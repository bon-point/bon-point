import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {operations} from '../src/operations.js';
import {processBookingMail} from '../src/booking-notifications.js';

const ORIGIN='https://bon-point.github.io', ADMIN_EMAIL='admin-test@example.invalid';
const PARENT='parent-test@example.invalid',OTHER='other-parent@example.invalid',TOKEN='d'.repeat(64);
function futureThursday(){
 for(let i=8;i<18;i++){
  const t=new Date(Date.now()+i*86400000);
  const d=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate(),12));
  if(d.getUTCDay()===4)return d.toISOString().slice(0,10);
 }
 throw Error('Aucun jeudi disponible pour le test');
}
function setup(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 db.exec([
  'CREATE TABLE booking_requests (id TEXT PRIMARY KEY,parent_email TEXT,parent_name TEXT,grade TEXT,subject TEXT,requested_date TEXT,period TEXT,notes TEXT,status TEXT,created_at TEXT,time_local TEXT,starts_at_utc TEXT,session_type TEXT,offer_id TEXT,reminder_due_at TEXT,reminder_sent_at TEXT,paid_notice_sent_at TEXT,order_id TEXT);',
  'CREATE TABLE orders (id TEXT PRIMARY KEY,state TEXT);',
  'CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY,email TEXT,expires_at TEXT);'
 ].join('\n'));
 db.exec(fs.readFileSync('cloudflare-v2/migrations/0014_booking_slots_notifications.sql','utf8'));
 db.exec(fs.readFileSync('cloudflare-v2/migrations/0015_booking_declined_notice.sql','utf8'));
 const hash=createHash('sha256').update(TOKEN).digest('hex');
 db.prepare('INSERT INTO admin_sessions VALUES(?,?,?)').run(hash,ADMIN_EMAIL,new Date(Date.now()+3600000).toISOString());
 const DB={prepare(sql){const stmt=db.prepare(sql);let args=[];
  return {bind(...values){args=values;return this},
   async first(){return stmt.get(...args)||null},
   async all(){return {results:stmt.all(...args)}},
   async run(){return {meta:{changes:stmt.run(...args).changes}}}
  };
 },async batch(sql){return await Promise.all(sql.map(s=>s.run()))}};
 const mails=[];
 const env={DB,MAIL_API_KEY:'FAKE-NO-NETWORK',MAIL_SENDER:ADMIN_EMAIL,OWNER_EMAIL:ADMIN_EMAIL,
 ADMIN_PANEL_ENABLED:'true',ADMIN_AUTH_SECRET:'demo-admin-secret-with-32-characters',
 ADMIN_LOGIN_PASSWORD:'demo-admin-password-with-24-characters',ADMIN_LOGIN_EMAIL:ADMIN_EMAIL,
 SLOT_PREVIEW_ENABLED:'true',SITE_INTAKE_ENABLED:'false',PAYMENTS_ENABLED:'false'};
 const h={
  json:(data,status=200)=>new Response(JSON.stringify(data),{status}),
  fail:(error,status=400)=>new Response(JSON.stringify({error}),{status}),
  safe:x=>String(x??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  email:async(_env,to,subject,html)=>{mails.push({to,subject,html})}
 };
 const call=async(path,body,config={})=>{
  const headers={Origin:config.origin||ORIGIN};if(config.admin!==false)headers.Authorization='Bearer '+TOKEN;
  if(body)headers['Content-Type']='application/json';
  return operations(new Request('https://worker.test'+path,{method:body?'POST':'GET',headers,
    body:body?JSON.stringify(body):undefined}),env,h);
 };
 const date=futureThursday();
 const booking=(email,time='14:00',kind='intro')=>({parent_request_received:true,parent_name:'Famille de test',
 email,grade:'Terminale',subject:'Mathématiques',date,time,session_type:kind,offer:kind==='course'?'seance':''});
 return {db,env,h,mails,call,date,booking};
}
test('Création → confirmation → calendrier occupé → e-mails → rappels → annulation',async()=>{
 const x=setup();
 try{
  const response=await x.call('/api/staff/bookings/manual',x.booking(PARENT));
  assert.equal(response.status,201);
  const {reference:id}=await response.json();
  const publicPreview=async()=>(await (await x.call('/api/site/slots?date='+x.date+'&session_type=intro')).json());
  assert.equal((await publicPreview()).slots.find(s=>s.time==='14:00').available,true);
  assert.equal((await publicPreview()).live_booking_enabled,false);
  assert.equal((await x.call('/api/staff/bookings/'+id,{status:'confirmed'})).status,200);
  const busy=await publicPreview();
  assert.equal(busy.slots.find(s=>s.time==='14:00').available,false);
  assert.equal(busy.slots.find(s=>s.time==='14:30').available,true);
  assert.equal(JSON.stringify(busy).includes(PARENT),false);
  const jobs=x.db.prepare('SELECT kind,state FROM booking_mail_jobs WHERE booking_id=? ORDER BY kind').all(id);
  assert.deepEqual(jobs.map(s=>s.kind),['confirmation_owner','confirmation_parent']);
  assert.equal(jobs.every(j=>j.state==='queued'),true);
  assert.equal((await processBookingMail(x.env,x.h)).sent,2);
  assert.equal(x.mails.length,2);
  assert.equal((await processBookingMail(x.env,x.h)).sent,0);
  const nextFree=await x.call('/api/staff/bookings/manual',x.booking(OTHER,'14:30'));
  assert.equal(nextFree.status,201,'A 20-minute meeting plus 10-minute buffer ends exactly at 14:30');
  assert.equal((await x.call('/api/staff/bookings/manual',x.booking(OTHER,'15:00'))).status,201);
  // Simulate the J-2 wake-up (the session still occurs more than 48 hours later).
  x.db.prepare('UPDATE booking_requests SET reminder_due_at=? WHERE id=?')
   .run(new Date(Date.now()-60_000).toISOString(),id);
  assert.equal((await processBookingMail(x.env,x.h)).sent,2);
  assert.ok(x.db.prepare('SELECT reminder_sent_at FROM booking_requests WHERE id=?').get(id).reminder_sent_at);
  assert.equal((await x.call('/api/staff/bookings/'+id,{status:'declined'})).status,200);
  assert.equal((await processBookingMail(x.env,x.h)).sent,1);
  assert.equal((await publicPreview()).slots.find(s=>s.time==='14:00').available,true);
 }finally{x.db.close()}
});
test('Une personne non authentifiée ne peut pas enregistrer de rendez-vous',async()=>{
 const x=setup();
 try{
  assert.equal((await x.call('/api/staff/bookings/manual',x.booking(PARENT),{admin:false})).status,401);
  assert.equal((await x.call('/api/staff/bookings/manual',x.booking(PARENT),{origin:'https://pirate.example'})).status,403);
  assert.equal((await x.call('/api/staff/bookings/manual',{...x.booking(PARENT),parent_request_received:false})).status,400);
  assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM booking_requests').get().n,0);
 }finally{x.db.close()}
});
test('Un cours payant ne déclenche le rappel que si un paiement est confirmé',async()=>{
 const x=setup();
 try{
  const response=await x.call('/api/staff/bookings/manual',x.booking(PARENT,'14:00','course'));
  assert.equal(response.status,201);
  const {reference:id}=await response.json();
  assert.equal((await x.call('/api/staff/bookings/'+id,{status:'confirmed'})).status,200);
  await processBookingMail(x.env,x.h);
  assert.match(x.mails.find(m=>m.to===PARENT).subject,/sous réserve de règlement/);
  x.db.prepare('UPDATE booking_requests SET reminder_due_at=? WHERE id=?')
   .run(new Date(Date.now()-60_000).toISOString(),id);
  assert.equal((await processBookingMail(x.env,x.h)).sent,0);
  x.db.prepare("INSERT INTO orders(id,state) VALUES('fake-order','paid')").run();
  x.db.prepare("UPDATE booking_requests SET order_id='fake-order' WHERE id=?").run(id);
  assert.equal((await processBookingMail(x.env,x.h)).sent,2);
 }finally{x.db.close()}
});
