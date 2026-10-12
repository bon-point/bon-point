/**
 * Administrative Discord joining workflow. Called ONLY after the staff route
 * has verified the admin session and browser origin.
 */
const hexToken=()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(10));
 return Array.from(bytes,v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
};
async function sha(value){
 const data=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return Array.from(new Uint8Array(data),v=>v.toString(16).padStart(2,"0")).join("");
}
const idRx=/^[0-9a-f-]{36}$/i;
const now=()=>new Date().toISOString();
const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function requestJson(req){
 if(!req.headers.get("content-type")?.includes("application/json"))throw new Error("JSON requis");
 const data=await req.text();if(data.length>3000)throw new Error("Requête trop longue");
 return JSON.parse(data);
}
const selectable=(b)=>b?.status==="confirmed"&&
 ["intro","course"].includes(b.session_type)&&
 (b.session_type==="intro"||b.payment_state==="paid")&&
 Number.isFinite(Date.parse(b.starts_at_utc))&&Date.parse(b.starts_at_utc)>Date.now()+40*60_000;
export async function staffDiscordAction(req,env,h,path){
 if(!path.startsWith("/api/staff/discord/"))return null;
 if(env.DISCORD_BOOKING_LINKS_ENABLED!=="true"||!env.DB)return h.fail("Liaison Discord en préparation",503,req);
 if(path==="/api/staff/discord/rooms"&&req.method==="GET"){
  const [audit,allocations]=await env.DB.batch([
   env.DB.prepare("SELECT status,reason,checked_at FROM discord_room_audits WHERE name='fixed_pair'"),
   env.DB.prepare("SELECT a.booking_id,a.room_id,a.starts_at_utc,a.ends_at_utc,a.state,a.access_granted_at,a.access_revoked_at,a.revoke_requested_at,a.last_access_error FROM discord_room_allocations a ORDER BY a.starts_at_utc DESC LIMIT 100")
  ]);
  return h.json({audit:audit.results?.[0]||null,allocations:allocations.results||[]},200,req);
 }
 if(path==="/api/staff/discord/link-code"&&req.method==="POST"){
  const d=await requestJson(req),id=String(d.booking_id||"").trim();
  if(!idRx.test(id)||d.parent_consent_confirmed!==true||d.discord_eligibility_confirmed!==true)
   return h.fail("Référence valide et confirmation préalable du responsable légal requises",400,req);
  if(!env.MAIL_API_KEY||!env.MAIL_SENDER)return h.fail("L'envoi d'e-mails sécurisé est indisponible",503,req);
  const b=await env.DB.prepare(`SELECT b.id,b.parent_email,b.status,b.session_type,b.starts_at_utc,o.state AS payment_state
   FROM booking_requests b LEFT JOIN orders o ON o.id=b.order_id WHERE b.id=?`).bind(id).first();
  if(!selectable(b)||!validEmail.test(b.parent_email))return h.fail("Cours non confirmé, non réglé ou trop proche",409,req);
  const existing=await env.DB.prepare("SELECT booking_id FROM discord_room_allocations WHERE booking_id=?").bind(id).first();
  if(existing)return h.fail("Une association existe déjà. Révoquez-la avant de demander une nouvelle liaison.",409,req);
  const code=hexToken(),hashed=await sha(code),sentAt=now(),expires=new Date(Date.now()+20*60_000).toISOString();
  await env.DB.prepare(`INSERT INTO discord_booking_link_codes(booking_id,code_hash,created_at,expires_at,consent_attested_at,used_at)
   VALUES(?,?,?,?,?,NULL)
   ON CONFLICT(booking_id) DO UPDATE SET code_hash=excluded.code_hash,created_at=excluded.created_at,
   expires_at=excluded.expires_at,consent_attested_at=excluded.consent_attested_at,used_at=NULL`)
   .bind(id,hashed,sentAt,expires,sentAt).run();
  try{
   await h.email(env,b.parent_email,"Bon Point — Code privé pour rejoindre votre cours",
    "<p>Un rendez-vous Bon Point confirmé peut être rejoint sur Discord par un participant remplissant les conditions d'âge de Discord et dont le responsable légal a autorisé la participation.</p>"+
    "<p>Code à usage unique, valable 20 minutes : <strong>"+code+"</strong>.</p>"+
    "<p>Communiquez ce code seulement à la personne concernée. Elle doit saisir <strong>/lier</strong> puis le code dans le serveur Bon Point. Ne publiez pas ce code dans un salon public.</p>"+
    "<p>La salle sera visible environ dix minutes avant le cours et l'accès sera retiré après la séance. Si vous n'avez pas autorisé cette démarche, contactez immédiatement Bon Point.</p>");
  }catch(err){
   await env.DB.prepare("DELETE FROM discord_booking_link_codes WHERE booking_id=? AND code_hash=? AND used_at IS NULL").bind(id,hashed).run();
   console.error("Discord joining code email unavailable");
   return h.fail("Impossible d'envoyer le code au parent",503,req);
  }
  return h.json({sent:true,reference:id.slice(0,8),expires_in_minutes:20},200,req);
 }
 if(path==="/api/staff/discord/revoke"&&req.method==="POST"){
  const d=await requestJson(req),id=String(d.booking_id||"").trim();
  if(!idRx.test(id)||d.confirm_revoke!==true)return h.fail("Référence et confirmation requises",400,req);
  const allocation=await env.DB.prepare("SELECT booking_id,state,access_granted_at,access_revoked_at FROM discord_room_allocations WHERE booking_id=?").bind(id).first();
  await env.DB.prepare("DELETE FROM discord_booking_link_codes WHERE booking_id=?").bind(id).run();
  if(!allocation)return h.json({revocation_requested:true,linked:false},200,req);
  if(allocation.access_revoked_at)return h.json({revocation_requested:true,already_revoked:true},200,req);
  if(!allocation.access_granted_at){
   await env.DB.prepare("UPDATE discord_room_allocations SET state='cancelled',revoke_requested_at=?,access_revoked_at=? WHERE booking_id=? AND access_granted_at IS NULL").bind(now(),now(),id).run();
   return h.json({revocation_requested:true,access_not_opened:true},200,req);
  }
  await env.DB.prepare("UPDATE discord_room_allocations SET revoke_requested_at=? WHERE booking_id=? AND access_revoked_at IS NULL").bind(now(),id).run();
  return h.json({revocation_requested:true,access_will_be_revoked:true},202,req);
 }
 return h.fail("Action Discord inconnue",404,req);
}
