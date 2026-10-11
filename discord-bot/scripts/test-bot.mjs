import assert from "node:assert/strict";
import {test} from "node:test";
import {generateKeyPairSync,sign,webcrypto} from "node:crypto";
import fs from "node:fs";

globalThis.crypto=webcrypto;
const js=fs.readFileSync("discord-bot/src/index.js","utf8");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
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
