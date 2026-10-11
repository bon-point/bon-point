# Bon Point — Worker de paiements (prototype non déployé)

Ce Worker est indépendant de l'ancien Worker Cloudflare et des réservations Firebase visibles dans espace.html.

## État
- ENABLE_CHECKOUT = false par défaut ; config-paiement.js ne contient aucune URL de serveur.
- Stripe propose seulement le compte de test « New business » ; confirmer qu'il correspond à l'activité avant d'y créer des produits.
- Aucune clé privée, webhook Stripe, base D1, clé Brevo ou autorisation Discord n'a été configuré ni testé sur ce nouveau Worker.
- Le site ne doit pas être considéré comme une boutique opérationnelle avant validation des prérequis.

## À faire pour tester et activer (personne autorisée sur les comptes)
1. Compléter l'identité professionnelle, les CGV, la politique de confidentialité, le régime de TVA, les modalités de rétractation et le médiateur de la consommation ; valider l'autorisation d'exercer/facturer.
2. Créer une base Cloudflare D1, renseigner son identifiant dans wrangler.toml et exécuter migrations/0001_init.sql.
3. Enregistrer de manière privée les secrets STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_API_KEY, BREVO_API_KEY, BREVO_FROM. Pour les invitations Discord facultatives : DISCORD_BOT_TOKEN et DISCORD_CHANNEL_ID. Optionnel : ADMIN_NOTIFY_EMAIL.
4. Configurer Stripe webhook vers /stripe/webhook : checkout.session.completed et checkout.session.async_payment_succeeded.
5. Ne délivrer une proposition qu'après confirmation des disponibilités et accord d'un parent. POST /api/admin/proposals requiert l'en-tête secret X-Admin-Key, avec un JSON de type offre progression, e-mail du parent et delivery alternative ou discord.
6. Transmettre l'URL confidentielle fournie au parent. Elle ne peut ouvrir un paiement Stripe que si le Worker est configuré, en mode actif, et si le parent accepte les conditions.
7. Tester le paiement en mode test, les webhooks signés, le paiement refusé, les erreurs réseau, l'e-mail Brevo, le retrait, le caractère unique des invitations et le respect des conditions d'âge Discord.
8. Avant l'activation réelle, renseigner l'URL HTTPS déployée dans config-paiement.js, puis ENABLE_CHECKOUT=true sur le Worker validé. Jamais de secrets dans le dépôt GitHub.

## Routes
- GET /health : disponibilité du service.
- POST /api/admin/proposals : création d'une proposition, réservé à l'administrateur.
- GET /api/proposal?token=... : détails de la proposition, sans divulguer l'e-mail.
- POST /api/checkout : ouverture d'une session Stripe avec montant fixé sur le serveur.
- POST /stripe/webhook : vérification et confirmation du paiement.
- POST /api/withdrawal : notification horodatée et e-mail d'accusé de réception.

## Limitations connues
- Prototype à auditer avant déploiement ; aucune réservation automatique, remboursement ou facturation automatisée.
- L'invitation Discord à usage unique ne configure pas l'accès à un salon privé. Prévoir aussi la visio alternative pour les élèves sous l'âge minimum.
- Implémenter une file de traitement pour assurer une livraison réellement idempotente malgré les échecs d'envoi.
- Déployer protection antispam, limitation de débit et contrôle d'accès à l'administration (par exemple Cloudflare Access).
- Les opérations de rectification, suppression et conservation des données clients doivent être documentées et réalisées.
- Ne pas associer un compte Stripe au prestataire s'il n'est pas autorisé à le détenir ; obtenir validation d'un responsable légal si nécessaire.