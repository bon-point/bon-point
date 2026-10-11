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

const worker=fs.readFileSync('cloudflare-v2/src/index.js','utf8');
const sql=fs.readFileSync('cloudflare-v2/migrations/0001_init.sql','utf8');
const entries=[...sql.matchAll(/\('([a-z]+)','[^']+','[^']+',(\d+),\d+\)/g)];
assert.equal(entries.length,5,'Expected five server pricing rows');
const server=new Map(entries.map(match=>[match[1],Number(match[2])]));
assert.deepEqual([...server.keys()].sort(),Object.keys(catalog).sort(),'Price catalogue keys differ');
for(const [id,amount] of server.entries())assert.equal(catalog[id].priceCents,amount,'Price mismatch '+id);
assert.match(fs.readFileSync('config-paiement.js','utf8'),/bon-point-v2\.soutien-bonpoint\.workers\.dev/,'Public API configured');
assert.match(fs.readFileSync('cloudflare-v2/wrangler.toml','utf8'),/PAYMENTS_ENABLED = "false"/,'Worker must default to disabled');
assert.match(worker,/verifyStripe\(/,'Missing webhook HMAC signature verification');
assert.match(worker,/payment_status/,'Missing paid-state verification');
assert.match(worker,/locked_price_cents!==s.amount_total/,'Missing paid amount verification');
assert.match(worker,/gradesCollege.has\(grade\)/,'Missing school-level Meet enforcement');
assert.match(worker,/discord_age_confirmed/,'Missing Discord minimum-age confirmation');
assert.match(worker,/SEND_MAIL|MAIL_API_KEY/,'Missing mail config');
console.log('OK baseline price catalog, no active payments, webhook checks, Meet/Discord');
