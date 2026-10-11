/* Seule configuration publique. Aucune clé privée Stripe/Discord/Brevo ne doit figurer ici.
 * URL publique du Worker v2. La réception de l'API ne signifie pas que les paiements sont activés : PAYMENTS_ENABLED=false côté Cloudflare.
 */
window.BONPOINT_CHECKOUT_API = "https://bon-point-v2.soutien-bonpoint.workers.dev";
