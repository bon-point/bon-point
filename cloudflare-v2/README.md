# Nouveau serveur Cloudflare Bon Point v2

**Projet neuf**, isolé du précédent Worker `bon-point-auto`. Les anciens paiements Stripe et l'ancien Worker ne sont pas réutilisés.

## État
- Code prêt dans `cloudflare-v2/src/index.js` mais **aucun déploiement Cloudflare effectué**.
- Aucun compte Cloudflare ni secret Stripe associé dans cette conversation.
- `PAYMENTS_ENABLED=false` dans `wrangler.toml` et `window.BONPOINT_CHECKOUT_API=""` sur le site.
- Le seul compte Stripe actuellement visible dans ChatGPT est un compte test nommé « New business », **pas celui du projet**. Aucun encaissement réel possible.

## Architecture
1. **Offres** : base D1 (`offers`) avec cinq tarifs modifiables par API administrateur, en euros **centimes**.
2. **Propositions** : le responsable confirme le planning avec un parent, puis crée une proposition nominative (`POST /api/admin/proposals` avec `X-Admin-Key` côté administrateur uniquement). Le Worker crée une URL privée valable 7 jours.
3. **Paiement** : le parent consulte son devis, les CGV, valide la commande ; le Worker fixe le prix à partir de D1 et crée une session Stripe Checkout. Le paiement n'est jamais validé depuis la page de retour.
4. **Confirmation** : webhook Stripe HMAC contrôlant mode, ID, montant, devise et e-mail, puis insertion d'une tâche de confirmation en D1.
5. **Google Meet** : obligatoire pour 6e/5e/4e/3e ; le lien Google Meet est créé manuellement par l'organisateur et renseigné dans la proposition *avant paiement*. Le parent le reçoit par e-mail seulement après paiement vérifié.
6. **Discord** : possible au lycée uniquement si le participant respecte l'âge minimum de Discord (15 ans en France) et que le parent le confirme. Le bot crée une invitation individuelle au serveur ; les permissions de salon privé sont une configuration Discord distincte. Google Meet reste possible au lycée.
7. **Rétractation** : enregistrement horodaté en D1 et accusé par e-mail via Brevo, avec file de reprises. Contrôle juridique nécessaire avant mise en production.

## Cloudflare : étapes de préparation par le propriétaire autorisé
1. Se connecter au compte Cloudflare approprié. Accès nécessaire au tableau de bord Cloudflare ; **je ne dispose pas de cet accès**.
2. Depuis le dossier `cloudflare-v2`, créer la D1 via `npx wrangler d1 create bon-point-v2`, préférer si souhaité la juridiction UE (`--jurisdiction eu`, selon conditions Cloudflare). Inscrire l'ID de D1 dans `wrangler.toml`.
3. Initialiser la base : `npx wrangler d1 migrations apply bon-point-v2 --remote`. Vérifier dans D1 que les cinq offres et les tables de commandes sont présentes.
4. Ajouter les secrets Cloudflare, jamais dans GitHub : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_API_KEY` (clé aléatoire longue), `MAIL_API_KEY`, `MAIL_SENDER`. Pour Discord : `DISCORD_BOT_TOKEN`, `DISCORD_CHANNEL_ID`. `OWNER_EMAIL` pour réception des demandes.
5. Configurer chez Stripe, sur le **nouveau compte confirmé**, le webhook `https://<NOUVEAU-WORKER>/stripe/webhook` avec événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Tester uniquement en **mode test**.
6. Déployer le Worker via `npx wrangler deploy`. Tester `GET /health` : tant que les secrets et `PAYMENTS_ENABLED=true` ne sont pas tous présents, le paiement reste désactivé.
7. Après tests, saisir l'URL HTTPS du nouveau Worker dans `config-paiement.js`. Le site affiche alors les nouveaux prix issus de D1, et les propositions nominatives peuvent devenir payables **uniquement** quand le serveur l'autorise.

## Gestion des prix
- `GET /api/offers` : liste publique des tarifs actifs.
- `POST /api/admin/offers/:id` avec `X-Admin-Key` depuis un environnement d'administration protégé, par exemple body `{"price_cents":79000,"active":true}`. Ne jamais inclure cette clé dans le navigateur.
- Le prix d'une proposition est **figé dans la commande** lors de sa création : modifier le catalogue ne modifie pas les montants déjà proposés.
- Si un prix change, relire et adapter les **CGV** et communications commerciales en plus de la base.

## Créer une proposition nominative (uniquement administrateur)
Exemple de corps JSON pour `POST /api/admin/proposals` :
```json
{"offer":"brevet","email":"parent@exemple.fr","grade":"3e","method":"meet","meet_url":"https://meet.google.com/abc-defg-hij"}
```
Le lien Meet ci-dessus est un **format fictif**, pas un véritable accès utilisable. Ne partager les vrais liens que dans les propositions privées. Pour une classe du collège, le Worker refuse la méthode Discord.

## Prérequis avant de facturer
- Identité professionnelle, statut/éventuel représentant légal, coordonnées et obligations fiscales à confirmer ; ne pas fournir ici de pièce d'identité ni d'informations bancaires.
- CGV exactes, conditions de rétractation, médiateur de la consommation, RGPD (base juridique, conservation, fournisseurs, transferts, demandes de suppression), confirmation écrite des créneaux.
- Sécuriser l'API admin (Cloudflare Access recommandé), limiter le débit public et installer Turnstile contre les demandes de rétractation abusives.
- Tester les webhooks répétés, refus de paiement, remboursements, indisponibilité du mail et des liens Meet/Discord, délais et relances.
- La livraison mail est **au moins une fois** : une erreur après envoi peut conduire à un second message. Prévoir une gestion de déduplication avant le réel.

## Attention
Cloudflare et Stripe demandent des comptes et des paramètres qu'une simple modification GitHub ne peut pas créer. Aucune clé privée n'a été placée dans le dépôt et aucun achat réel n'a été exécuté.
