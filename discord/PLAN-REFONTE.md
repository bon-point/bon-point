# Bon Point · Discord — plan de refonte sans interruption

Date de l'audit : 11 octobre 2026. Ce plan n'effectue **aucune modification du serveur Discord** et ne déploie **aucun nouveau bot**.

## État constaté

Capture partagée : serveur **Bonpoint-Visioconférence**, application **Bonpoint Bot** affichée hors ligne, salons **#lien-du-site**, **#réservations**, **#chat-rapide** et **#prompt**.

Cloudflare `bon-point-auto` (ancien Worker, existant et **non modifié**) :
- routes `/admin-confirm` et `/notify-booking-event` ; réception d'un ancien webhook Stripe ;
- base d'origine **Firebase/Firestore**, pas le nouveau D1 Bon Point v2 ;
- notification du propriétaire du serveur via webhook Discord ;
- création de salons vocaux par créneau sous une catégorie configurable ;
- création de liens d'invitation Discord, suivi des réservations, ménage des salons et rappels ;
- présence de secrets gérés côté Cloudflare : token bot, identifiants de guilde/catégorie, webhook. **Ne jamais les transférer dans GitHub, Discord public ou ChatGPT.**
- aucun gestionnaire de commandes slash ni connexion Gateway persistante identifiés dans ce Worker. Les commandes visibles dans Discord doivent donc être retrouvées dans la configuration de l'application, d'un hébergeur externe ou un autre dépôt.

**Point de sécurité à corriger lors de la migration** : les invitations produites dans ce vieux Worker emploient `max_age:0` et `max_uses:0`, soit des liens sans limite d'expiration ou d'utilisation. Le nouveau code devra utiliser des invitations temporaires (ex. 24 h, 1 utilisation), et limiter les accès par rôles / salons privés.

## Objectifs

1. Réserver les séances et effectuer les paiements **sur le site Bon Point**, pas dans des salons publics Discord.
2. Discord sert à l'accueil, l'aide et à certaines séances de lycée **uniquement pour les participants répondant aux exigences de la plateforme**. Proposer Google Meet aux autres familles et aux collégiens.
3. Créer une salle vocale temporaire pour les participants autorisés, sans nommer publiquement un élève.
4. Avertir l'administrateur des réservations confirmées et des incidents (dans des salons privés).
5. Préserver et documenter les commandes et webhooks existants avant tout changement.

## Proposition de structure (pas encore appliquée)

### INFORMATIONS
- `#bienvenue` : présentation, lien public du site, information sur les cours
- `#reglement-et-confidentialite` : règles de communication et de sécurité des mineurs
- `#annonces` : annonces modérées en lecture seule

### ORGANISATION
- `#reserver-un-cours` : lien vers https://bon-point.github.io/bon-point/reserver.html
- `#questions-rapides` : questions générales sans données personnelles
- `#assistance-technique` : aide pour connexion, audio, visio

### COURS PRIVÉS
- `🔊 Salle de cours privée 1` (création ou attribution au besoin, accès restreint)
- `🔊 Salle de cours privée 2` (optionnel)
- Salon de discussion individuel **uniquement si nécessaire**, visible au parent/responsable et au professeur, pas à tout le serveur

### ADMINISTRATION (catégorie masquée)
- `#reservations-a-traiter` : alertes de nouvelles demandes et confirmations, sans montants détaillés
- `#journal-du-bot` : enregistrements techniques sans identifiants sensibles
- `#alertes` : échecs webhook/notifications, salons orphelins, permissions
- `#tests-bot` : essais des slash commands sans affecter le serveur public

**Ne pas supprimer ni renommer les salons d'origine avant l'inventaire de leurs ID**, leurs permissions et leurs webhooks. Un renommage de salon garde en principe son ID, mais les scripts peuvent s'appuyer sur le nom ; le vérifier avant toute migration.

## Rôles et permissions

- `Administrateur` : configuration et commandes privées, accès aux alertes et aux journaux.
- `Professeur` : gérer la séance, entrer dans les salons privés attribués.
- `Parent / responsable` : accès uniquement aux espaces utiles, aucun accès aux dossiers des autres familles.
- `Élève autorisé` : permissions minimales, pas d'informations d'autres élèves, pas de messages privés automatiques.
- `Bonpoint Bot` : permissions minimales nécessaires ; jamais Administrator par défaut.

## Commandes à inventorier puis à regrouper

**Public, réponses privées (éphémères) :**
- `/aide` : aide et fonctionnement du serveur ;
- `/site` : lien vers Bon Point ;
- `/reserver` : ouvre le calendrier du site ;
- `/support` : contact technique ou familial.

**Réservées au personnel, après vérification d'un rôle :**
- `/statut` : contrôle de la connectivité des automatisations ;
- `/prochain-cours` : consulte une information issue d'une API protégée ;
- `/salle ouvrir` : crée un salon temporaire sécurisé pour un créneau confirmé ;
- `/salle fermer` : ferme la salle et révoque l'invitation ;
- `/rappel` : déclenche une vérification du statut du rappel et non un spam du client.

Aucune commande ne doit afficher les e-mails, adresses, données scolaires ou paiements dans un salon public. Pour les données parentales, le site privé reste l'accès de référence.

## Migration étape par étape

1. **Inventaire avant modifications** : récupérer le **code et l'hébergeur du bot qui possède les commandes Slash**, la liste des commandes, des salons, des rôles, des webhooks et leur destination. Une capture des paramètres Discord suffit ; **ne pas envoyer les URL complètes des webhooks ni aucun jeton secret**.
2. Faire une sauvegarde textuelle des permissions, des commandes et des webhooks existants (sans secrets).
3. Préparer une variante de bot/interaction en test, limitée à `/aide`, `/site`, `/reserver` et `/support`, sans remplacer les commandes existantes.
4. Tester les commandes et notifications dans `#tests-bot` et un salon admin, en utilisant uniquement des identifiants de rendez-vous fictifs.
5. Relier les événements autorisés de `bon-point-v2` (D1, créneau confirmé, paiement Stripe vérifié) au système de notifications ; interdire les doublons avec l'ancien Worker. Aucun encaissement réel ne doit être activé avant vérification des conditions légales.
6. Basculer les notifications/commandes une à une. Désactiver l'ancienne route/webhook seulement après avoir testé la nouvelle.
7. Nettoyer les anciennes invitations sans expiration et les salons temporaires abandonnés, après contrôle des droits.

## Bot hors ligne

Un Worker Cloudflare appelé uniquement via API ou webhooks **ne maintient pas à lui seul une connexion Gateway Discord**. La présence « hors ligne » dans la liste des membres peut donc coexister avec le fonctionnement de notifications HTTP et d'interactions slash. Les commandes peuvent être reçues par une URL d'interactions HTTP sans connexion Gateway (documentation Discord), ou via un processus hébergé durablement si la présence en ligne est importante. Le choix dépend de l'outil d'origine utilisé pour programmer les commandes ; ne pas migrer sans ce renseignement.

## Informations nécessaires

- Emplacement exact des **commandes de Bonpoint Bot** : repo GitHub, fichier JavaScript/Python, plateforme de création de bots, ou hébergement.
- Captures des onglets **Intégrations > Webhooks**, **Applications/Intégrations** et de la liste des commandes slash (sans secret).
- Liste des salons utiles à conserver, ou export anonymisé des identifiants (ID d'application/serveur non secrets ; jamais token).
