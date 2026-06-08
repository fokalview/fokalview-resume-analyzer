import { nextPlatformId, tableColumns } from "./ids.js";
import { betaAdmissionCookie, ensureBetaInvitation } from "../lib/workos.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const code = String(body.code || "").trim();
  const userPin = String(body.userSecurityCode || body.userPin || "").trim();
  const email = normalizeEmail(body.email);
  const betaAccessCode = env.BETA_ACCESS_CODE || "";

  if (betaAccessCode && code !== betaAccessCode) {
    return Response.json({ error: "Invalid beta access code." }, { status: 401 });
  }

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!/^\d{4}$/.test(userPin)) {
    return Response.json({ error: "Enter a 4-digit numeric security code." }, { status: 400 });
  }

  if (!env.DB) {
    return Response.json({ error: "User PIN storage is not configured." }, { status: 503 });
  }

  const columns = await tableColumns(env.DB, "users");
  if (!columns.has("security_pin_hash")) {
    return Response.json({ error: "User PIN storage needs the latest D1 migration." }, { status: 503 });
  }

  const identity = await emailIdentity(email, env);
  const pinHash = await hashPin(email, userPin, env);
  const existing = await env.DB.prepare("SELECT security_pin_hash AS securityPinHash FROM users WHERE id = ?")
    .bind(identity.userId)
    .first()
    .catch(() => null);

  if (existing?.securityPinHash && existing.securityPinHash !== pinHash) {
    return Response.json({ error: "Invalid 4-digit security code for this email." }, { status: 401 });
  }

  await upsertUserPin(env.DB, columns, identity, pinHash);

  let invitation = { status: "unavailable" };
  try {
    invitation = await ensureBetaInvitation(env, email);
  } catch (error) {
    invitation = {
      status: "failed",
      message: error instanceof Error ? error.message : "Could not send verified-account invitation."
    };
  }

  return Response.json(
    { ok: true, pinCreated: !existing?.securityPinHash, invitation },
    { headers: { "Set-Cookie": await betaAdmissionCookie(email, request, env) } }
  );
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function emailIdentity(email, env) {
  const emailDomain = domainFromEmail(email);
  const emailDomainType = classifyEmailDomain(emailDomain);
  const country = "";
  const salt = env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE || "fokalview";
  const bytes = new TextEncoder().encode(`${salt}:email:${email}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const clientHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    userId: `usr_${clientHash.slice(0, 16)}`,
    clientHash,
    identifierType: "email",
    emailDomain: emailDomainType === "personal" ? "personal_email" : emailDomain,
    emailDomainType,
    country
  };
}

async function hashPin(email, pin, env) {
  const salt = env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE || "fokalview";
  const bytes = new TextEncoder().encode(`${salt}:pin:${email}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function upsertUserPin(db, columns, identity, pinHash) {
  const now = new Date().toISOString();
  const hasCandidateId = columns.has("candidate_id");
  const candidateId = hasCandidateId ? await nextPlatformId(db, "candidate") : "";

  if (hasCandidateId) {
    await db.prepare(
      `INSERT INTO users (
         id, client_hash, identifier_type, email_domain, email_domain_type, country,
         candidate_id, security_pin_hash, security_pin_set_at, created_at, last_seen_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         identifier_type = 'email',
         email_domain = COALESCE(users.email_domain, excluded.email_domain),
         email_domain_type = COALESCE(users.email_domain_type, excluded.email_domain_type),
         country = COALESCE(users.country, excluded.country),
         candidate_id = COALESCE(users.candidate_id, excluded.candidate_id),
         security_pin_hash = COALESCE(users.security_pin_hash, excluded.security_pin_hash),
         security_pin_set_at = COALESCE(users.security_pin_set_at, excluded.security_pin_set_at)`
    )
      .bind(
        identity.userId,
        identity.clientHash,
        identity.identifierType,
        identity.emailDomain,
        identity.emailDomainType,
        identity.country,
        candidateId,
        pinHash,
        now,
        now,
        now
      )
      .run();
    return;
  }

  await db.prepare(
    `INSERT INTO users (
       id, client_hash, identifier_type, email_domain, email_domain_type, country,
       security_pin_hash, security_pin_set_at, created_at, last_seen_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       identifier_type = 'email',
       email_domain = COALESCE(users.email_domain, excluded.email_domain),
       email_domain_type = COALESCE(users.email_domain_type, excluded.email_domain_type),
       country = COALESCE(users.country, excluded.country),
       security_pin_hash = COALESCE(users.security_pin_hash, excluded.security_pin_hash),
       security_pin_set_at = COALESCE(users.security_pin_set_at, excluded.security_pin_set_at)`
  )
    .bind(
      identity.userId,
      identity.clientHash,
      identity.identifierType,
      identity.emailDomain,
      identity.emailDomainType,
      identity.country,
      pinHash,
      now,
      now,
      now
    )
    .run();
}

function domainFromEmail(email) {
  const parts = email.split("@");
  const domain = parts.length === 2 ? parts[1] : "";
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain : "";
}

function classifyEmailDomain(domain) {
  if (!domain) return "";
  if (domain.endsWith(".edu")) return "education";
  if (
    new Set([
      "gmail.com",
      "googlemail.com",
      "yahoo.com",
      "ymail.com",
      "aol.com",
      "hotmail.com",
      "outlook.com",
      "live.com",
      "icloud.com",
      "me.com",
      "proton.me",
      "protonmail.com"
    ]).has(domain)
  ) {
    return "personal";
  }
  return "organization";
}
