# Bon Point — Cloudflare Worker v2

État vérifié au **11 octobre 2026** : le Worker `bon-point-v2` est déployé sur Cloudflare à l'adresse `https://bon-point-v2.soutien-bonpoint.workers.dev`, sur une base D1 distincte de l'ancien `bon-point-auto` (qui n'a pas été modifié).

## Drapeaux de sécurité actuels

```toml
PAYMENTS_ENABLED = "false"
STRIPE_MODE = "test"
SITE_INTAKE_ENABLED = "false"
PARENT_PORTAL_ENABLED = "true"
```

Aucun paiement réel ni collecte automatique des demandes n'est ouvert. Le portail parents est configuré, sous réserve des secrets nécessaires et des contrôles individuels d'accès. L'API publique du catalogue reste consultable, mais le paiement est refusé tant que les prérequis et la configuration ne sont pas validés. Le déclencheur planifié v2 est `*/5 * * * *` pour le nettoyage des sessions expirées et les éventuelles notifications différées.

## Architecture et fonctionnalités

- `src/index.js` : offres, propositions nominatives, paiements Stripe conditionnels, vérification des webhooks, rétractation, accès Google Meet/Discord encadré.
- `src/site-services.js` : demandes de rendez-vous et diagnostics, authentification parent par code e-mail, dossiers privés, commandes, références de factures et accès administrateur.
- `migrations/0001_init.sql` : offres, commandes, notifications, rétractations.
- `migrations/0002_payment_plan.sql` : modalités de règlement des commandes.
- `migrations/0003_site_services.sql` : tables privées des services famille.

Les tables de la migration **0003** ont été créées directement sur la base D1 existante le 11 octobre 2026, après contrôle de leur caractère additif. **Attention :** avant d'exécuter `wrangler d1 migrations apply --remote`, vérifier l'historique/registre des migrations et l'état du schéma avec une sauvegarde. La colonne `orders.payment_plan` existe déjà ; rejouer l'ancienne migration 0002 (ALTER TABLE) sans registre cohérent peut échouer. Ne pas appliquer toutes les migrations aveuglément à la base en production.

## Guides

- `SITE-SERVICES.md` : explications de toutes les pages publiques, endpoints, gestion des comptes parents, activations et contrôles de sécurité.
- `GOOGLE-MEET.md` : organisation des cours à distance.
- `../INFOS-LEGALES-A-COMPLETER.md` : points juridiques à terminer.

## Points à finaliser avant toute activation

L'immatriculation et les informations fiscales, les mentions légales/CGV, le médiateur de la consommation, les engagements de protection des données, les contrats de sous-traitance et les durées de conservation doivent être vérifiés.

Ensuite seulement, tester les services avec de fausses données : e-mail de l'expéditeur Brevo, API admin privée, secret de code parent, Turnstile serveur, activation séparée des deux drapeaux. Ajouter des limitations de débit et contrôle d'accès administrateur. Les parents doivent obtenir une session individuelle vérifiée, et les factures doivent être effectivement émises et communiquées par un canal sûr.

**Discord n'est pas refondu par ce changement** : les anciens salons, commandes et webhooks ne sont pas touchés. Aucun identifiant privé ou secret ne doit être ajouté au dépôt GitHub public.

## Turnstile et réservations — préparation du 12 octobre 2026

- Widget Turnstile « Bon Point — formulaire de réservation » créé en mode `managed`, limité à `bon-point.github.io`.
- `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET` enregistrés en secrets Cloudflare du Worker `bon-point-v2`, sans publication de leur contenu.
- Le calendrier `reserver.html` charge le widget quand `/api/site/status` indique la réception des demandes active. Le serveur exige ensuite une validation Turnstile avec l'hôte attendu.
- `SITE_INTAKE_ENABLED=false` et `PAYMENTS_ENABLED=false` sont conservés jusqu'à validation des mentions légales, des conditions contractuelles et du parcours complet sur un navigateur réel.
- Brevo possède un expéditeur actif, mais ce contrôle ne constitue pas encore un test d'un e-mail client envoyé par le Worker.
- Attention : des modifications du schéma D1, notamment `discord_notifications.claimed_at`, ont été appliquées directement en production. Vérifier registre, schéma et sauvegarde avant toute commande Wrangler de migrations.
