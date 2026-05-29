export async function readIdentity(request, env) {
  const email = normalizeEmail(request.headers.get("X-FokalView-User-Email"));
  const clientId = request.headers.get("X-FokalView-Client-ID");
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
    identifierType
  };
}

export async function ensureUser(request, env) {
  const identity = await readIdentity(request, env);
  if (!identity || !env.DB) return identity;

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO users (id, client_hash, identifier_type, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_seen_at = excluded.last_seen_at,
       identifier_type = excluded.identifier_type`
  )
    .bind(identity.userId, identity.clientHash, identity.identifierType, now, now)
    .run();

  return identity;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
