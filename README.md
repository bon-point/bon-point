# Bon Point — Site premium et nouveau serveur Cloudflare v2

La refonte est actuellement sur une branche de préparation. Le site public n'est pas modifié tant que la PR n'est pas fusionnée.

## Site
- Motion design accessible et interface mobile
- Cinq formules de maths/physique-chimie, incluant Brevet Excellence et Bac Excellence
- Demande de rendez-vous par e-mail rédigé par le parent
- Parcours de proposition nominative et Stripe en mode désactivé par défaut
- Gestion des prix dans D1 une fois le Worker configuré
- Visios Google Meet pour les collégiens, Google Meet ou Discord avec âge requis pour les lycéens
- Ancien espace conservé en lecture des réservations existantes ; anciens paiements désactivés

## Nouveau backend
Code neuf sous `cloudflare-v2/` (aucune dépendance à l'ancien Worker). Documentation : `cloudflare-v2/README.md`.
Les anciennes tentatives de Worker de cette branche ont été supprimées pour éviter une confusion de déploiement.

## Ce qui est réellement opérationnel
Les fichiers sont enregistrés et les contrôles statiques Github Actions vérifient la structure et les montants initiaux.
**Le nouveau Worker Cloudflare a été créé avec D1 et paiements désactivés. Aucun service de facturation réel n'a été activé** via ce chat. Aucune clé privée n'a été fournie. Aucun paiement de bout en bout, aucun envoi Brevo ni invitation Discord réelle n'a été testé.
Le seul Stripe aperçu est un mauvais compte de test ; il doit être remplacé par le bon compte, avec les exigences Stripe applicables au titulaire.

## Avant fusion et encaissement
Compléter l'identité professionnelle, les CGV, la confidentialité et le médiateur.
Confirmer le bon compte Stripe et l'éligibilité à l'encaissement, déployer Cloudflare D1 et les secrets, produire de vrais liens Meet via le calendrier du propriétaire, configurer le bot Discord, mettre en place l'antispam et tester toutes les situations.

**Ne pas activer PAYMENTS_ENABLED sur une activité non vérifiée.**
