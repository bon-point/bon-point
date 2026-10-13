/** Tests du tunnel Stripe SANS AUCUN APPEL réseau réel.
 * Le code du Worker est exécuté avec une base SQLite volatile et des réponses Stripe/Brevo simulées.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash,createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';

const ORIGIN='https://bon-point.github.io';
const TOKEN='a'.repeat(64);
const ORDER='mock-order-001',EMAIL='famille-de-test@example.invalid';
const SECRET='whsec_FICTIF_POUR_TEST_UNITAIRE';
const STRIPE_KEY='sk_test_FICTIVE_NO_NETWORK';
function dateInDays(days){return new Date(Date.now()+days*86400000).toISOString()}
function testDatabase(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE offers (id TEXT PRIMARY KEY,title TEXT,description TEXT,price_cents INTEGER,active INTEGER,sort_order INTEGER);
 CREATE TABLE orders (id TEXT PRIMARY KEY,token_hash TEXT,offer_id TEXT,locked_price_cents INTEGER,parent_email TEXT,grade TEXT,method TEXT,meet_url TEXT,expires_at TEXT,payment_plan TEXT,state TEXT,created_at TEXT,stripe_session_id TEXT,parent_terms_at TEXT,paid_at TEXT);
 CREATE TABLE booking_requests (order_id TEXT,session_type TEXT,starts_at_utc TEXT,status TEXT,parent_email TEXT,offer_id TEXT);
 CREATE TABLE outbox (id TEXT PRIMARY KEY,order_id TEXT,kind TEXT,state TEXT,created_at TEXT,claimed_at TEXT,attempts INTEGER DEFAULT 0,sent_at TEXT);`);
 db.prepare('INSERT INTO offers VALUES(?,?,?,?,?,?)').run('seance','Séance ciblée','Mathématiques en visio',6500,1,1);
 db.prepare('INSERT INTO orders(id,token_hash,offer_id,locked_price_cents,parent_email,grade,method,meet_url,expires_at,payment_plan,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
 .run(ORDER,createHash('sha256').update(TOKEN).digest('hex'),'seance',6500,EMAIL,'terminale','meet','https://meet.google.com/abc-defg-hij',dateInDays(7),'once','proposed',new Date().toISOString());
 db.prepare('INSERT INTO booking_requests VALUES(?,?,?,?,?,?)').run(ORDER,'course',dateInDays(4),'confirmed',EMAIL,'seance');
 const DB={
  prepare(sql){
   const stmt=db.prepare(sql);let args=[];
   return {bind(...values){args=values;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},
    async run(){return {meta:{changes:stmt.run(...args).changes}}}};
  },
  async batch(statements){const out=[];for(const stmt of statements)out.push(await stmt.run());return out}
 };
 const env={DB,PAYMENTS_ENABLED:'false',STRIPE_MODE:'test',REQUIRE_CONFIRMED_BOOKING:'true',
  STRIPE_SECRET_KEY:STRIPE_KEY,STRIPE_WEBHOOK_SECRET:SECRET,
  ADMIN_API_KEY:'admin-test-secret-with-enough-characters',
  MAIL_API_KEY:'FAKE-NO-NETWORK',MAIL_SENDER:'bonpoint-test@example.invalid'};
 return {db,env};
}
function mockNetwork(){
 const seen={stripe:[],emails:[],error:false};
 const original=globalThis.fetch;
 globalThis.fetch=async(url,opts={})=>{
  if(url==='https://api.stripe.com/v1/checkout/sessions'){
   seen.stripe.push({body:new URLSearchParams(opts.body),headers:opts.headers});
   if(seen.error)return new Response(JSON.stringify({error:{message:'simulated decline'}}),{status:502});
   return new Response(JSON.stringify({id:'cs_test_mock001',url:'https://checkout.stripe.com/c/pay/mock001'}),{status:200});
  }
  if(url==='https://api.brevo.com/v3/smtp/email'){
   seen.emails.push(JSON.parse(opts.body));
   return new Response('{}',{status:201});
  }
  throw Error('Appel réseau non simulé refusé : '+url);
 };
 return {seen,restore(){globalThis.fetch=original}};
}
async function request(env,path,body,headers={}){
 const waiting=[];
 const response=await worker.fetch(new Request('https://worker.invalid'+path,{
  method:body===undefined?'GET':'POST',
  headers:{Origin:ORIGIN,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},
  body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)
 }),env,{waitUntil(p){waiting.push(p)}});
 await Promise.all(waiting);
 return response;
}
function signedEvent(overrides={}){
 const data={id:'evt_test_mock',type:'checkout.session.completed',livemode:false,data:{object:{
  id:'cs_test_mock001',metadata:{order_id:ORDER},mode:'payment',payment_status:'paid',currency:'eur',
  amount_total:6500,customer_details:{email:EMAIL}
 }}};
 const event={...data,...overrides,data:{...data.data,...overrides.data}};
 const raw=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000);
 const signature=createHmac('sha256',SECRET).update(timestamp+'.'+raw).digest('hex');
 return {raw,signature:'t='+timestamp+',v1='+signature};
}
test('Paiement bloqué par défaut et clé du mauvais mode refusée',async()=>{
 const {db,env}=testDatabase();const network=mockNetwork();
 try{
  let r=await request(env,'/health');
  assert.equal((await r.json()).payment_enabled,false);
  r=await request(env,'/api/checkout',{token:TOKEN,parent_confirmed:true,cgv_accepted:true});
  assert.equal(r.status,503);
  env.PAYMENTS_ENABLED='true';env.STRIPE_SECRET_KEY='sk_live_FAKE_DO_NOT_USE';
  r=await request(env,'/health');
  assert.equal((await r.json()).payment_enabled,false);
  assert.equal(network.seen.stripe.length,0);
 }finally{network.restore();db.close()}
});
test('La console protégée par OTP n’exige pas de clé administrateur héritée pour la disponibilité Stripe',async()=>{
 const {db,env}=testDatabase(),network=mockNetwork();
 try{
  env.PAYMENTS_ENABLED='true';delete env.ADMIN_API_KEY;
  let r=await request(env,'/health');assert.equal((await r.json()).payment_enabled,true);
  env.STRIPE_WEBHOOK_SECRET='';
  r=await request(env,'/health');assert.equal((await r.json()).payment_enabled,false);
  assert.equal(network.seen.stripe.length,0);
 }finally{network.restore();db.close()}
});
test('Seul un créneau confirmé et les CGV acceptées autorisent la simulation Checkout',async()=>{
 const {db,env}=testDatabase();const network=mockNetwork();env.PAYMENTS_ENABLED='true';
 try{
  const post=b=>request(env,'/api/checkout',b);
  assert.equal((await post({token:TOKEN,parent_confirmed:false,cgv_accepted:true})).status,400);
  assert.equal((await post({token:TOKEN,parent_confirmed:true,cgv_accepted:false})).status,400);
  db.prepare("UPDATE booking_requests SET status='requested'").run();
  assert.equal((await post({token:TOKEN,parent_confirmed:true,cgv_accepted:true})).status,409);
  db.prepare("UPDATE booking_requests SET status='confirmed'").run();
  const r=await post({token:TOKEN,parent_confirmed:true,cgv_accepted:true});
  assert.equal(r.status,200);
  assert.match((await r.json()).url,/^https:\/\/checkout\.stripe\.com\//);
  assert.equal(network.seen.stripe.length,1);
  assert.equal(network.seen.stripe[0].body.get('line_items[0][price_data][unit_amount]'),'6500');
  const checkoutExpires=Number(network.seen.stripe[0].body.get('expires_at'));
  assert.ok(checkoutExpires-Math.floor(Date.now()/1000)>3000,'Stripe Checkout expiry must safely exceed the 30-minute minimum');
  assert.equal(network.seen.stripe[0].body.get('metadata[order_id]'),ORDER);
  assert.equal(network.seen.stripe[0].headers.Authorization,'Bearer '+STRIPE_KEY);
  assert.equal(db.prepare('SELECT state FROM orders WHERE id=?').get(ORDER).state,'awaiting_payment');
  assert.equal((await post({token:TOKEN,parent_confirmed:true,cgv_accepted:true})).status,409);
  assert.equal(network.seen.stripe.length,1,'Un second clic ne doit pas créer une deuxième session');
 }finally{network.restore();db.close()}
});
test('Rejet Stripe simulé : commande rétablie et aucun argent encaissé',async()=>{
 const {db,env}=testDatabase(),network=mockNetwork();
 env.PAYMENTS_ENABLED='true';network.seen.error=true;
 try{
  const r=await request(env,'/api/checkout',{token:TOKEN,parent_confirmed:true,cgv_accepted:true});
  assert.equal(r.status,503);
  assert.equal(db.prepare('SELECT state FROM orders WHERE id=?').get(ORDER).state,'proposed');
  assert.equal(network.seen.emails.length,0);
 }finally{network.restore();db.close()}
});
test('Webhook signé : rejet des signatures, des modes et des montants incohérents',async()=>{
 const {db,env}=testDatabase(),network=mockNetwork();
 env.PAYMENTS_ENABLED='true';
 try{
  assert.equal((await request(env,'/api/checkout',{token:TOKEN,parent_confirmed:true,cgv_accepted:true})).status,200);
  const e=signedEvent();
  let r=await request(env,'/stripe/webhook',e.raw,{'Stripe-Signature':'t=1,v1=deadbeef'});
  assert.equal(r.status,400);
  const wrongMode=signedEvent({livemode:true});
  r=await request(env,'/stripe/webhook',wrongMode.raw,{'Stripe-Signature':wrongMode.signature});
  assert.equal(r.status,409);
  const wrongSum=signedEvent({data:{object:{...JSON.parse(e.raw).data.object,amount_total:1}}});
  r=await request(env,'/stripe/webhook',wrongSum.raw,{'Stripe-Signature':wrongSum.signature});
  assert.equal(r.status,409);
  assert.equal(db.prepare('SELECT state FROM orders WHERE id=?').get(ORDER).state,'awaiting_payment');
  r=await request(env,'/stripe/webhook',e.raw,{'Stripe-Signature':e.signature});
  assert.equal(r.status,200);
  assert.equal(db.prepare('SELECT state FROM orders WHERE id=?').get(ORDER).state,'paid');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n,1);
  assert.equal(db.prepare('SELECT state FROM outbox').get().state,'sent');
  assert.equal(network.seen.emails.length,1);
  r=await request(env,'/stripe/webhook',e.raw,{'Stripe-Signature':e.signature});
  assert.equal(r.status,200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n,1);
  assert.equal(network.seen.emails.length,1,'Un événement répété ne doit pas doubler les e-mails');
 }finally{network.restore();db.close()}
});
