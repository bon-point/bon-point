# Bon Point — checklist de préparation au lancement

Mise à jour le 12 octobre 2026. Les cases vérifiées concernent des observations techniques ou une validation de formalité communiquée par le responsable. Elles ne constituent pas une attestation de conformité juridique ou fiscale. Liste détaillée : [Vérification avant lancement](documents/verification-avant-lancement.md).

## Entreprise et légalité

- [x] Formalité d'entreprise individuelle (EI) déclarée comme validée auprès de l'INPI.
- [x] Identification EI et SIREN déjà présents dans les projets de mentions légales.
- [ ] Obtenir/vérifier le SIRET officiel et le document Sirene, sans extrapoler un numéro.
- [ ] Vérifier la capacité juridique d'exercice et les conditions du statut, ainsi que le titulaire autorisé des services de paiement, avec les interlocuteurs habilités si nécessaire.
- [ ] Déterminer le traitement TVA applicable avec les services fiscaux ou un professionnel compétent.
- [ ] Choisir les coordonnées professionnelles publiables : domiciliation et téléphone professionnel, sans divulguer d'adresse résidentielle privée ici.
- [ ] Renseigner les coordonnées complètes de l'hébergeur.
- [ ] Choisir et contractualiser avec un médiateur de la consommation référencé.
- [ ] Valider les CGV, prix, échéanciers éventuels, annulations, rétractations et facturation ; vérifier aussi la fonctionnalité de rétractation en ligne applicable aux contrats conclus en ligne.
- [ ] Finaliser l'information RGPD, les durées de conservation, les fournisseurs et éventuels transferts de données.

## Site, réservations et notifications

- [x] Site GitHub Pages, tableau de bord administrateur privé et authentification renforcée configurés.
- [x] Calendrier indicatif et saisie manuelle des demandes opérationnels.
- [x] Parcours de démonstration de bout en bout testé le 12/10/2026 : demande → Discord → confirmation → Brevo/Gmail → annulation → Discord/Gmail.
- [x] Données de la réservation fictive supprimées de Cloudflare D1 après vérification (0 réservation restante).
- [x] Widget Cloudflare Turnstile créé pour `bon-point.github.io` et secrets configurés dans le Worker.
- [x] Paiements et réception publique automatisée de réservations maintenus désactivés.
- [ ] Tester le formulaire public et Turnstile dans un vrai navigateur, sous conditions de lancement validées.
- [ ] Confirmer les plages horaires, les offres et les tarifs réellement proposés.
- [ ] Vérifier l'expérience sur téléphone et ordinateur, les liens, l'accessibilité et les coordonnées affichées.
- [ ] Vérifier la véracité et les autorisations de publication des éventuels portraits, avis et résultats.
- [ ] Avant mise en vente : tests Stripe dans le compte éligible, protections contre les doubles paiements et traitement des retraits/remboursements.

## Rapports de contrôle

- [Test de réservation et nettoyage](documents/verification-reservations-2026-10-12.md)
- [Vérification administrative et juridique](documents/verification-avant-lancement.md)

Ne jamais ajouter de mot de passe, jeton, clé API ou document d'identité dans le dépôt GitHub.
