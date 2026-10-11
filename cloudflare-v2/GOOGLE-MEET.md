# Google Agenda + Google Meet — Bon Point

Le propriétaire a connecté Google Calendar à ChatGPT. Un calendrier accessible en écriture est disponible. Cette connexion permet de programmer des cours ponctuellement **dans une conversation ChatGPT autorisée**, mais elle **n'autorise pas le Cloudflare Worker à appeler Google Calendar automatiquement**.

## Procédure de planification d'un cours collégien
1. Le parent confirme la matière, la date, l'horaire et la durée du cours. Vérifier que l'horaire est libre sur Google Agenda.
2. Créer l'événement `Bon Point — Cours de [matière]` dans Google Agenda, avec un lien Google Meet (`add_google_meet=true`), fuseau `Europe/Paris`, visibilité `private` et **attendees=[]** au départ : cela évite d'envoyer le lien avant paiement.
3. Si la création de Google Meet est encore en cours, relire l'événement avant de récupérer le lien définitif.
4. Après validation du responsable légal et du calendrier des séances, créer une proposition privée Cloudflare v2 (`POST /api/admin/proposals`) indiquant `method: 'meet'` et `meet_url` égal au vrai lien Google Meet.
5. Envoyer au parent l'URL de proposition sans divulguer le lien Google Meet. Après paiement confirmé par webhook Stripe, le Worker enverra le lien Google Meet au parent par courriel.
6. À défaut de paiement, contacter la famille ; supprimer ou modifier l'événement de réservation non retenue si nécessaire.

## Pour le lycée
Google Meet reste l'option universelle. Discord ne doit être utilisé que si le participant respecte les règles d'âge du service, et avec validation du responsable légal. Ne pas diffuser d'invitation Discord dans l'HTML public.

## Limites
- Aucune automatisation Google Calendar côté Cloudflare n'a été déployée ou autorisée.
- Pour la gestion automatique future, prévoir Google Calendar API avec OAuth/compte de service autorisé, stockage sécurisé des secrets et vérification de l'accord du propriétaire.
- Lien Meet privé dans la base de commandes, avec contrôle d'accès strict et politique de conservation adaptée.
- Éviter de faire apparaître des informations scolaires ou personnelles d'élèves dans un événement public ; l'invitation peut être adressée au responsable légal après le paiement.

Le site ne doit pas prétendre générer les visioconférences automatiquement tant que cette fonctionnalité n'a pas été configurée.