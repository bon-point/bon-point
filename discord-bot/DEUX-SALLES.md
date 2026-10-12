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

**Verrouillages actuels :**
- `DISCORD_ROOM_AUDIT_ENABLED=true` : le bot peut vérifier en lecture seule que les deux salons sont vocaux, appartiennent au même serveur et à une même catégorie privée, et que les permissions ne rendent pas les salons publics.
- `DISCORD_ROOM_ACCESS_ENABLED=false` : **aucun droit Discord n'est ajouté, supprimé ni modifié automatiquement**. Le bot continue de gérer les quatre commandes et les notifications administratives.
- Le planning des deux salons peut être choisi à l'aide de `chooseFixedRoom` (dans `src/index.js`). Il privilégie la Salle 1, bascule sur la Salle 2 si nécessaire et renvoie « aucune salle » si les deux sont prises. Il impose une marge de 10 minutes entre deux cours.
- La migration `cloudflare-v2/migrations/0008_discord_fixed_voice_rooms.sql` crée un stockage de planification vide et des triggers D1 qui rejettent atomiquement les chevauchements. Aucune donnée de participant n'a été créée.

**À finaliser avant de donner l'accès à un élève :**
1. Vérifier le résultat du contrôle Discord `discord_room_audits` (statut `verified`, sinon corriger les seules permissions nécessaires).
2. Confirmer l'éligibilité Discord des participants et recueillir leur accord / l'accord du responsable légal lorsque nécessaire ; définir comment associer leur identité Discord à la réservation.
3. Tester dans un environnement sûr les autorisations temporaires d'un seul membre, la révocation, et les chevauchements, sans jamais accorder `View Channel` à `@everyone`.
4. Relier l'attribution au statut réel `confirmed` et, lorsque nécessaire, au paiement `paid` vérifié côté serveur. Si les deux salles sont prises, conserver la réservation sans donner d'accès.
5. Activer les permissions temporaires seulement après un examen des droits du bot. L'ancien Worker `bon-point-auto` reste inchangé.

Le simple enregistrement des identifiants **ne constitue pas une automatisation opérationnelle des accès aux élèves**.
