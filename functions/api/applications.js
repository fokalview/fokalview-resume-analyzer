import { ensureUser } from "./identity.js";

const CONSENT_VERSION = "ferpa-minimum-necessary-v1";
const STATUSES = new Set(["Interested", "Applied", "Interviewing", "Offer", "Rejected"]);

export async function onRequestGet({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Missing user identifier." }, 400);

  const canStoreSalary = await hasSalaryColumn(env.DB);
  const rows = await env.DB.prepare(
    `SELECT id, user_id AS userId, title, company, location, ${canStoreSalary ? "salary" : "''"} AS salary, status, notes, url, source, captured_at AS createdAt,
      updated_at AS updatedAt, synced_at AS syncedAt
     FROM application_captures
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT 500`
  )
    .bind(identity.userId)
    .all();

  return json({ applications: rows.results || [] });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Missing user identifier." }, 400);

  try {
    const body = await request.json();
    if (body.consent !== true || body.consentVersion !== CONSENT_VERSION) {
      return json({ error: "Cloud sync requires explicit current consent." }, 400);
    }

    const application = normalizeApplication(body.application);
    const syncedAt = new Date().toISOString();
    const canStoreSalary = await hasSalaryColumn(env.DB);

    if (canStoreSalary) {
      await env.DB.prepare(
        `INSERT INTO application_captures (
          id, client_hash, user_id, title, company, location, salary, status, notes, url, source,
          data_category, consent_version, captured_at, updated_at, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'job_application_context', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          company = excluded.company,
          location = excluded.location,
          salary = excluded.salary,
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
          identity.clientHash,
          identity.userId,
          application.title,
          application.company,
          application.location,
          application.salary,
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
    } else {
      await env.DB.prepare(
        `INSERT INTO application_captures (
          id, client_hash, user_id, title, company, location, status, notes, url, source,
          data_category, consent_version, captured_at, updated_at, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'job_application_context', ?, ?, ?, ?)
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
          identity.clientHash,
          identity.userId,
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
    }

    return json({ ok: true, id: application.id, syncedAt });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not save application." }, 400);
  }
}

export async function onRequestPatch({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Missing user identifier." }, 400);

  try {
    const body = await request.json();
    const id = clean(body.id, 80);
    const status = STATUSES.has(body.status) ? body.status : "";
    if (!id || !status) return json({ error: "Application id and valid status are required." }, 400);

    const updatedAt = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE application_captures SET status = ?, updated_at = ?, synced_at = ? WHERE id = ? AND user_id = ?"
    )
      .bind(status, updatedAt, updatedAt, id, identity.userId)
      .run();

    return json({ ok: true, id, status, updatedAt });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not update application." }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Missing user identifier." }, 400);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "Missing application id." }, 400);

  await env.DB.prepare("DELETE FROM application_captures WHERE id = ? AND user_id = ?")
    .bind(id, identity.userId)
    .run();

  return json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, X-Beta-Access-Code, X-FokalView-Client-ID, X-FokalView-User-Email"
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
    salary: clean(application.salary, 160),
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

async function hasSalaryColumn(db) {
  const columns = await db.prepare("PRAGMA table_info(application_captures)").all();
  return (columns.results || []).some((column) => column.name === "salary");
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
