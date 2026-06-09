import { ensureUser } from "./identity.js";
import { nextPlatformId, tableColumns } from "./ids.js";
import { hasVerifiedAccess } from "../lib/workos.js";

const CONSENT_VERSION = "ferpa-minimum-necessary-v1";
const STATUSES = new Set([
  "Interested",
  "Researching",
  "Applying",
  "Applied",
  "Recruiter Contact",
  "Interviewing",
  "Final Interview",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn"
]);

export async function onRequestGet({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Missing user identifier." }, 400);

  const columns = await tableColumns(env.DB, "application_captures");
  const canStoreSalary = columns.has("salary");
  const jobDescriptionSelect = columns.has("job_description") ? "job_description AS jobDescription," : "'' AS jobDescription,";
  const jobQualificationsSelect = columns.has("job_qualifications_json") ? "job_qualifications_json AS jobQualificationsJson," : "NULL AS jobQualificationsJson,";
  const applicationIdSelect = columns.has("application_id") ? "application_id AS applicationId," : "'' AS applicationId,";
  const readinessSelect = columns.has("latest_readiness_score")
    ? `latest_readiness_score AS latestReadinessScore, latest_analysis_json AS latestAnalysisJson,
       analysis_history_json AS analysisHistoryJson, analysis_count AS analysisCount,
       last_analyzed_at AS lastAnalyzedAt,`
    : "NULL AS latestReadinessScore, NULL AS latestAnalysisJson, NULL AS analysisHistoryJson, 0 AS analysisCount, NULL AS lastAnalyzedAt,";
  const rows = await env.DB.prepare(
    `SELECT id, ${applicationIdSelect} ${readinessSelect} ${jobDescriptionSelect} ${jobQualificationsSelect} user_id AS userId, title, company, location, ${canStoreSalary ? "salary" : "''"} AS salary, status, notes, url, source, captured_at AS createdAt,
      updated_at AS updatedAt, synced_at AS syncedAt
     FROM application_captures
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT 500`
  )
    .bind(identity.userId)
    .all();

  return json({
    applications: (rows.results || []).map((row) => ({
      ...row,
      latestAnalysis: parseJson(row.latestAnalysisJson, undefined),
      analysisHistory: parseJson(row.analysisHistoryJson, []),
      jobQualifications: parseJson(row.jobQualificationsJson, undefined),
      latestAnalysisJson: undefined,
      analysisHistoryJson: undefined,
      jobQualificationsJson: undefined
    }))
  });
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
    const columns = await tableColumns(env.DB, "application_captures");
    const canStoreSalary = columns.has("salary");
    const canStoreApplicationId = columns.has("application_id");
    const canStoreReadiness = columns.has("latest_readiness_score");
    const canStoreJobDescription = columns.has("job_description");
    const canStoreJobQualifications = columns.has("job_qualifications_json");
    const applicationId = canStoreApplicationId ? await nextPlatformId(env.DB, "application") : "";

    if (canStoreSalary && canStoreApplicationId) {
      await env.DB.prepare(
        `INSERT INTO application_captures (
          id, application_id, client_hash, user_id, title, company, location, salary, status, notes, url, source,
          data_category, consent_version, captured_at, updated_at, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'job_application_context', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          application_id = COALESCE(application_captures.application_id, excluded.application_id),
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
          applicationId,
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
    } else if (canStoreSalary) {
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
    } else if (canStoreApplicationId) {
      await env.DB.prepare(
        `INSERT INTO application_captures (
          id, application_id, client_hash, user_id, title, company, location, status, notes, url, source,
          data_category, consent_version, captured_at, updated_at, synced_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'job_application_context', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          application_id = COALESCE(application_captures.application_id, excluded.application_id),
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
          applicationId,
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

    if (canStoreJobDescription) {
      await env.DB.prepare(
        "UPDATE application_captures SET job_description = ? WHERE id = ? AND user_id = ?"
      )
        .bind(application.jobDescription, application.id, identity.userId)
        .run();
    }

    if (canStoreJobQualifications && application.jobQualifications) {
      await env.DB.prepare(
        "UPDATE application_captures SET job_qualifications_json = ? WHERE id = ? AND user_id = ?"
      )
        .bind(JSON.stringify(application.jobQualifications), application.id, identity.userId)
        .run();
    }

    const saved = canStoreApplicationId
      ? await env.DB.prepare("SELECT application_id AS applicationId FROM application_captures WHERE id = ?")
          .bind(application.id)
          .first()
          .catch(() => null)
      : null;

    if (canStoreReadiness && application.latestAnalysis) {
      const existing = await env.DB.prepare(
        "SELECT analysis_history_json AS analysisHistoryJson, analysis_count AS analysisCount FROM application_captures WHERE id = ? AND user_id = ?"
      )
        .bind(application.id, identity.userId)
        .first()
        .catch(() => null);
      const history = parseJson(existing?.analysisHistoryJson, []);
      history.unshift({
        score: application.latestAnalysis.score,
        scoringVersion: application.latestAnalysis.scoringVersion,
        analyzedAt: application.lastAnalyzedAt,
        improvements: application.latestAnalysis.improvements
      });
      await env.DB.prepare(
        `UPDATE application_captures
         SET latest_readiness_score = ?, latest_analysis_json = ?, analysis_history_json = ?,
             analysis_count = ?, last_analyzed_at = ?, updated_at = ?, synced_at = ?
         WHERE id = ? AND user_id = ?`
      )
        .bind(
          application.latestAnalysis.score,
          JSON.stringify(application.latestAnalysis),
          JSON.stringify(history.slice(0, 20)),
          Number(existing?.analysisCount || 0) + 1,
          application.lastAnalyzedAt,
          application.updatedAt,
          syncedAt,
          application.id,
          identity.userId
        )
        .run();
    }

    return json({ ok: true, id: application.id, applicationId: saved?.applicationId || applicationId, syncedAt });
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
    jobDescription: cleanMultiline(application.jobDescription, 30000),
    jobQualifications: normalizeJobQualifications(application.jobQualifications),
    notes: clean(application.notes, 2000),
    url: cleanUrl(application.url),
    source: clean(application.source, 120),
    createdAt: cleanDate(application.createdAt),
    updatedAt: cleanDate(application.updatedAt),
    latestAnalysis: normalizeAnalysis(application.latestAnalysis),
    lastAnalyzedAt: cleanDate(application.lastAnalyzedAt)
  };
}

function normalizeAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") return null;
  return {
    score: clampNumber(analysis.score, 0, 100),
    scoringVersion: clean(analysis.scoringVersion, 80),
    summary: clean(analysis.summary, 1200),
    jobDetails: normalizeJobDetails(analysis.jobDetails),
    jobQualifications: normalizeJobQualifications(analysis.jobQualifications),
    strengths: cleanList(analysis.strengths, 8, 240),
    improvements: Array.isArray(analysis.improvements)
      ? analysis.improvements.slice(0, 8).map((item) => ({
          title: clean(item.title, 180),
          detail: clean(item.detail, 800),
          priority: clean(item.priority, 20)
        }))
      : [],
    keywordAnalysis: {
      matched: cleanList(analysis.keywordAnalysis?.matched, 30, 120),
      missing: cleanList(analysis.keywordAnalysis?.missing, 30, 120)
    },
    sections: Array.isArray(analysis.sections)
      ? analysis.sections.slice(0, 10).map((item) => ({
          name: clean(item.name, 120),
          score: clampNumber(item.score, 0, 100),
          note: clean(item.note, 400)
        }))
      : []
  };
}

function normalizeJobDetails(value) {
  if (!value || typeof value !== "object") return null;
  return {
    title: clean(value.title, 240),
    company: clean(value.company, 240),
    location: clean(value.location, 200),
    salary: clean(value.salary, 160),
    employmentType: clean(value.employmentType, 120),
    workplaceType: clean(value.workplaceType, 120),
    sourceUrl: cleanUrl(value.sourceUrl)
  };
}

function normalizeJobQualifications(value) {
  if (!value || typeof value !== "object") return null;
  return {
    requiredSkills: cleanList(value.requiredSkills, 25, 160),
    preferredSkills: cleanList(value.preferredSkills, 25, 160),
    tools: cleanList(value.tools, 25, 160),
    responsibilities: cleanList(value.responsibilities, 15, 400),
    education: cleanList(value.education, 10, 240),
    certifications: cleanList(value.certifications, 10, 200),
    experienceLevel: clean(value.experienceLevel, 120),
    yearsExperience: clean(value.yearsExperience, 120),
    employmentType: clean(value.employmentType, 120),
    location: clean(value.location, 200),
    salary: clean(value.salary, 160)
  };
}

async function requireAccess(request, env) {
  const betaAccessCode = env.BETA_ACCESS_CODE || "";
  if (await hasVerifiedAccess(request, env)) return null;
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

function cleanMultiline(value, maxLength) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
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

function cleanList(value, maxItems, maxLength) {
  return Array.isArray(value)
    ? value.map((item) => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
