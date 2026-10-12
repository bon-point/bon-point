/**
 * Bon Point — services complémentaires, isolés des paiements.
 * Aucune ouverture publique tant que SITE_INTAKE_ENABLED ou PARENT_PORTAL_ENABLED
 * ne sont pas explicitement activés, et que les secrets requis ne sont pas présents.
 * Toutes les données relatives aux familles sont conservées dans D1, jamais GitHub.
 */
const PARENT_ORIGIN="https://bon-point.github.io";
const GRADES=new Set(["6e","5e","4e","3e","Seconde","Première","Terminale"]);
const SUBJECTS=new Set(["Mathématiques","Physique-Chimie","Les deux"]);
const PERIODS=new Set(["Matin (9 h–12 h)","Après-midi (14 h–17 h)","Fin de journée (17 h–20 h)"]);
const GOALS=new Set(["Reprendre les bases","Mieux comprendre les cours","Préparer un contrôle","Préparer le brevet","Préparer le bac","Acquérir une meilleure méthode"]);
const RX_EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RX_TOKEN=/^[0-9a-f]{64}$/;
const plus=(minutes)=>new Date(Date.now()+minutes*60000).toISOString();
const text=(v,max=400)=>typeof v==="string"?v.trim().slice(0,max):"";
const validEmail=s=>s.length>=5&&s.length<=180&&RX_EMAIL.test(s);
const emailOf=s=>text(s,180).toLowerCase();
const goodDate=s=>/^20\d\d-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(s+"T12:00:00Z"));
const day=()=>new Date().toISOString().slice(0,10);
const hex=b=>Array.from(b,n=>n.toString(16).padStart(2,"0")).join("");
const secureToken=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function hash(s){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))))}
function intakeEnabled(env){return env.SITE_INTAKE_ENABLED==="true"&&!!(env.DB&&env.TURNSTILE_SECRET&&env.TURNSTILE_SITE_KEY&&env.MAIL_API_KEY&&env.MAIL_SENDER)}
function parentsEnabled(env){return env.PARENT_PORTAL_ENABLED==="true"&&!!(env.DB&&env.MAIL_API_KEY&&env.MAIL_SENDER&&env.PARENT_AUTH_SECRET?.length>=32)}
async function body(req){
 if(!req.headers.get("content-type")?.includes("application/json"))throw Error("JSON required");
 const raw=await req.text();if(raw.length>7000)throw Error("Too large");
 const d=JSON.parse(raw);if(!d||typeof d!=="object"||Array.isArray(d))throw Error("Invalid request");
 return d;
}
function browserOrigin(req){return req.headers.get("origin")===PARENT_ORIGIN}
async function verifyHuman(d,env){
 const answer=text(d.turnstile_token,3000);
 if(!answer)return false;
 const params=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:answer});
 const result=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:params});
 if(!result.ok)return false;
 const validated=await result.json();
 return validated.success===true&&validated.hostname==="bon-point.github.io";
}
function sanitized(d){
 const parent_name=text(d.parent_name,90),parent_email=emailOf(d.email);
 const grade=text(d.grade,30),subject=text(d.subject,40);
 return {parent_name,parent_email,grade,subject,valid:parent_name.length>=2&&validEmail(parent_email)&&GRADES.has(grade)&&SUBJECTS.has(subject)};
}
async function limit(env,table,mail){
 const from=new Date(Date.now()-3600000).toISOString();
 const row=await env.DB.prepare("SELECT COUNT(*) AS count FROM "+table+" WHERE parent_email=? AND created_at>?").bind(mail,from).first();
 return Number(row?.count||0)<3;
}
async function notifyOwner(env,h,heading,description,emailAddress){
 const to=env.OWNER_EMAIL||env.MAIL_SENDER;
 try{await h.email(env,to,heading,"<p>"+h.safe(description)+"</p><p>Contact parent : "+h.safe(emailAddress)+"</p><p>Consultez le tableau de suivi administrateur pour les détails.</p>")}
 catch(err){console.error("Site notification deferred:",err.message)}
}
async function booking(req,env,h){
 if(!intakeEnabled(env))return h.fail("Service désactivé ; utilisez le formulaire e-mail",503,req);
 if(!browserOrigin(req))return h.fail("Origine refusée",403,req);
 const d=await body(req),x=sanitized(d),requested_date=text(d.date,10),period=text(d.period,60),notes=text(d.notes,450);
 const time=new Date(requested_date+"T12:00:00Z").getTime();
 if(!x.valid||!goodDate(requested_date)||time<Date.now()+6*3600000||time>Date.now()+180*86400000||!PERIODS.has(period))return h.fail("Demande incomplète ou date invalide",400,req);
 if(!await verifyHuman(d,env))return h.fail("Vérification de sécurité nécessaire",400,req);
 if(!await limit(env,"booking_requests",x.parent_email))return h.fail("Trop de demandes récentes. Contactez Bon Point par e-mail.",429,req);
 const id=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO booking_requests(id,parent_email,parent_name,grade,subject,requested_date,period,notes,status,created_at) VALUES(?,?,?,?,?,?,?,?,'requested',?)").bind(id,x.parent_email,x.parent_name,x.grade,x.subject,requested_date,period,notes,h.now()).run();
 await notifyOwner(env,h,"Bon Point — Nouvelle demande de rendez-vous","Demande "+id+" · "+requested_date+" · "+period,x.parent_email);
 return h.json({received:true,reference:id,confirmed:false},201,req);
}
async function diagnostic(req,env,h){
 if(!intakeEnabled(env))return h.fail("Service désactivé ; utilisez le formulaire e-mail",503,req);
 if(!browserOrigin(req))return h.fail("Origine refusée",403,req);
 const d=await body(req),x=sanitized(d),chapters=text(d.chapters,650),goal=text(d.goal,100),notes=text(d.notes,650);
 if(d.parent_confirmed!==true||!x.valid||chapters.length<3||!GOALS.has(goal))return h.fail("Diagnostic incomplet",400,req);
 if(!await verifyHuman(d,env))return h.fail("Vérification de sécurité nécessaire",400,req);
 if(!await limit(env,"diagnostic_requests",x.parent_email))return h.fail("Trop de demandes récentes. Contactez Bon Point par e-mail.",429,req);
 const id=crypto.randomUUID();
 await env.DB.prepare("INSERT INTO diagnostic_requests(id,parent_email,parent_name,grade,subject,chapters,goal,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,x.parent_email,x.parent_name,x.grade,x.subject,chapters,goal,notes,h.now()).run();
 await notifyOwner(env,h,"Bon Point — Nouveau diagnostic","Diagnostic "+id+" · "+x.grade+" · "+x.subject,x.parent_email);
 return h.json({received:true,reference:id},201,req);
}
async function parentCode(req,env,h){
 if(env.PARENT_SELF_SERVICE_CODES!=="true")return h.fail("Demandez votre code de connexion à Bon Point.",403,req);
 if(!parentsEnabled(env))return h.fail("Accès privé indisponible",503,req);
 if(!browserOrigin(req))return h.fail("Origine refusée",403,req);
 const d=await body(req),mail=emailOf(d.email);
 if(!validEmail(mail))return h.fail("Adresse e-mail invalide",400,req);
 // Réponse identique que le compte existe ou non pour éviter la découverte d'utilisateurs.
 const accepted=()=>h.json({received:true},200,req);
 const account=await env.DB.prepare("SELECT email FROM parent_accounts WHERE email=? AND active=1").bind(mail).first();
 if(!account)return accepted();
 const recent=await env.DB.prepare("SELECT sent_at FROM parent_login_codes WHERE email=?").bind(mail).first();
 if(recent&&Date.now()-Date.parse(recent.sent_at)<90000)return accepted();
 const n=crypto.getRandomValues(new Uint32Array(1))[0]%1000000;
 const code=String(n).padStart(6,"0");
 const code_hash=await hash(mail+":"+code+":"+env.PARENT_AUTH_SECRET);
 await env.DB.prepare("INSERT INTO parent_login_codes(email,code_hash,sent_at,expires_at,attempts) VALUES(?,?,?,?,0) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,sent_at=excluded.sent_at,expires_at=excluded.expires_at,attempts=0").bind(mail,code_hash,h.now(),plus(10)).run();
 await h.email(env,mail,"Bon Point — Votre code temporaire","<p>Votre code de connexion Bon Point : <strong>"+code+"</strong>.</p><p>Il expire dans 10 minutes. Ne le transmettez à personne. Si vous n'avez rien demandé, ignorez cet e-mail.</p>");
 return accepted();
}
async function parentVerify(req,env,h){
 if(!parentsEnabled(env))return h.fail("Accès privé indisponible",503,req);
 if(!browserOrigin(req))return h.fail("Origine refusée",403,req);
 const d=await body(req),mail=emailOf(d.email),code=text(d.code,6);
 if(!validEmail(mail)||!/^[0-9]{6}$/.test(code))return h.fail("Code invalide ou expiré",401,req);
 const row=await env.DB.prepare("SELECT p.*, a.active FROM parent_login_codes p JOIN parent_accounts a ON a.email=p.email WHERE p.email=?").bind(mail).first();
 if(!row||row.active!==1||Date.parse(row.expires_at)<Date.now()||row.attempts>=5)return h.fail("Code invalide ou expiré",401,req);
 const attemptHash=await hash(mail+":"+code+":"+env.PARENT_AUTH_SECRET);
 if(row.code_hash!==attemptHash){
  await env.DB.prepare("UPDATE parent_login_codes SET attempts=attempts+1 WHERE email=?").bind(mail).run();
  return h.fail("Code invalide ou expiré",401,req);
 }
 const access=secureToken(),token_hash=await hash(access);
 await env.DB.batch([
  env.DB.prepare("DELETE FROM parent_login_codes WHERE email=?").bind(mail),
  env.DB.prepare("INSERT INTO parent_sessions(token_hash,email,created_at,expires_at) VALUES(?,?,?,?)").bind(token_hash,mail,h.now(),plus(120))
 ]);
 return h.json({access_token:access,expires_in:7200},200,req);
}
async function authenticated(req,env){
 const access=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!RX_TOKEN.test(access))return null;
 const session=await env.DB.prepare("SELECT s.email,a.display_name FROM parent_sessions s JOIN parent_accounts a ON a.email=s.email WHERE s.token_hash=? AND s.expires_at>? AND a.active=1").bind(await hash(access),new Date().toISOString()).first();
 return session||null;
}
async function parentDashboard(req,env,h){
 if(!parentsEnabled(env))return h.fail("Accès privé indisponible",503,req);
 if(!browserOrigin(req))return h.fail("Origine refusée",403,req);
 const account=await authenticated(req,env);if(!account)return h.fail("Session expirée ou invalide",401,req);
 const mail=account.email;
 const [sessions,bookings,orders,invoices]=await env.DB.batch([
  env.DB.prepare("SELECT id,session_date,subject,summary,next_step,strengths,homework,next_objective FROM progress_entries WHERE parent_email=? ORDER BY session_date DESC,created_at DESC LIMIT 50").bind(mail),
  env.DB.prepare("SELECT requested_date,time_local,starts_at_utc,subject,period,status,session_type FROM booking_requests WHERE parent_email=? ORDER BY created_at DESC LIMIT 30").bind(mail),
  env.DB.prepare("SELECT o.id,f.title,o.locked_price_cents,o.payment_plan,o.state,o.created_at FROM orders o JOIN offers f ON f.id=o.offer_id WHERE lower(o.parent_email)=? AND o.state IN ('proposed','paid') ORDER BY o.created_at DESC LIMIT 30").bind(mail),
  env.DB.prepare("SELECT invoice_number,total_cents,issued_on,status FROM invoices WHERE parent_email=? ORDER BY issued_on DESC LIMIT 30").bind(mail)
 ]);
 const files=await env.DB.prepare("SELECT id,progress_id,file_name,size_bytes,created_at FROM session_files WHERE parent_email=? ORDER BY created_at DESC LIMIT 100").bind(mail).all();
 return h.json({parent:{display_name:account.display_name,email:mail},sessions:sessions.results,bookings:bookings.results,orders:orders.results,invoices:invoices.results,files:files.results},200,req);
}
async function parentLogout(req,env,h){
 if(!parentsEnabled(env))return h.fail("Accès privé indisponible",503,req);
 if(!browserOrigin(req))return h.fail("Origine refusée",403,req);
 const access=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(RX_TOKEN.test(access))await env.DB.prepare("DELETE FROM parent_sessions WHERE token_hash=?").bind(await hash(access)).run();
 return h.json({ok:true},200,req);
}
async function admin(req,env,h,url){
 if(!h.adminAllowed(req,env))return h.fail("Non autorisé",403,req);
 if(!env.DB)return h.fail("Base indisponible",503,req);
 const path=url.pathname;
 if(req.method==="GET"&&path==="/api/admin/site/bookings"){
  const rows=await env.DB.prepare("SELECT * FROM booking_requests ORDER BY created_at DESC LIMIT 100").all();
  return h.json({bookings:rows.results},200,req);
 }
 if(req.method==="GET"&&path==="/api/admin/site/diagnostics"){
  const rows=await env.DB.prepare("SELECT * FROM diagnostic_requests ORDER BY created_at DESC LIMIT 100").all();
  return h.json({diagnostics:rows.results},200,req);
 }
 if(req.method==="POST"&&path==="/api/admin/site/parents"){
  const d=await body(req),email=emailOf(d.email),display_name=text(d.display_name,90);
  if(!validEmail(email)||display_name.length<2||typeof d.active!=="boolean")return h.fail("Compte invalide",400,req);
  await env.DB.prepare("INSERT INTO parent_accounts(email,display_name,active,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,active=excluded.active").bind(email,display_name,d.active?1:0,h.now()).run();
  if(!d.active)await env.DB.prepare("DELETE FROM parent_sessions WHERE email=?").bind(email).run();
  return h.json({saved:true},200,req);
 }
 if(req.method==="POST"&&path==="/api/admin/site/progress"){
  const d=await body(req),email=emailOf(d.email),subject=text(d.subject,40),session_date=text(d.session_date,10),summary=text(d.summary,700),next_step=text(d.next_step,500);
  if(!validEmail(email)||!SUBJECTS.has(subject)||!goodDate(session_date)||summary.length<3)return h.fail("Compte rendu invalide",400,req);
  const account=await env.DB.prepare("SELECT email FROM parent_accounts WHERE email=? AND active=1").bind(email).first();
  if(!account)return h.fail("Compte parent non activé",404,req);
  const id=crypto.randomUUID();
  await env.DB.prepare("INSERT INTO progress_entries(id,parent_email,session_date,subject,summary,next_step,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,email,session_date,subject,summary,next_step,h.now()).run();
  return h.json({saved:true,id},201,req);
 }
 const match=path.match(/^\/api\/admin\/site\/bookings\/([0-9a-f-]{36})$/i);
 if(req.method==="POST"&&match){
  const d=await body(req),state=text(d.status,20);
  if(!["requested","confirmed","declined"].includes(state))return h.fail("Statut invalide",400,req);
  const changed=await env.DB.prepare("UPDATE booking_requests SET status=? WHERE id=?").bind(state,match[1]).run();
  if(changed.meta?.changes!==1)return h.fail("Demande introuvable",404,req);
  return h.json({saved:true},200,req);
 }
 if(req.method==="POST"&&path==="/api/admin/site/invoices"){
  // Enregistrer uniquement une facture déjà légalement émise hors du site.
  const d=await body(req),order_id=text(d.order_id,36),invoice_number=text(d.invoice_number,40),issued_on=text(d.issued_on,10);
  if(!/^BP-20\d{2}-\d{4,6}$/.test(invoice_number)||!goodDate(issued_on)||!/^[-\da-f]{36}$/i.test(order_id)||d.confirm_issued!==true)
   return h.fail("Facture émise et référence légale requises",400,req);
  const order=await env.DB.prepare("SELECT id,parent_email,locked_price_cents,state FROM orders WHERE id=?").bind(order_id).first();
  if(!order||order.state!=="paid")return h.fail("Commande payée introuvable",404,req);
  const email=emailOf(order.parent_email);
  const account=await env.DB.prepare("SELECT email FROM parent_accounts WHERE email=? AND active=1").bind(email).first();
  if(!account)return h.fail("Compte parent requis",400,req);
  await env.DB.prepare("INSERT INTO invoices(invoice_number,order_id,parent_email,total_cents,issued_on,status,created_at) VALUES(?,?,?,?,?,'issued',?)").bind(invoice_number,order_id,email,order.locked_price_cents,issued_on,h.now()).run();
  return h.json({saved:true,invoice_number},201,req);
 }
 return h.fail("Introuvable",404,req);
}
export async function handleSite(req,env,h){
 const url=new URL(req.url),path=url.pathname;
 if(path==="/api/site/status"&&req.method==="GET")
  return h.json({intake:!!intakeEnabled(env),parent_portal:!!parentsEnabled(env),turnstile_site_key:intakeEnabled(env)?env.TURNSTILE_SITE_KEY:null},200,req);
 if(path.startsWith("/api/admin/site/"))return admin(req,env,h,url);
 if(path==="/api/site/bookings"&&req.method==="POST")return booking(req,env,h);
 if(path==="/api/site/diagnostics"&&req.method==="POST")return diagnostic(req,env,h);
 if(path==="/api/parent/code"&&req.method==="POST")return parentCode(req,env,h);
 if(path==="/api/parent/verify"&&req.method==="POST")return parentVerify(req,env,h);
 if(path==="/api/parent/dashboard"&&req.method==="GET")return parentDashboard(req,env,h);
 if(path==="/api/parent/logout"&&req.method==="POST")return parentLogout(req,env,h);
 if(path.startsWith("/api/site/")||path.startsWith("/api/parent/"))return h.fail("Introuvable",404,req);
 return null;
}
export async function cleanupSiteData(env){
 if(!env.DB)return;
 await env.DB.batch([
  env.DB.prepare("DELETE FROM parent_sessions WHERE expires_at<?").bind(new Date().toISOString()),
  env.DB.prepare("DELETE FROM parent_login_codes WHERE expires_at<?").bind(new Date().toISOString()),
  env.DB.prepare("DELETE FROM diagnostic_requests WHERE created_at<?").bind(new Date(Date.now()-90*86400000).toISOString()),
  env.DB.prepare("DELETE FROM booking_requests WHERE status!='confirmed' AND created_at<?").bind(new Date(Date.now()-90*86400000).toISOString())
 ]);
}
