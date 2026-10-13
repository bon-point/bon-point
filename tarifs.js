/* Catalogue central — montant en centimes d'euros. NE PAS modifier les prix côté client pour facturer. Le Worker doit imposer ses propres prix côté serveur. */
window.BONPOINT_TARIFS=Object.freeze({
 seance:{label:"Séance ciblée",priceCents:5000,minutes:60,description:"Une séance individuelle de 1 heure en visio."},
 progression:{label:"Progression",priceCents:19000,minutes:240,description:"4 séances individuelles de 1 heure sur 4 semaines en visio."},
 ambition:{label:"Ambition",priceCents:35000,minutes:480,description:"8 séances individuelles de 1 heure sur 4 semaines en visio."},
 brevet:{label:"Brevet Excellence",priceCents:79000,minutes:720,description:"12 heures de préparation individuelle, calendrier indicatif de 8 semaines."},
 bac:{label:"Bac Excellence",priceCents:129000,minutes:1200,description:"20 heures de préparation individuelle, calendrier indicatif de 10 semaines."}
});