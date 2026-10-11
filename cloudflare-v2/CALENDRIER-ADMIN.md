# Bon Point — mise en service des réservations et de l'espace administrateur

**Statut (11 octobre 2026)** : le calendrier public, la console `admin.html`, l'espace parents, les schémas D1 et le Worker v2 sont préparés et déployés. Les traitements automatiques de demandes, les codes privés, les rapports PDF et les encaissements ne sont pas activés.

## 1. Disponibilités enregistrées

Fuseau : **Europe/Paris**.
- Lundi, mardi, mercredi, vendredi : à partir de **18 h**.
- Jeudi : à partir de **13 h 30**.
- Samedi et dimanche : le week-end, à convenir.

Le calendrier **ne vérifie pas les vraies disponibilités de Google Calendar**. Il propose des heures indicatives de 30 min en 30 min (jusqu'à 22 h en semaine, 9 h–20 h le week-end). L'utilisateur peut suggérer un autre horaire, mais le serveur rejette les horaires hors de la plage de traitement provisoire (8 h–22 h le week-end ; 13 h 30–22 h le jeudi ; 18 h–22 h les autres jours). Faire confirmer les heures de fin par le propriétaire, puis mettre les deux côtés en cohérence.

Les demandes nouvelles doivent être déposées au moins **48 h** avant leur commencement. Le calendrier utilise une marge visuelle de 3 jours. Un créneau ne devient « confirmé » que lorsqu'il est accepté par l'administrateur. L'acceptation exige plus de 50 heures pour laisser de la marge au rappel. Les rappels programmés sont déclenchés 48 h 30 avant et le Worker fait un passage environ toutes les 5 minutes. **La livraison e-mail n'est pas garantie si le fournisseur est indisponible ou si l'encaissement est trop tardif.**

## 2. Flux de réservation

1. Le parent choisit un jour et une heure sur `reserver.html`, le type `intro` (premier échange gratuit de 20 min) ou `course` (séance de 60 min), l'offre, la classe, la matière, et confirme son rôle légal.
2. **Tant que `SITE_INTAKE_ENABLED=false`**, un brouillon d'e-mail se prépare dans sa messagerie. Le rendez-vous n'est pas réservé, le message doit être envoyé manuellement.
3. Après configuration de Turnstile, Brevo, CGV, RGPD et consentements, le responsable pourra activer la saisie automatique. D1 conservera les demandes en attente. La console `admin.html` permettra de confirmer/refuser.
4. Après confirmation, la console pourra générer **une proposition nominative** avec créneau confirmé, offre validée et URL Meet. Le montant est verrouillé dans D1. Le parent recevra ensuite son lien privé de paiement (envoi manuel ou automatique uniquement après mise en service).
5. L'API Stripe ne crée une session de paiement unique que si la réservation est confirmée, correspond au parent et à l'offre, et se situe au moins 49 heures dans le futur. La session de paiement est limitée à 30 minutes.
6. Après paiement vérifié par webhook Stripe, le Worker peut envoyer une notification au professeur et programmer le rappel de cours au parent et au professeur.

**Important :** actuellement `PAYMENTS_ENABLED=false`, `STRIPE_MODE=test`. Le paiement en 3 fois ou 2 fois est toujours une option commerciale indicative, mais le débit fractionné automatique n'est pas implémenté. Ne pas annoncer le système comme opérationnel avant intégration, tests et validation juridique.

## 3. Connexion administrateur

La console est à l'URL `https://bon-point.github.io/bon-point/admin.html` mais son API répond « Administration désactivée » tant que les prérequis ne sont pas activés. Une console publique statique n'est **pas** une authentification : les opérations sont toutes contrôlées sur le serveur.

Pour l'activer légalement et en sécurité :
- Configurer Brevo et l'adresse d'envoi vérifiée (secrets Cloudflare `MAIL_API_KEY`, `MAIL_SENDER`) et `OWNER_EMAIL`.
- Choisir un e-mail admin `ADMIN_LOGIN_EMAIL` et un **mot de passe long unique**, dans `ADMIN_LOGIN_PASSWORD` (secret Cloudflare, min 24 caractères).
- Générer un secret indépendant `ADMIN_AUTH_SECRET` (min 32 caractères). Ne pas copier les valeurs dans GitHub ou le navigateur.
- Ajouter une protection Cloudflare WAF / Access sur les chemins `/api/staff/*` et tester la limitation des tentatives. La connexion utilise mot de passe + code e-mail (validité 10 min), puis session de 60 minutes.
- Activer `ADMIN_PANEL_ENABLED=true` seulement après vérification des paramètres et tests. Le jeton admin reste en mémoire navigateur et ne sert pas à activer Stripe.

## 4. Espace parents et PDF

La console crée explicitement un compte parent avec nom d'affichage, e-mail et statut actif. Le responsable choisit ensuite **« Envoyer un nouveau code »** : le serveur génère un code éphémère de six chiffres, envoie au parent son e-mail privé, et stocke seulement un hachage. Les parents ne peuvent pas s'auto-enregistrer. Connexion sur `parents.html`, code valable 10 minutes, session valable 2 heures.

Pour chaque cours, le responsable enregistre :
- la date et la matière ;
- les notions travaillées et réussites ;
- les difficultés restantes, les priorités et les exercices conseillés ;
- un récapitulatif PDF privé (optionnel) ;
- les prochaines dates, commandes et références de factures lorsqu'elles existent.

Dans l'état actuel du compte, **Cloudflare R2 n'est pas activé**. Le module prévoit donc un stockage PDF privé de petite taille dans D1 (`session_file_blobs`) avec un maximum de **700 Ko par PDF**. Le parent authentifié peut télécharger uniquement les fichiers associés à son compte via `/api/parent/reports/:id`. Les PDF ne sont jamais servis comme fichiers statiques GitHub et aucun lien de téléchargement public n'est créé.

La fonction de dépôt PDF est désactivée par `REPORT_UPLOADS_ENABLED=false`. Avant activation, valider la conservation des données, l'accès uniquement au responsable légal, le traitement RGPD et les tests de cloisonnement. Pour les documents lourds, envisager plus tard R2 privé et un contrôle antivirus.

## 5. Fonctionnalités désactivées par défaut

```toml
PAYMENTS_ENABLED = "false"
STRIPE_MODE = "test"
SITE_INTAKE_ENABLED = "false"
PARENT_PORTAL_ENABLED = "false"
ADMIN_PANEL_ENABLED = "false"
REPORT_UPLOADS_ENABLED = "false"
PARENT_SELF_SERVICE_CODES = "false"
REQUIRE_CONFIRMED_BOOKING = "true"
```

Pour les données scolaires, finaliser immatriculation et éligibilité, confidentialité, sous-traitants, politique de conservation, CGV et informations des familles avant d'activer les services. Ne jamais activer un encaissement live sans identité professionnelle validée et moyens de paiement conformes aux conditions de Stripe. En particulier, l'absence de clients actuellement n'enlève pas ces obligations.

## 6. D1 et tests

Les migrations `0004_calendar_reports_admin.sql` et `0005_private_report_blobs.sql` ont **déjà été appliquées directement** à la base D1 le 11 octobre 2026. Avant un futur `wrangler d1 migrations apply --remote`, vérifier l'historique des migrations : ne pas rejouer les `ALTER TABLE` sur des colonnes existantes. Sauvegarder la base avant migration.

Le test automatisé `node scripts/test-booking.mjs` vérifie le fuseau Paris, le changement d'heure, les horaires, les contraintes de délai et les protections principales. `node scripts/check-site.mjs` contrôle l'ensemble des pages.

Discord est un chantier séparé. Aucune commande ni aucun webhook du bot existant n'a été modifié.
