# Bon Point — Modèle de confirmation contractuelle au parent

**Projet de travail — 18 octobre 2026. Ne pas envoyer comme confirmation de vente tant que les obligations légales et les fonctionnalités de commande ne sont pas validées.**

Ce modèle peut être utilisé **après** la conclusion effective d'un contrat et la validation de son paiement. Le courriel doit être envoyé au parent sur un support durable et être conservable. Ne jamais annoncer « payé » si Stripe et la base de commandes ne confirment pas réellement le paiement.

## Objet du courriel

Bon Point — Votre confirmation de commande n° [RÉFÉRENCE]

## Texte à personnaliser

Bonjour [PRÉNOM / NOM DU PARENT],

Nous vous confirmons votre commande Bon Point dont vous trouverez le récapitulatif ci-dessous.

**Référence de commande :** [RÉFÉRENCE]

**Responsable légal contractant :** [NOM DU PARENT]

**Prestation :** [NOM DE L'OFFRE] — [MATHÉMATIQUES / PHYSIQUE-CHIMIE] — [NIVEAU]

**Durée totale :** [NOMBRE D'HEURES] — [NOMBRE DE SÉANCES]

**Calendrier convenu :** [DATES, HEURES DE PARIS, DURÉE PAR SÉANCE]

**Modalité de réalisation :** [VISIOCONFÉRENCE GOOGLE MEET / AUTRE MOYEN AUTORISÉ]

**Prix total :** [PRIX TOTAL À PAYER, TVA COMPRISE LE CAS ÉCHÉANT] €. [MENTION FISCALE / DÉTAIL TVA LÉGALEMENT JUSTIFIÉ].

**Mode de paiement :** règlement unique par Stripe Checkout, lorsque le service est disponible.

**Statut vérifié :** [PAYÉ, UNIQUEMENT APRÈS CONFIRMATION FIABLE / AUTRE STATUT].

**Date de conclusion du contrat :** [DATE ET HEURE D'ACCEPTATION/PAYEMENT CONFIRMÉES].

**Début de la prestation :** [DATE CONVENUE].

Les séances ne sont pas renouvelées automatiquement et aucune prestation supplémentaire ne sera facturée sans votre accord préalable.

Les conditions générales de vente applicables à votre commande et le détail des prestations sont consultables ici : https://bon-point.github.io/bon-point/cgv.html . Une version permettant de conserver les conditions **acceptées à la date de la commande** doit également vous être transmise avec ce récapitulatif (pièce jointe ou document durable équivalent), et non seulement un lien vers une page susceptible d'être modifiée.

### Annulation et rétractation

Une demande de report transmise au moins 24 heures avant une séance peut permettre une nouvelle date sans frais, sous réserve des disponibilités, sans préjudice des droits impératifs du consommateur. Si Bon Point ne peut assurer une séance, un report convenu ou le remboursement correspondant aux heures non réalisées est proposé selon la loi.

Pour un contrat de services conclu à distance, vous bénéficiez **en principe d'un droit de rétractation de 14 jours à compter de la conclusion du contrat**. Vous pouvez nous adresser votre déclaration par courriel à soutien.bonpoint@gmail.com et consulter la fonctionnalité de demande : https://bon-point.github.io/bon-point/retractation.html .

Si vous avez expressément demandé de commencer la prestation avant la fin de ce délai, les conséquences d'une éventuelle rétractation doivent être celles prévues par la loi : la part du service effectivement fournie peut être due au prorata dans les conditions légales. **La demande expresse de commencement anticipé doit faire l'objet d'un accord distinct enregistré avant exécution** ; elle ne peut pas être présumée à partir de la simple acceptation des CGV.

### Réclamations

Vous pouvez contacter Bon Point à soutien.bonpoint@gmail.com pour toute question ou réclamation.

**Médiation de la consommation :** [NOM, ADRESSE POSTALE ET SITE DU MÉDIATEUR COMPÉTENT, À COMPLÉTER AVANT TOUTE VENTE À DES CONSOMMATEURS].

### Identification du professionnel

BONPOINT — entrepreneur individuel (EI), SIREN 131 360 802, SIRET 131 360 802 00014.

[ADRESSE PROFESSIONNELLE DE DOMICILIATION À VALIDER]

[TÉLÉPHONE PROFESSIONNEL À VALIDER]

Courriel : soutien.bonpoint@gmail.com

Merci pour votre confiance,

Bon Point — Soutien scolaire en mathématiques et physique-chimie

---

## Contrôles indispensables avant envoi automatique

- [ ] Démarrage légal de l'activité et capacité d'exercice, y compris conditions du compte de paiement.
- [ ] Informations d'identification complètes et sûres : adresse professionnelle publiable, numéro de téléphone et coordonnées d'hébergement sur le site.
- [ ] Médiateur de la consommation compétent effectivement désigné et coordonnées intégrées aux CGV, au site et à la confirmation.
- [ ] Traitement TVA et montant final validés ; modèle de facture légal complété.
- [ ] Une offre nominative associée à un créneau confirmé, un consentement du parent et l'acceptation de la version précise des CGV ont été enregistrés.
- [ ] Consentement distinct et traçable si début de prestation demandé avant la fin du délai de rétractation.
- [ ] Paiement réel confirmé par un webhook Stripe authentique, montant/devise/e-mail/identifiant de commande vérifiés ; ne pas considérer la seule page « succès » comme preuve.
- [ ] Pas d'e-mail en double en cas de réception répétée du webhook.
- [ ] Confirmation contenant les informations contractuelles sur support durable et justificatif de règlement/facture suivant les exigences légales.
- [ ] Dispositif de rétractation en ligne et accusé de réception fonctionnels, dans les cas où ils sont légalement exigés.

**Rappel :** ce fichier est un modèle. Il n'autorise pas l'activation des paiements réels ni l'envoi d'une confirmation sans commande vérifiée.
