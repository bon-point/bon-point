import assert from "node:assert/strict";
import {test} from "node:test";
import {runRoomAutomation,MEMBER_ALLOW} from "../src/room-automation.js";

const room1="1558922846896529418",room2="1558922881386418276";
const guild="1536096215996043286",cat="1536096215996043290";
const member="1536096215996043340";
const bookingId="ed1d370b-9ea3-434b-b3cf-82b7af0fd331";
const instant=(mins)=>new Date(Date.now()+mins*60_000).toISOString();
function setup({state="planned",minutesUntil=5,paid=true,accessEnabled=true,alreadyGranted=false}={}){
 const a={
  booking_id:bookingId,room_id:room1,participant_discord_id:member,
  starts_at_utc:instant(minutesUntil),ends_at_utc:instant(minutesUntil+60),
  state,grant_attempted_at:alreadyGranted?instant(-45):null,
  access_granted_at:alreadyGranted?instant(-40):null,access_revoked_at:null,revoke_requested_at:null,access_lease_until:null,
  booking_status:"confirmed",session_type:"course",payment_state:paid?"paid":"awaiting_payment"
 };
 let overwrite=alreadyGranted,calls=[],logs=[];
 const db={prepare(sql){return {bind(...args){
  return {
   async all(){
    if(sql.includes("FROM discord_room_allocations a JOIN booking_requests b"))return {results:[{...a}]};
    return {results:[]};
   },
   async first(){
    if(sql.includes("FROM discord_room_audits"))return {status:"verified",category_id:cat,room_ids:room1+","+room2};
    if(sql.includes("FROM discord_room_allocations a JOIN booking_requests b"))return {access_state:a.state,revoke_requested_at:a.revoke_requested_at,access_revoked_at:a.access_revoked_at,booking_status:a.booking_status,session_type:a.session_type,payment_state:a.payment_state};
    return null;
   },
   async run(){
    logs.push({sql,args});
    if(sql.includes("SET access_lease_until=?")){a.access_lease_until=args[0];return {meta:{changes:1}}}
    if(sql.includes("SET access_lease_until=NULL")){a.access_lease_until=null;return {meta:{changes:1}}}
    if(sql.includes("SET grant_attempted_at=")){if(a.state!=="planned"||a.revoke_requested_at)return {meta:{changes:0}};a.grant_attempted_at=args[0];return {meta:{changes:1}}}
    if(sql.includes("SET state='active'")){if(a.revoke_requested_at)return {meta:{changes:0}};a.state="active";a.access_granted_at=args[0];return {meta:{changes:1}}}
    if(sql.includes("SET state=?,access_revoked_at=?")){a.state=args[0];a.access_revoked_at=args[1];return {meta:{changes:1}}}
    if(sql.includes("SET state='cancelled'")){a.state="cancelled";return {meta:{changes:1}}}
    return {meta:{changes:1}};
   }
  }
 }}};
 const env={DB:db,DISCORD_BOT_TOKEN:"fake-secret-only-for-unit-tests",DISCORD_ROOM_ACCESS_ENABLED:String(accessEnabled),DISCORD_ROOM_1_ID:room1,DISCORD_ROOM_2_ID:room2,DISCORD_GUILD_ID:guild};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async (input,options={})=>{
  const url=new URL(String(input)),method=options.method||"GET";calls.push({path:url.pathname,method,body:options.body});
  if(url.pathname==="/channels/"+room1&&method==="GET"){
   const overwrites=[{id:guild,type:0,deny:"1024",allow:"0"}];
   if(overwrite)overwrites.push({id:member,type:1,allow:MEMBER_ALLOW,deny:"0"});
   return new Response(JSON.stringify({id:room1,type:2,guild_id:guild,parent_id:cat,permission_overwrites:overwrites}),{status:200,headers:{"Content-Type":"application/json"}});
  }
  if(url.pathname==="/guilds/"+guild+"/members/"+member&&method==="GET")return new Response("{}");
  if(url.pathname==="/channels/"+room1+"/permissions/"+member&&method==="PUT"){overwrite=true;return new Response(null,{status:204})}
  if(url.pathname==="/channels/"+room1+"/permissions/"+member&&method==="DELETE"){overwrite=false;return new Response(null,{status:204})}
  throw new Error("Unexpected Discord endpoint "+method+" "+url.pathname);
 };
 return {env,a,calls,logs,restore(){globalThis.fetch=originalFetch},hasOverwrite(){return overwrite}};
}
test("Only a confirmed and paid course can cause a member-specific grant",async()=>{
 const x=setup();
 try{
  await runRoomAutomation(x.env);
  assert.equal(x.hasOverwrite(),true);
  assert.equal(x.a.state,"active");
  const grants=x.calls.filter(c=>c.method==="PUT");
  assert.equal(grants.length,1);
  assert.equal(grants[0].path,"/channels/"+room1+"/permissions/"+member);
  assert.deepEqual(JSON.parse(grants[0].body),{type:1,allow:MEMBER_ALLOW,deny:"0"});
  assert.equal(x.calls.some(c=>c.path.includes(guild+"/permissions")||c.path.includes(room2+"/permissions")),false);
 }finally{x.restore()}
});
test("No payment means no grants and no Discord API requests",async()=>{
 const x=setup({paid:false});
 try{await runRoomAutomation(x.env);assert.equal(x.calls.length,0);assert.equal(x.a.state,"planned");}
 finally{x.restore()}
});
test("An expired participant overwrite is deleted even if new grants are disabled",async()=>{
 const x=setup({state:"active",minutesUntil:-100,accessEnabled:false,alreadyGranted:true});
 try{
  await runRoomAutomation(x.env);
  assert.equal(x.a.state,"completed");
  assert.equal(x.a.access_revoked_at!==null,true);
  assert.equal(x.hasOverwrite(),false);
  assert.equal(x.calls.filter(c=>c.method==="DELETE").length,1);
  assert.equal(x.calls.filter(c=>c.method==="PUT").length,0);
 }finally{x.restore()}
});
test("Cancelled booking forces a revoke without waiting for the end of class",async()=>{
 const x=setup({state:"active",minutesUntil:1,alreadyGranted:true});
 x.a.booking_status="declined";
 try{
  await runRoomAutomation(x.env);
  assert.equal(x.a.state,"cancelled");
  assert.equal(x.hasOverwrite(),false);
  assert.equal(x.calls.some(c=>c.method==="DELETE"),true);
 }finally{x.restore()}
});
