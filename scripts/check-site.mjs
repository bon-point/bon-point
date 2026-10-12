import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const names=['index.html','espace.html','checkout.html','retractation.html','paiement-confirme.html','cgv.html','confidentialite.html','mentions-legales.html','reserver.html','diagnostic.html','parents.html','admin.html'];
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

const page=fs.readFileSync('index.html','utf8');
assert.ok(!page.includes('<div class="strap"'),'Top strap must remain removed');
assert.ok(!page.includes('<div class="prelaunch-info"'),'Obsolete prelaunch banner must remain removed');
assert.ok(!page.includes('Mon espace')&&!page.includes('espace.html'),'Old area must stay out of navigation and homepage');
assert.ok(page.includes('class="hero-head-accent">Progresser</span>'),'Progresser must remain a single unbroken word');
assert.ok(page.includes('class="payment-choices"'),'Premium payment plans must remain readable');
assert.match(page,/<span>En une fois<\/span><strong>790 €<\/strong>/,'Brevet must show full one-time payment');
assert.match(page,/<span>En une fois<\/span><strong>1 290 €<\/strong>/,'Bac must show full one-time payment');
assert.match(page, /<option value="En une seule fois">En une seule fois<\/option>/,'Contact form needs one-time option');
const checkoutPage=fs.readFileSync('checkout.html','utf8');
assert.match(checkoutPage, /<option value="once">En une seule fois \(montant total\)<\/option>/,'Checkout needs once option');
assert.match(checkoutPage, /schedule\.value=.*:'once'/,'Full payment should be the default');
assert.match(worker, /payment_plan!=="once"/,'Only the locked one-time proposal can reach checkout');
assert.ok(!page.includes('263,34 € +'),'Avoid long premium installment additions');
assert.ok(!page.includes('matheo.png'),'Portrait must not be in homepage');
console.log('OK Bonpoint visual regressions and legacy removal');

const services=fs.readFileSync('cloudflare-v2/src/site-services.js','utf8');
const vars=fs.readFileSync('cloudflare-v2/wrangler.toml','utf8');
assert.match(vars,/SITE_INTAKE_ENABLED = "false"/,'No public intake before review');
assert.match(vars,/PARENT_PORTAL_ENABLED = "false"/,'No parent login before review');
assert.match(worker,/handleSite\(/,'Worker services must be routed');
assert.match(worker,/cleanupSiteData\(/,'Sensitive records cleanup must be scheduled');
assert.match(services,/verifyHuman\(/,'Intake must verify Turnstile on server');
assert.match(services,/PARENT_AUTH_SECRET/,'Private parent authentication secret required');
assert.match(services,/parent_email=\?/,'Parent records must be scoped to the logged-in email');
assert.match(services,/h\.adminAllowed\(req,env\)/,'Admin writes must check the existing admin key');
assert.match(fs.readFileSync('parents.html','utf8'),/Authorization/,'Dashboard must authenticate');
assert.match(fs.readFileSync('reserver.html','utf8'),/l.agenda n.affiche pas des disponibilités en temps réel/i,'No invented availability or instant booking');
for(const n of ['reserver.html','diagnostic.html','parents.html'])assert.ok(page.includes('href="'+n+'"'),'Homepage missing new tool '+n);

assert.ok(!fs.existsSync('ressources.html'),'Temporary resources library should be removed');
assert.ok(!page.includes('href="ressources.html"'),'No broken library link on homepage');
assert.match(fs.readFileSync('admin.html','utf8'),/api\/staff\/verify/,'Admin 2FA required');
assert.match(fs.readFileSync('admin.html','utf8'),/data-view="progress"/,'Progress administration required');
assert.match(fs.readFileSync('parents.html','utf8'),/Télécharger le récapitulatif PDF/,'Parent private PDF download required');
assert.match(services,/PARENT_SELF_SERVICE_CODES/,'Parent OTP issuance must be admin controlled');
const operations=fs.readFileSync('cloudflare-v2/src/operations.js','utf8');
assert.match(operations,/ADMIN_PANEL_ENABLED/,'Administration should be feature gated');
assert.match(operations,/session_file_blobs/,'Private PDF storage required');
assert.match(operations,/bookingReminders/,'Booking reminders required');
assert.match(fs.readFileSync('cloudflare-v2/wrangler.toml','utf8'),/ADMIN_PANEL_ENABLED = "true"/,'Admin activation must be reflected in the deployment configuration');
assert.match(operations,/ADMIN_LOGIN_PASSWORD\?\.length>=24/,'Admin login requires a sufficiently long password');
assert.match(operations,/ADMIN_AUTH_SECRET\?\.length>=32/,'Admin login requires a sufficiently long secret');
assert.match(fs.readFileSync('cloudflare-v2/wrangler.toml','utf8'),/PAYMENTS_ENABLED = "false"/,'Activating admin must not enable payments');
assert.match(fs.readFileSync('cloudflare-v2/wrangler.toml','utf8'),/SITE_INTAKE_ENABLED = "false"/,'Activating admin must not enable public intake');
assert.match(fs.readFileSync('cloudflare-v2/wrangler.toml','utf8'),/REPORT_UPLOADS_ENABLED = "false"/,'No PDF upload before review');
console.log('OK gated private services, parent data boundaries and new pages');
