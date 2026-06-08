import { WorkOS } from "@workos-inc/node";
import { nextPlatformId, tableColumns } from "../api/ids.js";

export const SESSION_COOKIE = "wos-session";
export const AUTH_STATE_COOKIE = "wos-auth-state";
export const BETA_ADMISSION_COOKIE = "sagittaiq-beta-admission";

export function workosClient(env) {
  requireWorkOSConfig(env);
  return new WorkOS(env.WORKOS_API_KEY, { clientId: env.WORKOS_CLIENT_ID });
}

export function requireWorkOSConfig(env) {
  const missing = ["WORKOS_API_KEY", "WORKOS_CLIENT_ID", "WORKOS_COOKIE_PASSWORD"].filter(
    (name) => !env[name]
  );
  if (missing.length) {
    throw new Error(`Missing WorkOS configuration: ${missing.join(", ")}`);
  }
}

export function callbackUrl(request) {
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return "http://localhost:5173/api/auth/callback";
  }
  return "https://sagittaiq.com/api/auth/callback";
}

export function readCookie(request, name) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function sessionCookie(value, request, maxAge = 7 * 24 * 60 * 60) {
  return serializeCookie(SESSION_COOKIE, value, request, maxAge);
}

export function stateCookie(value, request, maxAge = 10 * 60) {
  return serializeCookie(AUTH_STATE_COOKIE, value, request, maxAge);
}

export function clearCookie(name, request) {
  return serializeCookie(name, "", request, 0);
}

export async function betaAdmissionCookie(email, request, env) {
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const payload = `${expiresAt}:${String(email || "").trim().toLowerCase()}`;
  const signature = await signAdmission(payload, env);
  return serializeCookie(BETA_ADMISSION_COOKIE, `${payload}:${signature}`, request, 7 * 24 * 60 * 60);
}

export async function hasBetaAdmission(request, env) {
  const value = readCookie(request, BETA_ADMISSION_COOKIE);
  const parts = value.split(":");
  if (parts.length < 3) return false;

  const expiresAt = Number(parts.shift());
  const signature = parts.pop();
  const payload = `${expiresAt}:${parts.join(":")}`;
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

  const expected = await signAdmission(payload, env);
  return constantTimeEqual(signature, expected);
}

export async function verifiedSession(request, env, { refresh = false } = {}) {
  const sessionData = readCookie(request, SESSION_COOKIE);
  if (!sessionData) return { authenticated: false, reason: "no_session_cookie_provided" };

  const workos = workosClient(env);
  const session = workos.userManagement.loadSealedSession({
    sessionData,
    cookiePassword: env.WORKOS_COOKIE_PASSWORD
  });

  let result = await session.authenticate();
  if (!result.authenticated && refresh) {
    result = await session.refresh();
  }
  return result;
}

export async function hasVerifiedAccess(request, env) {
  if (!env.WORKOS_API_KEY || !env.WORKOS_CLIENT_ID || !env.WORKOS_COOKIE_PASSWORD) return false;
  try {
    const result = await verifiedSession(request, env);
    return Boolean(result.authenticated);
  } catch {
    return false;
  }
}

export async function ensureBetaInvitation(env, email) {
  if (!env.WORKOS_API_KEY || !env.WORKOS_CLIENT_ID) {
    return { status: "unavailable" };
  }

  const workos = workosClient(env);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return { status: "unavailable" };

  const users = await workos.userManagement.listUsers({ email: normalizedEmail, limit: 1 });
  if (users.data?.length) {
    return { status: "account_exists" };
  }

  const invitations = await workos.userManagement.listInvitations({ email: normalizedEmail, limit: 10 });
  const pending = invitations.data?.find((invitation) => invitation.state === "pending");
  if (pending) {
    return { status: "invitation_pending", expiresAt: pending.expiresAt || "" };
  }

  const invitation = await workos.userManagement.sendInvitation({
    email: normalizedEmail,
    expiresInDays: 7
  });

  return {
    status: "invitation_sent",
    invitationId: invitation.id,
    expiresAt: invitation.expiresAt || ""
  };
}

export async function linkVerifiedUser(db, env, user) {
  if (!db || !user?.id || !user?.email) return null;

  const columns = await tableColumns(db, "users");
  if (!columns.has("workos_user_id")) {
    throw new Error("Verified identity storage needs migration 0016_workos_verified_identity.sql.");
  }

  const email = String(user.email).trim().toLowerCase();
  const legacyUserId = await legacyUserIdForEmail(email, env);
  const existing = await db.prepare(
    "SELECT id, candidate_id AS candidateId FROM users WHERE workos_user_id = ? OR id = ? LIMIT 1"
  )
    .bind(user.id, legacyUserId)
    .first()
    .catch(() => null);

  const now = new Date().toISOString();
  const domain = domainFromEmail(email);
  const domainType = classifyEmailDomain(domain);

  if (existing?.id) {
    await db.prepare(
      `UPDATE users
       SET workos_user_id = ?, auth_provider = 'workos', verified_at = COALESCE(verified_at, ?),
           identifier_type = 'verified_email', email_domain = COALESCE(email_domain, ?),
           email_domain_type = COALESCE(email_domain_type, ?), last_seen_at = ?
       WHERE id = ?`
    )
      .bind(user.id, now, domainType === "personal" ? "personal_email" : domain, domainType, now, existing.id)
      .run();
    return { userId: existing.id, candidateId: existing.candidateId || "" };
  }

  const candidateId = columns.has("candidate_id") ? await nextPlatformId(db, "candidate") : "";
  if (columns.has("candidate_id")) {
    await db.prepare(
      `INSERT INTO users (
         id, client_hash, identifier_type, email_domain, email_domain_type, country,
         candidate_id, workos_user_id, auth_provider, verified_at, created_at, last_seen_at
       )
       VALUES (?, ?, 'verified_email', ?, ?, '', ?, ?, 'workos', ?, ?, ?)`
    )
      .bind(legacyUserId, legacyUserId.replace(/^usr_/, ""), domainType === "personal" ? "personal_email" : domain, domainType, candidateId, user.id, now, now, now)
      .run();
  } else {
    await db.prepare(
      `INSERT INTO users (
         id, client_hash, identifier_type, email_domain, email_domain_type, country,
         workos_user_id, auth_provider, verified_at, created_at, last_seen_at
       )
       VALUES (?, ?, 'verified_email', ?, ?, '', ?, 'workos', ?, ?, ?)`
    )
      .bind(legacyUserId, legacyUserId.replace(/^usr_/, ""), domainType === "personal" ? "personal_email" : domain, domainType, user.id, now, now, now)
      .run();
  }

  return { userId: legacyUserId, candidateId };
}

async function legacyUserIdForEmail(email, env) {
  const salt = env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE || "fokalview";
  const bytes = new TextEncoder().encode(`${salt}:email:${email}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `usr_${hash.slice(0, 16)}`;
}

function serializeCookie(name, value, request, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function signAdmission(payload, env) {
  const secret = env.WORKOS_COOKIE_PASSWORD || env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE;
  if (!secret) throw new Error("Missing beta admission signing secret.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function domainFromEmail(email) {
  return String(email).split("@")[1] || "";
}

function classifyEmailDomain(domain) {
  if (!domain) return "";
  if (domain.endsWith(".edu")) return "education";
  if (new Set(["gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "aol.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com", "proton.me", "protonmail.com"]).has(domain)) {
    return "personal";
  }
  return "organization";
}
