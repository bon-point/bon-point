# Bon Point — Site de cours particuliers

Site public : **https://bon-point.github.io/bon-point/**  
Console privée : **https://bon-point.github.io/bon-point/admin.html**  
Worker Cloudflare : `bon-point-v2` (base D1 privée), distinct de l'ancien système.  
État des contrôles : **13 octobre 2026**.

## Ce qui est opérationnel

- Site public présentant cinq formules de cours de mathématiques et physique-chimie, des outils de diagnostic et un calendrier indicatif.
- Formulaires de contact, diagnostic et demandes de créneaux : **e-mail à envoyer manuellement** par le parent, avec une possibilité de copier le message si aucune messagerie n'est configurée.
- Console privée d'administration avec mot de passe et vérification par code e-mail ; possibilité de gérer des réservations manuelles, les séances et des documents PDF privés.
- Espace parents privé sur invitation ; documents réservés au parent autorisé.
- Bot Discord Bon Point et deux salles vocales privées, sans permissions publiques ; les accès payants ne sont pas accordés avant vérification du paiement.
- Brevo : tests administratifs de notifications de réservation validés le **12 octobre 2026** (demande, confirmation, annulation), dossier fictif supprimé après vérification.
- Cloudflare Turnstile configuré pour la future réception publique automatisée.
- Stripe Checkout : **code intégré et testé en simulation sans aucune transaction réelle**, avec tests de validation du rendez-vous, refus des doubles demandes, webhook signé, erreurs de paiement et compatibilité du mode test.

## Ce qui n'est PAS encore ouvert

- **Paiements réels : désactivés** (`PAYMENTS_ENABLED=false`).
- **Stripe : mode test seulement** (`STRIPE_MODE=test`), sans secrets Stripe enregistrés dans le Worker ; le véritable paiement sandbox et le webhook sandbox restent à effectuer.
- **Réception automatique des demandes publiques : désactivée** (`SITE_INTAKE_ENABLED=false`). Le contact par e-mail manuel reste possible.
- Les paiements échelonnés des programmes Excellence ne sont **pas activés** dans Checkout.
- Aucun contrat client, facture réelle, abonnement de médiation ou encaissement n'a été créé par les travaux techniques ici.

## Immatriculation et limites avant ventes

- SIREN : **131 360 802** ; SIRET du siège : **131 360 802 00014** ; entrepreneur individuel ; nom commercial Sirene **BONPOINT**.
- L'avis Sirene du 13 octobre 2026 indique le **20 octobre 2026** comme début d'activité.
- L'adresse d'établissement contenue dans l'avis correspond au domicile déclaré par le titulaire : **ne pas publier automatiquement l'adresse personnelle dans ce dépôt public**.
- Les projets de mentions légales, CGV et factures restent à valider, notamment coordonnées professionnelles, règles de report/rétractation, TVA applicable et médiateur de la consommation.
- Un avis Sirene ou un statut Stripe « paiements activés » ne remplace pas les vérifications contractuelles et fiscales avant vente.

## Organisation du dépôt

| Emplacement | Contenu |
|---|---|
| `index.html` | Accueil et offres |
| `reserver.html`, `diagnostic.html` | Demandes de créneaux et diagnostic |
| `checkout.html` | Présentation d'une offre et futur Checkout nominatif |
| `retractation.html` | Déclaration de rétractation et canal de secours |
| `parents.html`, `admin.html` | Espaces privés |
| `cloudflare-v2/` | Worker, schéma SQL, scripts de test |
| `discord-bot/` | Bot Discord et gestion des deux salles |
| `documents/` | Dossiers de vérification, fiscalité, facturation |
| `AVANT-PUBLICATION.md` | Checklist principale |

## Tests et déploiement

Le workflow `.github/workflows/validate.yml` contrôle les modules, la séparation parent/admin, les créneaux, les notifications, les droits Discord, le parcours Stripe simulé, la rétractation et les liens du site. Les modifications du dépôt déclenchent également le déploiement GitHub Pages.

Les rapports importants sont :
- [Vérification des réservations du 12 octobre](documents/verification-reservations-2026-10-12.md)
- [Préparation des encaissements Stripe](documents/stripe-avant-encaissement-2026-10-13.md)
- [TVA et factures à valider](documents/validation-tva-factures.md)
- [Vérification avant lancement](documents/verification-avant-lancement.md)
- [Suivi de médiation](documents/mediateur-consommation-a-valider.md)

**Aucun mot de passe, identifiant bancaire, clé Stripe, clé de bot Discord ou document d'identité ne doit être déposé dans GitHub.**
