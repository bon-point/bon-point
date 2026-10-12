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

## À fournir pour poursuivre l'intégration

- ID Discord du salon `Salle de cours privée`.
- ID Discord du salon `Salle de cours privée 2`.

Ces ID sont des identifiants publics de salon, **pas des tokens**. Dans Discord avec le mode développeur activé : clic droit sur un salon → Copier l'identifiant du salon.

## État

Les quatre commandes Discord et les notifications dans le salon administratif sont installées. **L'automatisation des deux salons n'est pas encore activée** : la configuration attend les deux ID et les tests de permissions. L'ancien système `bon-point-auto` et ses webhooks n'ont pas été modifiés.
