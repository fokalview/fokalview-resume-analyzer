const CONSENT_VERSION = "ferpa-minimum-necessary-v1";
const STATUSES = new Set(["Interested", "Applied", "Interviewing", "Offer", "Rejected"]);

export async function onRequestGet({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const clientHash = await readClientHash(request, env);
  if (!clientHash) return json({ error: "Missing X-FokalView-Client-ID." }, 400);

  const rows = await env.DB.prepare(
    `SELECT id, title, company, location, status, notes, url, source, captured_at AS createdAt,
      updated_at AS updatedAt, synced_at AS syncedAt
     FROM application_captures
     WHERE client_hash = ?
     ORDER BY updated_at DESC
     LIMIT 500`
  )
    .bind(clientHash)
    .all();

  return json({ applications: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const clientHash = await readClientHash(request, env);
  if (!clientHash) return json({ error: "Missing X-FokalView-Client-ID." }, 400);

  try {
    const body = await request.json();
    if (body.consent !== true || body.consentVersion !== CONSENT_VERSION) {
      return json({ error: "Cloud sync requires explicit current consent." }, 400);
    }

    const application = normalizeApplication(body.application);
    const syncedAt = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO application_captures (
        id, client_hash, title, company, location, status, notes, url, source,
        data_category, consent_version, captured_at, updated_at, synced_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'job_application_context', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        company = excluded.company,
        location = excluded.location,
        status = excluded.status,
        notes = excluded.notes,
        url = excluded.url,
        source = excluded.source,
        consent_version = excluded.consent_version,
        updated_at = excluded.updated_at,
        synced_at = excluded.synced_at`
    )
      .bind(
        application.id,
        clientHash,
        application.title,
        application.company,
        application.location,
        application.status,
        application.notes,
        application.url,
        application.source,
        CONSENT_VERSION,
        application.createdAt,
        application.updatedAt,
        syncedAt
      )
      .run();

    return json({ ok: true, id: application.id, syncedAt });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not save application." }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const clientHash = await readClientHash(request, env);
  if (!clientHash) return json({ error: "Missing X-FokalView-Client-ID." }, 400);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "Missing application id." }, 400);

  await env.DB.prepare("DELETE FROM application_captures WHERE id = ? AND client_hash = ?")
    .bind(id, clientHash)
    .run();

  return json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, X-Beta-Access-Code, X-FokalView-Client-ID"
    }
  });
}

function normalizeApplication(input) {
  const application = input || {};
  const title = clean(application.title, 160);
  const company = clean(application.company, 160);

  if (!title || !company) {
    throw new Error("Application requires a job title and company.");
  }

  return {
    id: clean(application.id, 80) || crypto.randomUUID(),
    title,
    company,
    location: clean(application.location, 160),
    status: STATUSES.has(application.status) ? application.status : "Interested",
    notes: clean(application.notes, 2000),
    url: cleanUrl(application.url),
    source: clean(application.source, 120),
    createdAt: cleanDate(application.createdAt),
    updatedAt: cleanDate(application.updatedAt)
  };
}

async function requireAccess(request, env) {
  const betaAccessCode = env.BETA_ACCESS_CODE || "";
  if (betaAccessCode && request.headers.get("X-Beta-Access-Code") !== betaAccessCode) {
    return json({ error: "Invalid beta access code." }, 401);
  }
  return null;
}

async function readClientHash(request, env) {
  const clientId = request.headers.get("X-FokalView-Client-ID");
  if (!clientId) return "";

  const salt = env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE || "fokalview";
  const bytes = new TextEncoder().encode(`${salt}:${clientId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanUrl(value) {
  const url = clean(value, 1000);
  if (!url) return "";

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString().slice(0, 1000);
  } catch {
    return "";
  }
}

function cleanDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
