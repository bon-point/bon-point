# Bon Point — préparation du webhook Stripe live (18 octobre 2026)

## Actions exécutées et vérifiées

- Une **nouvelle destination webhook live v2** Stripe a été créée sur le compte `acct_1U1uAJR9ncVSpio5`.
- Destination : `we_1URtzgR9ncVSpio5ywWV8d6Q`.
- URL : `https://bon-point-v2.soutien-bonpoint.workers.dev/stripe/webhook`.
- Événements souscrits : `checkout.session.completed` et `checkout.session.async_payment_succeeded`.
- **État confirmé par relecture de l'API Stripe : `disabled`** (ne reçoit donc pas de nouveaux événements).
- L'ancien webhook `we_1U2SX6R9ncVSpio5HndW9tfw`, dirigé vers `bon-point-auto`, reste inchangé et actif.
- Le nouveau secret de signature a été directement stocké comme variable chiffrée Cloudflare `STRIPE_WEBHOOK_SECRET_LIVE_STANDBY`. **Aucune copie du secret n'est publiée dans ce dépôt.**
- Cloudflare `bon-point-v2` : valeurs rétablies `PAYMENTS_ENABLED=false`, `STRIPE_MODE=test`, `SITE_INTAKE_ENABLED=false`. Relecture confirmant **24 bindings préservés**, y compris D1 et les secrets.
- Deux nouveaux commits dans GitHub préparent (sans déploiement Worker automatique) l'utilisation **séparée** des secrets Stripe test et live : `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` en test ; `STRIPE_SECRET_KEY_LIVE` / `STRIPE_WEBHOOK_SECRET_LIVE_STANDBY` en mode live. Le mode live ne doit jamais réutiliser les secrets de test.
- Le fichier `cloudflare-v2/scripts/test-stripe-checkout-mock.mjs` contient un test du verrouillage du mode live quand un secret distinct manque.

## Incohérence de déploiement remarquée puis corrigée

Lors des contrôles, Cloudflare renvoyait `PAYMENTS_ENABLED=true` et `STRIPE_MODE=live`. L'historique indique un déploiement par le tableau de bord le 18 octobre à 13:16 UTC (avant l'installation du secret standby à 13:19 UTC), dont la provenance ou la motivation reste à vérifier avec le titulaire. Ces réglages ont été **rétablis** à `false` et `test` le même jour, avec conservation de 24 bindings. Il n'est pas affirmé que des paiements ont été réalisés ; les états bancaires, la D1 et le flux Checkout n'ont pas été audités sur cette période.

## Blocages pour un basculement vers des encaissements réels

1. Vérifier juridiquement l'habilitation du titulaire et le représentant Stripe approprié ; ne pas contourner les restrictions d'âge.
2. Respecter le début d'activité Sirene du 20 octobre 2026 et compléter médiation de consommation, mentions légales, CGV/rétractation, TVA et facturation.
3. Finir un test fictif de bout en bout avec un véritable webhook Stripe sandbox, commande et e-mail, et vérifier l'expiration et les doublons.
4. Le secret `STRIPE_SECRET_KEY_LIVE` **n'a pas été installé**, ni récupéré, ni publié ; le connecteur Stripe connecté n'expose pas cette clé secrète.
5. Les modifications de code GitHub **ne sont pas encore déployées** sur le Worker. Une fois le dossier validé, redéployer proprement le code et les bindings en conservant toute la configuration, puis vérifier le mode test avant tout nouveau lancement.
6. Après les vérifications d'identité, de conformité et de fonctionnement, une personne habilitée pourra configurer la clé live dans les secrets Cloudflare, activer le nouveau webhook dans Stripe et n'ouvrir les paiements qu'après validation du parcours.

**Statut final du présent rapport : webhook live v2 créé MAIS désactivé ; secret de signature live en réserve ; ventes réelles conservées fermées.**
