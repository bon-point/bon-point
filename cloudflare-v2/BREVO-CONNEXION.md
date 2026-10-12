# Bon Point — connexion Brevo (12 octobre 2026)

## État vérifié

- Brevo connecté : société Bonpoint, compte Free, service SMTP transactionnel activé.
- Expéditeur actif dans Brevo : `Bonpoint <soutien.bonpoint@gmail.com>`.
- Worker Cloudflare `bon-point-v2` : `MAIL_SENDER=soutien.bonpoint@gmail.com`, `OWNER_EMAIL=soutien.bonpoint@gmail.com`, `ADMIN_LOGIN_EMAIL=soutien.bonpoint@gmail.com`.
- Secret Cloudflare `MAIL_API_KEY` présent, **jamais inscrit dans GitHub ni partagé dans ChatGPT**.
- Les courriels transactionnels utilisent déjà `POST https://api.brevo.com/v3/smtp/email` dans `src/index.js`.
- `ADMIN_PANEL_ENABLED=false`, `SITE_INTAKE_ENABLED=false`, `PAYMENTS_ENABLED=false`, `DISCORD_BOOKING_LINKS_ENABLED=false` : ne pas les activer sans prérequis.

## Test d'envoi à usage unique

Le module `src/mail-smoke-test.js` n'envoie **qu'un seul e-mail** vers `soutien.bonpoint@gmail.com`, et seulement quand `MAIL_SMOKE_TEST_ENABLED=true`. Il requiert la correspondance stricte entre expéditeur, destinataire propriétaire et la boîte Bon Point.

Le verrou atomique D1 `mail_delivery_checks` évite les doublons. `state='accepted'` signifie que l'API Brevo a accepté l'envoi, **pas nécessairement que Gmail a livré le message**. `state='failed'` enregistre le code HTTP simplifié sans aucune clé API ni information personnelle. La tâche est déclenchée par le cron du Worker ; une propagation de configuration Cloudflare peut nécessiter plusieurs minutes.

Pour consulter le résultat via D1 :
```sql
SELECT test_key,state,error_code,created_at,finished_at
FROM mail_delivery_checks
ORDER BY created_at DESC
LIMIT 3;
```

Lorsque l'envoi a été effectué, remettre `MAIL_SMOKE_TEST_ENABLED=false` et le cron normal du site `*/5 * * * *`.

## Résultat de la validation

Le 12 octobre 2026 à 12:10:30 UTC, la table `mail_delivery_checks` a enregistré `state='accepted'` pour `brevo-connectivity-2026-10-12`, sans code d'erreur. **Brevo a accepté l'envoi transactionnel depuis le Worker Cloudflare.** La réception finale par Gmail reste à confirmer par le propriétaire du compte.

Après validation :
- `MAIL_SMOKE_TEST_ENABLED=false` (désactivé).
- Cron `*/5 * * * *` (rythme normal rétabli).
- `MAIL_API_KEY` reste un secret Cloudflare, confirmé par lecture de la configuration après restauration.
- `PAYMENTS_ENABLED=false` inchangé.

## Administration (12 octobre 2026)

La présence des secrets `ADMIN_LOGIN_PASSWORD` et `ADMIN_AUTH_SECRET` a été vérifiée dans Cloudflare sans consulter leurs valeurs. Les tests automatiques des protections de connexion (e-mail, mot de passe, OTP, session et origine) ont réussi. Le commutateur `ADMIN_PANEL_ENABLED=true` a été enregistré puis confirmé par une nouvelle lecture de la configuration. `PAYMENTS_ENABLED=false`, `SITE_INTAKE_ENABLED=false` et `PARENT_PORTAL_ENABLED=false` restent inchangés. La connexion de l'administrateur doit être essayée manuellement sur [admin.html](https://bon-point.github.io/bon-point/admin.html) ; la longueur réelle des secrets n'est pas accessible via la lecture Cloudflare, et le Worker refuse la connexion si les minimums de 24 et 32 caractères ne sont pas respectés.

## Suite

1. Vérifier que le test est accepté par Brevo et reçu dans la boîte (éventuellement dossier spam).
2. Configurer les secrets `ADMIN_LOGIN_PASSWORD` (mot de passe long, choisi par l'administrateur) et `ADMIN_AUTH_SECRET` (valeur aléatoire d'au moins 32 caractères) exclusivement dans Cloudflare, jamais dans le dépôt.
3. Vérifier l'identité et les autorisations légales nécessaires avant l'activation publique des services.
4. Effectuer un test d'accès admin et de connexion parent ; n'activer `ADMIN_PANEL_ENABLED` et `DISCORD_BOOKING_LINKS_ENABLED` qu'après cette validation.
5. Garder les paiements réels désactivés tant que les prérequis légaux et Stripe ne sont pas vérifiés.

Ne jamais utiliser le système de campagne marketing Brevo pour envoyer un code privé à une liste de contacts.
