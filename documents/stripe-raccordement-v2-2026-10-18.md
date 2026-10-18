# Bon Point — raccordement Stripe v2 : audit du 18 octobre 2026

## Contrôles directs (connecteurs Stripe et Cloudflare)
- Compte Stripe connecté : `acct_1U1uAJR9ncVSpio5`, France, type `individual`, `charges_enabled=true`, `payouts_enabled=true`, `details_submitted=true` ; aucune exigence supplémentaire ne ressort du tableau `requirements` de l'API à cette date. **Cela ne vaut pas validation juridique ni preuve de l'âge légal du titulaire**.
- Webhook **live** visible sur ce compte : `we_1U2SX6R9ncVSpio5HndW9tfw`, activé, écoute `checkout.session.completed`, mais cible **l'ancien Worker** `https://bon-point-auto.soutien-bonpoint.workers.dev`. Ne pas le supprimer ou le rediriger avant de confirmer les utilisations existantes.
- Aucun webhook live vers `https://bon-point-v2.soutien-bonpoint.workers.dev/stripe/webhook` n'est présent.
- Worker `bon-point-v2` : `PAYMENTS_ENABLED=false`, `STRIPE_MODE=test`, `SITE_INTAKE_ENABLED=false`, `REQUIRE_CONFIRMED_BOOKING=true`.
- Bindings chiffrés `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` présents, valeurs **non lues**.
- La connexion Stripe disponible dans ChatGPT donne accès uniquement au compte **live**, pas à une connexion de test indépendante. Aucun webhook test authentique n'a pu être installé via cette connexion.
- `checkout.html` et `/api/checkout` implémentent déjà Stripe Checkout à prix verrouillé sur proposition nominative et réservation confirmée. Le Worker attend les événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`, signés.
- Le site est public sur https://bon-point.github.io/bon-point/ ; les ventes par carte sont toujours fermées.

## À faire **en test** avant toute vente
1. Rattacher un environnement Stripe sandbox/test utilisable, sans divulguer ses clés dans un dépôt ni dans un message.
2. Créer la destination webhook **test**, URL `https://bon-point-v2.soutien-bonpoint.workers.dev/stripe/webhook`, avec les deux événements attendus ; régler le secret de signature `whsec_` correspondant au test dans Cloudflare.
3. Vérifier dans un environnement isolé une réservation fictive confirmée (minimum 49 h avant la séance), une proposition nominative, une session Checkout test, la simulation de règlement, un événement webhook Stripe authentique, l'état D1, une notification email fictive et l'idempotence.
4. En cas de tests échoués, corriger sans passer en mode live.

## Mise en production **uniquement après** conformité et autorisation
1. Vérifier capacité juridique du titulaire et rôle du représentant/garant éventuel directement dans Stripe, avec l'interlocuteur légal compétent.
2. Respecter le début d'activité déclaré au 20 octobre 2026 ; obtenir et contractualiser une médiation de consommation référencée ; valider mentions légales, CGV, rétractation, coordonnées professionnelles, TVA et factures.
3. Créer une **nouvelle** destination webhook live pour la v2 ; la distinguer de l'ancien endpoint `bon-point-auto` et enregistrer son secret de signature live dans Cloudflare sans le publier.
4. Injecter la clé live autorisée uniquement en secret Cloudflare ; contrôler son préfixe `sk_live_`. Tester webhook/correspondance Stripe et modes avant d'activer `STRIPE_MODE=live` et `PAYMENTS_ENABLED=true`.
5. Vérifier les e-mails, les commandes, les remboursements, les protections contre doubles paiements et la facturation. Conserver le bouton désactivé en cas d'erreur.
6. Gérer explicitement l'expiration des sessions Checkout et les tentatives de paiement reprises pour ne pas bloquer définitivement une proposition abandonnée.

**Aucune écriture Stripe live, aucune vente, aucune nouvelle facture, aucun changement de secrets Cloudflare et aucune activation de paiement réalisés dans cet audit.**

Sources : https://support.stripe.com/questions/can-i-use-stripe-if-i-am-under-18 ; https://entreprendre.service-public.gouv.fr/vosdroits/F31627 ; https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0
