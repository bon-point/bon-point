import assert from "node:assert/strict";
import {test} from "node:test";
import {operations,schedulingPolicy} from "../src/operations.js";
import {slotsOverlap,freeFromConflicts,slotPreview} from "../src/booking-availability.js";
import {mailAllowed} from "../src/booking-notifications.js";
const {parisToUTC,validSlot,acceptedSchedule}=schedulingPolicy;

function futureThursday(){
 let x=new Date(Date.now()+9*86400000);
 for(let i=0;i<8;i++){
  const d=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth(),x.getUTCDate()+i,12));
  if(d.getUTCDay()===4)return d.toISOString().slice(0,10);
 }
 throw Error("Thursday not found");
}
const date=futureThursday();
const start=parisToUTC(date,"14:00");
const confirmed=[{starts_at_utc:start,session_type:"course",parent_email:"sensitive@example.invalid",parent_name:"NE JAMAIS AFFICHER"}];
test("Weekend and weekday session must finish within the announced opening hours",()=>{
 assert.equal(acceptedSchedule("2026-10-15","19:00","course"),true);
 assert.equal(acceptedSchedule("2026-10-15","19:30","course"),false);
 assert.equal(acceptedSchedule("2026-10-15","19:30","intro"),true);
 assert.equal(acceptedSchedule("2026-10-15","20:00","intro"),false);
 assert.equal(acceptedSchedule("2026-10-17","19:30","intro"),true);
 assert.equal(acceptedSchedule("2026-10-18","17:30","course"),false);
});
test("A confirmed 1-hour class blocks its whole duration and ten-minute buffer",()=>{
 assert.equal(slotsOverlap(start,"course",start,"intro"),true);
 assert.equal(freeFromConflicts(parisToUTC(date,"14:30"),"course",confirmed),false);
 assert.equal(freeFromConflicts(parisToUTC(date,"15:00"),"intro",confirmed),false);
 assert.equal(freeFromConflicts(parisToUTC(date,"15:30"),"course",confirmed),true);
});
test("Public calendar preview shows occupancy but never parent identities",async()=>{
 const db={prepare(sql){assert.match(sql,/SELECT starts_at_utc,session_type FROM booking_requests/);
  return {bind(value){assert.equal(value,date);return this},async all(){return {results:confirmed}}}
 }};
 const h={
  json:(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}}),
  fail:(text,status)=>new Response(JSON.stringify({error:text}),{status,headers:{"content-type":"application/json"}})
 };
 const input=new Request("https://bon-point-v2.example/api/site/slots?date="+date+"&session_type=course",{headers:{Origin:"https://bon-point.github.io"}});
 const response=await operations(input,{SLOT_PREVIEW_ENABLED:"true",SITE_INTAKE_ENABLED:"false",DB:db},h);
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.live_booking_enabled,false);
 assert.equal(result.slots.find(x=>x.time==="14:00").available,false);
 assert.equal(result.slots.find(x=>x.time==="14:30").available,false);
 assert.equal(result.slots.find(x=>x.time==="15:30").available,true);
 assert.equal(JSON.stringify(result).includes("sensitive@example.invalid"),false);
 assert.equal(JSON.stringify(result).includes("NE JAMAIS"),false);
 const denied=await operations(new Request(input.url,{headers:{Origin:"https://attacker.example"}}),
  {SLOT_PREVIEW_ENABLED:"true",DB:db},h);
 assert.equal(denied.status,403);
});
test("Reminder eligible only for paid confirmed lessons and 48h minimum",()=>{
 const now=Date.now();
 const job={kind:"reminder_parent",parent_email:"parent@example.invalid",starts_at_utc:new Date(now+50*3600000).toISOString(),
  booking_status:"confirmed",session_type:"course",payment_state:"paid"};
 assert.equal(mailAllowed(job,now),true);
 assert.equal(mailAllowed({...job,payment_state:"awaiting_payment"},now),false);
 assert.equal(mailAllowed({...job,booking_status:"declined"},now),false);
 assert.equal(mailAllowed({...job,starts_at_utc:new Date(now+47*3600000).toISOString()},now),false);
 assert.equal(mailAllowed({...job,session_type:"intro",payment_state:null},now),true);
});
