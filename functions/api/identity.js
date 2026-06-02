import { nextPlatformId, tableColumns } from "./ids.js";

export async function readIdentity(request, env) {
  const email = normalizeEmail(request.headers.get("X-FokalView-User-Email"));
  const clientId = request.headers.get("X-FokalView-Client-ID");
  const emailDomain = email ? domainFromEmail(email) : "";
  const emailDomainType = classifyEmailDomain(emailDomain);
  const country = cleanCountry(request.headers.get("CF-IPCountry"));
  const identifierType = email ? "email" : "client";
  const identifier = email ? `email:${email}` : clientId ? `client:${clientId}` : "";
  if (!identifier) return null;

  const salt = env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE || "fokalview";
  const bytes = new TextEncoder().encode(`${salt}:${identifier}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const clientHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    userId: `usr_${clientHash.slice(0, 16)}`,
    clientHash,
    identifierType,
    emailDomain: emailDomainType === "personal" ? "personal_email" : emailDomain,
    emailDomainType,
    country
  };
}

export async function ensureUser(request, env) {
  const identity = await readIdentity(request, env);
  if (!identity || !env.DB) return identity;

  const now = new Date().toISOString();
  const columns = await tableColumns(env.DB, "users");
  const hasMetadata = columns.has("email_domain") && columns.has("email_domain_type") && columns.has("country");
  const hasCandidateId = columns.has("candidate_id");

  if (hasMetadata && hasCandidateId) {
    const candidateId = await nextPlatformId(env.DB, "candidate");
    await env.DB.prepare(
      `INSERT INTO users (
         id, client_hash, identifier_type, email_domain, email_domain_type, country,
         candidate_id, created_at, last_seen_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         identifier_type = excluded.identifier_type,
         email_domain = COALESCE(excluded.email_domain, users.email_domain),
         email_domain_type = COALESCE(excluded.email_domain_type, users.email_domain_type),
         country = COALESCE(excluded.country, users.country),
         candidate_id = COALESCE(users.candidate_id, excluded.candidate_id)`
    )
      .bind(
        identity.userId,
        identity.clientHash,
        identity.identifierType,
        identity.emailDomain,
        identity.emailDomainType,
        identity.country,
        candidateId,
        now,
        now
      )
      .run();
  } else if (hasMetadata) {
    await env.DB.prepare(
      `INSERT INTO users (id, client_hash, identifier_type, email_domain, email_domain_type, country, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         identifier_type = excluded.identifier_type,
         email_domain = COALESCE(excluded.email_domain, users.email_domain),
         email_domain_type = COALESCE(excluded.email_domain_type, users.email_domain_type),
         country = COALESCE(excluded.country, users.country)`
    )
      .bind(
        identity.userId,
        identity.clientHash,
        identity.identifierType,
        identity.emailDomain,
        identity.emailDomainType,
        identity.country,
        now,
        now
      )
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO users (id, client_hash, identifier_type, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         identifier_type = excluded.identifier_type`
    )
      .bind(identity.userId, identity.clientHash, identity.identifierType, now, now)
      .run();
  }

  if (hasCandidateId) {
    const saved = await env.DB.prepare("SELECT candidate_id AS candidateId FROM users WHERE id = ?")
      .bind(identity.userId)
      .first()
      .catch(() => null);
    identity.candidateId = saved?.candidateId || identity.candidateId || "";
  }

  return identity;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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

function cleanCountry(value) {
  const country = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : "";
}
