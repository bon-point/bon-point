/**
 * Bon Point — protected access to exactly two existing Discord voice rooms.
 * The booking comes from Bon Point's D1; user identity comes from a signed
 * Discord slash interaction. No student information is posted publicly.
 */
const API="https://discord.com/api/v10";
const MS_MIN=60_000;
const VIEW=1024n,CONNECT=1048576n,SPEAK=2097152n;
export const MEMBER_ALLOW=(VIEW|CONNECT|SPEAK).toString();
const snowflake=/^\d{17,22}$/;
const tokenPattern=/^[A-F0-9]{20}$/;
const ttlMinutes=20;
const today=()=>new Date().toISOString();
const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,"0")).join("");
function message(content){
 return {type:4,data:{content,flags:64,allowed_mentions:{parse:[]}}};
}
export function validRoomIds(env){
 const ids=[env.DISCORD_ROOM_1_ID,env.DISCORD_ROOM_2_ID];
 return ids.length===2&&ids.every(v=>snowflake.test(v||""))&&ids[0]!==ids[1]?ids:[];
}
export function roomReadyForGrant(allocation,booking,now=Date.now()){
 const start=Date.parse(allocation.starts_at_utc),end=Date.parse(allocation.ends_at_utc);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return false;
 if(!["planned","active"].includes(allocation.state)||allocation.access_granted_at||allocation.access_revoked_at||allocation.revoke_requested_at)return false;
 if(booking.booking_status!=="confirmed")return false;
 if(booking.session_type!=="intro"&&(booking.session_type!=="course"||booking.payment_state!=="paid"))return false;
 return now>=start-10*MS_MIN&&now<end;
}
export function shouldRevoke(allocation,booking,now=Date.now()){
 if((!allocation.access_granted_at&&!allocation.grant_attempted_at)||allocation.access_revoked_at)return false;
 const end=Date.parse(allocation.ends_at_utc);
 return !!allocation.revoke_requested_at||booking.booking_status!=="confirmed"||
   (booking.session_type==="course"&&booking.payment_state!=="paid")||
   !Number.isFinite(end)||now>=end+5*MS_MIN;
}
function safeOverwrite(channel,id){
 const entry=(channel.permission_overwrites||[]).find(p=>String(p.id)===id);
 if(!entry)return "none";
 if(Number(entry.type)===1&&String(entry.allow||"0")===MEMBER_ALLOW&&BigInt(entry.deny||"0")===0n)return "ours";
 return "other";
}
export function privateVoice(channel,guild,category){
 if(!channel||channel.type!==2||channel.guild_id!==guild||channel.parent_id!==category)return false;
 const global=(channel.permission_overwrites||[]).find(x=>String(x.id)===guild&&Number(x.type)===0);
 return !!global&&(BigInt(global.deny||"0")&VIEW)!==0n;
}
async function api(env,path,init={}){
 const r=await fetch(API+path,{...init,headers:{Authorization:"Bot "+env.DISCORD_BOT_TOKEN,...(init.body?{"Content-Type":"application/json"}:{})}});
 if(!r.ok){throw new Error("discord-http-"+r.status)}
 if(r.status===204)return null;
 return r.json();
}
async function verifyRoom(env,id,memberId){
 if(!validRoomIds(env).includes(id))throw Error("room-not-allowlisted");
 const audit=await env.DB.prepare("SELECT status,category_id,room_ids FROM discord_room_audits WHERE name='fixed_pair'").first();
 if(audit?.status!=="verified"||!snowflake.test(audit.category_id||"")||audit.room_ids!==validRoomIds(env).join(","))throw Error("room-audit-not-verified");
 const room=await api(env,"/channels/"+id);
 if(!privateVoice(room,env.DISCORD_GUILD_ID,audit.category_id))throw Error("room-privacy-changed");
 return {room,existing:safeOverwrite(room,memberId)};
}
const dbRows=async (db,query,...args)=>(await db.prepare(query).bind(...args).all()).results||[];
async function alert(env,bookingId,cause){
 if(!env.DB)return;
 const permitted=/^[a-z0-9-]{2,55}$/i.test(cause)?cause:"unexpected-error";
 await env.DB.prepare("INSERT OR IGNORE INTO discord_notifications(event_key,category,message,state,attempts,created_at) VALUES(?, 'room_access_issue', ?, 'pending', 0, datetime('now'))")
   .bind("room-alert:"+bookingId+":"+permitted,"⚠️ **Accès Discord à vérifier** : réservation `"+bookingId.slice(0,8)+"`, code "+permitted+". Aucun salon n'a été rendu public.").run();
}
async function markError(env,a,msg){
 const clean=/^[a-z0-9-]{2,55}$/i.test(msg)?msg:"unexpected-error";
 await env.DB.prepare("UPDATE discord_room_allocations SET last_access_error=? WHERE booking_id=?").bind(clean,a.booking_id).run();
 await alert(env,a.booking_id,clean);
}
async function lease(env,bookingId){
 const date=today(),until=new Date(Date.now()+2*MS_MIN).toISOString();
 const result=await env.DB.prepare("UPDATE discord_room_allocations SET access_lease_until=? WHERE booking_id=? AND (access_lease_until IS NULL OR access_lease_until<?)").bind(until,bookingId,date).run();
 return Number(result.meta?.changes||0)===1;
}
async function freeLease(env,id){
 await env.DB.prepare("UPDATE discord_room_allocations SET access_lease_until=NULL WHERE booking_id=?").bind(id).run();
}
async function revoke(env,a,reason="ended"){
 const ids=validRoomIds(env);
 if(!ids.includes(a.room_id)||!snowflake.test(a.participant_discord_id||""))throw Error("room-or-member-invalid");
 const channel=await api(env,"/channels/"+a.room_id);
 const overwrite=safeOverwrite(channel,a.participant_discord_id);
 if(overwrite==="other")throw Error("permission-changed");
 if(overwrite==="ours"){
  await api(env,"/channels/"+a.room_id+"/permissions/"+a.participant_discord_id,{method:"DELETE"});
 }
 // If the entry is missing, it was already revoked (e.g. after a retry).
 await env.DB.prepare("UPDATE discord_room_allocations SET state=?,access_revoked_at=?,last_access_error=NULL WHERE booking_id=? AND access_revoked_at IS NULL")
 .bind(reason==="ended"?"completed":"cancelled",today(),a.booking_id).run();
}
async function grant(env,a,b){
 if(!roomReadyForGrant(a,b))return;
 const {existing}=await verifyRoom(env,a.room_id,a.participant_discord_id);
 if(existing==="other")throw Error("member-permission-preexists");
 // Resume after PUT succeeded but D1 update failed, but ONLY if it matches
 // the exact known 3 voice bits and no deny.
 if(existing==="ours"&&!a.grant_attempted_at)throw Error("member-permission-preexists");
 if(existing==="none"){
  await api(env,"/guilds/"+env.DISCORD_GUILD_ID+"/members/"+a.participant_discord_id);
  const intent=await env.DB.prepare("UPDATE discord_room_allocations SET grant_attempted_at=COALESCE(grant_attempted_at,?) WHERE booking_id=? AND state IN ('planned','active') AND access_revoked_at IS NULL AND revoke_requested_at IS NULL").bind(today(),a.booking_id).run();
  if(Number(intent.meta?.changes||0)!==1)throw Error("booking-revoked");
  await api(env,"/channels/"+a.room_id+"/permissions/"+a.participant_discord_id,{
   method:"PUT",body:JSON.stringify({type:1,allow:MEMBER_ALLOW,deny:"0"})
  });
 }
 // Recheck the booking (it could have been declined/refunded in the meantime).
 const current=await env.DB.prepare("SELECT a.state AS access_state,a.revoke_requested_at,a.access_revoked_at,b.status AS booking_status,b.session_type,o.state AS payment_state FROM discord_room_allocations a JOIN booking_requests b ON b.id=a.booking_id LEFT JOIN orders o ON b.order_id=o.id WHERE a.booking_id=?").bind(a.booking_id).first();
 const canStillGrant=current && roomReadyForGrant({...a,state:current.access_state,revoke_requested_at:current.revoke_requested_at,access_revoked_at:current.access_revoked_at},current);
 if(!canStillGrant){
  await revoke(env,{...a,access_granted_at:today()},"cancelled");
  return;
 }
 const recorded=await env.DB.prepare("UPDATE discord_room_allocations SET state='active',access_granted_at=COALESCE(access_granted_at,?),last_access_error=NULL WHERE booking_id=? AND state IN ('planned','active') AND access_revoked_at IS NULL AND revoke_requested_at IS NULL")
 .bind(today(),a.booking_id).run();
 if(Number(recorded.meta?.changes||0)!==1)await revoke(env,{...a,access_granted_at:today()},"cancelled");
}
export async function runRoomAutomation(env){
 if(!env.DB||!env.DISCORD_BOT_TOKEN||validRoomIds(env).length!==2||!snowflake.test(env.DISCORD_GUILD_ID||""))return {enabled:false};
 const grantEnabled=env.DISCORD_ROOM_ACCESS_ENABLED==="true";
 const rows=await dbRows(env.DB,`SELECT a.*,b.status AS booking_status,b.session_type,o.state AS payment_state
 FROM discord_room_allocations a JOIN booking_requests b ON a.booking_id=b.id
 LEFT JOIN orders o ON b.order_id=o.id
 WHERE a.state IN ('planned','active') OR (a.state='cancelled' AND a.grant_attempted_at IS NOT NULL AND a.access_revoked_at IS NULL) ORDER BY a.starts_at_utc LIMIT 80`);
 const now=Date.now();
 for(const a of rows){
  const complete=shouldRevoke(a,a,now)||(!grantEnabled&&(!!a.access_granted_at||!!a.grant_attempted_at)&&!a.access_revoked_at);
  const overdue=!a.access_granted_at&&!a.grant_attempted_at&&(a.revoke_requested_at||a.booking_status!=="confirmed"||
    a.session_type==="course"&&a.payment_state!=="paid"||now>=Date.parse(a.ends_at_utc));
  if(!complete&&!overdue&&!(grantEnabled&&roomReadyForGrant(a,a,now)))continue;
  if(!await lease(env,a.booking_id))continue;
  try{
   if(complete)await revoke(env,a,now>=Date.parse(a.ends_at_utc)+5*MS_MIN?"ended":"cancelled");
   else if(overdue)await env.DB.prepare("UPDATE discord_room_allocations SET state='cancelled' WHERE booking_id=? AND state='planned' AND access_granted_at IS NULL").bind(a.booking_id).run();
   else if(grantEnabled)await grant(env,a,a);
  }catch(e){
   const code=/^(discord-http-\d{3}|room-[a-z-]+|member-permission-preexists|permission-changed)$/.test(String(e.message||""))?e.message:"unexpected-error";
   await markError(env,a,code);
  }finally{await freeLease(env,a.booking_id)}
 }
 await env.DB.prepare("DELETE FROM discord_booking_link_codes WHERE expires_at<? AND (used_at IS NOT NULL OR expires_at<?)").bind(today(),new Date(Date.now()-86400000).toISOString()).run();
 await env.DB.prepare("DELETE FROM discord_room_allocations WHERE state IN ('completed','cancelled') AND ends_at_utc<? AND access_revoked_at IS NOT NULL").bind(new Date(Date.now()-90*86400000).toISOString()).run();
 return {enabled:true,processed:rows.length};
}
export async function linkDiscordInteraction(interaction,env,chooseFixedRoom){
 if(env.DISCORD_ROOM_LINK_ENABLED!=="true"||!env.DB)return message("La liaison des comptes Discord n'est pas encore disponible. Contactez Bon Point.");
 const code=String(interaction.data?.options?.find(x=>x.name==="code")?.value||"").trim().toUpperCase();
 const memberId=interaction.member?.user?.id;
 if(!tokenPattern.test(code)||!snowflake.test(memberId||"")||interaction.member?.user?.bot===true)return message("Code invalide ou expiré. Demandez un nouveau code à Bon Point.");
 const codeHash=await digest(code);
 const info=await env.DB.prepare(`SELECT c.booking_id,c.expires_at,c.used_at,b.status,b.session_type,b.starts_at_utc,b.order_id,
 o.state AS payment_state FROM discord_booking_link_codes c JOIN booking_requests b ON b.id=c.booking_id
 LEFT JOIN orders o ON o.id=b.order_id WHERE c.code_hash=?`).bind(codeHash).first();
 if(!info||info.used_at||Date.parse(info.expires_at)<Date.now()||info.status!=="confirmed"||
    !["intro","course"].includes(info.session_type)||info.session_type==="course"&&info.payment_state!=="paid"||
    Date.parse(info.starts_at_utc)<Date.now()+15*MS_MIN)
 return message("Code invalide ou expiré, ou séance non confirmée. Contactez Bon Point.");
 const audit=await env.DB.prepare("SELECT status,room_ids FROM discord_room_audits WHERE name='fixed_pair'").first();
 const ids=validRoomIds(env);
 if(audit?.status!=="verified"||audit.room_ids!==ids.join(","))return message("Les salles sont momentanément indisponibles. Contactez Bon Point.");
 const end=new Date(Date.parse(info.starts_at_utc)+(info.session_type==="intro"?20:60)*MS_MIN).toISOString();
 const booked=await dbRows(env.DB,"SELECT room_id,starts_at_utc,ends_at_utc,state FROM discord_room_allocations WHERE state IN ('planned','active')");
 const roomId=chooseFixedRoom({startsAt:info.starts_at_utc,endsAt:end,booked,roomIds:ids,bufferMinutes:10});
 if(!roomId)return message("Les deux salles sont occupées sur ce créneau. Contactez Bon Point pour une autre solution.");
 try{
  const now=today();
  // The first statement inserts only with an unused code and an eligible
  // confirmed booking. D1.batch is atomic; DB triggers reject overlapping rooms.
  const results=await env.DB.batch([
   env.DB.prepare(`INSERT INTO discord_room_allocations(booking_id,room_id,participant_discord_id,starts_at_utc,ends_at_utc,state,created_at)
    SELECT b.id,?,?,b.starts_at_utc,?,'planned',?
    FROM discord_booking_link_codes c JOIN booking_requests b ON b.id=c.booking_id
    LEFT JOIN orders o ON o.id=b.order_id
    WHERE c.code_hash=? AND c.used_at IS NULL AND c.expires_at>?
    AND b.status='confirmed' AND b.id=?
    AND b.starts_at_utc>? AND (b.session_type='intro' OR (b.session_type='course' AND o.state='paid'))`)
    .bind(roomId,memberId,end,now,codeHash,now,info.booking_id,new Date(Date.now()+15*MS_MIN).toISOString()),
   env.DB.prepare("UPDATE discord_booking_link_codes SET used_at=? WHERE booking_id=? AND code_hash=? AND used_at IS NULL AND expires_at>?")
     .bind(now,info.booking_id,codeHash,now)
  ]);
  if(Number(results[0]?.meta?.changes||0)!==1)return message("Ce code n'est plus valide. Contactez Bon Point.");
 }catch(e){
  console.warn("Bon Point room assignment rejected",String(e).includes("schedule conflict")?"schedule-conflict":"invalid-or-used");
  return message("Impossible de réserver une salle pour cette séance. Contactez Bon Point.");
 }
 return message("✅ Votre compte Discord est associé au rendez-vous. La salle privée attribuée deviendra visible environ 10 minutes avant le début du cours, puis l'accès sera retiré après la séance.");
}
