# Bon Point — checklist de préparation au lancement

Mise à jour le 13 octobre 2026. Les cases vérifiées concernent des observations techniques ou une validation de formalité communiquée par le responsable. Elles ne constituent pas une attestation de conformité juridique ou fiscale. Liste détaillée : [Vérification avant lancement](documents/verification-avant-lancement.md).

## Contrôle technique confirmé le 13 octobre 2026 (soir)

- [x] Version Worker `77771e6a-6826-4596-bf72-67ee60852810` **déployée à 100 %** depuis l'API Cloudflare, sans modifier le schéma D1.
- [x] Les **21 bindings** existants ont été conservés, y compris les secrets d'administration, Brevo, l'authentification des parents et la base D1.
- [x] Test à distance GitHub Actions de `/health`, `/api/offers` et `/api/site/status` réussi : le Worker répond, prix `50 €/190 €/350 €` confirmés, programmes `790 €/1 290 €` inchangés.
- [x] Réservations du site revenues aux horaires initiaux ; tests du calendrier et réservations réussis dans GitHub Actions.
- [x] `PAYMENTS_ENABLED=false`, `SITE_INTAKE_ENABLED=false` et `STRIPE_MODE=test` confirmés sur le Worker déployé.
- [ ] Sandbox Stripe : **aucune** des deux variables secrètes `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` n'est encore enregistrée dans Cloudflare. Le connecteur Stripe accessible ici ne voit que le compte **live**, pas de sandbox.
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
- [ ] Sandbox Stripe non accessible dans le connecteur actuel (seul le compte **live** est connecté) : créer/connecter ou autoriser un accès à la sandbox puis faire un paiement de test avec une carte de test ; aucun vrai paiement.
- [ ] Secrets `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` non fournis et non installés sur Cloudflare ; ne jamais les publier dans GitHub/chat.
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
- [ ] **Publier la dernière version du code Worker sur Cloudflare** via ce nouveau workflow manuel après contrôle de l'autorisation GitHub/Cloudflare. Les modifications du code serveur sur GitHub ne sont pas nécessairement déployées par le déploiement GitHub Pages.
- [ ] Un vrai paiement sandbox Stripe, son webhook et un accusé de paiement doivent encore être validés dans un environnement isolé.
- [ ] Conditions contractuelles, fiscales et médiation validées avant d'envisager `PAYMENTS_ENABLED=true` et une clé `sk_live_`.

## Rapports de contrôle

- [Test de réservation et nettoyage](documents/verification-reservations-2026-10-12.md)
- [Vérification administrative et juridique](documents/verification-avant-lancement.md)

Ne jamais ajouter de mot de passe, jeton, clé API ou document d'identité dans le dépôt GitHub.
