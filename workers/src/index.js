// Bon Point — Backend Cloudflare Workers (prototype, non déployé)
// Activer seulement après vérification du compte Stripe, des CGV et des secrets.
const OFFERS={
 seance:{title:"Séance ciblée",amount:6500},progression:{title:"Progression",amount:24900},
 ambition:{title:"Ambition",amount:44900},brevet:{title:"Brevet Excellence",amount:79000},
 bac:{title:"Bac Excellence",amount:129000}
};
const SITE="https://bon-point.github.io/bon-point/";
const ORIGIN="https://bon-point.github.io";
function response(data,status=200,headers={}){
 return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store",...headers}});
}
function headers(req){return req.headers.get("origin")===ORIGIN?{"access-control-allow-origin":ORIGIN,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type","vary":"Origin"}:{"vary":"Origin"}}
function fail(req,code,msg){return response({error:msg},code,headers(req))}
function active(e){return e.ENABLE_CHECKOUT==="true" && e.DB && e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET && e.ADMIN_API_KEY && e.BREVO_API_KEY && e.BREVO_FROM}
function random(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("")}
function hex(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function hash(text){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))}
async function json(req){if(!req.headers.get("content-type")?.includes("application/json")||+(req.headers.get("content-length")||0)>10000)throw Error("Invalid JSON");return req.json()}
function validEmail(email){return typeof email==="string"&&email.length<=180&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
function safe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function sendEmail(e,to,subject,content){
 const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"Content-Type":"application/json","api-key":e.BREVO_API_KEY},
 body:JSON.stringify({sender:{email:e.BREVO_FROM,name:"Bon Point"},to:[{email:to}],subject,htmlContent:content})});
 if(!r.ok)throw Error("Brevo "+r.status);
}
async function stripe(e,values){
 const r=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{"Authorization":"Bearer "+e.STRIPE_SECRET_KEY,"Content-Type":"application/x-www-form-urlencoded"},
 body:new URLSearchParams(values)});
 const d=await r.json();if(!r.ok)throw Error("Stripe "+r.status);return d;
}
async function verifySignature(body,header,secret){
 if(!header||!secret)return false;
 const parts=header.split(",").map(x=>x.trim()),ts=parts.find(x=>x.startsWith("t="))?.slice(2);
 const signatures=parts.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
 if(!ts||!/^\d+$/.test(ts)||Math.abs(Date.now()/1000-Number(ts))>300)return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const expected=hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ts+"."+body)));
 return signatures.some(s=>s.length===expected.length&&[...s].reduce((acc,c,i)=>acc|(c.charCodeAt(0)^expected.charCodeAt(i)),0)===0);
}
async function discordInvite(e){
 if(!e.DISCORD_BOT_TOKEN||!e.DISCORD_CHANNEL_ID)throw Error("Discord non configuré");
 const r=await fetch("https://discord.com/api/v10/channels/"+encodeURIComponent(e.DISCORD_CHANNEL_ID)+"/invites",{
 method:"POST",headers:{"Authorization":"Bot "+e.DISCORD_BOT_TOKEN,"Content-Type":"application/json"},
 body:JSON.stringify({max_age:604800,max_uses:1,temporary:true,unique:true})});
 const d=await r.json();if(!r.ok||!d.code)throw Error("Discord "+r.status);
 return "https://discord.gg/"+encodeURIComponent(d.code);
}
async function fulfill(e,order){
 if(order.emailed)return;
 let invite=order.discord_invite;
 if(order.delivery==="discord"&&!invite){
  invite=await discordInvite(e);
  await e.DB.prepare("UPDATE orders SET discord_invite=? WHERE id=?").bind(invite,order.id).run();
 }
 let msg="<p>Bonjour,</p><p>Votre paiement Bon Point est confirmé. Offre : "+safe(OFFERS[order.offer].title)+". Référence : "+safe(order.id)+".</p>";
 if(order.delivery==="discord")msg+="<p>Pour un participant ayant l'âge requis pour Discord, voici une invitation individuelle à usage unique valable jusqu'à 7 jours : <a href='"+safe(invite)+"'>Rejoindre Discord</a>.</p>";
 else msg+="<p>Les informations de connexion pour la visio adaptée à l'élève vous seront transmises directement. Aucun compte Discord n'est nécessaire.</p>";
 msg+="<p>Les créneaux sont ceux convenus avec le parent avant le paiement. Contact : soutien.bonpoint@gmail.com.</p>";
 await sendEmail(e,order.email,"Bon Point — Paiement confirmé",msg);
 await e.DB.prepare("UPDATE orders SET emailed=1 WHERE id=? AND status='paid'").bind(order.id).run();
}
async function webhook(req,e){
 if(!e.DB||!e.STRIPE_WEBHOOK_SECRET)return response({error:"unavailable"},503);
 const raw=await req.text();
 if(!await verifySignature(raw,req.headers.get("stripe-signature"),e.STRIPE_WEBHOOK_SECRET))return response({error:"signature invalide"},400);
 const event=JSON.parse(raw);
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type))return response({received:true});
 const obj=event.data?.object||{},id=obj.metadata?.order_id;
 if(obj.payment_status!=="paid"||obj.mode!=="payment")return response({received:true});
 if(!id)return response({error:"order id missing"},400);
 let order=await e.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
 if(!order)return response({error:"unknown order"},409);
 if(!OFFERS[order.offer]||obj.id!==order.session_id||obj.currency!=="eur"||
 obj.amount_total!==OFFERS[order.offer].amount || obj.customer_details?.email?.toLowerCase()!==order.email.toLowerCase())
 return response({error:"mismatch"},409);
 if(order.status==="checkout_open")await e.DB.prepare("UPDATE orders SET status='paid',paid_at=datetime('now') WHERE id=? AND status='checkout_open'").bind(id).run();
 order=await e.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
 if(order.status!=="paid")return response({error:"invalid status"},409);
 await fulfill(e,order); // If email fails, return 5xx so Stripe retries.
 return response({received:true});
}
async function adminProposal(req,e){
 if(!e.DB||!e.ADMIN_API_KEY)return fail(req,503,"Non configuré");
 const provided=req.headers.get("X-Admin-Key")||"";
 if(provided.length!==e.ADMIN_API_KEY.length||[...provided].reduce((a,c,i)=>a|(c.charCodeAt(0)^e.ADMIN_API_KEY.charCodeAt(i)),0)!==0)return fail(req,403,"Interdit");
 const data=await json(req),offer=OFFERS[data.offer],email=String(data.email||"").trim().toLowerCase();
 if(!offer||!validEmail(email)||!["discord","alternative"].includes(data.delivery))return fail(req,400,"Offre, parent ou modalité invalide");
 const token=random(),id=crypto.randomUUID(),expires=new Date(Date.now()+7*86400000).toISOString();
 await e.DB.prepare("INSERT INTO orders (id,token_hash,offer,email,delivery,expires_at,status) VALUES(?,?,?,?,?,?,'proposed')").bind(id,await hash(token),data.offer,email,data.delivery,expires).run();
 return response({order_id:id,checkout_url:SITE+"checkout.html?token="+token,expires},201);
}
async function publicProposal(req,e,url){
 if(!e.DB)return fail(req,503,"Base non configurée");
 const token=url.searchParams.get("token")||"";
 if(!/^[a-f0-9]{64}$/.test(token))return fail(req,400,"Lien invalide");
 const order=await e.DB.prepare("SELECT * FROM orders WHERE token_hash=?").bind(await hash(token)).first();
 if(!order||Date.parse(order.expires_at)<Date.now())return fail(req,404,"Lien expiré");
 return response({offer:order.offer,title:OFFERS[order.offer].title,amount:OFFERS[order.offer].amount,
 status:order.status,expires:order.expires_at,active:!!active(e)},200,headers(req));
}
async function checkout(req,e){
 if(!active(e))return fail(req,503,"Paiement en cours de configuration");
 const data=await json(req),token=String(data.token||"");
 if(!/^[a-f0-9]{64}$/.test(token)||data.cgv_accepted!==true||data.parent_confirmed!==true)return fail(req,400,"Validation nécessaire");
 const order=await e.DB.prepare("SELECT * FROM orders WHERE token_hash=?").bind(await hash(token)).first();
 if(!order||Date.parse(order.expires_at)<Date.now())return fail(req,404,"Lien expiré");
 if(order.status!=="proposed")return fail(req,409,"Commande déjà prise en charge");
 const reserved=await e.DB.prepare("UPDATE orders SET status='starting' WHERE id=? AND status='proposed'").bind(order.id).run();
 if(reserved.meta?.changes!==1)return fail(req,409,"Commande en cours");
 try{
 const offer=OFFERS[order.offer];
 const dataStripe=await stripe(e,{
 mode:"payment",customer_email:order.email,"payment_method_types[0]":"card",
 "line_items[0][price_data][currency]":"eur","line_items[0][price_data][unit_amount]":String(offer.amount),
 "line_items[0][price_data][product_data][name]":offer.title,"line_items[0][quantity]":"1",
 "metadata[order_id]":order.id,success_url:SITE+"paiement-confirme.html?session_id={CHECKOUT_SESSION_ID}",
 cancel_url:SITE+"checkout.html?token="+token
 });
 if(!dataStripe.id||!dataStripe.url)throw Error("Stripe did not return checkout");
 await e.DB.prepare("UPDATE orders SET status='checkout_open',session_id=? WHERE id=? AND status='starting'").bind(dataStripe.id,order.id).run();
 return response({url:dataStripe.url},200,headers(req));
 }catch(err){
  console.error("Unable to create checkout",err);
  await e.DB.prepare("UPDATE orders SET status='proposed' WHERE id=? AND status='starting'").bind(order.id).run();
  return fail(req,503,"Paiement temporairement indisponible");
 }
}
async function withdrawal(req,e){
 if(!e.DB||!e.BREVO_API_KEY||!e.BREVO_FROM)return fail(req,503,"Écrivez à soutien.bonpoint@gmail.com");
 const data=await json(req),name=String(data.name||"").trim().slice(0,120),email=String(data.email||"").trim().toLowerCase(),reference=String(data.reference||"").trim().slice(0,120);
 if(name.length<2||!validEmail(email))return fail(req,400,"Coordonnées invalides");
 const id=crypto.randomUUID();
 await e.DB.prepare("INSERT INTO withdrawals(id,name,email,order_ref) VALUES(?,?,?,?)").bind(id,name,email,reference).run();
 try{
 await sendEmail(e,email,"Bon Point — Accusé de réception de rétractation","<p>Votre notification de rétractation a été reçue. Référence : "+safe(id)+".</p><p>Son traitement dépend des conditions légales applicables au contrat.</p>");
 await sendEmail(e,e.ADMIN_NOTIFY_EMAIL||e.BREVO_FROM,"Bon Point — Nouvelle rétractation","<p>Référence : "+safe(id)+"</p><p>Parent : "+safe(name)+"</p><p>Contact : "+safe(email)+"</p><p>Commande : "+safe(reference)+"</p>");
 await e.DB.prepare("UPDATE withdrawals SET acknowledged=1 WHERE id=?").bind(id).run();
 return response({received:true,reference:id},200,headers(req));
 }catch(err){console.error("Retraction receipt failed",err);return fail(req,503,"Notification enregistrée mais accusé électronique indisponible. Contactez Bon Point en donnant la référence : "+id)}
}
export default {async fetch(req,env){
 const url=new URL(req.url);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
 try{
  if(req.method==="GET"&&url.pathname==="/health")return response({ready:!!active(env),environment:env.STRIPE_SECRET_KEY?.startsWith("sk_test_")?"test":"unknown"},200,headers(req));
  if(req.method==="POST"&&url.pathname==="/stripe/webhook")return await webhook(req,env);
  if(req.method==="POST"&&url.pathname==="/api/admin/proposals")return await adminProposal(req,env);
  if(req.method==="GET"&&url.pathname==="/api/proposal")return await publicProposal(req,env,url);
  if(req.method==="POST"&&url.pathname==="/api/checkout")return await checkout(req,env);
  if(req.method==="POST"&&url.pathname==="/api/withdrawal")return await withdrawal(req,env);
  return fail(req,404,"Page non trouvée");
 }catch(err){console.error("Backend error",err);return fail(req,500,"Erreur interne")}
}};
