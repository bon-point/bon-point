/** Production read-only smoke test. NO financial operations or private data. */
import assert from 'node:assert/strict';

const ROOT='https://bon-point-v2.soutien-bonpoint.workers.dev';
async function read(path){
 const ctrl=new AbortController();
 const timeout=setTimeout(()=>ctrl.abort(),12_000);
 try{
  const response=await fetch(ROOT+path,{signal:ctrl.signal,headers:{Accept:'application/json','Cache-Control':'no-cache'}});
  assert.equal(response.status,200,path+' should return HTTP 200');
  return response.json();
 }finally{clearTimeout(timeout)}
}
const health=await read('/health');
assert.equal(health.running,true,'Worker should be running');
assert.equal(health.payment_enabled,false,'Real/sandbox checkout is not enabled');
assert.equal(health.stripe_mode,'test','Worker remains in Stripe test mode');
const offers=await read('/api/offers');
assert.equal(offers.payment_available,false,'Catalog checkout remains gated');
assert.equal(offers.currency,'EUR');
const priceById=Object.fromEntries(offers.offers.map(o=>[o.id,o.price_cents]));
for(const [id,expected] of Object.entries({seance:5000,progression:19000,ambition:35000,brevet:79000,bac:129000})){
 assert.equal(priceById[id],expected,'Catalog amount for '+id);
}
const status=await read('/api/site/status');
assert.equal(status.intake,false,'Public intake remains disabled until customer readiness review');
assert.equal(status.parent_portal,true,'Private parent portal remains enabled');
console.log('OK public Worker replies, five verified EUR offers, private parent area, Stripe/live payments and public intake disabled.');
