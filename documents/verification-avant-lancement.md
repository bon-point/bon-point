# Bon Point — Points à valider avant les premières ventes
Mise à jour : 12 octobre 2026. Ce document est une liste de vérification, pas un avis juridique ni une attestation de conformité.

## Immatriculation
- [x] Formalité de création EI affichée « validée » par l'INPI le 12/10/2026 (d'après capture fournie).
- [x] SIREN indiqué sur le récapitulatif : **131 360 802**.
- [x] Code APE du récapitulatif : **85.59B — Autres enseignements**.
- [ ] Obtenir le **SIRET à 14 chiffres**, distinct du SIREN. Ne pas ajouter de SIRET supposé aux documents.
- [ ] Télécharger l'avis de situation au répertoire Sirene : https://avis-situation-sirene.insee.fr/ (une création récente peut nécessiter 24 heures ; la non-diffusion nécessite parfois FranceConnect).
- [ ] Vérifier que les données RNE, régime choisi et situation d'exercice sont cohérents. La validation informatique ne remplace pas le respect des conditions légales de capacité.

## Capacité juridique et compte de paiement
- [ ] Si le titulaire de l'EI est mineur, **vérifier sa situation avant tout encaissement** : un mineur non émancipé ne peut pas créer une EI ou micro-entreprise ; un mineur émancipé peut créer une EI sous conditions. Vérifier avec l'INPI, l'URSSAF et un représentant légal si nécessaire.
  Source : https://entreprendre.service-public.gouv.fr/vosdroits/F31627
- [ ] Avant d'accepter des fonds par Stripe, vérifier son exigence de représentant majeur/tuteur légal pour les titulaires mineurs et les informations légales du compte. Ne jamais contourner les contrôles de Stripe.
  Source : https://support.stripe.com/questions/can-i-use-stripe-if-i-am-under-18

## Mentions obligatoires site et documents
- [x] Mentions légales et CGV mises à jour pour ne plus qualifier l'activité de « non immatriculée ».
- [x] Le SIREN, la qualité d'entrepreneur individuel (EI), l'activité et le contact e-mail figurent dans les projets de mentions.
- [ ] **Adresse de domiciliation professionnelle**, même lorsqu'elle correspond au domicile personnel : exigence légale sur le site et factures. Les possibilités de domiciliation et de protection du domicile doivent être examinées avant toute publication.
- [ ] **Numéro de téléphone professionnel** pour les coordonnées publiées ; décider d'un contact adéquat sans mettre une donnée privée non souhaitée en ligne.
- [ ] Coordonnées complètes et à jour de l'hébergeur du site.
- [ ] Compléter les CGV : modalités précises du contrat, réservation, exécution, prix, reports, rétractation, remboursement, médiateur de la consommation et lien vers le formulaire adapté. Pour les contrats à distance conclus en ligne, vérifier aussi la fonctionnalité de rétractation en ligne applicable depuis le 19/06/2026 (voir `retractation.html`).
- [ ] Contrat effectif avec un **médiateur de la consommation** compétent, puis informations sur le médiateur dans les CGV. Une [présélection fondée sur la liste officielle](mediateur-consommation-a-valider.md) est prête ; aucun organisme n'est encore engagé.
- [x] Dossier de démonstration du parcours réservation supprimé de Cloudflare D1 après les tests du 12/10/2026 (0 réservation restante).
- [ ] Vérifier la conformité RGPD de l'espace parents, les outils tiers et les durées de conservation avant ouverture aux familles.
  Source : https://entreprendre.service-public.gouv.fr/vosdroits/F31228

## TVA et facturation
- [ ] Déterminer le bon fondement fiscal avec le SIE ou un professionnel compétent. Selon les conditions, l'enseignement scolaire dispensé personnellement et payé directement par l'élève/le responsable légal peut être exonéré de TVA sur la base de l'**article 261, 4-4°-b du CGI**. La **franchise en base** constitue une autre situation à distinguer.
  Source : https://bofip.impots.gouv.fr/bofip/943-PGP.html/identifiant=BOI-TVA-CHAMP-30-10-20-50-20191016
- [ ] Vérifier les mentions de facturation : numéro unique et chronologique continu, date d'émission et de prestation, vendeur EI et adresse, client et adresse (selon conditions applicables), description détaillée, quantités et prix, fondement de TVA, modalités de règlement.
  Source : https://entreprendre.service-public.gouv.fr/vosdroits/F31808
- [x] **Modèle de facture non émis** : `documents/modele-facture-bonpoint.html` ; les champs manquants restent clairement signalés.
- [ ] Valider l'émission effective et l'archivage des factures **avant** d'automatiser les ventes ; ne pas utiliser le modèle provisoire pour facturer des clients.

## Site Bon Point et réservations
- [x] Console d'administration à double facteur activée, comptes parents privés et PDF protégés.
- [x] Calendrier de proposition déjà en place : jeudi dès 13 h 30, soirs de semaine dès 18 h, samedi/dimanche 8 h–18 h. Horaires indicatifs, pas de disponibilité temps réel.
- [x] Notifications Brevo validées et bot Discord privé pour les deux salles préparé.
- [x] Parcours de démonstration du 12/10/2026 vérifié : création en administration, notifications Discord de demande/confirmation/refus, envois Brevo et réceptions Gmail ; dossier de test supprimé après vérification. Voir `documents/verification-reservations-2026-10-12.md`.
- [ ] Valider les plages de fin de journée, les durées de séances et le calendrier réel avec l'exploitant.
- [ ] Vérifier paiements en conditions de test et protection contre toute double facturation, puis décision distincte de mise en production.
- [x] **`PAYMENTS_ENABLED=false`** et **`SITE_INTAKE_ENABLED=false`** à maintenir jusqu'à validation finale ; ne pas activer Stripe réel par anticipation.
- [x] Protection anti-robot Turnstile créée et clés enregistrées en secrets Cloudflare (domaine `bon-point.github.io`).
- [ ] Test complet d'une demande depuis un navigateur public avec Turnstile : **non réalisé**, ne pas le confondre avec la création manuelle dans l'administration.

## À fournir avant une mise en conformité définitive
1. Le numéro **SIRET** du principal établissement ou un avis Sirene après publication.
2. Une solution de **domiciliation et coordonnées de contact professionnelles** acceptable pour les mentions obligatoires.
3. La situation de **capacité juridique** vérifiée (dont l'émancipation si applicable).
4. La décision confirmée sur le **régime de TVA**.
5. Les coordonnées du **médiateur de la consommation** choisi.
