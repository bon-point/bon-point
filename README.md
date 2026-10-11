# Bon Point — Refonte premium et préparation au lancement

Cette branche héberge la refonte de la vitrine et un **prototype sécurisé de nouvelle infrastructure de paiement**, sans activation des encaissements réels.

## Fonctionnalités
- Design responsive avec animations adaptées aux préférences de réduction du mouvement.
- Accompagnements : séance ciblée, Progression, Ambition, Brevet Excellence et Bac Excellence.
- Formulaire de contact destiné aux parents. Il prépare un brouillon e-mail à envoyer manuellement.
- Catalogue public dans tarifs.js, synchronisé par test automatisé avec les montants contrôlés côté serveur dans workers/src/index.js.
- Checkout après proposition nominative validée par le professeur, à condition d'avoir configuré le Worker ; par défaut inactif.
- Webhook Stripe signé et tentative de livraison d'une invitation Discord à usage unique après paiement, par e-mail du parent ; visio alternative lorsque Discord n'est pas approprié. **Prototype non déployé et non testé de bout en bout.**
- Page de rétractation avec e-mail de secours ; API de traitement/accusé à activer avant vente en ligne.
- Page espace.html conservant l'ancien système Firebase et les liens Discord privés des anciennes réservations confirmées ; nouveaux anciens paiements désactivés.
- Documents légaux provisoires : mentions légales, CGV et confidentialité, à personnaliser.
- Tests GitHub Actions : syntaxe du Worker et des scripts HTML, liens, cohérence du catalogue de prix.

## Important
Aucun compte Stripe en mode réel n'a été relié. Un seul compte de test intitulé New business est visible et son affectation à Bon Point n'est pas confirmée. Cloudflare, Firestore, Discord et Brevo restent à configurer et tester. **Ne pas publier comme vente opérationnelle** tant que les obligations légales et les tests de bout en bout ne sont pas satisfaits.

Consulter workers/README.md et AVANT-PUBLICATION.md avant toute fusion vers main.
