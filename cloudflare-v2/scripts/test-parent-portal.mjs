import assert from "node:assert/strict";
import {test} from "node:test";
import {handleSite} from "../src/site-services.js";
import {operations} from "../src/operations.js";

const ORIGIN="https://bon-point.github.io";
const secret="fictitious-parent-test-secret-over-32-characters";
const mailA="parent.demo.a@example.invalid",mailB="parent.demo.b@example.invalid";
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,"0")).join("");
async function hash(input){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input)))}
const parentRequest=(path,{method="GET",body,origin=ORIGIN,token}={})=>{
 const headers={Origin:origin};if(body!==undefined)headers["Content-Type"]="application/json";if(token)headers.Authorization="Bearer "+token;
 return new Request("https://bon-point-v2.example"+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
};
const out={
 json:(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json"}}),
 fail:(msg,status)=>new Response(JSON.stringify({error:msg}),{status,headers:{"content-type":"application/json"}}),
 email:async()=>{},
 now:()=>new Date().toISOString(),
 safe:s=>String(s),
 adminAllowed:()=>false
};
const sessionDate="2026-10-20";
const fileA="11111111-1111-4111-8111-111111111111",fileB="22222222-2222-4222-8222-222222222222";
function prepareMock(){
 const logins=new Map(),sessions=new Map(),allQueries=[];
 const accounts=new Map([[mailA,{email:mailA,display_name:"Famille Démo A",active:1}],[mailB,{email:mailB,display_name:"Famille Démo B",active:1}]]);
 const lessons=[
  {id:"abc",parent_email:mailA,session_date:sessionDate,subject:"Mathématiques",summary:"Fonctions — famille A",strengths:"Lecture de graphique",homework:"Exercices 3 et 4",next_step:"S'entraîner",next_objective:"Proportionnalité"},
  {id:"def",parent_email:mailB,session_date:sessionDate,subject:"Mathématiques",summary:"Ne doit jamais apparaître — famille B",strengths:"Privé B",homework:"Privé B"}
 ];
 const pdfById=new Map([
  [fileA,{id:fileA,parent_email:mailA,progress_id:"abc",file_name:"bonpoint.pdf",size_bytes:18,r2_key:"d1:"+fileA,content_base64:btoa("%PDF-1.4 TEST FAMILLE A")}],
  [fileB,{id:fileB,parent_email:mailB,progress_id:"def",file_name:"prive-B.pdf",size_bytes:18,r2_key:"d1:"+fileB,content_base64:btoa("%PDF-1.4 TEST FAMILLE B")}]
 ]);
 let issued=0;
 const env={DB:{prepare(sql){
  const query={sql,args:[],bind(...args){this.args=args;return this},
   async first(){
    allQueries.push({sql,args:this.args});
    if(sql.includes("FROM parent_login_codes p JOIN parent_accounts a")){
     const row=logins.get(this.args[0]);return row?{...row,active:accounts.get(this.args[0])?.active}:null;
    }
    if(sql.includes("FROM parent_sessions s JOIN parent_accounts a")){
     const info=sessions.get(this.args[0]),account=accounts.get(info?.email);
     if(!info||info.expires_at<=this.args[1]||!account?.active)return null;
     if(sql.includes("SELECT a.email"))return {email:info.email};
     return {email:info.email,display_name:account.display_name};
    }
    if(sql.includes("FROM session_files WHERE id=? AND parent_email=?")){
     const f=pdfById.get(this.args[0]);return f?.parent_email===this.args[1]?f:null;
    }
    if(sql.includes("FROM session_file_blobs WHERE file_id=?")){
     const f=pdfById.get(this.args[0]);return f?{content_base64:f.content_base64}:null;
    }
    return null;
   },
   async all(){
    allQueries.push({sql,args:this.args});
    const target=this.args[0];
    if(sql.includes("FROM progress_entries WHERE parent_email=?"))return {results:lessons.filter(l=>l.parent_email===target)};
    if(sql.includes("FROM session_files WHERE parent_email=?"))return {results:[...pdfById.values()].filter(f=>f.parent_email===target).map(({id,progress_id,file_name,size_bytes})=>({id,progress_id,file_name,size_bytes,created_at:new Date().toISOString()}))};
    return {results:[]};
   },
   async run(){
    allQueries.push({sql,args:this.args});
    if(sql.includes("UPDATE parent_login_codes SET attempts")){
     const code=logins.get(this.args[0]);if(code)code.attempts++;return {meta:{changes:code?1:0}};
    }
    if(sql.includes("DELETE FROM parent_login_codes")){logins.delete(this.args[0]);return {meta:{changes:1}}}
    if(sql.includes("INSERT INTO parent_sessions")){
     sessions.set(this.args[0],{email:this.args[1],created_at:this.args[2],expires_at:this.args[3]});return {meta:{changes:1}};
    }
    if(sql.includes("DELETE FROM parent_sessions")){sessions.delete(this.args[0]);return {meta:{changes:1}}}
    return {meta:{changes:0}};
   }
  };
  return query;
 },async batch(stmts){const results=[];for(const s of stmts)results.push(await s.run());return results}},
 PARENT_PORTAL_ENABLED:"true",PARENT_AUTH_SECRET:secret,MAIL_API_KEY:"test-placeholder",MAIL_SENDER:"bonpoint@example.invalid"};
 async function issue(email,code){
  issued++;logins.set(email,{email,code_hash:await hash(email+":"+code+":"+secret),sent_at:new Date().toISOString(),expires_at:new Date(Date.now()+600000).toISOString(),attempts:0});
 }
 return {env,accounts,lessons,sessions,logins,pdfById,allQueries,issue};
}
test("A fictional parent sees only their own lesson summaries and homework",async()=>{
 const fake=prepareMock(),code="147258";await fake.issue(mailA,code);
 const verified=await handleSite(parentRequest("/api/parent/verify",{method:"POST",body:{email:mailA,code}}),fake.env,out);
 assert.equal(verified.status,200);
 const access=(await verified.json()).access_token;
 assert.match(access,/^[a-f0-9]{64}$/);
 assert.equal(fake.logins.has(mailA),false,"OTP is one-use");
 const response=await handleSite(parentRequest("/api/parent/dashboard",{token:access}),fake.env,out);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.parent.email,mailA);
 assert.equal(data.sessions.length,1);
 assert.match(data.sessions[0].summary,/famille A/);
 assert.equal(data.sessions[0].homework,"Exercices 3 et 4");
 assert.equal(data.files.length,1);
 assert.equal(data.files[0].id,fileA);
 assert.equal(JSON.stringify(data).includes("famille B"),false);
});
test("Wrong codes and cross-origin requests cannot open a parent's dossier",async()=>{
 const fake=prepareMock();await fake.issue(mailA,"147258");
 const fail=await handleSite(parentRequest("/api/parent/verify",{method:"POST",body:{email:mailA,code:"111111"}}),fake.env,out);
 assert.equal(fail.status,401);
 assert.equal(fake.logins.get(mailA).attempts,1);
 const stolen=await handleSite(parentRequest("/api/parent/dashboard",{origin:"https://elsewhere.example",token:"a".repeat(64)}),fake.env,out);
 assert.equal(stolen.status,403);
 const unauthorized=await handleSite(parentRequest("/api/parent/dashboard",{token:"a".repeat(64)}),fake.env,out);
 assert.equal(unauthorized.status,401);
});
test("A parent cannot download another family's private PDF",async()=>{
 const fake=prepareMock();await fake.issue(mailA,"654321");
 const logged=await handleSite(parentRequest("/api/parent/verify",{method:"POST",body:{email:mailA,code:"654321"}}),fake.env,out);
 const token=(await logged.json()).access_token;
 const other=await operations(parentRequest("/api/parent/reports/"+fileB,{token}),fake.env,out);
 assert.equal(other.status,404);
 const owned=await operations(parentRequest("/api/parent/reports/"+fileA,{token}),fake.env,out);
 assert.equal(owned.status,200);
 assert.equal(owned.headers.get("content-type"),"application/pdf");
 assert.match(await owned.text(),/FAMILLE A/);
 const logout=await handleSite(parentRequest("/api/parent/logout",{method:"POST",token}),fake.env,out);
 assert.equal(logout.status,200);
 const after=await operations(parentRequest("/api/parent/reports/"+fileA,{token}),fake.env,out);
 assert.equal(after.status,401);
});
test("Disabled parent portal is never publicly accessible",async()=>{
 const fake=prepareMock();fake.env.PARENT_PORTAL_ENABLED="false";
 const r=await handleSite(parentRequest("/api/parent/dashboard",{token:"a".repeat(64)}),fake.env,out);
 assert.equal(r.status,503);
 const p=await operations(parentRequest("/api/parent/reports/"+fileA,{token:"a".repeat(64)}),fake.env,out);
 assert.equal(p.status,503);
});
