# Mise en production : paiement, réservations et Discord — spécification vérifiable

## État (11 octobre 2026)
Le dépôt ne contient que l'ancien `index.html` client, et pas le code du Worker `bon-point-auto.soutien-bonpoint.workers.dev`, ni les règles Firestore ni les accès Stripe. Impossible de vérifier l'historique des paiements ou de modifier les prix de Stripe par simple édition HTML.

Cette branche prépare **un catalogue centralisé** dans `tarifs.js`, les pages d'offres, l'espace historique et la demande de rétractation. **Aucun nouveau paiement n'est actif.** Il est interdit de raccorder des prix affichés à un ancien lien Stripe sans avoir vérifié les montants côté Stripe et le serveur.

## Offres souhaitées
| Identifiant | Prix affiché | Prestations |
|---|---:|---|
| seance | 65 € | 1 h |
| progression | 249 € | 4 h sur 4 semaines |
| ambition | 449 € | 8 h sur 4 semaines |
| brevet | 790 € | 12 h, programme Brevet Excellence |
| bac | 1 290 € | 20 h, programme Bac Excellence |

L'équipe doit pouvoir modifier les tarifs depuis un outil **serveur** (catalogue Stripe et paramétrage back-end), puis synchroniser le site. `tarifs.js` sert à l'affichage seulement ; ce n'est jamais une source de vérité pour la facturation.

## Flux cible sécurisé
1. Parent identifié, offre et disponibilité confirmées.
2. Serveur valide offre, montant, devise, autorisation parentale et réservation. Création d'une session Stripe Checkout avec `client_reference_id` et `metadata.bookingId` serveur, jamais fournis librement depuis le navigateur.
3. Page de paiement hébergée chez Stripe ; retour sur site avec simple message d'attente. **Un retour sur page de succès ne confirme jamais seul le paiement.**
4. Webhook Stripe au Worker : valider la signature, identifier l'événement, vérifier état `paid`, montant total, devise, identifiant de réservation, statut, date et identité attendus.
5. Validation idempotente : en transaction Firestore, marquer la réservation confirmée, appliquer règles de capacité, tracer `stripeEventId` pour éviter les doublons. Le statut ne doit jamais pouvoir être confirmé par un client via Firestore.
6. Créer/récupérer une invitation Discord privée propre au créneau confirmé, courte durée si possible. Stocker sous `slots/{slotId}/private/discord` et limiter l'accès à l'admin, aux services serveurs et aux participants payés pour ce créneau (règles Firestore robustes). Ne pas publier le lien dans le HTML. Si Discord indisponible, conserver le statut confirmé et afficher une procédure de support.
7. Envoyer au parent un reçu et les informations pratiques via le service e-mail, avec journal de succès/échec et possibilité de renvoi.
8. Annulation, remboursement, report, litige et rétractation : route serveur authentifiée, historique horodaté et confirmation sur support durable ; vérifier les règles propres aux prestations déjà exécutées. La fonctionnalité de rétractation en ligne doit réellement **transmettre** la demande et **accuser réception**.
9. Tester avec les modes tests Stripe : deux clics, deux clients sur la dernière place, webhook en double/dans le désordre, remboursement, échec réseau, usager non autorisé, capacité complète, lien Discord inaccessible à un tiers, aucune injection HTML depuis Firestore.

## Configuration requise (jamais dans GitHub)
- Clé privée Stripe, webhook signing secret, produits/prix actifs pour chaque offre.
- Environnement Cloudflare Worker, variables secrètes et URL de domaine autorisée.
- Firebase Admin credentials sécurisés ; règles Firestore et autorisation métier sur serveur.
- Compte Discord du propriétaire + bot autorisé uniquement sur le serveur voulu ; jeton du bot gardé secret.
- Identité professionnelle, conditions de vente validées, médiateur de la consommation.

## Conformité française à finaliser
Les pages de mentions légales, CGV et confidentialité sont des **projets**. Compléter sans inventer :
identité/statut, SIREN, adresse et téléphone selon obligations, TVA applicable, prix TTC, calendrier de fourniture, droit de rétractation avec modèle type, annulation, médiateur conventionné, archivage du contrat, délais RGPD, paiements, droits des personnes, cookies éventuels, modalités du présentiel et SAP si revendiqué. Obtenir un contrôle juridique avant vente.
Sources publiques indicatives : Service Public (contrats à distance et CGV), DGCCRF (rétractation), CNIL (RGPD). Ne pas revendiquer de réduction fiscale sans les conditions requises.

## Déploiement
Ne fusionner vers `main` qu'après validation de l'identité juridique, de la conformité et de l'ensemble des tests checkout/Discord. Conserver l'ancien site en production jusque-là.
