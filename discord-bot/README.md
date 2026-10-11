# Bon Point — Bot Discord sans hébergement permanent

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

### Configuration Discord Developer Portal

1. Ouvrir [Discord Developer Portal](https://discord.com/developers/applications), sélectionner **Bonpoint Bot**.
2. Dans **General Information**, relever les éléments **publics** : `Application ID` et `Public Key`. **Ne jamais partager le Bot Token** dans un chat, un e-mail ou GitHub.
3. Dans Discord, activer le mode développeur puis **Copier l'identifiant du serveur** (Guild ID). La valeur est un ID public de référence.
4. Dans Cloudflare, configurer `DISCORD_PUBLIC_KEY` et `DISCORD_GUILD_ID` comme variables du Worker `bon-point-discord`.
5. Dans le Developer Portal, définir l'**Interactions Endpoint URL** vers l'URL ci-dessus : Discord envoie un PING signé et vérifie que le bot répond correctement. Cela **ne fonctionne pas** tant que la clé publique n'est pas renseignée.
6. Dans la section **Installation**, autoriser l'application sur le serveur avec l'étendue `applications.commands`, et ajouter le bot avec uniquement les permissions nécessaires si les alertes administratives sont souhaitées.

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
