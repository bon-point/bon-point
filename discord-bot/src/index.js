/**
 * Bon Point — Discord interactions HTTP + notifications.
 * Slash commands: /aide, /site, /reserver, /support.
 * No Gateway process, no public student records, no payment collection.
 */
import {linkDiscordInteraction,runRoomAutomation,MEMBER_ALLOW} from "./room-automation.js";
const HOME="https://bon-point.github.io/bon-point/";
const BOOKING="https://bon-point.github.io/bon-point/reserver.html";
const EMAIL="soutien.bonpoint@gmail.com";
const API="https://discord.com/api/v10";
const EPHEMERAL=64;
const encoder=new TextEncoder();

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
function hexb(hex){if(!/^(?:[a-f0-9]{2})+$/i.test(hex||""))return null;return Uint8Array.from(hex.match(/../g),t=>parseInt(t,16))}
function configuredKey(env){return /^[0-9a-f]{64}$/i.test(env.DISCORD_PUBLIC_KEY||"")}
async function authorized(request,env){
 const sig=request.headers.get("X-Signature-Ed25519");
 const ts=request.headers.get("X-Signature-Timestamp");
 if(!configuredKey(env)||!sig||!/^[0-9a-f]{128}$/i.test(sig)||!ts||!/^\d{10}$/.test(ts))return null;
 if(Math.abs(Date.now()/1000-Number(ts))>300)return null;
 const raw=await request.text();
 if(raw.length>262144)return null;
 try{
  const key=await crypto.subtle.importKey("raw",hexb(env.DISCORD_PUBLIC_KEY),{name:"Ed25519"},false,["verify"]);
  const ok=await crypto.subtle.verify("Ed25519",key,hexb(sig),encoder.encode(ts+raw));
  return ok?JSON.parse(raw):null;
 }catch{return null}
}
function ephemeral(content,components=[]){return json({type:4,data:{content,flags:EPHEMERAL,allowed_mentions:{parse:[]},...(components.length?{components} :{})}})}
function link(label,url){return {type:2,style:5,label,url}}
function buttons(...items){return [{type:1,components:items.map(([label,url])=>link(label,url))}]}
function reply(name){
 switch(name){
  case "aide":return ephemeral("**Bon Point — Commandes du serveur**\n• `/site` : découvrir nos formules de soutien scolaire.\n• `/reserver` : proposer une date et une heure.\n• `/support` : contacter Bon Point.\n• `/lier` : associer un cours confirmé avec un code temporaire transmis au responsable légal.\n\nLes réservations, paiements et dossiers pédagogiques se gèrent sur le site, jamais dans un salon public.",buttons(["Site Bon Point",HOME],["Réserver un cours",BOOKING]));
  case "site":return ephemeral("**Bon Point** · Cours particuliers en mathématiques et physique-chimie, pour le collège et le lycée. Découvrez les offres et le fonctionnement sur notre site.",buttons(["Ouvrir le site",HOME]));
  case "reserver":return ephemeral("**Proposer un créneau**\nChoisissez une date et une heure dans le calendrier Bon Point. Un créneau devient réservé uniquement après confirmation écrite. Aucune donnée scolaire personnelle n'est à envoyer ici.",buttons(["Ouvrir le calendrier",BOOKING]));
  case "support":return ephemeral("**Besoin d'aide ?**\nContactez Bon Point par e-mail : **"+EMAIL+"**. Pour une question de réservation, précisez seulement votre référence dans l'e-mail. Ne publiez jamais de coordonnées, factures ou données scolaires dans un salon public.",buttons(["Consulter le site",HOME]));
  default:return ephemeral("Commande non reconnue. Utilisez `/aide`.");
 }
}
const COMMANDS=[
 {name:"aide",description:"Découvrir les commandes et le fonctionnement de Bon Point",type:1},
 {name:"site",description:"Obtenir le lien du site officiel Bon Point",type:1},
 {name:"reserver",description:"Ouvrir le calendrier de réservation des cours",type:1},
 {name:"support",description:"Savoir comment contacter Bon Point",type:1},
 {name:"lier",description:"Associer votre compte Discord à un cours confirmé",type:1,options:[{type:3,name:"code",description:"Code unique du responsable légal (20 caractères)",required:true,min_length:20,max_length:20}]}
];
const COMMAND_SCHEMA="five-commands-private-link-v2";
function registrationReady(env){
 return env.DISCORD_AUTO_REGISTER==="true"&&env.DB&&configuredKey(env)&&/^\d{17,22}$/.test(env.DISCORD_GUILD_ID||"")&&/^\d{17,22}$/.test(env.DISCORD_APPLICATION_ID||"")&&env.DISCORD_BOT_TOKEN;
}
async function registerGuildCommands(env){
 if(!registrationReady(env))return;
 const row=await env.DB.prepare("SELECT value FROM discord_bot_state WHERE name='command_schema'").first();
 if(row?.value===COMMAND_SCHEMA)return;
 const endpoint=API+"/applications/"+env.DISCORD_APPLICATION_ID+"/guilds/"+env.DISCORD_GUILD_ID+"/commands";
 for(const command of COMMANDS){
  const response=await fetch(endpoint,{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bot "+env.DISCORD_BOT_TOKEN},
   body:JSON.stringify(command)
  });
  if(!response.ok){
   console.warn("Discord command registration failed",command.name,response.status);
   return;
  }
 }
 await env.DB.prepare("INSERT INTO discord_bot_state(name,value,updated_at) VALUES('command_schema',?,datetime('now')) ON CONFLICT(name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(COMMAND_SCHEMA).run();
 console.log("Bon Point Discord commands registered in configured guild");
}

// Fixed-room mode: only the two explicitly authorized voice-channel IDs.
// Read-only safety audit. NEVER change Discord permissions in this module.
const ROOM_VIEW=1024n;
const snowflake=/^\d{17,22}$/;
export function fixedRoomIds(env){
 const one=String(env.DISCORD_ROOM_1_ID||""),two=String(env.DISCORD_ROOM_2_ID||"");
 return snowflake.test(one)&&snowflake.test(two)&&one!==two?[one,two]:[];
}
export function chooseFixedRoom({startsAt,endsAt,booked=[],roomIds,bufferMinutes=10}){
 if(!Array.isArray(roomIds)||roomIds.length!==2||roomIds[0]===roomIds[1]||!roomIds.every(x=>snowflake.test(x)))return null;
 const start=Date.parse(startsAt),end=Date.parse(endsAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>6*3600000||!Number.isInteger(bufferMinutes)||bufferMinutes<0||bufferMinutes>30)return null;
 for(const id of roomIds){
  const conflict=booked.some(r=>{
   if(r.room_id!==id||!["planned","active"].includes(r.state))return false;
   const otherStart=Date.parse(r.starts_at_utc),otherEnd=Date.parse(r.ends_at_utc);
   if(!Number.isFinite(otherStart)||!Number.isFinite(otherEnd))return true;
   const margin=bufferMinutes*60000;
   return start<otherEnd+margin && end+margin>otherStart;
  });
  if(!conflict)return id;
 }
 return null; // Two concurrent rooms fully booked: never open another.
}
function deniesPublicView(channel,guildId){
 const all=(channel.permission_overwrites||[]).find(o=>o.id===guildId && Number(o.type)===0);
 return !!all && (BigInt(all.deny||"0")&ROOM_VIEW)!==0n;
}
function hasUnexpectedRoleAccess(channel,guildRoles,guildId,allowedMemberIds=new Set()){
 for(const entry of channel.permission_overwrites||[]){
  if((BigInt(entry.allow||"0")&ROOM_VIEW)===0n)continue;
  if(entry.id===guildId)return true;
  if(Number(entry.type)===1){
   const ours=allowedMemberIds.has(String(entry.id)) && BigInt(entry.allow||"0")===BigInt(MEMBER_ALLOW) && BigInt(entry.deny||"0")===0n;
   if(!ours)return true;
   continue;
  }
  const role=guildRoles.find(x=>x.id===entry.id);
  if(!role||!["Administrateur","Professeur","Bonpoint"].includes(role.name))return true;
 }
 return false;
}
async function readDiscordJson(url,token){
 const r=await fetch(url,{headers:{"Authorization":"Bot "+token}});
 if(!r.ok)throw Error("Discord read-only audit HTTP "+r.status);
 return r.json();
}
async function auditFixedRooms(env){
 const ids=fixedRoomIds(env);
 if(env.DISCORD_ROOM_AUDIT_ENABLED!=="true"||!env.DB||!env.DISCORD_BOT_TOKEN||!snowflake.test(env.DISCORD_GUILD_ID||"")||ids.length!==2)return;
 const state=await env.DB.prepare("SELECT room_ids,status,checked_at FROM discord_room_audits WHERE name='fixed_pair'").first();
 if(state?.room_ids===ids.join(",")&&state.status==="verified"&&Date.now()-Date.parse(state.checked_at)<86400000)return;
 let status="blocked",reason="unknown",categoryId=null;
 try{
  // Identify the denied endpoint precisely without storing any Discord content.
  const fetchStage=async(stage,url)=>{
   try{return await readDiscordJson(url,env.DISCORD_BOT_TOKEN)}
   catch(e){
    const code=/Discord read-only audit HTTP (\d{3})/.exec(String(e.message||""))?.[1];
    throw Error(stage+":"+(code||"failed"));
   }
  };
  const first=await fetchStage("voice-1",API+"/channels/"+ids[0]);
  const second=await fetchStage("voice-2",API+"/channels/"+ids[1]);
  const roles=await fetchStage("guild-roles",API+"/guilds/"+env.DISCORD_GUILD_ID+"/roles");
  // Only previously recorded active allocations can explain member-specific overwrites.
  const active=await env.DB.prepare("SELECT room_id,participant_discord_id FROM discord_room_allocations WHERE state IN ('planned','active') AND grant_attempted_at IS NOT NULL AND access_revoked_at IS NULL").all();
  const membersForRoom=id=>new Set((active.results||[]).filter(a=>a.room_id===id).map(a=>a.participant_discord_id));
  if(first.id!==ids[0]||second.id!==ids[1]||first.type!==2||second.type!==2||
     first.guild_id!==env.DISCORD_GUILD_ID||second.guild_id!==env.DISCORD_GUILD_ID)reason="wrong-channel-or-guild";
  else if(!first.parent_id||first.parent_id!==second.parent_id)reason="different-categories";
  else{
   const parent=await fetchStage("category",API+"/channels/"+first.parent_id);
   categoryId=first.parent_id;
   if(parent.guild_id!==env.DISCORD_GUILD_ID||parent.type!==4)reason="not-same-category";
   else if(!deniesPublicView(parent,env.DISCORD_GUILD_ID)||
           !deniesPublicView(first,env.DISCORD_GUILD_ID)||
           !deniesPublicView(second,env.DISCORD_GUILD_ID))reason="public-view-not-explicitly-denied";
   else if(!Array.isArray(roles)||hasUnexpectedRoleAccess(parent,roles,env.DISCORD_GUILD_ID)||hasUnexpectedRoleAccess(first,roles,env.DISCORD_GUILD_ID,membersForRoom(first.id))||hasUnexpectedRoleAccess(second,roles,env.DISCORD_GUILD_ID,membersForRoom(second.id)))reason="unapproved-visibility-overwrite";
   else{status="verified";reason="private-voice-pair-read-only"}
  }
 }catch(e){
  const detail=/^(voice-1|voice-2|guild-roles|category):(403|404|429|failed|5\d\d|4\d\d)$/.exec(String(e.message||""));
  reason=detail?"discord-"+detail[1]+"-"+detail[2]:"discord-read-error";
  console.warn("Bonpoint voice room audit:",reason);
 }
 await env.DB.prepare("INSERT INTO discord_room_audits(name,room_ids,status,reason,category_id,checked_at) VALUES('fixed_pair',?,?,?,?,datetime('now')) ON CONFLICT(name) DO UPDATE SET room_ids=excluded.room_ids,status=excluded.status,reason=excluded.reason,category_id=excluded.category_id,checked_at=excluded.checked_at")
 .bind(ids.join(","),status,reason,categoryId).run();
}

function safeDate(d){return /^20\d{2}-\d{2}-\d{2}$/.test(d||"")?d.split("-").reverse().join("/"):"date à confirmer"}
function safeTime(t){return /^([01]\d|2[0-3]):[0-5]\d$/.test(t||"")?t:"horaire à confirmer"}
function enabled(env){return env.DISCORD_NOTIFICATIONS_ENABLED==="true"&&env.DB&&env.DISCORD_BOT_TOKEN&&/^\d{17,22}$/.test(env.DISCORD_ADMIN_CHANNEL_ID||"")}
function validStart(s){return typeof s==="string"&&s.length>0}
async function enqueue(env){
 const from=env.DISCORD_SYNC_FROM||"9999-12-31T00:00:00.000Z";
 const requested=await env.DB.prepare("SELECT id,requested_date,time_local,session_type FROM booking_requests WHERE created_at>=? AND starts_at_utc IS NOT NULL ORDER BY created_at DESC LIMIT 80").bind(from).all();
 for(const b of requested.results||[]){
  const type=b.session_type==="intro"?"premier échange":"cours";
  const detail="🔔 **Proposition de rendez-vous** · "+safeDate(b.requested_date)+" à "+safeTime(b.time_local)+" · "+type+".\nRéférence interne : `"+b.id.slice(0,8)+"`. À examiner dans l'administration Bon Point.";
  await env.DB.prepare("INSERT OR IGNORE INTO discord_notifications(event_key,category,message,state,attempts,created_at) VALUES(?, 'booking_requested', ?, 'pending', 0, datetime('now'))").bind("request:"+b.id,detail).run();
 }
 const confirmed=await env.DB.prepare("SELECT id,requested_date,time_local,session_type FROM booking_requests WHERE created_at>=? AND status='confirmed' AND starts_at_utc IS NOT NULL ORDER BY created_at DESC LIMIT 80").bind(from).all();
 for(const b of confirmed.results||[]){
  const detail="✅ **Rendez-vous confirmé** · "+safeDate(b.requested_date)+" à "+safeTime(b.time_local)+". Référence `"+b.id.slice(0,8)+"`.";
  await env.DB.prepare("INSERT OR IGNORE INTO discord_notifications(event_key,category,message,state,attempts,created_at) VALUES(?, 'booking_confirmed', ?, 'pending', 0, datetime('now'))").bind("confirmed:"+b.id,detail).run();
 }
 const paid=await env.DB.prepare("SELECT o.id,b.requested_date,b.time_local FROM orders o JOIN booking_requests b ON b.order_id=o.id WHERE o.created_at>=? AND o.state='paid' AND b.status='confirmed' ORDER BY o.created_at DESC LIMIT 80").bind(from).all();
 for(const b of paid.results||[]){
  const detail="💳 **Paiement confirmé par Stripe** pour un rendez-vous prévu le "+safeDate(b.requested_date)+" à "+safeTime(b.time_local)+". Référence de commande `"+b.id.slice(0,8)+"`.";
  await env.DB.prepare("INSERT OR IGNORE INTO discord_notifications(event_key,category,message,state,attempts,created_at) VALUES(?, 'payment_confirmed', ?, 'pending', 0, datetime('now'))").bind("paid:"+b.id,detail).run();
 }
}
async function sendQueued(env){
 const pending=await env.DB.prepare("SELECT event_key,category,message,attempts FROM discord_notifications WHERE state='pending' AND attempts<6 ORDER BY created_at LIMIT 12").all();
 for(const event of pending.results||[]){
  const locked=await env.DB.prepare("UPDATE discord_notifications SET state='sending',attempts=attempts+1 WHERE event_key=? AND state='pending'").bind(event.event_key).run();
  if(Number(locked.meta?.changes||0)!==1)continue;
  try{
   const response=await fetch(API+"/channels/"+env.DISCORD_ADMIN_CHANNEL_ID+"/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bot "+env.DISCORD_BOT_TOKEN},
    body:JSON.stringify({content:event.message,allowed_mentions:{parse:[]}})
   });
   if(!response.ok){
    const errorText=await response.text();
    console.warn("Discord notification HTTP error",response.status,errorText.slice(0,100));
    await env.DB.prepare("UPDATE discord_notifications SET state=CASE WHEN attempts>=6 THEN 'failed' ELSE 'pending' END WHERE event_key=?").bind(event.event_key).run();
    if(response.status===429)break;
   }else{
    await env.DB.prepare("UPDATE discord_notifications SET state='delivered',sent_at=datetime('now') WHERE event_key=?").bind(event.event_key).run();
   }
  }catch(err){
   console.error("Discord notification failed",String(err).slice(0,160));
   await env.DB.prepare("UPDATE discord_notifications SET state=CASE WHEN attempts>=6 THEN 'failed' ELSE 'pending' END WHERE event_key=?").bind(event.event_key).run();
  }
 }
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health"&&request.method==="GET")return json({name:"Bon Point Discord",version:1,discord_interactions_configured:configuredKey(env)&&/^\d{17,22}$/.test(env.DISCORD_GUILD_ID||""),notifications_configured:!!enabled(env)});
  if(url.pathname!=="/interactions")return new Response("Not found",{status:404});
  if(request.method!=="POST")return new Response("Method not allowed",{status:405});
  const interaction=await authorized(request,env);
  if(!interaction)return new Response("Invalid Discord signature",{status:401});
  if(interaction.type===1)return json({type:1});
  if(interaction.type!==2)return ephemeral("Interaction non prise en charge.");
  if(!/^\d{17,22}$/.test(env.DISCORD_GUILD_ID||"")||interaction.guild_id!==env.DISCORD_GUILD_ID)return ephemeral("Cette commande est réservée au serveur Bonpoint.");
  if(interaction.data?.name==="lier"){
   try{return json(await linkDiscordInteraction(interaction,env,chooseFixedRoom))}
   catch(e){console.warn("Discord linking request failed",String(e.message||"").slice(0,80));return ephemeral("La liaison est momentanément indisponible. Contactez Bon Point.")}
  }
  return reply(interaction.data?.name);
 },
 async scheduled(_event,env,ctx){
  ctx.waitUntil((async()=>{
   await registerGuildCommands(env);
   await auditFixedRooms(env);
   await runRoomAutomation(env);
   if(!enabled(env))return;
   await enqueue(env);
   await sendQueued(env);
  })());
 }
};
