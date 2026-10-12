/**
 * Bon Point — transactional booking messages, distinct claims per recipient.
 * Delivery is at-least-once if a Worker crashes after Brevo accepts but before
 * persisting success. Never promises exactly-once email delivery.
 */
const MIN=60_000,HOUR=60*MIN;
const iso=()=>new Date().toISOString();
const future=minutes=>new Date(Date.now()+minutes*MIN).toISOString();
const KINDS=new Set(['confirmation_parent','confirmation_owner','declined_parent','reminder_parent','reminder_owner']);
const isReminder=k=>k.startsWith('reminder_');
export function mailAllowed(job,now=Date.now()){
 if(!KINDS.has(job.kind)||!job.parent_email||!job.starts_at_utc)return false;
 const t=Date.parse(job.starts_at_utc);
 if(!Number.isFinite(t))return false;
 if(job.kind==='declined_parent')return job.booking_status==='declined';
 if(job.booking_status!=='confirmed'||t<=now)return false;
 if(job.kind.startsWith('confirmation_'))return true;
 return isReminder(job.kind)&&t-now>=48*HOUR&&(job.session_type==='intro'||job.session_type==='course'&&job.payment_state==='paid');
}
function mailPayload(job,escape){
 const date=escape(job.requested_date),time=escape(job.time_local),reference=escape(job.booking_id.slice(0,8));
 const details='<p>Le '+date+' à '+time+' (heure de Paris) · '+escape(job.subject)+' · '+escape(job.grade)+'.</p>';
 const ref='<p>Référence : '+reference+'.</p>';
 const contact='<p>Pour toute question ou demande de report, contactez <a href="mailto:soutien.bonpoint@gmail.com">soutien.bonpoint@gmail.com</a>.</p>';
 if(job.kind==='declined_parent')return {
  to:job.parent_email,subject:'Bon Point — Proposition de rendez-vous non retenue',
  html:'<p>Bonjour,</p><p>Le créneau demandé ne peut malheureusement pas être retenu.</p>'+details+ref+'<p>Vous pouvez proposer une autre date.</p>'+contact
 };
 if(job.kind==='confirmation_parent'){
  const paid=job.session_type==='course';
  return {to:job.parent_email,subject:paid?'Bon Point — Créneau retenu sous réserve de règlement':'Bon Point — Premier échange confirmé',
   html:'<p>Bonjour,</p><p>'+(paid?'Votre créneau a été retenu. Le cours payant ne pourra avoir lieu qu’après finalisation des conditions contractuelles et confirmation du paiement. Aucun prélèvement n’est effectué par ce message.':'Votre premier échange gratuit est confirmé.')+'</p>'+details+ref+'<p>Vous recevrez un rappel avant le rendez-vous, si les conditions du cours sont remplies.</p>'+contact};
 }
 if(job.kind==='confirmation_owner')return {
  to:job.owner_email,subject:'Bon Point — Créneau confirmé dans le planning',
  html:'<p>Le rendez-vous suivant a été confirmé dans l’administration :</p>'+details+ref+'<p>Parent : '+escape(job.parent_email)+'.</p>'};
 if(job.kind==='reminder_parent')return {
  to:job.parent_email,subject:'Bon Point — Rappel de votre rendez-vous',
  html:'<p>Bonjour,</p><p>Votre rendez-vous Bon Point approche :</p>'+details+ref+contact};
 return {
  to:job.owner_email,subject:'Bon Point — Rappel de cours (48 h)',
  html:'<p>Rappel professionnel : un rendez-vous confirmé et éligible approche.</p>'+details+ref+'<p>Parent : '+escape(job.parent_email)+'.</p>'
 };
}
async function enqueueReminders(env){
 const now=iso(),minimum=future(48*60);
 const where=`FROM booking_requests b LEFT JOIN orders o ON b.order_id=o.id
 WHERE b.status='confirmed' AND b.reminder_due_at IS NOT NULL
 AND b.reminder_due_at<=? AND b.starts_at_utc>=?
 AND (b.session_type='intro' OR (b.session_type='course' AND o.state='paid'))`;
 for(const kind of ['reminder_parent','reminder_owner']){
  await env.DB.prepare(`INSERT OR IGNORE INTO booking_mail_jobs(booking_id,kind)
   SELECT b.id, ? ${where}`).bind(kind,now,minimum).run();
 }
}
async function cancel(env,id,kind){
 await env.DB.prepare("UPDATE booking_mail_jobs SET state='cancelled',last_error='no-longer-eligible' WHERE booking_id=? AND kind=? AND state='sending'").bind(id,kind).run();
}
async function markComplete(env,id,kind){
 await env.DB.prepare("UPDATE booking_mail_jobs SET state='sent',sent_at=?,last_error=NULL WHERE booking_id=? AND kind=? AND state='sending'").bind(iso(),id,kind).run();
 if(kind==='reminder_parent'||kind==='reminder_owner'){
  await env.DB.prepare(`UPDATE booking_requests SET reminder_sent_at=?
  WHERE id=? AND reminder_sent_at IS NULL
  AND EXISTS(SELECT 1 FROM booking_mail_jobs WHERE booking_id=? AND kind='reminder_parent' AND state='sent')
  AND EXISTS(SELECT 1 FROM booking_mail_jobs WHERE booking_id=? AND kind='reminder_owner' AND state='sent')`)
   .bind(iso(),id,id,id).run();
 }
}
async function markFailure(env,job,err){
 const next=job.attempts+1>=5?'cancelled':'queued';
 const retry=new Date(Date.now()+Math.min(90,5*2**job.attempts)*MIN).toISOString();
 await env.DB.prepare("UPDATE booking_mail_jobs SET state=?,next_attempt_at=?,last_error=? WHERE booking_id=? AND kind=? AND state='sending'")
  .bind(next,retry,'brevo-delivery-error',job.booking_id,job.kind).run();
 console.error("Bon Point booking email delivery failed",job.kind,String(err?.message||'').replace(/[\r\n]/g,' ').slice(0,50).replace(/[^a-zA-Z0-9 .-]/g,''));
}
export async function processBookingMail(env,h){
 if(!env.DB||!env.MAIL_API_KEY||!env.MAIL_SENDER||typeof h.email!=='function')return {enabled:false};
 await enqueueReminders(env);
 const now=iso(),stale=new Date(Date.now()-15*MIN).toISOString();
 const queue=await env.DB.prepare(`SELECT j.booking_id,j.kind,j.state,j.attempts,b.parent_email,b.parent_name,b.grade,b.subject,
 b.requested_date,b.time_local,b.starts_at_utc,b.session_type,b.status AS booking_status,o.state AS payment_state
 FROM booking_mail_jobs j JOIN booking_requests b ON j.booking_id=b.id LEFT JOIN orders o ON b.order_id=o.id
 WHERE j.attempts<5 AND j.next_attempt_at<=?
 AND (j.state='queued' OR (j.state='sending' AND j.claimed_at<?))
 ORDER BY CASE WHEN j.kind LIKE 'confirmation%' THEN 0 WHEN j.kind='declined_parent' THEN 1 ELSE 2 END,j.created_at LIMIT 30`)
  .bind(now,stale).all();
 let sent=0,skipped=0;
 for(const j of queue.results||[]){
  const claim=await env.DB.prepare(`UPDATE booking_mail_jobs
  SET state='sending',attempts=attempts+1,claimed_at=?
  WHERE booking_id=? AND kind=? AND attempts<5 AND next_attempt_at<=?
  AND (state='queued' OR (state='sending' AND claimed_at<?))`)
   .bind(iso(),j.booking_id,j.kind,iso(),stale).run();
  if(Number(claim.meta?.changes||0)!==1)continue;
  if(!mailAllowed(j)){await cancel(env,j.booking_id,j.kind);skipped++;continue}
  try{
   const payload=mailPayload({...j,owner_email:env.OWNER_EMAIL||env.MAIL_SENDER},h.safe);
   await h.email(env,payload.to,payload.subject,payload.html);
   await markComplete(env,j.booking_id,j.kind);sent++;
  }catch(e){await markFailure(env,j,e)}
 }
 return {sent,skipped,checked:(queue.results||[]).length};
}
