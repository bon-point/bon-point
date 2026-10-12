/**
 * Safe one-shot Brevo connection check. A test can be sent only to the
 * verified Bon Point sender address, never to parents or customers.
 * Does not create orders, bookings, payments or mailing-list contacts.
 */
const TARGET="soutien.bonpoint@gmail.com";
const KEY="brevo-connectivity-2026-10-12";
export async function runMailSmokeTest(env,sendEmail){
 if(env.MAIL_SMOKE_TEST_ENABLED!=="true")return {status:"disabled"};
 if(!env.DB||!env.MAIL_API_KEY||env.MAIL_SENDER!==TARGET||env.OWNER_EMAIL!==TARGET)
  return {status:"not-configured"};
 // INSERT OR IGNORE guarantees that only one scheduled invocation can send.
 const lock=await env.DB.prepare(
  "INSERT OR IGNORE INTO mail_delivery_checks(test_key,state) VALUES(?,'sending')"
 ).bind(KEY).run();
 if(Number(lock.meta?.changes||0)!==1)return {status:"already-started"};
 try{
  await sendEmail(env,TARGET,"Bon Point — Test de connexion Brevo",
   '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px">'+
   '<h2>Bon Point</h2>'+
   '<p>Ce message confirme que le serveur Bon Point peut soumettre un e-mail transactionnel à Brevo.</p>'+
   '<p><strong>Test technique uniquement :</strong> aucune réservation, aucun paiement et aucune donnée d’élève.</p>'+
   '<p>Si vous avez reçu ce message, l’envoi Brevo fonctionne.</p></div>');
  await env.DB.prepare(
   "UPDATE mail_delivery_checks SET state='accepted',finished_at=CURRENT_TIMESTAMP,error_code=NULL WHERE test_key=? AND state='sending'"
  ).bind(KEY).run();
  return {status:"accepted"};
 }catch(error){
  const code=/Mail delivery failed (\d{3})/.exec(String(error?.message||""))?.[1];
  await env.DB.prepare(
   "UPDATE mail_delivery_checks SET state='failed',error_code=?,finished_at=CURRENT_TIMESTAMP WHERE test_key=? AND state='sending'"
  ).bind(code?"http-"+code:"request-failed",KEY).run();
  return {status:"failed"};
 }
}
