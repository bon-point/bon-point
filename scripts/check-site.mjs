import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const names=['index.html','espace.html','checkout.html','retractation.html','paiement-confirme.html','cgv.html','confidentialite.html','mentions-legales.html'];
for (const name of names) {
  const html=fs.readFileSync(name,'utf8');
  assert.match(html,/<html lang="fr">/,name+': invalid language');
  assert.match(html,/<title>.+<\/title>/,name+': missing title');
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.has(m[1]),name+': broken internal anchor '+m[1]);
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(/application\/ld\+json/i.test(m[1])){JSON.parse(m[2]);continue}
    if(m[2].trim())new vm.Script(m[2],{filename:name});
  }
  for(const match of html.matchAll(/\bhref="([^"]+\.html)(?:#[^"]*)?"/g)){
    const path=match[1].split('?')[0]; if(!path.startsWith('http')) assert.ok(fs.existsSync(path),name+': missing local file '+path);
  }
  console.log('OK '+name);
}
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('tarifs.js','utf8'),ctx);
const catalog=ctx.window.BONPOINT_TARIFS;
const worker=fs.readFileSync('workers/src/index.js','utf8');
const m=worker.match(/const OFFERS=\{([\s\S]*?)\n\};/);
assert.ok(m,'Worker server catalog missing');
const server=vm.runInNewContext('({'+m[1]+'})');
assert.deepEqual(Object.keys(catalog).sort(),Object.keys(server).sort(),'Client/server catalog keys mismatch');
for(const id of Object.keys(catalog))assert.equal(catalog[id].priceCents,server[id].amount,'Price mismatch for '+id);
assert.match(fs.readFileSync('config-paiement.js','utf8'),/BONPOINT_CHECKOUT_API\s*=\s*""/,'Checkout must default to disabled');
assert.match(worker,/verifySignature/,'Missing webhook signature verification');
assert.match(worker,/payment_status/,'Missing paid-state verification');
assert.match(worker,/amount_total/,'Missing amount verification');
console.log('OK matching prices, disabled-by-default payments and webhook checks');
