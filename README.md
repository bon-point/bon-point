# Bon Point — Refonte pour le lancement
Cette branche propose une vitrine commerciale premium **sans mettre en production des fonctionnalités de paiement ou de réservation non auditées**.

## Contenu
- Page d'accueil responsive : positionnement, spécialités, méthode, trois formules, profil, FAQ et contact.
- Demande de premier échange : le formulaire ouvre un **brouillon d'e-mail à envoyer manuellement** ; aucune donnée n'est transmise depuis la page à un serveur.
- Pages de mentions légales, CGV et confidentialité : **brouillons, informations professionnelles obligatoires à compléter**.
- SEO de base : balises de partage et description, URL canonique, sitemap et robots.

## Décisions de sécurité
L'ancienne page `index.html` utilise Firebase Auth/Firestore, des liens de paiement Stripe et un Worker Cloudflare externe. Ce dépôt ne contient pas les règles de sécurité Firestore ni le code du Worker ; les flux de paiements, rôles administrateurs, réservations, rappels et annulations n'ont donc pas pu être vérifiés de bout en bout. Le commit précédent reste disponible dans l'historique GitHub ; la nouvelle page **ne crée ni réservation automatique, ni compte client, ni paiement**. Ne pas présenter cette première version comme une plateforme transactionnelle pleinement opérationnelle.

## À valider avant de fusionner cette branche dans main
1. Valider les tarifs proposés : 65 € / 1 h ; 249 € / 4 semaines (4 h) ; 449 € / 4 semaines (8 h).
2. Confirmer les créneaux, zones d'intervention, statut professionnel, informations du fondateur et contenu de la présentation.
3. Compléter et faire vérifier `mentions-legales.html`, `cgv.html` et `confidentialite.html` (actuellement marquées provisoires).
4. Valider l'utilisation de `matheo.png` et de l'adresse de contact.
5. Tester le rendu mobile, clavier, mails `mailto:` sur plusieurs systèmes (sans application de messagerie, l'utilisateur doit écrire directement à l'adresse indiquée).
6. Pour remettre en ligne un espace élève : ajouter le code serveur, les règles Firestore restrictives et les tests Stripe webhook + prévention des doubles réservations + authentification admin robuste.

**Attention :** Les prix et textes juridiques sont des propositions. Le projet ne doit pas être publié tel quel avant validation des mentions obligatoires.

Dépôt d'origine : https://github.com/bon-point/bon-point
