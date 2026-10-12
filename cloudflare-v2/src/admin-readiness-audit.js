/**
 * One-shot private admin readiness audit executed only by Worker cron.
 * Stores booleans, NEVER any password/secret content, hash, or length.
 * Not reachable via public HTTP and disabled by default.
 */
export function checkAdminReadiness(env){
 const login=String(env.ADMIN_LOGIN_EMAIL||"");
 return {
  admin_enabled:Number(env.ADMIN_PANEL_ENABLED==="true"),
  database_present:Number(!!env.DB),
  mail_key_present:Number(!!env.MAIL_API_KEY),
  sender_present:Number(!!env.MAIL_SENDER),
  valid_login_email:Number(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)),
  password_meets_minimum:Number(typeof env.ADMIN_LOGIN_PASSWORD==="string"&&env.ADMIN_LOGIN_PASSWORD.length>=24),
  auth_secret_meets_minimum:Number(typeof env.ADMIN_AUTH_SECRET==="string"&&env.ADMIN_AUTH_SECRET.length>=32)
 };
}
export async function auditAdminReadiness(env){
 if(env.ADMIN_READINESS_AUDIT_ENABLED!=="true"||!env.DB)return;
 const status=checkAdminReadiness(env);
 await env.DB.prepare(`INSERT INTO admin_readiness_audit(name,admin_enabled,database_present,mail_key_present,sender_present,valid_login_email,password_meets_minimum,auth_secret_meets_minimum,checked_at)
 VALUES('server',?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
 ON CONFLICT(name) DO UPDATE SET admin_enabled=excluded.admin_enabled,database_present=excluded.database_present,
 mail_key_present=excluded.mail_key_present,sender_present=excluded.sender_present,
 valid_login_email=excluded.valid_login_email,password_meets_minimum=excluded.password_meets_minimum,
 auth_secret_meets_minimum=excluded.auth_secret_meets_minimum,checked_at=CURRENT_TIMESTAMP`)
 .bind(status.admin_enabled,status.database_present,status.mail_key_present,status.sender_present,status.valid_login_email,
 status.password_meets_minimum,status.auth_secret_meets_minimum).run();
}
