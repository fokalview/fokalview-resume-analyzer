import { ensureUser } from "./identity.js";

const CONSENT_VERSION = "workforce-resume-profile-v1";
const MAX_RAW_RESUME_LENGTH = 50000;
const MAX_JOB_CONTEXT_LENGTH = 12000;

export async function onRequestGet({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Missing user identifier." }, 400);

  const rows = await env.DB.prepare(
    `SELECT id, user_id AS userId, target_role AS targetRole, profile_json AS profileJson,
      analysis_json AS analysisJson, raw_resume_retained AS rawResumeRetained,
      data_category AS dataCategory, consent_version AS consentVersion,
      captured_at AS capturedAt, updated_at AS updatedAt
     FROM resume_records
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT 200`
  )
    .bind(identity.userId)
    .all();

  return json({
    records: (rows.results || []).map((row) => ({
      ...row,
      profile: JSON.parse(row.profileJson),
      analysis: JSON.parse(row.analysisJson),
      profileJson: undefined,
      analysisJson: undefined,
      rawResumeRetained: Boolean(row.rawResumeRetained)
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
      return json({ error: "Resume storage requires explicit current consent." }, 400);
    }

    const record = normalizeResumeRecord(body);
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO resume_records (
        id, client_hash, user_id, target_role, job_context, profile_json, analysis_json,
        raw_resume_text, raw_resume_retained, data_category, consent_version,
        captured_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'workforce_resume_profile', ?, ?, ?)`
    )
      .bind(
        record.id,
        identity.clientHash,
        identity.userId,
        record.targetRole,
        record.jobContext,
        JSON.stringify(record.profile),
        JSON.stringify(record.analysis),
        record.rawResumeText,
        record.rawResumeText ? 1 : 0,
        CONSENT_VERSION,
        now,
        now
      )
      .run();

    return json({ ok: true, id: record.id, savedAt: now });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not save resume record." }, 400);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Missing user identifier." }, 400);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ error: "Missing resume record id." }, 400);

  await env.DB.prepare("DELETE FROM resume_records WHERE id = ? AND user_id = ?")
    .bind(id, identity.userId)
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
        "Content-Type, X-Beta-Access-Code, X-FokalView-Client-ID, X-FokalView-User-Email"
    }
  });
}

function normalizeResumeRecord(body) {
  const analysis = body.analysis || {};
  const profile = body.profile || analysis.profile;

  if (!profile || typeof profile !== "object") {
    throw new Error("Missing structured resume profile.");
  }

  if (!analysis || typeof analysis !== "object") {
    throw new Error("Missing resume analysis.");
  }

  const retainRawResumeText = body.retainRawResumeText === true;

  return {
    id: crypto.randomUUID(),
    targetRole: clean(body.targetRole, 180),
    jobContext: clean(body.jobContext, MAX_JOB_CONTEXT_LENGTH),
    profile: normalizeProfile(profile),
    analysis: normalizeAnalysis(analysis),
    rawResumeText: retainRawResumeText ? cleanRawText(body.resumeText, MAX_RAW_RESUME_LENGTH) : ""
  };
}

function normalizeProfile(profile) {
  return {
    currentTitle: clean(profile.currentTitle, 180),
    careerLevel: clean(profile.careerLevel, 40) || "Unknown",
    yearsExperienceEstimate: clampNumber(profile.yearsExperienceEstimate, 0, 60),
    industries: cleanList(profile.industries, 12, 120),
    skills: {
      technical: cleanList(profile.skills?.technical, 30, 120),
      tools: cleanList(profile.skills?.tools, 30, 120),
      soft: cleanList(profile.skills?.soft, 20, 120)
    },
    workHistory: Array.isArray(profile.workHistory)
      ? profile.workHistory.slice(0, 12).map((item) => ({
          title: clean(item.title, 180),
          company: clean(item.company, 180),
          startDate: clean(item.startDate, 40),
          endDate: clean(item.endDate, 40),
          highlights: cleanList(item.highlights, 6, 240)
        }))
      : [],
    education: Array.isArray(profile.education)
      ? profile.education.slice(0, 8).map((item) => ({
          institution: clean(item.institution, 180),
          credential: clean(item.credential, 180),
          field: clean(item.field, 180)
        }))
      : [],
    certifications: cleanList(profile.certifications, 20, 180),
    projects: cleanList(profile.projects, 20, 240),
    languages: cleanList(profile.languages, 12, 120),
    locationSignals: cleanList(profile.locationSignals, 12, 120)
  };
}

function normalizeAnalysis(analysis) {
  return {
    score: clampNumber(analysis.score, 0, 100),
    summary: clean(analysis.summary, 1200),
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

async function requireAccess(request, env) {
  const betaAccessCode = env.BETA_ACCESS_CODE || "";
  if (betaAccessCode && request.headers.get("X-Beta-Access-Code") !== betaAccessCode) {
    return json({ error: "Invalid beta access code." }, 401);
  }
  return null;
}


function cleanList(value, maxItems, maxLength) {
  return Array.isArray(value)
    ? value.map((item) => clean(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanRawText(value, maxLength) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
