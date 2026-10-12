import assert from "node:assert/strict";
import {test} from "node:test";
import {checkAdminReadiness,auditAdminReadiness} from "../src/admin-readiness-audit.js";

test("Private readiness audit stores booleans only",async()=>{
 let sql,values;
 const env={
  ADMIN_READINESS_AUDIT_ENABLED:"true",
  ADMIN_PANEL_ENABLED:"true",
  ADMIN_LOGIN_EMAIL:"admin@example.org",ADMIN_LOGIN_PASSWORD:"an-example-password-over-24-characters",
  ADMIN_AUTH_SECRET:"an-example-secret-more-than-32-characters",
  MAIL_API_KEY:"fake-api-key",MAIL_SENDER:"sender@example.org",
  DB:{prepare(query){sql=query;return {bind(...v){values=v;return this},async run(){return {meta:{changes:1}}}}}}
 };
 const checks=checkAdminReadiness(env);
 assert.equal(Object.values(checks).every(v=>v===1),true);
 await auditAdminReadiness(env);
 assert.equal(values.length,7);
 assert.equal(values.every(v=>v===1||v===0),true);
 assert.doesNotMatch(sql,/password\s*=\s*excluded|secret\s*=\s*excluded/i);
});
test("Readiness gate detects too short secrets without recording them",()=>{
 const s=checkAdminReadiness({ADMIN_PANEL_ENABLED:"true",DB:{},MAIL_API_KEY:"x",MAIL_SENDER:"sender@example.org",ADMIN_LOGIN_EMAIL:"admin@example.org",ADMIN_LOGIN_PASSWORD:"short",ADMIN_AUTH_SECRET:"also-short"});
 assert.equal(s.password_meets_minimum,0);
 assert.equal(s.auth_secret_meets_minimum,0);
});
