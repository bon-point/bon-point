# Bon Point — catalogue Stripe synchronisé le 18 octobre 2026

## Source de vérité
Offres publiques : `tarifs.js` et prix verrouillés côté serveur Cloudflare. Cette opération a actualisé le **catalogue du compte Stripe live** `acct_1U1uAJR9ncVSpio5`, **sans accepter de paiement**, créer d'abonnement, de client ou de lien de paiement.

| ID offre site | Nom du produit | Prix unique EUR | Durée / contenu | ID produit Stripe | ID prix Stripe |
|---|---|---:|---|---|---|
| `seance` | Séance ciblée | 50 € | 1 séance d'1 h | `prod_VSpKAZEJYMhMnr` | `price_1URtfvR9ncVSpio5sWWdiqb5` |
| `progression` | Progression | 190 € | 4 séances d'1 h / 4 semaines | `prod_VSpKK9H6UGxTwZ` | `price_1URtgGR9ncVSpio52vTiBziu` |
| `ambition` | Ambition | 350 € | 8 séances d'1 h / 4 semaines | `prod_VSpKyN7HjgiNWQ` | `price_1URtgIR9ncVSpio5XHCfd9OY` |
| `brevet` | Brevet Excellence | 790 € | 12 h de préparation / 8 semaines indicatives | `prod_VSpLGOnRnFGYqW` | `price_1URtgKR9ncVSpio5cPsdtKmr` |
| `bac` | Bac Excellence | 1 290 € | 20 h de préparation / 10 semaines indicatives | `prod_VSpLX4mbcMHo07` | `price_1URtgLR9ncVSpio5SahrPgNy` |

**Réglages communs :** cinq produits actifs, cinq prix par unité actifs, en EUR, non récurrents (aucun abonnement), descriptions et métadonnées d'offre Bon Point ; `tax_behavior=unspecified` jusqu'à validation fiscale. Aucune fonctionnalité de paiement fractionné n'a été activée.

## Catalogue ancien archivé
| Produit | Ancien tarif | Produit Stripe | Ancien prix | État |
|---|---:|---|---|---|
| Cours à l'heure | 29 € | `prod_V1yKgWDRJF0BTX` | `price_1U1uO2R9ncVSpio5IAOZ2z3q` | Produit et prix inactifs |
| Forfait mensuel | 99 €/mois | `prod_V1yLKfektqdDvN` | `price_1U1uOUR9ncVSpio5HOPaZdl5` | Produit et prix inactifs |
| Stage de vacances | 180 € | `prod_V1yLfYbRaFnhPN` | `price_1U1uOpR9ncVSpio5OTLi9Kga` | Produit et prix inactifs |

Les trois anciens liens de paiement actifs ont été désactivés :
`plink_1U1uTRR9ncVSpio5mweiTDcc`, `plink_1U1uT4R9ncVSpio5zIR1lcH2`, `plink_1U1uSnR9ncVSpio5BQZD9Agd`.
Les deux autres liens existants étaient déjà inactifs et n'ont pas été réactivés.
Une recherche Stripe n'a trouvé **aucun abonnement** sur le compte lors du contrôle.

## Vérification après opérations
L'API Stripe a été relue après modification et confirme **exactement cinq produits actifs**, **cinq prix actifs**, trois produits/prix archivés, et **zéro lien de paiement actif** parmi les cinq liens listés. Les objets historiques restent présents dans Stripe.

## Important pour le site
Le Worker `cloudflare-v2/src/index.js` emploie actuellement `line_items[0][price_data]` pour Stripe Checkout, en imposant un montant issu de sa base de commandes ; il **n'utilise pas encore directement les nouveaux `price_...`**. Les produits du tableau de bord Stripe sont donc prêts, mais cela ne change **pas** automatiquement la logique de Checkout côté site. Toute évolution devra préserver le verrouillage des montants, les créneaux confirmés et les vérifications de paiement.

Le Worker conserve `PAYMENTS_ENABLED=false` et `STRIPE_MODE=test` : **encaissement réel toujours désactivé**. Avant mise en vente, les vérifications juridiques (dont capacité du titulaire, médiateur, CGV, TVA, facturation, date d'activité) et le test du webhook authentique restent nécessaires.

Aucune clé secrète, information bancaire ou donnée client personnelle n'est conservée dans ce document.
