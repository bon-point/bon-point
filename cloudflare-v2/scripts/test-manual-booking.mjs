import assert from "node:assert/strict";
import {test} from "node:test";
import {operations} from "../src/operations.js";

const ORIGIN="https://bon-point.github.io",adminEmail="soutien.bonpoint@gmail.com";
const token="a".repeat(64);
function dateForThursday(){
 for(let days=7;days<15;days++){
  const day=new Date(Date.now()+days*86400000);
  const date=new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),12));
  if(date.getUTCDay()===4)return date.toISOString().slice(0,10);
 }
 throw Error("No Thursday");
}
function fixture(){
 const written=[];
 const env={
  ADMIN_PANEL_ENABLED:"true",ADMIN_AUTH_SECRET:"dummy-auth-secret-over-32-characters",
  ADMIN_LOGIN_PASSWORD:"dummy-admin-password-more-than-24-characters",
  ADMIN_LOGIN_EMAIL:adminEmail,MAIL_API_KEY:"test-email-api",MAIL_SENDER:adminEmail,
  DB:{prepare(sql){
   const statement={args:[],bind(...params){this.args=params;return this},
    async first(){
     if(sql.includes("FROM admin_sessions"))return {email:adminEmail};
     if(sql.includes("SELECT id FROM booking_requests"))return null;
     return null;
    },
    async all(){return {results:[]}},
    async run(){written.push({sql,args:this.args});return {meta:{changes:1}}}
   };return statement;
  }}
 };
 const h={json:(d,status=200)=>new Response(JSON.stringify(d),{status}),fail:(m,status)=>new Response(JSON.stringify({error:m}),{status})};
 const data={parent_name:"Parent Demo",email:"parent.demo@example.invalid",grade:"Terminale",subject:"Mathématiques",
  date:dateForThursday(),time:"14:00",session_type:"intro",offer:"",parent_request_received:true};
 const request=(body,origin=ORIGIN,authorization="Bearer "+token)=>new Request("https://bon-point-v2.example/api/staff/bookings/manual",{
  method:"POST",headers:{Origin:origin,Authorization:authorization,"Content-Type":"application/json"},body:JSON.stringify(body)
 });
 return {env,h,data,request,written};
}
test("Only authenticated administrator can record a requested appointment",async()=>{
 const a=fixture();
 const ok=await operations(a.request(a.data),a.env,a.h);
 assert.equal(ok.status,201);
 assert.equal((await ok.json()).status,"requested");
 assert.equal(a.written.length,1);
 assert.match(a.written[0].sql,/INSERT INTO booking_requests/);
 assert.equal(a.written[0].args[1],"parent.demo@example.invalid");
 assert.equal(a.written[0].args[9],"intro");
 assert.equal(a.written[0].args.length,14);
 const wrongOrigin=await operations(a.request(a.data,"https://attacker.example"),a.env,a.h);
 assert.equal(wrongOrigin.status,403);
 const missingAuth=await operations(a.request(a.data,ORIGIN,"Bearer invalid"),a.env,a.h);
 assert.equal(missingAuth.status,401);
 assert.equal(a.written.length,1);
});
test("Cannot create a booking without recorded parent request or within closed hours",async()=>{
 const a=fixture();
 const missingConsent=await operations(a.request({...a.data,parent_request_received:false}),a.env,a.h);
 assert.equal(missingConsent.status,400);
 const outside=await operations(a.request({...a.data,time:"12:30"}),a.env,a.h);
 assert.equal(outside.status,400);
 const noOffer=await operations(a.request({...a.data,session_type:"course",offer:""}),a.env,a.h);
 assert.equal(noOffer.status,400);
 assert.equal(a.written.length,0);
});
