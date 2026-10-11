# Nouveaux services Bon Point — configuration responsable

Ce module ajoute quatre pages publiques et un espace privé :

- `reserver.html` : proposition d'un créneau de premier échange, jamais une réservation automatiquement confirmée.
- `diagnostic.html` : questionnaire pédagogique rempli par un parent.
- `ressources.html` : 12 fiches de révision et exercices corrigés accessibles sans compte.
- `parents.html` : suivi pédagogique, rendez-vous, commandes et références de factures, après authentification du parent.

**Aucun paiement, contrat ou accès confidentiel n'est activé par cette modification.** Le Worker Stripe existant continue d'utiliser `PAYMENTS_ENABLED=false`. Les fichiers Discord, ses commandes et ses webhooks ne sont pas modifiés.

## État réel immédiatement après publication GitHub Pages

- Les fiches pédagogiques sont fonctionnelles.
- Les pages de réservation et de diagnostic préparent un e-mail à envoyer manuellement à `soutien.bonpoint@gmail.com`. Une date souhaitée n'est pas un créneau disponible ni confirmé.
- Le portail parent indique que la connexion privée est en cours de configuration. Il ne crée aucun compte public ni n'affiche de données scolaires.
- Les paramètres Cloudflare `SITE_INTAKE_ENABLED=false` et `PARENT_PORTAL_ENABLED=false` empêchent la collecte de données via l'API et l'envoi de codes de connexion.

## D1 et endpoints

Les tables de la migration 0003 ont été créées sur D1 le 11 octobre 2026, et le Worker v2 a été déployé avec tous les nouveaux services privés **désactivés**. Avant toute future migration via Wrangler, contrôler le registre des migrations et le schéma réel : la colonne existante `orders.payment_plan` ne doit pas être ajoutée une deuxième fois. Faire une sauvegarde.

Le module `src/site-services.js` s'importe dans `src/index.js`. Les routes publiques nouvelles sont :

- `GET /api/site/status` : indique `intake` et `parent_portal`, sans dévoiler de secret.
- `POST /api/site/bookings` et `POST /api/site/diagnostics` : **désactivées par défaut**. Quand activées, elles nécessitent Turnstile validé par le serveur et une origine autorisée.
- `POST /api/parent/code` : envoie un code temporaire de 6 chiffres à une adresse déjà autorisée (jamais une inscription publique).
- `POST /api/parent/verify` : ouvre une session éphémère après vérification du code.
- `GET /api/parent/dashboard` : nécessite un jeton `Authorization: Bearer <jeton>`, valable deux heures ; retourne uniquement les enregistrements associés au parent connecté.
- `POST /api/parent/logout` : invalide le jeton.

Les routes administratives nouvelles exigent `X-Admin-Key` (clé privée déjà requise par le Worker, **jamais** à placer dans un HTML, un e-mail ou le dépôt public) :

- `GET /api/admin/site/bookings`
- `GET /api/admin/site/diagnostics`
- `POST /api/admin/site/parents` : `{"email":"parent@exemple.fr","display_name":"Responsable légal","active":true}`
- `POST /api/admin/site/progress` : `{"email":"parent@exemple.fr","session_date":"2026-10-20","subject":"Mathématiques","summary":"Équations revues en séance","next_step":"Revoir les fractions"}`
- `POST /api/admin/site/bookings/<uuid>` : `{"status":"confirmed"}` ou `{"status":"declined"}`, seulement après échange réel.
- `POST /api/admin/site/invoices` : enregistre **une facture réellement émise**, correspondant à une commande payée existante ; corps `{"order_id":"<uuid>","invoice_number":"BP-2026-0001","issued_on":"2026-10-20","confirm_issued":true}`. Le portail affiche la référence et le montant, **pas de PDF** : les factures originales sont remises par un canal sécurisé séparé.

Le format de numérotation des factures de l'exemple doit être adapté et contrôlé dans le cadre des obligations comptables, notamment la séquence chronologique.

## Avant toute activation des nouvelles données personnelles

1. Finaliser l'immatriculation et les documents juridiques (statut, mentions légales, CGV et politique de confidentialité), et définir les durées de conservation et les sous-traitants du traitement.
2. Appliquer la migration D1 et effectuer des tests de sécurité sur une base séparée. Ne jamais charger de dossiers réels dans une base de test.
3. Configurer `MAIL_API_KEY`, `MAIL_SENDER` (Brevo correctement vérifié), `OWNER_EMAIL`, `ADMIN_API_KEY` existants.
4. Pour la collecte en ligne : configurer une instance Turnstile pour le domaine `bon-point.github.io`, puis `TURNSTILE_SITE_KEY` (public, utilisé par le navigateur) et `TURNSTILE_SECRET` (secret serveur). Activer `SITE_INTAKE_ENABLED=true` uniquement après tests de bout en bout.
5. Pour le portail privé : définir un `PARENT_AUTH_SECRET` aléatoire d'au moins 32 caractères, et provisionner explicitement chaque compte parent via une route admin. Vérifier les permissions, le débit, l'e-mail et les protections anti-automatisation, puis activer `PARENT_PORTAL_ENABLED=true`.
6. Ajouter des contrôles de débit Cloudflare/WAF, et restreindre les routes administratives par Cloudflare Access si possible. Tester l'expiration des codes, leur tentative répétée, le cloisonnement entre parents, et la fermeture de session.
7. Activer les flux de facturation uniquement après vérification de la conformité et de l'existence de factures réellement émises. Aucune donnée de carte n'est stockée ici.

**Le changement des drapeaux ne doit pas être fait tant que ces prérequis ne sont pas tous remplis.** Pour les cours aux mineurs, les demandes et l'accès privé sont réservés aux parents. Google Meet reste une alternative à Discord.

## Confidentialité et limites

Les codes expirent en 10 minutes et les sessions en 2 heures. Le nettoyage des demandes non confirmées et diagnostics s'effectue après 90 jours si la tâche planifiée Cloudflare tourne. Les suivis actifs et documents fiscaux nécessitent encore une politique de conservation formalisée. Les pages ne demandent pas le nom complet de l'élève et affichent des conseils d'éviter les données médicales et sensibles.

**Non inclus à ce stade** : synchronisation réelle Google Calendar, disponibilité temps réel, confirmation automatique des rendez-vous, émetteur PDF de factures, espace élève nominatif, interface administrateur graphique, refonte Discord. Ces étapes exigent des calendriers, identités légales, accès et tests qui ne peuvent pas être inventés.
