/** Bon Point : calendrier et espace administrateur, inactifs sans prérequis. */
const ORIGIN="https://bon-point.github.io",DURATION={intro:20,course:60};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GRADES=new Set(["6e","5e","4e","3e","Seconde","Première","Terminale"]);
const SUBJECTS=new Set(["Mathématiques","Physique-Chimie","Les deux"]);
const OFFERS=new Set(["seance","progression","ambition","brevet","bac"]);
const safeString=(x,max=600)=>typeof x==="string"?x.trim().slice(0,max):"";
const normalEmail=x=>safeString(x,180).toLowerCase();
const utcNow=()=>new Date().toISOString();
const future=(m)=>new Date(Date.now()+m*60_000).toISOString();
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,"0")).join("");
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function sha(s){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))))}
function enabledIntake(e){return e.SITE_INTAKE_ENABLED==="true"&&e.DB&&e.TURNSTILE_SECRET&&e.TURNSTILE_SITE_KEY&&e.MAIL_API_KEY&&e.MAIL_SENDER}
function enabledStaff(e){return e.ADMIN_PANEL_ENABLED==="true"&&e.DB&&e.MAIL_API_KEY&&e.MAIL_SENDER&&e.ADMIN_LOGIN_PASSWORD?.length>=24&&EMAIL.test(e.ADMIN_LOGIN_EMAIL||"")&&e.ADMIN_AUTH_SECRET?.length>=32}
function allowed(req){return req.headers.get("origin")===ORIGIN}
async function jsonBody(req){
 if(!req.headers.get("content-type")?.includes("application/json"))throw Error("JSON required");
 const text=await req.text();if(text.length>8000)throw Error("Request too large");
 const x=JSON.parse(text);if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Invalid JSON");
 return x;
}
async function turnstile(d,e){
 const token=safeString(d.turnstile_token,3000);
 if(!token)return false;
 const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret:e.TURNSTILE_SECRET,response:token})});
 if(!r.ok)return false;const v=await r.json();return v.success===true&&v.hostname==="bon-point.github.io";
}
// UTC d'une date et heure murales de Paris, y compris les changements d'heure.
function parisToUTC(day,time){
 if(!/^20\d\d-\d\d-\d\d$/.test(day)||!/^([01]\d|2[0-3]):(00|30)$/.test(time))return null;
 const [y,m,d]=day.split("-").map(Number),[hour,minute]=time.split(":").map(Number);
 const base=Date.UTC(y,m-1,d,hour,minute);
 const check=new Date(Date.UTC(y,m-1,d,12));
 if(Number.isNaN(base)||check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;
 const name=new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Paris",timeZoneName:"shortOffset"}).formatToParts(check).find(x=>x.type==="timeZoneName")?.value;
 const mm=name?.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
 if(!mm)return null;
 const offset=(mm[1]==="+"?1:-1)*(Number(mm[2])*60+Number(mm[3]||0));
 const exact=base-offset*60000;
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(exact));
 const get=k=>parts.find(p=>p.type===k)?.value;
 if([get("year"),get("month"),get("day")].join("-")!==day||get("hour")+":"+get("minute")!==time)return null;
 return new Date(exact).toISOString();
}
function acceptedSchedule(day,time,kind='intro'){
 const [hh,mm]=time.split(":").map(Number),clock=hh*60+mm;
 const n=new Date(day+"T12:00:00Z").getUTCDay();
 if(n===0||n===6)return clock>=8*60&&clock+(kind==='course'?60:20)<=18*60;
 if(n===4)return clock>=13*60+30&&clock<=22*60;
 return clock>=18*60&&clock<=22*60;
}
function validSlot(date,time,kind='intro'){const iso=parisToUTC(date,time);return iso&&Date.parse(iso)>=Date.now()+48*3600000&&Date.parse(iso)<Date.now()+91*86400000&&acceptedSchedule(date,time,kind)?iso:null}
async function booking(req,env,h){
 if(!enabledIntake(env))return h.fail("Les demandes automatiques sont désactivées. Utilisez l'e-mail.",503,req);
 if(!allowed(req))return h.fail("Origine invalide",403,req);
 const d=await jsonBody(req);
 const name=safeString(d.parent_name,90),email=normalEmail(d.email),grade=safeString(d.grade,30),subject=safeString(d.subject,40);
 const date=safeString(d.date,10),time=safeString(d.time,5),notes=safeString(d.notes,450),kind=safeString(d.session_type,12),offer=safeString(d.offer,25);
 const starts=validSlot(date,time,kind);
 if(d.parent_confirmed!==true||name.length<2||!EMAIL.test(email)||!GRADES.has(grade)||!SUBJECTS.has(subject)||!DURATION[kind]||kind==="course"&&!OFFERS.has(offer)||!starts)return h.fail("Créneau ou informations invalides (48 h minimum).",400,req);
 if(!await turnstile(d,env))return h.fail("Vérification anti-robot nécessaire",400,req);
 const hourly=await env.DB.prepare("SELECT count(*) AS n FROM booking_requests WHERE parent_email=? AND created_at>?").bind(email,future(-60)).first();
 if(Number(hourly?.n||0)>=3)return h.fail("Trop de demandes récentes.",429,req);
 const id=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO booking_requests(id,parent_email,parent_name,grade,subject,requested_date,period,notes,status,created_at,time_local,starts_at_utc,session_type,offer_id,reminder_due_at) VALUES(?,?,?,?,?,?,?,?, 'requested',?,?,?,?,?,?)")
 .bind(id,email,name,grade,subject,date,time,notes,utcNow(),time,starts,kind,kind==="course"?offer:null,new Date(Date.parse(starts)-(48*60+30)*60000).toISOString()).run();
 try{await h.email(env,env.OWNER_EMAIL||env.MAIL_SENDER,"Bon Point — Nouveau créneau demandé","<p>Nouvelle proposition de rendez-vous à confirmer.</p><p>"+h.safe(date)+" à "+h.safe(time)+" (Paris), "+h.safe(kind==="intro"?"premier échange":"cours")+".</p><p>Référence : "+h.safe(id)+"</p><p>Parent : "+h.safe(email)+"</p>")}
 catch(err){console.error("Booking email failed",err.message)}
 return h.json({received:true,confirmed:false,reference:id},201,req);
}
async function session(req,env){
 const raw=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!/^[a-f0-9]{64}$/.test(raw))return null;
 const row=await env.DB.prepare("SELECT email FROM admin_sessions WHERE token_hash=? AND expires_at>?").bind(await sha(raw),utcNow()).first();
 return row?.email===normalEmail(env.ADMIN_LOGIN_EMAIL)?row:null;
}
async function rateGate(env,req){
 const ip=req.headers.get("cf-connecting-ip")||"unknown";
 const key=await sha(ip+":"+env.ADMIN_AUTH_SECRET),since=future(-60);
 const prev=await env.DB.prepare("SELECT * FROM admin_login_attempts WHERE ip_hash=?").bind(key).first();
 if(prev&&prev.window_started>since&&prev.attempts>=6)return false;
 await env.DB.prepare("INSERT INTO admin_login_attempts(ip_hash,attempts,window_started) VALUES(?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN window_started<? THEN 1 ELSE attempts+1 END,window_started=CASE WHEN window_started<? THEN excluded.window_started ELSE window_started END").bind(key,utcNow(),since,since).run();
 return true;
}
async function staffLogin(req,env,h){
 if(!enabledStaff(env))return h.fail("Administration en préparation",503,req);
 if(!allowed(req))return h.fail("Origine refusée",403,req);
 if(!await rateGate(env,req))return h.fail("Trop d'essais. Revenez dans une heure.",429,req);
 const d=await jsonBody(req);const email=normalEmail(d.email),password=safeString(d.password,256);
 const same=await sha(password+env.ADMIN_AUTH_SECRET)===await sha(env.ADMIN_LOGIN_PASSWORD+env.ADMIN_AUTH_SECRET);
 if(email!==normalEmail(env.ADMIN_LOGIN_EMAIL)||!same)return h.fail("Identifiants incorrects",401,req);
 const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
 const digest=await sha(email+":"+code+":"+env.ADMIN_AUTH_SECRET);
 await env.DB.prepare("INSERT INTO admin_login_codes(email,code_hash,sent_at,expires_at,attempts) VALUES(?,?,?,?,0) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,sent_at=excluded.sent_at,expires_at=excluded.expires_at,attempts=0").bind(email,digest,utcNow(),future(10)).run();
 await h.email(env,email,"Bon Point — Code administrateur","<p>Code de connexion à l'administration : <strong>"+code+"</strong>.</p><p>Expire après 10 minutes. Ne le communiquez jamais.</p>");
 return h.json({challenge_sent:true},200,req);
}
async function staffVerify(req,env,h){
 if(!enabledStaff(env))return h.fail("Administration inactive",503,req);
 if(!allowed(req))return h.fail("Origine refusée",403,req);
 const d=await jsonBody(req),email=normalEmail(d.email),code=safeString(d.code,6);
 if(email!==normalEmail(env.ADMIN_LOGIN_EMAIL)||!/^[0-9]{6}$/.test(code))return h.fail("Code invalide",401,req);
 const row=await env.DB.prepare("SELECT * FROM admin_login_codes WHERE email=?").bind(email).first();
 if(!row||row.attempts>=5||Date.parse(row.expires_at)<Date.now())return h.fail("Code invalide ou expiré",401,req);
 if(row.code_hash!==await sha(email+":"+code+":"+env.ADMIN_AUTH_SECRET)){
 await env.DB.prepare("UPDATE admin_login_codes SET attempts=attempts+1 WHERE email=?").bind(email).run();
 return h.fail("Code invalide ou expiré",401,req);
 }
 const token=random();
 await env.DB.batch([
  env.DB.prepare("DELETE FROM admin_login_codes WHERE email=?").bind(email),
  env.DB.prepare("INSERT INTO admin_sessions(token_hash,email,created_at,expires_at) VALUES(?,?,?,?)").bind(await sha(token),email,utcNow(),future(60))
 ]);
 return h.json({access_token:token,expires_in:3600},200,req);
}
async function issueParentCode(req,env,h){
 if(env.PARENT_PORTAL_ENABLED!=="true"||!env.PARENT_AUTH_SECRET?.length)return h.fail("L'accès parents n'est pas activé",503,req);
 const d=await jsonBody(req),email=normalEmail(d.email);
 const parent=await env.DB.prepare("SELECT email FROM parent_accounts WHERE email=? AND active=1").bind(email).first();
 if(!parent)return h.fail("Compte parent inconnu",404,req);
 const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,"0");
 const hashed=await sha(email+":"+code+":"+env.PARENT_AUTH_SECRET);
 await env.DB.prepare("INSERT INTO parent_login_codes(email,code_hash,sent_at,expires_at,attempts) VALUES(?,?,?,?,0) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,sent_at=excluded.sent_at,expires_at=excluded.expires_at,attempts=0").bind(email,hashed,utcNow(),future(10)).run();
 await h.email(env,email,"Bon Point — Votre code de connexion","<p>Votre code temporaire Bon Point : <strong>"+code+"</strong>.</p><p>Valable 10 minutes. Ce code donne accès à votre espace parent privé. Ne le partagez pas.</p>");
 return h.json({sent:true},200,req);
}
async function staffRoute(req,env,h,url){
 if(!enabledStaff(env))return h.fail("Administration désactivée",503,req);
 if(!allowed(req))return h.fail("Origine refusée",403,req);
 const staff=await session(req,env);if(!staff)return h.fail("Connexion administrateur requise",401,req);
 const path=url.pathname;
 if(path==="/api/staff/logout"&&req.method==="POST"){
  const raw=req.headers.get("authorization").replace(/^Bearer\s+/i,"");
  await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await sha(raw)).run();
  return h.json({ok:true},200,req);
 }
 if(path==="/api/staff/bookings"&&req.method==="GET"){
  const v=await env.DB.prepare("SELECT id,parent_email,parent_name,grade,subject,requested_date,time_local,starts_at_utc,session_type,offer_id,status,order_id,reminder_sent_at FROM booking_requests ORDER BY created_at DESC LIMIT 100").all();
  return h.json({bookings:v.results},200,req);
 }
 const bookingMatch=path.match(/^\/api\/staff\/bookings\/([a-f0-9-]{36})$/);
 if(bookingMatch&&req.method==="POST"){
  const d=await jsonBody(req),status=safeString(d.status,15),id=bookingMatch[1];
  if(!["confirmed","declined"].includes(status))return h.fail("Statut invalide",400,req);
  const item=await env.DB.prepare("SELECT * FROM booking_requests WHERE id=?").bind(id).first();
  if(!item)return h.fail("Demande introuvable",404,req);
  if(status==="confirmed"){
   if(!item.starts_at_utc||Date.parse(item.starts_at_utc)<Date.now()+50*3600000)return h.fail("Au moins 50 h nécessaires pour confirmer et assurer le rappel J-2.",409,req);
   const nearby=await env.DB.prepare("SELECT id FROM booking_requests WHERE id!=? AND status='confirmed' AND starts_at_utc>? AND starts_at_utc<? LIMIT 1").bind(id,new Date(Date.parse(item.starts_at_utc)-60*60000).toISOString(),new Date(Date.parse(item.starts_at_utc)+60*60000).toISOString()).first();
   if(nearby)return h.fail("Conflit avec un cours confirmé.",409,req);
  }
  await env.DB.prepare("UPDATE booking_requests SET status=? WHERE id=?").bind(status,id).run();
  return h.json({updated:true,status},200,req);
 }
 if(path==="/api/staff/parents"&&req.method==="POST"){
  const d=await jsonBody(req),email=normalEmail(d.email),displayName=safeString(d.display_name,90);
  if(!EMAIL.test(email)||displayName.length<2||typeof d.active!=="boolean")return h.fail("Compte invalide",400,req);
  await env.DB.prepare("INSERT INTO parent_accounts(email,display_name,active,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,active=excluded.active").bind(email,displayName,d.active?1:0,utcNow()).run();
  if(!d.active)await env.DB.prepare("DELETE FROM parent_sessions WHERE email=?").bind(email).run();
  return h.json({saved:true},200,req);
 }
 if(path==="/api/staff/parent-code"&&req.method==="POST")return issueParentCode(req,env,h);
 if(path==="/api/staff/proposals"&&req.method==="POST"){
  const d=await jsonBody(req),bookingId=safeString(d.booking_id,36),link=safeString(d.meet_url,140),plan=safeString(d.plan,15)||"once";
  if(!/^[0-9a-f-]{36}$/i.test(bookingId)||!/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(link)||plan!=="once")
   return h.fail("Réservation, lien Google Meet ou règlement invalide",400,req);
  const b=await env.DB.prepare("SELECT * FROM booking_requests WHERE id=? AND session_type='course' AND status='confirmed'").bind(bookingId).first();
  if(!b||b.order_id||!b.starts_at_utc||Date.parse(b.starts_at_utc)<Date.now()+49*3600000)return h.fail("Séance non confirmée ou créneau trop proche",409,req);
  const offer=await env.DB.prepare("SELECT id,price_cents FROM offers WHERE id=? AND active=1").bind(b.offer_id).first();
  if(!offer)return h.fail("Offre indisponible",404,req);
  const grade=({Seconde:"seconde","Première":"premiere",Terminale:"terminale"})[b.grade]||b.grade;
  const access=random(),orderId=crypto.randomUUID();
  await env.DB.batch([
   env.DB.prepare("INSERT INTO orders(id,token_hash,offer_id,locked_price_cents,parent_email,grade,method,meet_url,expires_at,payment_plan,state,created_at) VALUES(?,?,?,?,? ,?,'meet',?,?,'once','proposed',?)")
     .bind(orderId,await sha(access),offer.id,offer.price_cents,b.parent_email,grade,link,future(7*24*60),utcNow()),
   env.DB.prepare("UPDATE booking_requests SET order_id=? WHERE id=? AND order_id IS NULL AND status='confirmed'").bind(orderId,bookingId)
  ]);
  const url="https://bon-point.github.io/bon-point/checkout.html?token="+access;
  if(d.notify_parent===true){
   if(env.PAYMENTS_ENABLED!=="true")return h.json({created:true,private_checkout_url:url,not_sent:true,note:"Aucun e-mail de paiement envoyé car le paiement est désactivé."},201,req);
   await h.email(env,b.parent_email,"Bon Point — Proposition nominative à examiner","<p>Bonjour,</p><p>Votre créneau du "+h.safe(b.requested_date)+" à "+h.safe(b.time_local)+" est confirmé sous réserve du règlement de la prestation.</p><p>Vous pouvez consulter votre proposition nominative, les conditions générales et procéder au règlement ici : <a href='"+url+"'>Voir ma proposition</a>.</p><p>La proposition ne constitue pas un abonnement automatique.</p>");
  }
  return h.json({created:true,order_id:orderId,private_checkout_url:url},201,req);
 }

 if(path==="/api/staff/progress"&&req.method==="POST"){
  const d=await jsonBody(req),email=normalEmail(d.email),subject=safeString(d.subject,40),date=safeString(d.session_date,10),summary=safeString(d.summary,700),next=safeString(d.next_step,500);
  if(!EMAIL.test(email)||!SUBJECTS.has(subject)||!/^20\d\d-\d\d-\d\d$/.test(date)||summary.length<3)return h.fail("Compte rendu incomplet",400,req);
  const p=await env.DB.prepare("SELECT email FROM parent_accounts WHERE email=? AND active=1").bind(email).first();
  if(!p)return h.fail("Compte parent non activé",404,req);
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO progress_entries(id,parent_email,session_date,subject,summary,next_step,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,email,date,subject,summary,next,utcNow()).run();
  return h.json({saved:true,id},201,req);
 }
 if(path==="/api/staff/reports"&&req.method==="POST")return uploadReport(req,env,h);
 if(path==="/api/staff/orders"&&req.method==="GET"){
  const rows=await env.DB.prepare("SELECT o.id,o.parent_email,o.offer_id,f.title,o.state,o.locked_price_cents,o.created_at,o.paid_at FROM orders o JOIN offers f ON f.id=o.offer_id ORDER BY o.created_at DESC LIMIT 100").all();
  return h.json({orders:rows.results},200,req);
 }
 const linkMatch=path.match(/^\/api\/staff\/bookings\/([a-f0-9-]{36})\/order$/);
 if(linkMatch&&req.method==="POST"){
  const d=await jsonBody(req),orderId=safeString(d.order_id,36);
  const item=await env.DB.prepare("SELECT * FROM booking_requests WHERE id=? AND session_type='course' AND status='confirmed'").bind(linkMatch[1]).first();
  const order=await env.DB.prepare("SELECT id,parent_email,offer_id,state FROM orders WHERE id=?").bind(orderId).first();
  if(!item||!order||normalEmail(item.parent_email)!==normalEmail(order.parent_email)||item.offer_id!==order.offer_id)return h.fail("Réservation et commande incompatibles",400,req);
  await env.DB.prepare("UPDATE booking_requests SET order_id=? WHERE id=? AND (order_id IS NULL OR order_id=?)").bind(orderId,item.id,orderId).run();
  return h.json({linked:true},200,req);
 }
 return h.fail("Action administrateur inconnue",404,req);
}
async function uploadReport(req,env,h){
 if(env.REPORT_UPLOADS_ENABLED!=="true"||!env.DB)return h.fail("Dépôt de fichiers privés non disponible",503,req);
 if(!req.headers.get("content-type")?.startsWith("multipart/form-data"))return h.fail("Un PDF est requis",400,req);
 if(Number(req.headers.get("content-length")||0)>5_600_000)return h.fail("Fichier trop volumineux",413,req);
 const form=await req.formData();
 const progressId=safeString(form.get("progress_id"),36),file=form.get("file");
 if(!/^[0-9a-f-]{36}$/i.test(progressId)||!file||typeof file.arrayBuffer!=="function"||file.size<8||file.size>700_000)return h.fail("Fichier PDF ou compte rendu invalide (700 Ko max)",400,req);
 const signature=new Uint8Array(await file.slice(0,5).arrayBuffer());
 if(String.fromCharCode(...signature)!=="%PDF-")return h.fail("Seuls les PDF sont acceptés",415,req);
 const progress=await env.DB.prepare("SELECT id,parent_email FROM progress_entries WHERE id=?").bind(progressId).first();
 if(!progress)return h.fail("Compte rendu introuvable",404,req);
 const id=crypto.randomUUID(),key="reports/"+id+".pdf",name=safeString(file.name,150).replace(/[\\/<>:"|?*]/g,"_")||"compte-rendu.pdf";
 const bytes=new Uint8Array(await file.arrayBuffer());let encoded="";
 for(let i=0;i<bytes.length;i+=24576)encoded+=btoa(String.fromCharCode(...bytes.subarray(i,i+24576)));
 await env.DB.batch([
  env.DB.prepare("INSERT INTO session_files(id,progress_id,parent_email,file_name,content_type,size_bytes,r2_key,created_at) VALUES(?,?,?,?,'application/pdf',?,?,?)").bind(id,progressId,progress.parent_email,name,file.size,"d1:"+id,utcNow()),
  env.DB.prepare("INSERT INTO session_file_blobs(file_id,content_base64) VALUES(?,?)").bind(id,encoded)
 ]);
 return h.json({saved:true,id,name},201,req);
}
async function readReport(req,env,h,path){
 if(env.PARENT_PORTAL_ENABLED!=="true"||!env.DB)return h.fail("Documents privés indisponibles",503,req);
 if(!allowed(req))return h.fail("Origine invalide",403,req);
 const auth=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!/^[a-f0-9]{64}$/.test(auth))return h.fail("Accès non autorisé",401,req);
 const user=await env.DB.prepare("SELECT a.email FROM parent_sessions s JOIN parent_accounts a ON a.email=s.email WHERE s.token_hash=? AND s.expires_at>? AND a.active=1").bind(await sha(auth),utcNow()).first();
 if(!user)return h.fail("Session expirée",401,req);
 const id=path.split("/").pop();
 if(!/^[a-f0-9-]{36}$/.test(id))return h.fail("Fichier introuvable",404,req);
 const entry=await env.DB.prepare("SELECT r2_key,file_name FROM session_files WHERE id=? AND parent_email=?").bind(id,user.email).first();
 if(!entry)return h.fail("Fichier introuvable",404,req);
 if(!entry.r2_key.startsWith("d1:"))return h.fail("Fichier indisponible",503,req);
 const data=await env.DB.prepare("SELECT content_base64 FROM session_file_blobs WHERE file_id=?").bind(id).first();
 if(!data)return h.fail("Fichier introuvable",404,req);
 const raw=atob(data.content_base64),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new Response(bytes,{status:200,headers:{"content-type":"application/pdf","content-disposition":"attachment; filename=\"compte-rendu.pdf\"","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","access-control-allow-origin":ORIGIN,"vary":"Origin"}});
}
export const schedulingPolicy=Object.freeze({parisToUTC,acceptedSchedule,validSlot});
export async function operations(req,env,h){
 const path=new URL(req.url).pathname;
 if(path==="/api/site/bookings"&&req.method==="POST")return booking(req,env,h);
 if(path==="/api/staff/login"&&req.method==="POST")return staffLogin(req,env,h);
 if(path==="/api/staff/verify"&&req.method==="POST")return staffVerify(req,env,h);
 if(path.startsWith("/api/staff/"))return staffRoute(req,env,h,new URL(req.url));
 if(path.startsWith("/api/parent/reports/")&&req.method==="GET")return readReport(req,env,h,path);
 return null;
}
export async function bookingReminders(env,h){
 if(!env.DB)return;
 await env.DB.prepare("DELETE FROM admin_login_codes WHERE expires_at<?").bind(utcNow()).run();
 await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at<?").bind(utcNow()).run();
 await env.DB.prepare("DELETE FROM admin_login_attempts WHERE window_started<?").bind(future(-120)).run();
 if(!env.MAIL_API_KEY||!env.MAIL_SENDER)return;
 const paid=await env.DB.prepare("SELECT b.*,o.state AS payment_state FROM booking_requests b JOIN orders o ON o.id=b.order_id WHERE b.status='confirmed' AND o.state='paid' AND b.paid_notice_sent_at IS NULL LIMIT 10").all();
 for(const b of paid.results){
  try{await h.email(env,env.OWNER_EMAIL||env.MAIL_SENDER,"Bon Point — Paiement reçu pour un cours","<p>Paiement confirmé pour le rendez-vous du "+h.safe(b.requested_date)+" à "+h.safe(b.time_local)+" (Paris), réf. "+h.safe(b.id)+".</p>");
   await env.DB.prepare("UPDATE booking_requests SET paid_notice_sent_at=? WHERE id=? AND paid_notice_sent_at IS NULL").bind(utcNow(),b.id).run();
  }catch(e){console.error("Paid notification failure",e.message)}
 }
 const v=await env.DB.prepare("SELECT b.*,o.state AS payment_state FROM booking_requests b LEFT JOIN orders o ON o.id=b.order_id WHERE b.status='confirmed' AND b.reminder_sent_at IS NULL AND b.reminder_due_at<=? AND b.starts_at_utc>? AND (b.session_type='intro' OR (b.session_type='course' AND o.state='paid')) ORDER BY b.starts_at_utc LIMIT 10").bind(utcNow(),utcNow()).all();
 for(const b of v.results){
  const msg="<p>Rappel de séance : "+h.safe(b.requested_date)+" à "+h.safe(b.time_local)+" (heure de Paris).</p><p>Référence "+h.safe(b.id)+" ; classe "+h.safe(b.grade)+" ; matière "+h.safe(b.subject)+".</p>";
  try{await h.email(env,env.OWNER_EMAIL||env.MAIL_SENDER,"Bon Point — Rappel de séance J-2",msg);
   await h.email(env,b.parent_email,"Bon Point — Votre séance approche",msg);
   await env.DB.prepare("UPDATE booking_requests SET reminder_sent_at=? WHERE id=? AND reminder_sent_at IS NULL").bind(utcNow(),b.id).run();
  }catch(e){console.error("Reminder failed",e.message)}
 }
}
