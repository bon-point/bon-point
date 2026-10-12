# Bon Point — Réutilisation de deux salons vocaux

**Choix validé :** utiliser uniquement les deux salons vocaux existants, sans créer de salon pour chaque réservation.

## Fonctionnement cible

1. Le parent demande un cours sur le site ; l'administrateur confirme le créneau.
2. Après confirmation des conditions requises (notamment paiement vérifié lorsqu'il s'agit d'un cours payant), l'administrateur associe à la réservation **l'ID Discord** d'un participant éligible à Discord, avec son accord.
3. Le système choisit le premier salon libre parmi les **deux ID configurés**. Il réserve le salon pour toute la durée de la séance ; en cas de chevauchement et de deux salons occupés, la demande reste en attente ou passe sur Google Meet.
4. Peu avant le cours, le bot accorde **à ce seul membre** les droits Voir le salon / Se connecter à la salle attribuée. Les accès privés des autres familles doivent rester bloqués.
5. Après le cours, il retire uniquement **l'autorisation temporaire qu'il a créée**. Il ne doit pas supprimer les autorisations manuelles des professeurs ou administrateurs.
6. Les notifications générales de réservation continuent dans `#réservations-à-traiter`. Les identifiants et renseignements pédagogiques des élèves restent exclusivement dans les systèmes privés.

## Mesures de sécurité

- Catégorie **COURS PRIVÉS** : `@everyone` sans View Channels ; `Professeur` et `Administrateur` autorisés. Ne pas autoriser globalement Parent et Élève autorisé.
- Les salons peuvent avoir des autorisations individualisées. Une permission au niveau du salon peut désynchroniser ses permissions de la catégorie : vérifier avant et après chaque modification.
- Confirmer que le bot dispose uniquement des capacités d'édition des permissions nécessaires pour **ces deux salons**, sans permission globale Administrator.
- Ne créer aucune invitation permanente. Préférer une attribution nominative, contrôlée et temporaire.
- Lier la réservation à l'ID Discord seulement avec l'accord du participant et, pour un mineur, du responsable légal. Ne pas inscrire automatiquement des collégiens : proposer Google Meet quand Discord n'est pas adapté.
- Protection contre double réservation : comparer heure de début ET heure de fin, empêcher deux cours simultanés dans le même salon, et prolonger le verrou légèrement après la séance pour laisser le temps de se déconnecter.
- En cas d'erreur API Discord, garder la réservation et envoyer une alerte administrative ; **ne jamais ouvrir le salon à @everyone**.
- Tenir un journal d'attribution et de révocation pour contrôler les accès, sans dévoiler les données des familles en salon public.

## Configuration enregistrée le 12 octobre 2026

| Salle existante | Identifiant Discord |
|---|---|
| Salle de cours privée | `1558922846896529418` |
| Salle de cours privée 2 | `1558922881386418276` |

Les deux identifiants sont présents dans `discord-bot/wrangler.toml` et dans les variables du Worker Cloudflare `bon-point-discord`.

## Automatisation déployée le 12 octobre 2026

Le Worker `bon-point-discord` contient maintenant :
- `/lier code` : identifie le participant à partir de son compte Discord réel (interaction signée) et d'un code confidentiel à usage unique reçu par son responsable légal ;
- le choix de **Salle 1** en priorité, sinon de **Salle 2** ; les conflits sont rejetés dans la base D1 grâce à des triggers atomiques (marge de 10 minutes) ;
- une permission individuelle Discord `View Channel + Connect + Speak` créée **environ 10 minutes avant la séance**, uniquement pour le membre associé, et révoquée après le cours (avec une marge de 5 minutes) ;
- le contrôle du statut `confirmed` de la réservation et du statut Stripe réellement `paid` pour les cours payants. Le premier échange gratuit n'exige pas de paiement ;
- une révocation lors d'une annulation ou si la prestation cesse d'être éligible, et un mécanisme de reprise après interruption du Worker ;
- une révocation toujours exécutée lorsque `DISCORD_ROOM_ACCESS_ENABLED=false` en arrêt d'urgence, sans permettre de nouvelles ouvertures ;
- un contrôle de la confidentialité des deux salons environ toutes les cinq minutes, et l'arrêt des nouvelles ouvertures si les permissions publiques ou manuelles semblent anormales ;
- des alertes anonymisées vers `#réservations-à-traiter` en cas d'erreur Discord, sans données personnelles ni identifiant complet du participant.

Les indicateurs `DISCORD_ROOM_ACCESS_ENABLED=true` et `DISCORD_ROOM_LINK_ENABLED=true` ont été activés sur le Worker après tests automatiques. **Aucun accès réel n'a été accordé** : à la mise en service, la base ne contenait aucune réservation confirmée, aucun code parental ni aucune attribution.

### Activation de la chaîne complète avec les familles

L'enregistrement automatique des demandes, les paiements Stripe réels et l'accès à la console administrateur Bon Point sont encore **désactivés séparément**. Les nouvelles commandes et la configuration des salles ne remplacent pas ces prérequis.

Pour chaque cours :
1. Le parent propose un créneau ; l'administrateur le confirme. Une séance payante doit avoir son paiement vérifié par webhook Stripe.
2. Depuis `admin.html → Accès Discord`, l'administrateur renseigne la référence de réservation et confirme **avoir obtenu l'accord du responsable légal** ainsi que l'éligibilité d'âge Discord du participant.
3. Le serveur génère un code aléatoire de 20 caractères, conservé sous forme hachée dans D1, et l'envoie **uniquement à l'e-mail du parent**. Il expire après 20 minutes.
4. Le participant autorisé entre `/lier` puis son code dans le serveur Bon Point ; la commande répond en privé. Discord fournit l'identité du membre dans son interaction signée.
5. L'attribution est enregistrée, et l'ouverture et la fermeture du salon se font automatiquement lorsque la séance devient éligible.
6. La console permet aussi de demander une révocation. **Si une requête de suppression Discord échoue, l'administrateur reçoit une alerte et doit vérifier ou retirer l'autorisation manuellement.** La révocation d'une permission ne garantit pas que Discord déconnecte aussitôt un membre déjà présent dans l'audio.

Pour utiliser la console, il faudra configurer et tester les secrets d'authentification de l'administrateur, le fournisseur d'e-mail Brevo, les informations légales et les engagements RGPD, puis activer `ADMIN_PANEL_ENABLED=true` et `DISCORD_BOOKING_LINKS_ENABLED=true` sur le Worker **bon-point-v2**. Aucun secret ne doit figurer sur GitHub ni être partagé dans le chat.

Pour des élèves sous l'âge minimal Discord applicable, choisir **Google Meet**. Ne pas donner aux rôles `Parent` et `Élève autorisé` l'accès permanent à la catégorie de cours.

### Arrêt d'urgence

Dans le Worker `bon-point-discord`, mettre `DISCORD_ROOM_ACCESS_ENABLED=false` pour **arrêter les nouveaux accès**, tout en laissant au bot la possibilité de retirer les autorisations existantes. En cas de panne Discord, contrôler les permissions des deux salons manuellement. Ne pas débrancher le token si des autorisations temporaires restent ouvertes.

Les migrations 0009 et 0010 sont déjà appliquées sur la base D1 ; elles ne doivent pas être rejouées à l'aveugle. L'ancien Worker `bon-point-auto`, ses commandes et ses webhooks n'ont pas été modifiés.
