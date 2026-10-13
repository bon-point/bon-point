/** End-to-end test on disposable in-memory SQLite. Stripe and Brevo are mocked.
 * Exercises the real Worker routes: private staff booking -> confirmation ->
 * named proposal -> checkout consent -> signed webhook -> one confirmation.
 * No network, no Cloudflare D1 writes and no real or sandbox charges.
 */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/index.js';

const ORIGIN='https://bon-point.github.io', ADMIN='soutien.bonpoint@gmail.com';
const SESSION='a'.repeat(64), SECRET='whsec_FAKE_UNIT_TEST_ONLY';
const KEY='sk_test_FAKE_UNIT_TEST_ONLY', SESSION_ID='cs_test_e2e_demo_001';
function nextThursday(){
 for(let i=8;i<17;i++){
  const d=new Date(Date.now()+i*86400000),utc=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),12));
  if(utc.getUTCDay()===4)return utc.toISOString().slice(0,10);
 }
 throw Error('No eligible Thursday found');
}
function dbFixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(fs.readFileSync('cloudflare-v2/migrations/0001_init.sql','utf8'));
 db.exec(fs.readFileSync('cloudflare-v2/migrations/0002_payment_plan.sql','utf8'));
 db.exec('CREATE TABLE booking_requests (id TEXT PRIMARY KEY,parent_email TEXT,parent_name TEXT,grade TEXT,subject TEXT,requested_date TEXT,period TEXT,notes TEXT,status TEXT,created_at TEXT,time_local TEXT,starts_at_utc TEXT,session_type TEXT,offer_id TEXT,reminder_due_at TEXT,reminder_sent_at TEXT,paid_notice_sent_at TEXT,order_id TEXT)');
 db.exec('CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY,email TEXT,expires_at TEXT)');
 db.exec(fs.readFileSync('cloudflare-v2/migrations/0014_booking_slots_notifications.sql','utf8'));
 db.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(createHash('sha256').update(SESSION).digest('hex'),ADMIN,new Date(Date.now()+3600000).toISOString());
 const DB={prepare(sql){
  const st=db.prepare(sql);let args=[];
  return {bind(...v){args=v;return this},async first(){return st.get(...args)||null},
   async all(){return {results:st.all(...args)}},async run(){return {meta:{changes:st.run(...args).changes}}}};
 },async batch(stmts){const result=[];for(const x of stmts)result.push(await x.run());return result;}};
 return {db,DB};
}
function sign(event){
 const raw=JSON.stringify(event),ts=Math.floor(Date.now()/1000);
 return {raw,signature:'t='+ts+',v1='+createHmac('sha256',SECRET).update(ts+'.'+raw).digest('hex')};
}
test('Real booking and checkout routes, fake card gateway, signed webhook, no duplicate fulfillment',async()=>{
 const {db,DB}=dbFixture();
 const env={DB,ADMIN_PANEL_ENABLED:'true',ADMIN_AUTH_SECRET:'fake-admin-hmac-key-more-than-32-characters',
  ADMIN_LOGIN_PASSWORD:'fake-long-admin-password-more-than-24-characters',
  ADMIN_LOGIN_EMAIL:ADMIN,OWNER_EMAIL:ADMIN,
  PAYMENTS_ENABLED:'false',STRIPE_MODE:'test',REQUIRE_CONFIRMED_BOOKING:'true',
  STRIPE_SECRET_KEY:KEY,STRIPE_WEBHOOK_SECRET:SECRET,
  MAIL_API_KEY:'FAKE-NO-NETWORK',MAIL_SENDER:ADMIN,SITE_INTAKE_ENABLED:'false'};
 const oldFetch=globalThis.fetch,seen={checkout:[],mail:[]};
 globalThis.fetch=async(url,options={})=>{
  if(url==='https://api.stripe.com/v1/checkout/sessions'){
   const params=new URLSearchParams(options.body);
   seen.checkout.push(params);
   return new Response(JSON.stringify({id:SESSION_ID,url:'https://checkout.stripe.com/c/pay/e2e-fake'}),{status:200});
  }
  if(url==='https://api.brevo.com/v3/smtp/email'){
   seen.mail.push(JSON.parse(options.body));
   return new Response('{}',{status:201});
  }
  throw Error('External network disabled for end-to-end test: '+url);
 };
 async function api(path,data,headers={}){
  const waits=[],request=new Request('https://worker.invalid'+path,{
   method:data===undefined?'GET':'POST',
   headers:{Origin:ORIGIN,...(data===undefined?{}:{'content-type':'application/json'}),...headers},
   body:data===undefined?undefined:typeof data==='string'?data:JSON.stringify(data)
  });
  const r=await worker.fetch(request,env,{waitUntil(p){waits.push(p)}});
  await Promise.all(waits);
  return r;
 }
 try{
  const date=nextThursday();
  let r=await api('/api/staff/bookings/manual',{
   parent_name:'DÉMO — Famille fictive',email:ADMIN,grade:'Terminale',
   subject:'Mathématiques',date,time:'14:00',session_type:'course',
   offer:'seance',test_mode:true
  },{Authorization:'Bearer '+SESSION});
  assert.equal(r.status,201,'Only private staff can record the fake booking');
  const booking=(await r.json()).reference;
  assert.ok(booking,'Private staff booking reference must be generated');
  assert.equal(db.prepare('SELECT offer_id FROM booking_requests WHERE id=?').get(booking).offer_id,'seance');
  r=await api('/api/staff/bookings/'+booking,{status:'confirmed'},{Authorization:'Bearer '+SESSION});
  assert.equal(r.status,200,'Staff confirmation should succeed');
  assert.equal(db.prepare('SELECT status FROM booking_requests WHERE id=?').get(booking).status,'confirmed');

  r=await api('/api/staff/proposals',{
   booking_id:booking,meet_url:'https://meet.google.com/abc-defg-hij',
   plan:'once',notify_parent:false
  },{Authorization:'Bearer '+SESSION});
  assert.equal(r.status,201,'Staff proposal should be bound to the confirmed lesson');
  const offer=await r.json();
  assert.equal(offer.created,true);
  const token=new URL(offer.private_checkout_url).searchParams.get('token');
  assert.match(token,/^[a-f0-9]{64}$/);
  const order=db.prepare('SELECT * FROM orders').get();
  assert.equal(order.locked_price_cents,5000,'Current Bon Point hourly price must be 50 EUR');
  assert.equal(order.payment_plan,'once');
  assert.equal(order.state,'proposed');

  const attempted={token,parent_confirmed:true,cgv_accepted:true};
  assert.equal((await api('/api/checkout',attempted)).status,503,'No checkout while disabled');
  env.PAYMENTS_ENABLED='true';
  assert.equal((await api('/api/checkout',{...attempted,parent_confirmed:false})).status,400,'Parent consent required');
  assert.equal((await api('/api/checkout',{...attempted,cgv_accepted:false})).status,400,'CGV acceptance required');
  r=await api('/api/checkout',attempted);
  assert.equal(r.status,200);
  assert.match((await r.json()).url,/^https:\/\/checkout\.stripe\.com\//);
  assert.equal(seen.checkout.length,1);
  assert.equal(seen.checkout[0].get('line_items[0][price_data][unit_amount]'),'5000');
  assert.equal(seen.checkout[0].get('metadata[order_id]'),order.id);
  assert.equal(db.prepare('SELECT state FROM orders').get().state,'awaiting_payment');
  assert.equal((await api('/api/checkout',attempted)).status,409,'Repeated checkout must be blocked');
  assert.equal(seen.checkout.length,1,'Never create another Stripe session from repeated click');

  const event={id:'evt_test_full_e2e',type:'checkout.session.completed',livemode:false,
   data:{object:{id:SESSION_ID,metadata:{order_id:order.id},mode:'payment',
    payment_status:'paid',currency:'eur',amount_total:5000,
    customer_details:{email:ADMIN}}}};
  const signed=sign(event);
  assert.equal((await api('/stripe/webhook',signed.raw,{'Stripe-Signature':'t=1,v1=bad'})).status,400);
  const mismatch=sign({...event,data:{object:{...event.data.object,amount_total:1}}});
  assert.equal((await api('/stripe/webhook',mismatch.raw,{'Stripe-Signature':mismatch.signature})).status,409);
  assert.equal(db.prepare('SELECT state FROM orders').get().state,'awaiting_payment');
  r=await api('/stripe/webhook',signed.raw,{'Stripe-Signature':signed.signature});
  assert.equal(r.status,200,'Simulated signed test webhook accepted');
  assert.equal(db.prepare('SELECT state FROM orders').get().state,'paid');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM outbox').get().n,1);
  assert.equal(db.prepare('SELECT state FROM outbox').get().state,'sent');
  assert.equal(seen.mail.length,1,'One confirmation to the sandbox parent address');
  assert.equal(seen.mail[0].to[0].email,ADMIN);
  r=await api('/stripe/webhook',signed.raw,{'Stripe-Signature':signed.signature});
  assert.equal(r.status,200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM outbox').get().n,1);
  assert.equal(seen.mail.length,1,'No duplicate email when Stripe retries');
  console.log('OK booking → confirmation → named proposal → 50 EUR test Checkout → HMAC webhook → single confirmation. All network mocked; temporary SQLite only.');
 }finally{globalThis.fetch=oldFetch;db.close()}
});
