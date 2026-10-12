# Bon Point — Bot Discord sans hébergement permanent

## Configuration des deux salles (12 octobre 2026)

Deux salons vocaux existants ont été configurés, sans création de salons :

- Salle 1 : `1558922846896529418`
- Salle 2 : `1558922881386418276`

`DISCORD_ROOM_AUDIT_ENABLED=true` active seulement les contrôles de confidentialité **en lecture seule**. `DISCORD_ROOM_ACCESS_ENABLED=false` interdit toute automatisation de permission des participants. L'attribution de la salle libre et les protections contre chevauchement sont préparées, mais la liaison à une réservation nominative et les autorisations temporaires restent à faire avant activation. Voir [DEUX-SALLES.md](DEUX-SALLES.md).

## État confirmé au 11 octobre 2026

Les quatre commandes `/aide`, `/site`, `/reserver`, `/support` ont été enregistrées avec succès auprès de Discord pour le serveur `1536096215996043286`. La table privée D1 `discord_bot_state` contient `command_schema = four-public-commands-v1`, horodaté `2026-10-11 20:30:46 UTC`. Le token du bot demeure en secret Cloudflare ; le registre d'installation ne contient aucun secret. Le déclencheur planifié a été ramené à `*/5 * * * *` après l'installation. La configuration `DISCORD_AUTO_REGISTER=true` est conservée : elle est idempotente et n'effectue plus d'écriture quand le schéma déjà enregistré correspond.

Les notifications administratives Discord ont été activées et un message de test a été envoyé avec succès dans `#réservations-à-traiter` (salon `1558922955394650304`). **L'envoi automatique des demandes du site dépend toujours de l'activation séparée du formulaire sécurisé de réservation.**

Le nouveau bot utilise des **interactions HTTP sécurisées (Ed25519)** sur **Cloudflare Workers**. Il n'a pas besoin d'être connecté au Gateway ni d'une machine en ligne 24 h/24 : il peut apparaître « hors ligne » dans la liste des membres, même lorsque ses commandes fonctionnent.

## Ce qui a été préparé

- `/aide` : présente les quatre commandes.
- `/site` : lien officiel vers Bon Point.
- `/reserver` : lien direct vers le calendrier de proposition de créneaux.
- `/support` : contact de Bon Point (sans collecte de données privées dans Discord).

Toutes les réponses sont **éphémères** : seul l'utilisateur voit sa réponse, y compris dans les salons publics.

**Aucune commande Discord ne traite de paiement ni ne révèle d'informations sur les élèves.**

### Hébergement

Script Cloudflare : `bon-point-discord`. Endpoint prévu :
`https://bon-point-discord.soutien-bonpoint.workers.dev/interactions`

Un `GET /health` permet de vérifier l'état de la configuration sans divulguer de secrets. Le Worker n'accepte pas les interactions tant que la **clé publique Ed25519** et l'**ID du serveur** ne sont pas correctement configurés.

## Identifiants publics configurés (11 octobre 2026)

- Application Discord : `1536007822855110707`
- Serveur Bonpoint-Visioconférence : `1536096215996043286`
- Clé publique Ed25519 : présente dans `wrangler.toml` et dans le Worker Cloudflare.
- Endpoint à coller dans Discord Developer Portal, section **General Information → Interactions Endpoint URL** : `https://bon-point-discord.soutien-bonpoint.workers.dev/interactions`.

Discord a validé l'URL, le token privé est enregistré directement dans les secrets Cloudflare (jamais dans GitHub), et les quatre commandes ont été enregistrées. `DISCORD_AUTO_REGISTER=true` maintient l'enregistrement après mise à jour ; ne réinitialisez pas le token tant que l'ancien système peut encore l'utiliser.

### Configuration Discord Developer Portal

1. Ouvrir [Discord Developer Portal](https://discord.com/developers/applications), sélectionner **Bonpoint Bot**.
2. Dans **General Information**, relever les éléments **publics** : `Application ID` et `Public Key`. **Ne jamais partager le Bot Token** dans un chat, un e-mail ou GitHub.
3. Dans Discord, activer le mode développeur puis **Copier l'identifiant du serveur** (Guild ID). La valeur est un ID public de référence.
4. Dans Cloudflare, configurer `DISCORD_PUBLIC_KEY` et `DISCORD_GUILD_ID` comme variables du Worker `bon-point-discord`.
5. Dans le Developer Portal, définir l'**Interactions Endpoint URL** vers l'URL ci-dessus : Discord envoie un PING signé et vérifie que le bot répond correctement. Cela **ne fonctionne pas** tant que la clé publique n'est pas renseignée.
6. Dans la section **Installation**, autoriser l'application sur le serveur avec l'étendue `applications.commands`, et ajouter le bot avec uniquement les permissions nécessaires si les alertes administratives sont souhaitées.

### Enregistrement automatique (recommandé)

Le bot peut désormais inscrire lui-même ses quatre commandes de serveur, sans terminal, à la prochaine exécution planifiée (environ cinq minutes). Pour cela : configurer **DISCORD_APPLICATION_ID**, **DISCORD_GUILD_ID**, **DISCORD_PUBLIC_KEY**, puis ajouter **DISCORD_BOT_TOKEN** dans les Secrets du Worker ; après un test, activer **DISCORD_AUTO_REGISTER=true**. Le code inscrit chaque commande séparément, sans effacer les autres commandes. Le succès est consigné dans la table privée `discord_bot_state`.

### Enregistrer les commandes

Dans un terminal Node.js 22, après avoir défini les variables d'environnement **uniquement en local** :
```sh
node discord-bot/scripts/register-commands.mjs
```
Variables requises : `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`. Le script enregistre individuellement les quatre commandes **dans ce seul serveur**, sans effacer les autres commandes existantes.

Pour utiliser le bot sans terminal, une interface d'installation sécurisée peut être ajoutée lorsque l'application Discord est correctement liée et que les secrets restent dans Cloudflare.

## Liaison avec Bon Point

Les réservations et commandes du site sont gérées par `bon-point-v2`, et stockées dans sa base Cloudflare D1. Le Worker Discord peut interroger cette même base toutes les 5 minutes, envoyer dans `#réservations-à-traiter` :
- les demandes de rendez-vous ;
- les rendez-vous confirmés ;
- les paiements effectivement vérifiés par Stripe.

Les messages ne comportent **aucun e-mail, numéro de téléphone ou détail pédagogique** ; ils affichent uniquement la date, l'heure et une référence interne partielle.

L'envoi reste **désactivé** tant que `DISCORD_NOTIFICATIONS_ENABLED=false`, que le `DISCORD_ADMIN_CHANNEL_ID` n'est pas renseigné, ou que le Bot Token n'est pas configuré comme secret du nouveau Worker.

Pour activer plus tard :
- Configurer `DISCORD_BOT_TOKEN` en **secret Worker** via le Dashboard Cloudflare (ne pas le saisir dans le code).
- Copier l'ID du salon privé `#réservations-à-traiter` puis ajouter `DISCORD_ADMIN_CHANNEL_ID` au Worker.
- S'assurer que le bot a accès au salon et la permission **Send Messages**.
- Choisir `DISCORD_SYNC_FROM` (date UTC à partir de laquelle les événements sont considérés) pour éviter les alertes historiques.
- Tester avec des réservations fictives sans données privées, puis activer `DISCORD_NOTIFICATIONS_ENABLED=true`.
- La file D1 `discord_notifications` évite les messages dupliqués dans la plupart des cas et garde un journal de livraison limité.
- Les paiements réels du site restent désactivés tant que ses conditions juridiques ne sont pas remplies.

## Suppression des anciens webhooks : ne pas confondre

Le vieux Worker **`bon-point-auto`** conserve un **webhook Discord** et un **webhook Stripe**. Le premier envoie des messages et notifications historiques ; le second valide des paiements selon l'ancienne logique.

- **Ne jamais supprimer le webhook Stripe de production comme s'il s'agissait d'un webhook Discord.**
- Les webhooks Discord obsolètes pourront être retirés depuis **Paramètres du serveur > Intégrations > Webhooks** une fois les nouveaux messages testés dans `#tests-bot`.
- Ne supprimez pas l'application Bonpoint Bot : elle porte les mêmes identifiants et sa clé publique. Le nouveau Worker sert uniquement de nouvelle logique.
- Garder `bon-point-auto` en l'état jusqu'à la vérification du bon fonctionnement du nouveau bot.

## Rôles recommandés (à créer avec vos droits Discord)

`Professeur`, `Parent`, `Élève autorisé` et `Bonpoint Bot` (automatique si installé). L'administrateur doit limiter les accès aux salons privés à l'avance. Les rôles Discord ne remplacent pas le contrôle d'accès du site Bon Point.

Les élèves ne remplissant pas les conditions d'âge de Discord doivent utiliser une alternative (Google Meet, par exemple).
