import assert from "node:assert/strict";
import {test} from "node:test";
import {runMailSmokeTest} from "../src/mail-smoke-test.js";

function fakeEnv({apiKey="secret-placeholder",sender="soutien.bonpoint@gmail.com",owner=sender,flag="true"}={}){
 const dbState={exists:false,state:null,error:null,messages:0};
 const db={prepare(statement){
  const args=[];
  return {bind(...values){args.push(...values);return this},
   async run(){
    if(statement.startsWith("INSERT")){
     if(dbState.exists)return {meta:{changes:0}};
     dbState.exists=true;dbState.state="sending";return {meta:{changes:1}};
    }
    if(statement.includes("state='accepted'"))dbState.state="accepted";
    if(statement.includes("state='failed'")){dbState.state="failed";dbState.error=args[0]}
    return {meta:{changes:1}};
   }
  }
 }};
 return {env:{MAIL_SMOKE_TEST_ENABLED:flag,MAIL_API_KEY:apiKey,MAIL_SENDER:sender,OWNER_EMAIL:owner,DB:db},dbState};
}
test("A single test email is accepted once only to Bon Point address",async()=>{
 const {env,dbState}=fakeEnv();
 const send=async (_,to,subject,html)=>{
  assert.equal(to,"soutien.bonpoint@gmail.com");
  assert.match(subject,/Test de connexion Brevo/);
  assert.match(html,/aucune réservation/);
  dbState.messages++;
 };
 assert.equal((await runMailSmokeTest(env,send)).status,"accepted");
 assert.equal((await runMailSmokeTest(env,send)).status,"already-started");
 assert.equal(dbState.state,"accepted");
 assert.equal(dbState.messages,1);
});
test("No message is sent when disabled or sender unverified",async()=>{
 for(const options of [{flag:"false"},{sender:"example@gmail.com"},{apiKey:null},{owner:"other@example.com"}]){
  const {env,dbState}=fakeEnv(options);
  const result=await runMailSmokeTest(env,async()=>{throw Error("must not send")});
  assert.notEqual(result.status,"accepted");
  assert.equal(dbState.messages,0);
 }
});
test("Failure is persisted without leaking credentials",async()=>{
 const {env,dbState}=fakeEnv();
 const result=await runMailSmokeTest(env,async()=>{throw Error("Mail delivery failed 401")});
 assert.equal(result.status,"failed");
 assert.equal(dbState.state,"failed");
 assert.equal(dbState.error,"http-401");
});
