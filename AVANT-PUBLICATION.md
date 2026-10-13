# Bon Point — checklist de préparation au lancement

Mise à jour le 13 octobre 2026. Les cases vérifiées concernent des observations techniques ou une validation de formalité communiquée par le responsable. Elles ne constituent pas une attestation de conformité juridique ou fiscale. Liste détaillée : [Vérification avant lancement](documents/verification-avant-lancement.md).

## Test de bout en bout isolé — 13 octobre 2026 (fin de soirée)

- [x] Nouveau test automatisé `cloudflare-v2/scripts/test-complete-payment-lifecycle.mjs` intégré à `.github/workflows/validate.yml` : réservation de démonstration par la console protégée, confirmation du créneau, proposition nominative à **50 €**, validation des CGV, Checkout, événement webhook HMAC signé, confirmation et vérification de l'absence de doublon.
- [x] Exécution réussie dans GitHub Actions avec **SQLite temporaire et Stripe/Brevo simulés**, sans utiliser la D1 du Worker public ni faire d'appel réseau financier.
- [x] Les anciens tests Stripe ont été réalignés sur le tarif horaire actuel de **50 €** (au lieu de l'ancien tarif de 65 €).
- [ ] L'acheminement **réel** du webhook Stripe vers l'endpoint public reste à valider depuis la destination de test sur Stripe. Une simulation HMAC locale ne prouve pas que l'abonnement à l'événement, l'URL et le secret de la destination Stripe sont corrects.
- [ ] Ne pas activer les ventes aux familles avant validation des obligations commerciales et administratives, indépendamment des tests techniques.

## Test Stripe après installation des secrets — 13 octobre 2026

- [x] Le Worker déployé sur Cloudflare dispose de `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`, tous deux enregistrés comme `secret_text`; le contenu des clés n'a pas été lu ni publié.
- [x] Les paramètres restent `STRIPE_MODE=test`, `PAYMENTS_ENABLED=false`, `SITE_INTAKE_ENABLED=false` et `REQUIRE_CONFIRMED_BOOKING=true`.
- [x] Contrôle automatique distant de l'endpoint `/stripe/webhook` : une requête à **signature délibérément invalide** obtient HTTP 400, ce qui vérifie la présence du secret de signature et le refus de falsification (mais **pas** la livraison d'un webhook Stripe authentique).
- [x] Contrôle distant `/api/checkout` : HTTP 503 tant que les paiements sont volontairement désactivés, sans création de commande.
- [x] Vérifications GitHub Actions : **live smoke**, contrôles statiques et GitHub Pages réussis.
- [x] Vérification de la clé de sandbox sans révéler son contenu : appel réel à l'API Stripe Checkout réussi (HTTP 200), retour de session `cs_test_`, `livemode=false`, prix 50 €, sans carte ni règlement.
- [ ] Confirmer le cycle complet sandbox : une commande de démonstration avec créneau confirmé, Stripe Checkout test, événement webhook signé et confirmation en D1. Aucun encaissement réel ne doit être autorisé.

## Contrôle technique confirmé le 13 octobre 2026 (soir)

- [x] Version Worker `77771e6a-6826-4596-bf72-67ee60852810` **déployée à 100 %** depuis l'API Cloudflare, sans modifier le schéma D1.
- [x] Les **21 bindings** existants ont été conservés, y compris les secrets d'administration, Brevo, l'authentification des parents et la base D1.
- [x] Test à distance GitHub Actions de `/health`, `/api/offers` et `/api/site/status` réussi : le Worker répond, prix `50 €/190 €/350 €` confirmés, programmes `790 €/1 290 €` inchangés.
- [x] Réservations du site revenues aux horaires initiaux ; tests du calendrier et réservations réussis dans GitHub Actions.
- [x] `PAYMENTS_ENABLED=false`, `SITE_INTAKE_ENABLED=false` et `STRIPE_MODE=test` confirmés sur le Worker déployé.
- [x] Les variables secrètes Stripe de test sont bien enregistrées dans Cloudflare ; l'essai réel de création d'une session Checkout en sandbox est réussi. Le connecteur Stripe dans le chat ne donne toujours accès qu'au compte **live** ; l'essai a été fait via le Worker, sans utilisation de ce connecteur.
- [ ] Validation d'un parcours test Stripe avec un webhook signé dans un environnement isolé, sans encaissement réel.
- [ ] Informations légalement obligatoires encore à finaliser (médiateur effectif, domiciliation/coordonnées professionnelles, vérification fiscale et contractuelle).
- [ ] **Ne pas lancer la vente réelle avant les validations requises et la date d'entrée en activité prévue le 20 octobre 2026.**

Le workflow manuel GitHub Cloudflare a échoué au contrôle des secrets GitHub Actions (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` absents dans l'environnement `cloudflare-staging`). **La correction a été directement déployée par le connecteur Cloudflare**, pas par GitHub Actions. Le workflow redevient manuel, pour éviter toute exécution automatique involontaire.

## Entreprise et légalité

- [x] Formalité d'entreprise individuelle (EI) déclarée comme validée auprès de l'INPI.
- [x] Identification EI et SIREN déjà présents dans les projets de mentions légales.
- [x] SIRET du siège vérifié grâce à l'avis Sirene du 13/10/2026 : **131 360 802 00014** ; nom commercial officiel **BONPOINT**.
- [ ] Prendre en compte le début d'activité déclaré au **20 octobre 2026**, avant toute première vente.
- [ ] Vérifier la capacité juridique d'exercice et les conditions du statut, ainsi que le titulaire autorisé des services de paiement, avec les interlocuteurs habilités si nécessaire.
- [ ] Déterminer le traitement TVA applicable avec les services fiscaux ou un professionnel compétent.
- [ ] Choisir les coordonnées professionnelles publiables : domiciliation et téléphone professionnel, sans divulguer d'adresse résidentielle privée ici.
- [ ] Renseigner les coordonnées complètes de l'hébergeur.
- [ ] Choisir et contractualiser avec un médiateur de la consommation référencé.
- [ ] Valider les CGV, prix, échéanciers éventuels, annulations, rétractations et facturation ; vérifier aussi la fonctionnalité de rétractation en ligne applicable aux contrats conclus en ligne.
- [ ] Finaliser l'information RGPD, les durées de conservation, les fournisseurs et éventuels transferts de données.

## Préparation des encaissements — travaux sans médiateur (13 octobre 2026)

- [x] CGV enrichies : réservation distincte de la commande, propositions nominatives, information sur le délai de rétractation de 14 jours et modèle de notification.
- [x] Paiement fractionné clarifié dans les CGV : **non disponible** dans le tunnel Stripe actuel, même si des échéanciers peuvent être étudiés.
- [x] Fonctionnalité de rétractation en ligne préparée avec confirmation de référence et possibilité de copier/envoyer la déclaration si le service échoue ; test JavaScript automatisé réussi. L'envoi horodaté/accusé côté serveur nécessite encore un essai navigateur complet.
- [x] Hébergeur GitHub Pages : lien d'assistance officielle complété dans les mentions, sans inventer de téléphone.
- [x] Tableau d'analyse TVA documenté pour les cours personnels exonérés (sous conditions), la franchise et le régime taxable. Voir [validation TVA et factures](documents/validation-tva-factures.md).
- [x] Modèle de facture complété avec champs de quantités, montants et référence de paiement, sans le faire passer pour une facture émise.
- [x] Les nouveaux tests de préparation légale et de sécurité des paiements sont exécutés dans GitHub Actions.
- [ ] Confirmation du régime de TVA et de la mention fiscale par le SIE ; décider des montants TTC définitifs.
- [ ] Coordonnées professionnelles obligatoires et adresse de domiciliation publiable, **sans exposer automatiquement le domicile**.
- [ ] Approbation des règles commerciales : reports, annulations, absences, remboursements, début anticipé des séances et échéances contractuelles.
- [x] Sandbox Stripe vérifiée par appel réel du Worker (création d'une session Checkout **impayée**). [ ] Paiement fictif de bout en bout à effectuer ensuite dans un environnement contrôlé ; aucun vrai paiement.
- [x] Secrets `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` installés dans Cloudflare comme données chiffrées ; ne jamais les publier dans GitHub/chat.
- [ ] `PAYMENTS_ENABLED=false` et `STRIPE_MODE=test` conservés. La configuration live est **en attente de la validation contractuelle/légale**, de la sandbox et du médiateur.

## Site, réservations et notifications

- [x] Site GitHub Pages, tableau de bord administrateur privé et authentification renforcée configurés.
- [x] Calendrier indicatif et saisie manuelle des demandes opérationnels.
- [x] Parcours de démonstration de bout en bout testé le 12/10/2026 : demande → Discord → confirmation → Brevo/Gmail → annulation → Discord/Gmail.
- [x] Données de la réservation fictive supprimées de Cloudflare D1 après vérification (0 réservation restante).
- [x] Widget Cloudflare Turnstile créé pour `bon-point.github.io` et secrets configurés dans le Worker.
- [x] Formulaires de contact, réservation et diagnostic : secours manuel de copie du brouillon si aucun logiciel e-mail n'est configuré, sans envoi serveur implicite.
- [x] Vérification des créneaux bornée à 6,5 secondes ; état indicatif préservé en cas d'indisponibilité.
- [x] Déconnexion de l'espace parents : suppression immédiate du jeton de session côté navigateur et des informations affichées dans la page.
- [x] Sitemap public enrichi (accueil, réservation, diagnostic) et tests automatisés correspondants intégrés à GitHub Actions.
- [ ] Test de navigation réel sur PC et smartphone des nouveaux secours e-mail et de la déconnexion parents.
- [x] Paiements et réception publique automatisée de réservations maintenus désactivés.
- [ ] Tester le formulaire public et Turnstile dans un vrai navigateur, sous conditions de lancement validées.
- [ ] Confirmer les plages horaires, les offres et les tarifs réellement proposés.
- [ ] Vérifier l'expérience sur téléphone et ordinateur, les liens, l'accessibilité et les coordonnées affichées.
- [ ] Vérifier la véracité et les autorisations de publication des éventuels portraits, avis et résultats.
- [x] Audit Stripe du 13/10/2026 : compte français connecté, capacités techniques de paiement et de versement actives dans Stripe ; **aucune conclusion sur l'éligibilité juridique et aucune activation Cloudflare**. Voir [le dossier Stripe](documents/stripe-avant-encaissement-2026-10-13.md).
- [ ] Avant mise en vente : capacité juridique du titulaire et rôle éventuel du représentant légal vérifiés, médiateur et CGV finalisés, secrets Stripe sécurisés, tests Stripe dans l'environnement éligible, protections contre les doubles paiements, facturation et remboursements.

## Dernières corrections techniques (13 octobre 2026)

- [x] Vérification Stripe côté Worker adaptée à l'administration moderne protégée par code e-mail ; une clé administrateur de l'ancien système n'est plus exigée pour déclarer Checkout prêt.
- [x] Le secret du webhook Stripe doit avoir le préfixe attendu `whsec_`, et le mode de clé doit correspondre au mode `STRIPE_MODE`.
- [x] Durée de vie d'une session Stripe Checkout fixée à une heure afin d'éviter le rejet de Stripe à la limite minimale de 30 minutes.
- [x] Tests automatisés associés : mode test/live, webhook signé, duplications, échec Stripe, absence de clé d'administration héritée et expiration Checkout.
- [x] Page de commande : échéanciers non disponibles en ligne signalés explicitement.
- [x] Tableau de bord administrateur : état des paiements, formulaires et espace parents interrogé depuis le serveur.
- [x] Ancien `README.md` remplacé par une synthèse exacte de l'état du site et des services.
- [x] Workflow Cloudflare corrigé : déploiement **manuel depuis main**, avec garde-fous `PAYMENTS_ENABLED=false`, `STRIPE_MODE=test` et `SITE_INTAKE_ENABLED=false`, et **sans migrations D1 automatiques**.
- [x] Dernière version sécurisée du Worker publiée directement sur Cloudflare. Le workflow GitHub pour les déploiements futurs nécessite toujours des autorisations spécifiques.
- [ ] Un vrai paiement sandbox Stripe, son webhook et un accusé de paiement doivent encore être validés dans un environnement isolé.
- [ ] Conditions contractuelles, fiscales et médiation validées avant d'envisager `PAYMENTS_ENABLED=true` et une clé `sk_live_`.

## Rapports de contrôle

- [Test de réservation et nettoyage](documents/verification-reservations-2026-10-12.md)
- [Vérification administrative et juridique](documents/verification-avant-lancement.md)

Ne jamais ajouter de mot de passe, jeton, clé API ou document d'identité dans le dépôt GitHub.
