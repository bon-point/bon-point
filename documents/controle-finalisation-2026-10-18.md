# Bon Point — contrôle de finalisation du 18 octobre 2026

Contrôle effectué sur le dépôt GitHub et les paramètres Cloudflare ; aucune vente réelle, clé secrète ou donnée client créée.

## État observé
- Site GitHub Pages : https://bon-point.github.io/bon-point/ ; tunnel de commande à jeton nominatif dans `checkout.html`.
- Worker Cloudflare `bon-point-v2` présent, authentification admin et espace parents configurés.
- Cloudflare : `PAYMENTS_ENABLED=false`, `STRIPE_MODE=test`, `SITE_INTAKE_ENABLED=false`, `REQUIRE_CONFIRMED_BOOKING=true`.
- Bindings `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` présents et chiffrés (contenu non inspecté).
- Compte Stripe connecté au mode live, mais le code déployé n'est pas ouvert aux encaissements.
- Les tests du 13 octobre documentent un Checkout sandbox impayé et des simulations locales. Le webhook Stripe réel sandbox n'a pas encore été validé de bout en bout.
- La date de début d'activité annoncée dans le dossier Sirene est le 20 octobre 2026 (date future lors du contrôle).

## Prérequis de lancement à résoudre
1. Capacité juridique et représentant légal du titulaire auprès de l'autorité compétente ; vérification de l'éligibilité Stripe dans le Dashboard et sans partage de pièces d'identité dans GitHub.
2. Médiateur de la consommation référencé effectivement choisi et conventionné avant vente aux parents consommateurs. Ne pas se contenter d'une promesse de médiation ni inventer un médiateur.
3. Coordonnées professionnelles légalement publiables, mentions légales, CGV, rétractation, régime fiscal/TVA, facturation, politique de confidentialité et validation des tarifs.
4. Confirmer l'entrée en activité, puis valider le parcours technique sandbox de bout en bout (réservation confirmée -> proposition -> Checkout test -> webhook Stripe authentique -> état D1 -> confirmation email -> non-duplication).
5. Enfin, contrôler la configuration live séparément et n'activer les ventes qu'après validation des points précédents.

## Références officielles
- https://entreprendre.service-public.gouv.fr/vosdroits/F33338
- https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/choisir-un-mediateur-de-la-consommation
- https://support.stripe.com/questions/can-i-use-stripe-if-i-am-under-18

**Décision :** maintien du mode non encaissant. Ne pas remplacer une vérification juridique ou la signature d'une convention par un simple changement de variable Cloudflare.