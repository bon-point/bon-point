# Bon Point — vérification du parcours de réservation (12 octobre 2026)

## Périmètre

Test de bout en bout **en mode démonstration**, dans le panneau administrateur avec le Worker `bon-point-v2`, la base Cloudflare D1 et le bot `bon-point-discord`. Aucun dossier de famille ni règlement réel n'a été créé. Les données nominatives, secrets et jetons ne figurent pas dans ce rapport.

## Résultats vérifiés

| Fonction | Résultat |
| --- | --- |
| Création manuelle de réservation fictive, sans paiement | OK — état `requested` dans D1 |
| Notification Discord de nouvelle demande | OK — `delivered` à la première tentative |
| Confirmation dans l'administration | OK — état `confirmed` |
| Mise en file de deux e-mails de confirmation | OK — parent et administrateur |
| Acceptation des deux e-mails par Brevo | OK — `sent` à la première tentative |
| Réception Gmail des deux e-mails de confirmation | OK — messages dans la boîte de réception |
| Notification Discord de confirmation | OK — `delivered` à la première tentative |
| Annulation de la réservation de démonstration (changement D1 protégé) | OK — état `declined` |
| E-mail d'annulation | OK — `sent` et présent dans Gmail |
| Notification Discord d'annulation | OK — `delivered` à la première tentative |
| Suppression ciblée du dossier de démonstration après les envois | OK — 0 réservation de test, 0 tâche d'e-mail liée, 0 entrée de file Discord liée |
| Solde de réservations en base après nettoyage | 0 |

Les messages déjà transmis à Discord et Gmail n'ont pas été effacés des plateformes externes, afin de conserver les preuves de test visibles par le propriétaire.

## Sécurité et limites

- Les tâches Discord utilisent une file dédupliquée et une récupération des envois bloqués (at-least-once ; un doublon reste théoriquement possible après interruption réseau).
- Le widget Turnstile a été créé en mode `managed` pour `bon-point.github.io` ; ses clés sont enregistrées en secrets Cloudflare.
- `SITE_INTAKE_ENABLED=false` et `PAYMENTS_ENABLED=false` demeurent inchangés : **ce test ne valide pas le formulaire public avec Turnstile, ni Stripe en conditions réelles**.
- Les informations légales, les CGV et les vérifications du responsable de l'activité restent à finaliser avant ouverture des services publics sensibles.
- La base D1 de production ayant fait l'objet de mises à jour directes, vérifier son registre de migrations avant toute application globale de migrations Wrangler.

Dernière vérification : 12 octobre 2026 (heure de Paris).
