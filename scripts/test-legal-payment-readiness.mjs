/** Contrôles pré-lancement : ne valident pas à eux seuls la conformité légale. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html=name=>fs.readFileSync(name,'utf8');
const cgv=html('cgv.html'),mentions=html('mentions-legales.html');
const withdrawal=html('retractation.html'),invoice=html('documents/modele-facture-bonpoint.html');
const config=fs.readFileSync('cloudflare-v2/wrangler.toml','utf8');
const worker=fs.readFileSync('cloudflare-v2/src/index.js','utf8');
assert.match(cgv,/14 jours/,'CGV : rappel du délai de rétractation nécessaire');
assert.match(cgv,/href="retractation\.html"/,'CGV : lien vers la rétractation nécessaire');
assert.match(cgv,/premier échange|responsable légal/i,'CGV : conditions de l\'offre destinées aux familles');
assert.match(cgv,/n.est pas disponible dans le tunnel de paiement actuel/,'Ne pas annoncer le paiement fractionné comme actif');
assert.match(mentions,/131 360 802 00014/,'Mentions : SIRET requis');
assert.match(mentions,/Adresse de domiciliation/,'Ne pas considérer les coordonnées complètes comme validées');
assert.match(invoice,/FACTURE — MODÈLE/,'Ne jamais faire passer le brouillon pour une facture émise');
assert.match(invoice,/TVA/,'Mention TVA à renseigner');
assert.match(config,/PAYMENTS_ENABLED\s*=\s*"false"/,'Les vrais paiements doivent rester désactivés');
assert.match(config,/STRIPE_MODE\s*=\s*"test"/,'Mode Stripe test obligatoire avant validation');
assert.match(worker,/REQUIRE_CONFIRMED_BOOKING/,'Créneau confirmé obligatoire pour un paiement');
const checkout=html('checkout.html'),admin=html('admin.html');
assert.match(checkout,/pas encore disponible en ligne/,'Échéanciers de commande non activés annoncés honnêtement');
assert.match(admin,/id="serviceHealth"/,'Console affiche désormais les états des services');
assert.match(admin,/api\/site\/status/,'La console doit vérifier les formulaires sur le serveur');
const deployment=fs.readFileSync('.github/workflows/deploy-cloudflare-v2.yml','utf8');
assert.match(deployment,/github\.ref_name == 'main'/,'Déploiement manuel Worker depuis la branche principale uniquement');
assert.match(deployment,/PAYMENTS_ENABLED = "false"/,'Lancement de déploiement manuel protège les paiements réels');
assert.doesNotMatch(deployment,/^\s+run:.*wrangler d1 migrations apply/m,'Ne pas exécuter des migrations D1 non contrôlées en déploiement');

assert.match(withdrawal,/id="backupText"/,'Rétractation : secours manuel sans logiciel e-mail');
assert.match(withdrawal,/id="copy"/,'Rétractation : option copier');
for(const m of withdrawal.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  new vm.Script(m[1],{filename:'retractation.html:inline.js'});
}
assert.ok(!/ROBERT SCHUMAN|ATHIS-MONS/i.test([mentions,cgv,invoice].join(' ')),
  'Ne pas divulguer automatiquement l\'adresse résidentielle à partir de l\'avis INSEE');
console.log('OK legal drafts clearly provisional, withdrawal JS, address privacy, real Stripe payments gated');
