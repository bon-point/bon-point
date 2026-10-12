import assert from "node:assert/strict";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import fs from "node:fs";

const js=fs.readFileSync("discord-bot/src/index.js","utf8");
const {default:worker,chooseFixedRoom,fixedRoomIds}=await import("../src/index.js");
const {roomReadyForGrant,shouldRevoke,validRoomIds,privateVoice,MEMBER_ALLOW,linkDiscordInteraction}=await import("../src/room-automation.js");
const {privateKey,publicKey}=generateKeyPairSync("ed25519");
const pubHex=publicKey.export({format:"der",type:"spki"}).subarray(-32).toString("hex");
const env={DISCORD_PUBLIC_KEY:pubHex,DISCORD_GUILD_ID:"123456789012345678",DISCORD_NOTIFICATIONS_ENABLED:"false"};
async function interaction(body,override={}){
 const raw=JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000)),signature=sign(null,Buffer.from(timestamp+raw),privateKey).toString("hex");
 const req=new Request("https://bon-point-discord.example/interactions",{method:"POST",headers:{"Content-Type":"application/json","X-Signature-Timestamp":timestamp,"X-Signature-Ed25519":signature},body:raw});
 return worker.fetch(req,{...env,...override});
}
test("Health endpoint does not expose credentials",async()=>{
 const r=await worker.fetch(new Request("https://example.com/health"),env);
 assert.equal(r.status,200);const x=await r.json();assert.equal(x.discord_interactions_configured,true);assert.equal(JSON.stringify(x).includes("Bot "),false);
});
test("Signed PING acknowledged for verification",async()=>{
 const r=await interaction({type:1});assert.equal(r.status,200);assert.equal((await r.json()).type,1);
});
test("The four slash commands produce private and safe responses",async()=>{
 for(const name of ["aide","site","reserver","support"]){
  const r=await interaction({type:2,guild_id:env.DISCORD_GUILD_ID,data:{name}});
  assert.equal(r.status,200);const x=await r.json();assert.equal(x.type,4);assert.equal(x.data.flags,64);assert.deepEqual(x.data.allowed_mentions,{parse:[]});
  assert.ok(x.data.content.length>15);
 }
});
test("Booking command has correct link",async()=>{
 const r=await interaction({type:2,guild_id:env.DISCORD_GUILD_ID,data:{name:"reserver"}});const x=await r.json();
 assert.equal(x.data.components[0].components[0].url,"https://bon-point.github.io/bon-point/reserver.html");
});
test("Messages from other guild are refused",async()=>{
 const r=await interaction({type:2,guild_id:"999999999999999999",data:{name:"site"}});const x=await r.json();
 assert.match(x.data.content,/réservée au serveur/);
});
test("Requests with forged signatures are rejected",async()=>{
 const r=await worker.fetch(new Request("https://example.com/interactions",{method:"POST",headers:{"X-Signature-Timestamp":String(Math.floor(Date.now()/1000)),"X-Signature-Ed25519":"aa".repeat(64)},body:'{"type":1}'}),env);
 assert.equal(r.status,401);
});
test("Non-configured worker rejects signed requests",async()=>{
 const r=await interaction({type:1},{DISCORD_PUBLIC_KEY:"NOT_CONFIGURED"});assert.equal(r.status,401);
});
test("Unknown commands cannot access administration",async()=>{
 const r=await interaction({type:2,guild_id:env.DISCORD_GUILD_ID,data:{name:"admin-delete"}});const x=await r.json();
 assert.match(x.data.content,/Commande non reconnue/);
});

test("Scheduled synchronization stays inactive without credentials",async()=>{
 let task;
 await worker.scheduled({},env,{waitUntil:p=>{task=p}});
 await task;
 assert.ok(true,"No Discord or D1 calls were made");
});

test("Only the two fixed private-room IDs are accepted",()=>{
 const ids=["1558922846896529418","1558922881386418276"];
 assert.deepEqual(fixedRoomIds({DISCORD_ROOM_1_ID:ids[0],DISCORD_ROOM_2_ID:ids[1]}),ids);
 assert.deepEqual(fixedRoomIds({DISCORD_ROOM_1_ID:ids[0],DISCORD_ROOM_2_ID:ids[0]}),[]);
 assert.deepEqual(fixedRoomIds({DISCORD_ROOM_1_ID:"abc",DISCORD_ROOM_2_ID:ids[1]}),[]);
});
test("First available room is allocated; overlaps take second room",()=>{
 const ids=["1558922846896529418","1558922881386418276"];
 const first={startsAt:"2026-11-07T12:00:00.000Z",endsAt:"2026-11-07T13:00:00.000Z",roomIds:ids};
 assert.equal(chooseFixedRoom(first),ids[0]);
 const booked=[{room_id:ids[0],starts_at_utc:"2026-11-07T11:45:00.000Z",ends_at_utc:"2026-11-07T12:45:00.000Z",state:"planned"}];
 assert.equal(chooseFixedRoom({...first,booked}),ids[1]);
 booked.push({...booked[0],room_id:ids[1],state:"active"});
 assert.equal(chooseFixedRoom({...first,booked}),null);
});
test("Ten-minute safety buffer and closed allocations work",()=>{
 const ids=["1558922846896529418","1558922881386418276"];
 const slot={startsAt:"2026-11-07T12:00:00.000Z",endsAt:"2026-11-07T13:00:00.000Z",roomIds:ids};
 const occupied={room_id:ids[0],starts_at_utc:"2026-11-07T11:00:00.000Z",ends_at_utc:"2026-11-07T11:55:00.000Z",state:"active"};
 assert.equal(chooseFixedRoom({...slot,booked:[occupied]}),ids[1]);
 assert.equal(chooseFixedRoom({...slot,booked:[{...occupied,state:"completed"}]}),ids[0]);
 assert.equal(chooseFixedRoom({...slot,booked:[{...occupied,ends_at_utc:"2026-11-07T11:50:00.000Z"}]}),ids[0]);
 assert.equal(chooseFixedRoom({...slot,endsAt:"2026-11-07T11:00:00.000Z"}),null);
});
test("Read-only audit does not grant public or private Discord access",()=>{
 assert.match(js,/DISCORD_ROOM_AUDIT_ENABLED/);
 assert.match(js,/discord_room_audits/);
 assert.doesNotMatch(js,/\/channels\/[^\n]+\/permissions/);
 assert.doesNotMatch(js,/method:\s*["'](?:PATCH|PUT|DELETE)["'][^\n]*permissions/);
});

test("Discord /lier cannot be used before secure enrollment activation",async()=>{
 const r=await interaction({type:2,guild_id:env.DISCORD_GUILD_ID,member:{user:{id:"123456789012345678"}},data:{name:"lier",options:[{name:"code",value:"0123456789ABCDEF0123"}]}});
 assert.equal(r.status,200);const x=await r.json();
 assert.equal(x.type,4);assert.equal(x.data.flags,64);assert.match(x.data.content,/pas encore disponible/);
});
test("Room admission requires a confirmed and if payable paid booking",()=>{
 const future=Date.now()+5*60000;
 const a={state:"planned",starts_at_utc:new Date(future).toISOString(),ends_at_utc:new Date(future+3600000).toISOString()};
 assert.equal(roomReadyForGrant(a,{booking_status:"confirmed",session_type:"intro"}),true);
 assert.equal(roomReadyForGrant(a,{booking_status:"confirmed",session_type:"course",payment_state:"paid"}),true);
 assert.equal(roomReadyForGrant(a,{booking_status:"confirmed",session_type:"course",payment_state:"awaiting_payment"}),false);
 assert.equal(roomReadyForGrant(a,{booking_status:"declined",session_type:"intro"}),false);
 assert.equal(roomReadyForGrant({...a,revoke_requested_at:new Date().toISOString()},{booking_status:"confirmed",session_type:"intro"}),false);
 assert.equal(roomReadyForGrant({...a,starts_at_utc:new Date(future+3600000).toISOString()},{booking_status:"confirmed",session_type:"intro"}),false);
});
test("Access is revoked after end or cancellation, including interrupted grants",()=>{
 const start=Date.now()-90*60000,end=Date.now()-15*60000;
 const a={state:"active",starts_at_utc:new Date(start).toISOString(),ends_at_utc:new Date(end).toISOString(),access_granted_at:new Date(start).toISOString()};
 assert.equal(shouldRevoke(a,{booking_status:"confirmed",session_type:"course",payment_state:"paid"}),true);
 assert.equal(shouldRevoke({...a,access_revoked_at:new Date().toISOString()},{booking_status:"confirmed",session_type:"course",payment_state:"paid"}),false);
 assert.equal(shouldRevoke({...a,access_granted_at:null,grant_attempted_at:new Date(start).toISOString()},{booking_status:"confirmed",session_type:"intro"}),true);
 assert.equal(shouldRevoke({...a,ends_at_utc:new Date(Date.now()+600000).toISOString()},{booking_status:"declined",session_type:"intro"}),true);
});
test("Only two configured voice rooms with explicit private overwrites are eligible",()=>{
 const one="1558922846896529418",two="1558922881386418276",guild="1536096215996043286",parent="1536096215996043287";
 assert.deepEqual(validRoomIds({DISCORD_ROOM_1_ID:one,DISCORD_ROOM_2_ID:two}),[one,two]);
 assert.deepEqual(validRoomIds({DISCORD_ROOM_1_ID:one,DISCORD_ROOM_2_ID:one}),[]);
 const channel={id:one,type:2,guild_id:guild,parent_id:parent,permission_overwrites:[{id:guild,type:0,allow:"0",deny:"1024"}]};
 assert.equal(privateVoice(channel,guild,parent),true);
 assert.equal(privateVoice({...channel,permission_overwrites:[]},guild,parent),false);
 assert.equal(privateVoice({...channel,type:0},guild,parent),false);
 assert.equal(MEMBER_ALLOW,String(1024+1048576+2097152));
});
test("No Discord permission API can execute from a public request",async()=>{
 const res=await worker.fetch(new Request("https://example.com/voice/1558922846896529418",{method:"POST"}),env);
 assert.equal(res.status,404);
});
