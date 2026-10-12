import assert from "node:assert/strict";
import {test} from "node:test";
import {operations} from "../src/operations.js";

const address="support-test@bonpoint.example";
const origin="https://bon-point.github.io";
const request=(path,body,from=origin)=>new Request("https://bon-point-v2.example"+path,{
 method:"POST",headers:{"Origin":from,"Content-Type":"application/json"},
 body:JSON.stringify(body)
});
const transport={
 json:(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}}),
 fail:(message,status)=>new Response(JSON.stringify({error:message}),{status,headers:{"content-type":"application/json"}}),
 now:()=>new Date().toISOString(),
 safe:s=>String(s).replace(/[<>&"]/g,""),
 email:async()=>{}
};
function instance(){
 const storage={code:null,session:null,issuedEmails:[],attempts:0};
 const DB={
  prepare(sql){
   const statement={
    values:[],
    bind(...args){this.values=args;return this},
    async first(){
     if(sql.includes("FROM admin_login_attempts"))return storage.attempts>=6?{window_started:new Date().toISOString(),attempts:storage.attempts}:null;
     if(sql.includes("FROM admin_login_codes"))return storage.code;
     if(sql.includes("FROM admin_sessions"))return storage.session;
     return null;
    },
    async run(){
     if(sql.includes("INSERT INTO admin_login_attempts")){storage.attempts++;return {meta:{changes:1}}}
     if(sql.includes("INSERT INTO admin_login_codes")){
      const [email,code_hash,sent_at,expires_at]=this.values;
      storage.code={email,code_hash,sent_at,expires_at,attempts:0};
     }
     if(sql.includes("UPDATE admin_login_codes SET attempts")){if(storage.code)storage.code.attempts++}
     if(sql.includes("DELETE FROM admin_login_codes"))storage.code=null;
     if(sql.includes("INSERT INTO admin_sessions")){
      const [token_hash,email,created_at,expires_at]=this.values;
      storage.session={token_hash,email,created_at,expires_at};
     }
     if(sql.includes("DELETE FROM admin_sessions"))storage.session=null;
     return {meta:{changes:1}};
    },
    async all(){
     if(sql.includes("FROM booking_requests"))return {results:[]};
     return {results:[]};
    }
   };
   return statement;
  },
  async batch(stmts){return Promise.all(stmts.map(x=>x.run()))}
 };
 const env={
  ADMIN_PANEL_ENABLED:"true",DB,MAIL_API_KEY:"fake-test-key",MAIL_SENDER:address,
  ADMIN_LOGIN_EMAIL:address,ADMIN_LOGIN_PASSWORD:"example-password-with-at-least-24-chars",
  ADMIN_AUTH_SECRET:"example-auth-secret-with-at-least-32-characters"
 };
 const h={...transport,email:async(_env,to,subject,body)=>{storage.issuedEmails.push({to,subject,body})}};
 return {env,h,storage};
}
test("Admin login feature gate stays closed when disabled",async()=>{
 const {env,h}=instance();env.ADMIN_PANEL_ENABLED="false";
 const r=await operations(request("/api/staff/login",{email:address,password:env.ADMIN_LOGIN_PASSWORD}),env,h);
 assert.equal(r.status,503);
});
test("Wrong browser Origin is denied before touching credentials",async()=>{
 const {env,h,storage}=instance();
 const r=await operations(request("/api/staff/login",{email:address,password:env.ADMIN_LOGIN_PASSWORD},"https://attacker.example"),env,h);
 assert.equal(r.status,403);
 assert.equal(storage.issuedEmails.length,0);
});
test("Bad password produces no OTP and is rejected",async()=>{
 const {env,h,storage}=instance();
 const r=await operations(request("/api/staff/login",{email:address,password:"wrong"}),env,h);
 assert.equal(r.status,401);
 assert.equal(storage.issuedEmails.length,0);
});
test("Two-factor admin login issues email and only accepts valid code",async()=>{
 const {env,h,storage}=instance();
 const challenge=await operations(request("/api/staff/login",{email:address,password:env.ADMIN_LOGIN_PASSWORD}),env,h);
 assert.equal(challenge.status,200);
 assert.equal(storage.issuedEmails.length,1);
 assert.equal(storage.issuedEmails[0].to,address);
 const body=storage.issuedEmails[0].body;
 const code=body.match(/<strong>(\d{6})<\/strong>/)?.[1];
 assert.match(code||"",/^\d{6}$/);
 const bad=await operations(request("/api/staff/verify",{email:address,code:"not-a-code"}),env,h);
 assert.equal(bad.status,401);
 const valid=await operations(request("/api/staff/verify",{email:address,code}),env,h);
 assert.equal(valid.status,200);
 const data=await valid.json();
 assert.match(data.access_token,/^[a-f0-9]{64}$/);
 assert.equal(storage.code,null,"OTP must be deleted after use");
});
test("Administrative routes require an active bearer session",async()=>{
 const {env,h}=instance();
 const unauthorized=await operations(new Request("https://bon-point-v2.example/api/staff/bookings",{
  headers:{Origin:origin,Authorization:"Bearer invalid"}
 }),env,h);
 assert.equal(unauthorized.status,401);
 const forbidden=await operations(new Request("https://bon-point-v2.example/api/staff/bookings",{
  headers:{Origin:"https://attacker.example"}
 }),env,h);
 assert.equal(forbidden.status,403);
});
test("Credentials must meet minimum security lengths",async()=>{
 const {env,h}=instance();env.ADMIN_AUTH_SECRET="too-short";
 const r=await operations(request("/api/staff/login",{email:address,password:env.ADMIN_LOGIN_PASSWORD}),env,h);
 assert.equal(r.status,503);
});
