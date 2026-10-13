# Bon Point — vérification avant les premiers encaissements Stripe
Mise à jour : 13 octobre 2026. Document technique de préparation, sans secret et sans activation.

## Vérifications réalisées sur le compte Stripe connecté (lecture seule)
- Un compte Stripe français en mode **live** est connecté à l'intégration.
- Stripe renvoie `charges_enabled=true` et `payouts_enabled=true`.
- L'API ne signale ni `currently_due`, ni `past_due`, ni `disabled_reason`.
- Ces indicateurs techniques ne démontrent pas à eux seuls la capacité juridique de l'entrepreneur, l'achèvement des obligations contractuelles vis-à-vis des familles ou l'éligibilité du compte au regard des conditions d'âge de Stripe.
- **Aucun paiement, lien de paiement, facture réelle ou produit Stripe n'a été créé par cet audit.**

## Contrôles réalisés sur Cloudflare Workers
- Worker : `bon-point-v2`.
- `PAYMENTS_ENABLED=false` (inchangé).
- `STRIPE_MODE=test` (inchangé).
- `SITE_INTAKE_ENABLED=false` (inchangé).
- `REQUIRE_CONFIRMED_BOOKING=true` (inchangé).
- Les liaisons secrètes `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` sont **absentes**.
- La base D1 contient 0 commande, 0 facture, 0 réservation à la date du contrôle.
- Le code source dispose déjà d'un paiement Checkout Stripe pour les propositions nominatives à règlement en une seule fois, d'un contrôle du statut de la séance confirmée et d'une vérification de signature du webhook. Il reste à valider l'intégration de bout en bout avec des données fictives, sans déclencher de vrai paiement.

## Points bloquants avant le mode live
1. **Capacité juridique d'exploiter l'entreprise individuelle et de conclure les contrats :** à vérifier avec l'autorité compétente ou un professionnel. Selon service-public.fr, un mineur non émancipé ne peut pas créer une EI, tandis qu'un mineur émancipé peut le faire sous conditions. La seule présence d'un SIRET n'est pas une attestation suffisante.
2. **Conditions Stripe si le titulaire est mineur :** Stripe exige qu'un représentant légal assume le rôle indiqué par la plateforme avant toute acceptation de fonds. La vérification se fait **dans Stripe** par la personne légalement habilitée, sans partage de documents privés, dates de naissance, mots de passe ou pièces d'identité dans un dépôt GitHub ou un chat.
3. **Date de début d'activité :** l'avis INSEE établi le 13 octobre 2026 indique une activité à partir du **20 octobre 2026** ; toute date effective et possibilité contractuelle antérieure doivent être confirmées officiellement.
4. **Obligations de vente aux particuliers :** obtenir un médiateur référencé, finaliser les CGV et la rétractation, les informations précontractuelles, le régime TVA et la facturation. L'adresse de domicile présente dans l'avis Sirene ne doit pas être exposée dans le dépôt public sans vérification et choix éclairé.
5. **Test technique :** disposer d'un environnement Stripe de test distinct, valider un règlement fictif et sa confirmation avec un webhook signé, son caractère idempotent, la prévention des doublons et les e-mails. Ensuite seulement, ajouter les secrets dans Cloudflare (jamais dans GitHub) et décider séparément de toute activation réelle.

## Sources officielles
- https://entreprendre.service-public.gouv.fr/vosdroits/F31627
- https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account
- https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0

**État : pas prêt pour l'encaissement réel ; ne pas basculer `PAYMENTS_ENABLED` ou `STRIPE_MODE` à ce stade.**
