/**
 * Bon Point — API v2 indépendante. Aucun appel à l'ancien Worker/Firebase.
 * Déploiement INACTIF par défaut : PAYMENTS_ENABLED=false.
 * Les créneaux sont confirmés hors ligne avec le parent avant toute proposition.
 */
import {handleSite,cleanupSiteData} from './site-services.js';
import {operations,bookingReminders} from './operations.js';
const BASE="https://bon-point.github.io/bon-point/";
const ORIGIN="https://bon-point.github.io";
const CORS={"access-control-allow-origin":ORIGIN,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type, Authorization","vary":"Origin"};
const RX_EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RX_MEET=/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i;
const levels=new Set(["6e","5e","4e","3e","seconde","premiere","terminale"]);
const gradesCollege=new Set(["6e","5e","4e","3e"]);
const now=()=>new Date().toISOString();
const json=(data,status=200,request)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","referrer-policy":"no-referrer",...(request?.headers.get("origin")===ORIGIN?CORS:{})}});
const fail=(message,status,req)=>json({error:message},status,req);
const bytes=x=>new Uint8Array(x);
const toHex=b=>Array.from(bytes(b),x=>x.toString(16).padStart(2,"0")).join("");
const token=()=>toHex(crypto.getRandomValues(new Uint8Array(32)));
async function digest(s){return toHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))}
function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function requestJSON(req){
  if(!req.headers.get("content-type")?.includes("application/json"))throw Error("JSON required");
  if(Number(req.headers.get("content-length")||0)>10000)throw Error("Too large");
  return req.json();
}
function enabled(env){const mode=env.STRIPE_MODE;const validKey=mode==="test"?env.STRIPE_SECRET_KEY?.startsWith("sk_test_"):mode==="live"&&env.STRIPE_SECRET_KEY?.startsWith("sk_live_");return env.PAYMENTS_ENABLED==="true" && env.REQUIRE_CONFIRMED_BOOKING==="true" && !!(validKey&&env.DB&&env.STRIPE_WEBHOOK_SECRET&&env.ADMIN_API_KEY&&env.MAIL_API_KEY&&env.MAIL_SENDER)}
function adminAllowed(req,env){
 const candidate=req.headers.get("X-Admin-Key")||"",known=env.ADMIN_API_KEY||"";
 if(candidate.length<32||known.length!==candidate.length)return false;
 let diff=0;for(let i=0;i<known.length;i++)diff|=known.charCodeAt(i)^candidate.charCodeAt(i);
 return diff===0;
}
async function email(env,to,subject,body){
 const r=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"content-type":"application/json","api-key":env.MAIL_API_KEY},
 body:JSON.stringify({sender:{email:env.MAIL_SENDER,name:"Bon Point"},to:[{email:to}],subject,htmlContent:body})});
 if(!r.ok)throw Error("Mail delivery failed "+r.status);
}
async function publicOffers(req,env){
 const rows=await env.DB.prepare("SELECT id,title,description,price_cents FROM offers WHERE active=1 ORDER BY sort_order ASC").all();
 return json({offers:rows.results,currency:"EUR",payment_available:enabled(env)},200,req);
}
async function adminUpdateOffer(req,env,id){
 if(!adminAllowed(req,env))return fail("Non autorisé",403,req);
 const existing=await env.DB.prepare("SELECT id FROM offers WHERE id=?").bind(id).first();
 if(!existing)return fail("Offre introuvable",404,req);
 const data=await requestJSON(req);
 const price=Number(data.price_cents);
 if(!Number.isSafeInteger(price)||price<100||price>1000000||typeof data.active!=="boolean")return fail("Prix en centimes invalide",400,req);
 await env.DB.prepare("UPDATE offers SET price_cents=?,active=?,updated_at=? WHERE id=?").bind(price,data.active?1:0,now(),id).run();
 return json({updated:true,id,price_cents:price,active:data.active},200,req);
}
async function adminProposal(req,env){
 if(!adminAllowed(req,env))return fail("Non autorisé",403,req);
 const d=await requestJSON(req),offer=await env.DB.prepare("SELECT * FROM offers WHERE id=? AND active=1").bind(String(d.offer||"")).first();
 const parentEmail=String(d.email||"").trim().toLowerCase();
 const grade=String(d.grade||"").trim().toLowerCase();
 const method=d.method==="discord"?"discord":"meet";
 const plan=d.plan==="monthly"||d.plan==="quarterly"?d.plan:"once";
 if(plan!=="once"&&!["brevet","bac"].includes(String(d.offer||"")))return fail("Échelonnement réservé aux programmes Excellence",400,req);
 if(!offer||!RX_EMAIL.test(parentEmail)||parentEmail.length>180||!levels.has(grade))return fail("Offre, classe ou contact invalide",400,req);
 if(gradesCollege.has(grade)&&method!=="meet")return fail("Collège : Google Meet uniquement",400,req);
 const meetUrl=typeof d.meet_url==="string"?d.meet_url.trim():"";
 if((method==="meet"&&!RX_MEET.test(meetUrl))||(method==="discord"&&meetUrl&& !RX_MEET.test(meetUrl)))return fail("Lien Google Meet nécessaire pour les cours Meet",400,req);
 const access=token(),orderId=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO orders(id,token_hash,offer_id,locked_price_cents,parent_email,grade,method,meet_url,expires_at,payment_plan,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'proposed',?)")
 .bind(orderId,await digest(access),offer.id,offer.price_cents,parentEmail,grade,method,meetUrl||null,new Date(Date.now()+7*86400000).toISOString(),plan,now()).run();
 return json({order_id:orderId,private_checkout_url:BASE+"checkout.html?token="+access},201,req);
}
async function proposal(req,env,url){
 const access=url.searchParams.get("token")||"";
 if(!/^[a-f0-9]{64}$/.test(access))return fail("Lien non valide",400,req);
 const row=await env.DB.prepare("SELECT o.*, f.title,f.description FROM orders o JOIN offers f ON o.offer_id=f.id WHERE o.token_hash=?").bind(await digest(access)).first();
 if(!row||Date.parse(row.expires_at)<Date.now())return fail("Proposition expirée",404,req);
 return json({offer:row.offer_id,title:row.title,description:row.description,amount:row.locked_price_cents,method:row.method,plan:row.payment_plan,status:row.state,active:enabled(env)&&row.state==="proposed"&&row.payment_plan==="once"},200,req);
}
async function stripeCheckout(env,order,offer,privateToken){
 const body=new URLSearchParams({
  "mode":"payment","payment_method_types[0]":"card",
  "customer_email":order.parent_email,
  "line_items[0][price_data][currency]":"eur",
  "line_items[0][price_data][unit_amount]":String(order.locked_price_cents),
  "line_items[0][price_data][product_data][name]":offer.title,
  "line_items[0][quantity]":"1",
  "metadata[order_id]":order.id,
  "client_reference_id":order.id,
  "success_url":BASE+"paiement-confirme.html",
  "cancel_url":BASE+"checkout.html?token="+privateToken
 });
 const res=await fetch("https://api.stripe.com/v1/checkout/sessions",{
  method:"POST",
  headers:{"Authorization":"Bearer "+env.STRIPE_SECRET_KEY,"content-type":"application/x-www-form-urlencoded","Idempotency-Key":"bonpoint-v2-"+order.id},
  body
 });
 const data=await res.json();
 if(!res.ok||!data.id||!/^https:\/\/checkout\.stripe\.com\//.test(data.url||""))throw Error("Stripe checkout creation failed");
 return data;
}
async function checkout(req,env){
 if(!enabled(env))return fail("Paiement en ligne non disponible",503,req);
 const d=await requestJSON(req),access=String(d.token||"");
 if(!/^[a-f0-9]{64}$/.test(access)||d.cgv_accepted!==true||d.parent_confirmed!==true)
  return fail("Validation du responsable légal et des CGV nécessaire",400,req);
 const order=await env.DB.prepare("SELECT * FROM orders WHERE token_hash=?").bind(await digest(access)).first();
 if(!order||Date.parse(order.expires_at)<Date.now())return fail("Lien expiré",404,req);
 if(order.state!=="proposed")return fail("Commande déjà traitée ou en cours",409,req);
 if(order.payment_plan!=="once")return fail("Paiement échelonné non activé : devis et modalités à confirmer par Bonpoint",409,req);
 const slot=await env.DB.prepare("SELECT starts_at_utc,status,parent_email,offer_id FROM booking_requests WHERE order_id=? AND session_type='course' LIMIT 1").bind(order.id).first();
 if(!slot||slot.status!=="confirmed"||slot.parent_email!==order.parent_email||slot.offer_id!==order.offer_id||!slot.starts_at_utc||Date.parse(slot.starts_at_utc)<Date.now()+49*3600000)return fail("Créneau confirmé au moins 49 h avant le cours nécessaire avant paiement",409,req);
 if(order.method==="discord"&&d.discord_age_confirmed!==true)return fail("Discord nécessite la confirmation des conditions d'âge par le parent",400,req);
 const offer=await env.DB.prepare("SELECT title FROM offers WHERE id=?").bind(order.offer_id).first();
 const reserved=await env.DB.prepare("UPDATE orders SET state='creating' WHERE id=? AND state='proposed'").bind(order.id).run();
 if(reserved.meta?.changes!==1)return fail("Commande déjà prise en charge",409,req);
 try{
  const session=await stripeCheckout(env,order,offer,access);
  await env.DB.prepare("UPDATE orders SET state='awaiting_payment',stripe_session_id=?,parent_terms_at=? WHERE id=? AND state='creating'")
    .bind(session.id,now(),order.id).run();
  return json({url:session.url},200,req);
 }catch(err){
  console.error("Stripe creation error",err);
  await env.DB.prepare("UPDATE orders SET state='proposed' WHERE id=? AND state='creating'").bind(order.id).run();
  return fail("Paiement indisponible : contactez Bon Point",503,req);
 }
}
async function verifyStripe(raw,header,secret){
 if(!header||!secret)return false;
 const entries=header.split(",").map(x=>x.trim());
 const ts=entries.find(x=>x.startsWith("t="))?.slice(2);
 const sigs=entries.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
 if(!ts||!/^\d+$/.test(ts)||sigs.length===0||Math.abs(Date.now()/1000-Number(ts))>300)return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const want=toHex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ts+"."+raw)));
 return sigs.some(s=>s.length===want.length&&[...s].reduce((mask,c,i)=>mask|(c.charCodeAt(0)^want.charCodeAt(i)),0)===0);
}
async function stripeWebhook(req,env){
 if(!env.DB||!env.STRIPE_WEBHOOK_SECRET)return fail("Pas configuré",503);
 const raw=await req.text();
 if(!await verifyStripe(raw,req.headers.get("stripe-signature"),env.STRIPE_WEBHOOK_SECRET))return fail("Signature incorrecte",400);
 const event=JSON.parse(raw);
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded"].includes(event.type))return json({received:true});
 const s=event.data?.object||{};
 if(s.payment_status!=="paid"||s.mode!=="payment")return json({received:true});
 if(typeof event.livemode!=="boolean"||event.livemode!==(env.STRIPE_MODE==="live"))return fail("Mode Stripe non concordant",409);
 const id=s.metadata?.order_id;
 if(!id)return fail("Commande non trouvée",409);
 const order=await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
 if(!order||order.stripe_session_id!==s.id||order.parent_email!==String(s.customer_details?.email||"").toLowerCase()||
  order.locked_price_cents!==s.amount_total||s.currency!=="eur")return fail("Paiement incohérent",409);
 if(!["awaiting_payment","paid"].includes(order.state))return fail("État de commande incorrect",409);
 await env.DB.batch([
  env.DB.prepare("UPDATE orders SET state='paid',paid_at=? WHERE id=? AND state='awaiting_payment'").bind(now(),id),
  env.DB.prepare("INSERT OR IGNORE INTO outbox(id,order_id,kind,state,created_at) VALUES(?,?,'confirmation','queued',?)").bind("confirm-"+id,id,now())
 ]);
 return json({received:true});
}
async function discordInvite(env){
 if(!env.DISCORD_BOT_TOKEN||!env.DISCORD_CHANNEL_ID)throw Error("Bot Discord absent");
 const r=await fetch("https://discord.com/api/v10/channels/"+encodeURIComponent(env.DISCORD_CHANNEL_ID)+"/invites",{
  method:"POST",headers:{"Authorization":"Bot "+env.DISCORD_BOT_TOKEN,"content-type":"application/json"},
  body:JSON.stringify({max_age:604800,max_uses:1,unique:true,temporary:true})
 });
 const d=await r.json();
 if(!r.ok||!d.code)throw Error("Invitation Discord indisponible");
 return "https://discord.gg/"+encodeURIComponent(d.code);
}
async function sendConfirmation(env,order){
 let link=order.meet_url;
 if(order.method==="discord"){
  link=order.discord_invite;
  if(!link){
   link=await discordInvite(env);
   await env.DB.prepare("UPDATE orders SET discord_invite=? WHERE id=?").bind(link,order.id).run();
  }
 }
 if(!link)throw Error("Lien de visio manquant");
 const title=safe(order.title),ref=safe(order.id),url=safe(link);
 let details=order.method==="meet"?"Lien Google Meet convenu avec le parent":"Invitation Discord individuelle à usage unique (respecter les conditions d'âge du service)";
 await email(env,order.parent_email,"Bon Point — Confirmation de paiement",
 "<p>Bonjour,</p><p>Votre paiement pour "+title+" est confirmé.</p><p>Référence : "+ref+"</p><p>"+details+" : <a href='"+url+"'>Accéder à la visioconférence</a></p><p>Les créneaux doivent être convenus avec le responsable légal avant le cours. Contact : soutien.bonpoint@gmail.com.</p>");
}
async function drainOutbox(env){
 // Recover timed-out leases. Delivery is at-least-once, not exactly-once.
 await env.DB.prepare("UPDATE outbox SET state='queued' WHERE state='sending' AND datetime(claimed_at) < datetime('now', '-15 minutes') AND attempts < 6").run();
 const rows=await env.DB.prepare("SELECT * FROM outbox WHERE state='queued' AND attempts < 6 ORDER BY created_at LIMIT 10").all();
 for(const row of rows.results){
  const lease=await env.DB.prepare("UPDATE outbox SET state='sending',attempts=attempts+1,claimed_at=? WHERE id=? AND state='queued'").bind(now(),row.id).run();
  if(lease.meta?.changes!==1)continue;
  try{
   if(row.kind==="confirmation"){
    const order=await env.DB.prepare("SELECT o.*, f.title FROM orders o JOIN offers f ON o.offer_id=f.id WHERE o.id=?").bind(row.order_id).first();
    if(!order||order.state!=="paid")throw Error("Commande non payée");
    await sendConfirmation(env,order);
   } else if(row.kind==="withdrawal"){
    const claim=await env.DB.prepare("SELECT * FROM withdrawals WHERE id=?").bind(row.order_id).first();
    if(!claim)throw Error("Rétractation inconnue");
    await email(env,claim.email,"Bon Point — Accusé de réception de rétractation",
    "<p>Votre demande de rétractation a été enregistrée.</p><p>Référence : "+safe(claim.id)+". Elle sera traitée dans les conditions légales applicables.</p>");
    await email(env,env.OWNER_EMAIL||env.MAIL_SENDER,"Bon Point — Nouvelle rétractation",
    "<p>Référence : "+safe(claim.id)+" ; adresse : "+safe(claim.email)+" ; commande : "+safe(claim.order_ref)+"</p>");
   }
   await env.DB.prepare("UPDATE outbox SET state='sent',sent_at=? WHERE id=?").bind(now(),row.id).run();
  }catch(err){
   console.error("Delivery failure",row.kind,err.message);
   await env.DB.prepare("UPDATE outbox SET state='queued' WHERE id=? AND state='sending'").bind(row.id).run();
  }
 }
}
async function withdrawal(req,env){
 if(!env.DB||!env.MAIL_API_KEY||!env.MAIL_SENDER)return fail("Service indisponible : utilisez le contact e-mail",503,req);
 const data=await requestJSON(req);
 const name=String(data.name||"").trim().slice(0,120),emailAddress=String(data.email||"").trim().toLowerCase(),ref=String(data.reference||"").trim().slice(0,120);
 if(name.length<2||!RX_EMAIL.test(emailAddress)||emailAddress.length>180)return fail("Identité ou e-mail invalide",400,req);
 const id=crypto.randomUUID();
 await env.DB.batch([
  env.DB.prepare("INSERT INTO withdrawals(id,name,email,order_ref,created_at) VALUES(?,?,?,?,?)").bind(id,name,emailAddress,ref,now()),
  env.DB.prepare("INSERT INTO outbox(id,order_id,kind,state,created_at) VALUES(?,?,'withdrawal','queued',?)").bind("withdraw-"+id,id,now())
 ]);
 return json({received:true,reference:id,note:"Votre notification est enregistrée ; un accusé sera envoyé par e-mail."},200,req);
}
export default{
 async fetch(req,env,ctx){
  const url=new URL(req.url);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:req.headers.get("origin")===ORIGIN?CORS:{}});
  try{
   const op=await operations(req,env,{json,fail,email,now,safe});
   if(op)return op;
   const extra=await handleSite(req,env,{json,fail,adminAllowed,email,now,safe});
   if(extra)return extra;
   if(req.method==="GET"&&url.pathname==="/health")return json({running:true,payment_enabled:!!enabled(env),stripe_mode:env.STRIPE_MODE||"not-set"},200,req);
   if(req.method==="GET"&&url.pathname==="/api/offers")return env.DB?publicOffers(req,env):fail("Non configuré",503,req);
   if(req.method==="GET"&&url.pathname==="/api/proposal")return env.DB?proposal(req,env,url):fail("Non configuré",503,req);
   if(req.method==="POST"&&url.pathname==="/api/checkout")return checkout(req,env);
   if(req.method==="POST"&&url.pathname==="/stripe/webhook"){const result=await stripeWebhook(req,env);if(result.ok && env.DB && env.MAIL_API_KEY)ctx.waitUntil(drainOutbox(env));return result}
   if(req.method==="POST"&&url.pathname==="/api/withdrawal"){const result=await withdrawal(req,env);if(result.ok && env.DB && env.MAIL_API_KEY)ctx.waitUntil(drainOutbox(env));return result}
   if(req.method==="POST"&&url.pathname==="/api/admin/proposals")return env.DB?adminProposal(req,env):fail("Non configuré",503,req);
   const m=url.pathname.match(/^\/api\/admin\/offers\/([a-z]+)$/);
   if(req.method==="POST"&&m)return env.DB?adminUpdateOffer(req,env,m[1]):fail("Non configuré",503,req);
   return fail("Introuvable",404,req);
  }catch(err){console.error("Request error",err.message);return fail("Service temporairement indisponible",500,req)}
 },
 async scheduled(event,env,ctx){if(env.DB)await cleanupSiteData(env);if(env.DB)await bookingReminders(env,{email,safe});if(env.DB&&env.MAIL_API_KEY)await drainOutbox(env)}
};
