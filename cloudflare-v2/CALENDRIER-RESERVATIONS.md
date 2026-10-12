# Bon Point — Calendrier et réservations

État technique : 12 octobre 2026.

## Disponibilités (Europe/Paris)

- Lundi, mardi, mercredi et vendredi : de **18 h à 22 h** (dernier départ : 21 h pour 1 h, 21 h 30 pour 20 min).
- Jeudi : de **13 h 30 à 22 h**.
- Samedi/dimanche : de **8 h à 18 h** (dernier départ : 17 h pour 1 h, 17 h 30 pour 20 min).
- Calendrier : au plus tôt 3 jours après la date locale, jusqu'à 90 jours ; le serveur impose 48 h d'avance et **50 h pour la confirmation administrative**.
- Séances : 20 min pour un premier échange gratuit, 60 min pour une séance.
- Intervalle de battement : **10 min** supplémentaires dans le moteur d'exclusivité des créneaux.

## Ce qui a été déployé

- `SLOT_PREVIEW_ENABLED=true` : **GET /api/site/slots?date=AAAA-MM-JJ&session_type=intro|course** renvoie uniquement l'heure et `available=true|false`. Aucune identité ni adresse e-mail n'est transmise. Il s'agit d'un aperçu, **pas d'une disponibilité réservée**.
- L'interface `reserver.html` affiche les horaires occupés lorsque le Worker les fournit. Si le contrôle est indisponible, elle reste indicative et précise l'incertitude.
- Deux triggers **D1 SQLite** empêchent tout chevauchement de rendez-vous `confirmed`, y compris dans les cas de confirmations concurrentes : migrations **0014** et **0015**.
- `booking_requests` peut recevoir plusieurs propositions `requested` à la même heure ; une seule peut devenir `confirmed`.
- Quand l'administrateur confirme, refuse ou annule une demande, une file `booking_mail_jobs` est renseignée dans la même transaction.
- Le Worker planifié toutes les 5 minutes envoie les confirmations (ou refus) au parent et/ou à l'administrateur via Brevo. Le courriel de confirmation d'un cours payant indique **« sous réserve de règlement »**.
- Pour les rappels à J-2, le Worker vérifie la confirmation et, pour les cours payants, l'état **`orders.state=paid`**. Le rappel n'est mis en file que si la séance est à au moins 48 h.
- Chaque destinataire est suivi séparément. Les tentatives sont reprises après une erreur Brevo avec temporisation. Un message est considéré envoyé quand Brevo accepte l'appel, ce qui ne garantit pas sa réception en boîte de réception. Une interruption entre l'envoi et l'enregistrement peut exceptionnellement produire un doublon.
- L'administration affiche les statuts d'envoi et permet de **relancer uniquement un e-mail qui a définitivement échoué**.

## Règles de lancement

- **`SITE_INTAKE_ENABLED=false`** : les demandes automatiques via formulaire restent désactivées ; le site utilise le courriel prérempli jusqu'à nouvelle validation de conformité. Le calendrier de consultation des créneaux fonctionne séparément.
- **`PAYMENTS_ENABLED=false`** et **`STRIPE_MODE=test`** : aucun paiement réel n'est activé.
- Les réservations issues d'un e-mail ne sont pas ajoutées à D1 automatiquement. Pour leur faire bénéficier de la confirmation et du rappel, il faudra les enregistrer via une interface authentifiée ou activer le formulaire une fois le lancement autorisé.
- Les deux salles Discord restent privées. La liaison Discord nécessite une réservation confirmée et, pour un cours payant, la confirmation du paiement.
- Le système n'est pas un agenda Google Calendar synchronisé ; la disponibilité est calculée à partir des réservations confirmées dans Bon Point uniquement.
- Si le professeur ajoute un rendez-vous à un agenda personnel extérieur, il doit aussi le reporter dans Bon Point pour éviter un conflit.
- Ne pas publier les informations personnelles des familles, ne pas activer Stripe réel ni l'inscription publique automatique sans les validations légales et les tests complets.

## Tests

- `python3 scripts/test-booking-db.py` : triggers SQLite et notifications atomiques.
- `node --test cloudflare-v2/scripts/test-calendar-availability.mjs` : plages Paris, créneaux bloqués, confidentialité.
- `node --test cloudflare-v2/scripts/test-booking-mail.mjs` : envoi par destinataire, reprise et absence de doublons après succès.
- `node scripts/test-booking.mjs` : dates, horaires, UTC et heure d'été/hiver.
