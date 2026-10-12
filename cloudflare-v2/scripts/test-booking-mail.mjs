import assert from "node:assert/strict";
import {test} from "node:test";
import {processBookingMail} from "../src/booking-notifications.js";

const bookingId="77777777-7777-4777-8777-777777777777";
function setup(kinds=['confirmation_parent','confirmation_owner'],kind="intro"){
 const now=new Date().toISOString();
 const rows=kinds.map(k=>({
  booking_id:bookingId,kind:k,state:'queued',attempts:0,
  claimed_at:null,next_attempt_at:new Date(Date.now()-60_000).toISOString(),
  created_at:now,booking_status:'confirmed',payment_state:kind==='course'?'paid':null,
  session_type:kind,parent_email:'parent.demo@example.invalid',parent_name:'Famille Test',
  owner_email:'owner.demo@example.invalid',grade:'3e',subject:'Mathématiques',
  starts_at_utc:new Date(Date.now()+72*3600000).toISOString(),
  requested_date:'2026-10-19',time_local:'18:00'
 }));
 const state={rows,mail:[],reminderMarked:0,failOwner:false};
 const DB={prepare(sql){
  const q={params:[],bind(...x){this.params=x;return this},
   async all(){
    if(sql.includes('FROM booking_mail_jobs j JOIN booking_requests b')){
     return {results:state.rows.filter(r=>(
      (r.state==='queued'||r.state==='sending'&&r.claimed_at<this.params[1])
      &&r.attempts<5&&r.next_attempt_at<=this.params[0])).map(r=>({...r}))};
    }
    return {results:[]};
   },
   async run(){
    if(sql.startsWith('INSERT OR IGNORE INTO booking_mail_jobs'))return {meta:{changes:0}};
    const [arg,id,k]=this.params;
    const target=sql.includes('SET state=?,next_attempt_at=?')?[this.params[3],this.params[4]]:
      sql.includes("SET state='cancelled'")?[this.params[0],this.params[1]]:[id,k];
    const r=state.rows.find(r=>r.booking_id===target[0]&&r.kind===target[1]);
    if(sql.includes("SET state='sending',attempts=attempts+1")){
     if(!r||r.state!=='queued')return {meta:{changes:0}};
     r.state='sending';r.claimed_at=arg;r.attempts++;return {meta:{changes:1}};
    }
    if(sql.includes("SET state='sent'")){
     if(!r)return {meta:{changes:0}};
     r.state='sent';r.sent_at=arg;return {meta:{changes:1}};
    }
    if(sql.includes("SET state='cancelled'")){
     if(!r)return {meta:{changes:0}};
     r.state='cancelled';return {meta:{changes:1}};
    }
    if(sql.includes('SET state=?,next_attempt_at=?')){
     if(!r)return {meta:{changes:0}};
     r.state=arg;r.next_attempt_at=this.params[1];r.last_error=this.params[2];return {meta:{changes:1}};
    }
    if(sql.includes('UPDATE booking_requests SET reminder_sent_at')){
     const sent=['reminder_parent','reminder_owner'].every(k=>state.rows.find(r=>r.kind===k)?.state==='sent');
     if(sent)state.reminderMarked++;return {meta:{changes:sent?1:0}};
    }
    return {meta:{changes:0}};
   }
  };
  return q;
 }};
 const env={DB,OWNER_EMAIL:'owner.demo@example.invalid',MAIL_SENDER:'owner.demo@example.invalid',MAIL_API_KEY:'mock-only'};
 const h={safe:x=>String(x).replaceAll('<','&lt;'),email:async(_,to,subject,html)=>{
  if(state.failOwner&&to===env.OWNER_EMAIL){state.failOwner=false;throw Error('Brevo temporarily failed')}
  state.mail.push({to,subject,html});
 }};
 return {state,env,h};
}
test("A confirmed first meeting sends independent parent and owner confirmations",async()=>{
 const {state,env,h}=setup();
 const result=await processBookingMail(env,h);
 assert.equal(result.sent,2);
 assert.equal(state.rows.every(r=>r.state==='sent'),true);
 assert.equal(state.mail.length,2);
 assert.equal(state.mail[0].to,'parent.demo@example.invalid');
 assert.match(state.mail[0].subject,/Premier échange confirmé/);
 await processBookingMail(env,h);
 assert.equal(state.mail.length,2,'Already sent emails are not requeued');
});
test("If Brevo fails for the owner, the parent confirmation is not repeated",async()=>{
 const {state,env,h}=setup();
 state.failOwner=true;
 await processBookingMail(env,h);
 assert.equal(state.mail.length,1);
 const owner=state.rows.find(r=>r.kind==='confirmation_owner');
 assert.equal(owner.state,'queued');
 assert.equal(owner.attempts,1);
 assert.equal(state.rows.find(r=>r.kind==='confirmation_parent').state,'sent');
 await processBookingMail(env,h);
 assert.equal(state.mail.length,1,'Backoff prevents rapid duplicate retry');
 owner.next_attempt_at=new Date(Date.now()-60_000).toISOString();
 await processBookingMail(env,h);
 assert.equal(state.mail.length,2);
 assert.equal(owner.state,'sent');
});
test("An unconfirmed booking cannot cause an outgoing email",async()=>{
 const {state,env,h}=setup(['confirmation_parent']);
 state.rows[0].booking_status='requested';
 const done=await processBookingMail(env,h);
 assert.equal(done.sent,0);assert.equal(done.skipped,1);
 assert.equal(state.mail.length,0);assert.equal(state.rows[0].state,'cancelled');
});
