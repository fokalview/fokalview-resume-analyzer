import { ensureUser } from "./identity.js";
import { nextPlatformId, tableColumns } from "./ids.js";
import { hasVerifiedAccess } from "../lib/workos.js";
import { ResumeSourceError, readSourceJson, requireOwnedSource } from "../lib/resume-sources.js";

const CONSENT_VERSION = "workforce-resume-profile-v1";
const MAX_RAW_RESUME_LENGTH = 50000;
const MAX_JOB_CONTEXT_LENGTH = 30000;

export async function onRequestGet({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Sign in with a verified account." }, 401);

  const columns = await tableColumns(env.DB, "resume_records");
  const reportIdSelect = columns.has("report_id") ? "report_id AS reportId," : "'' AS reportId,";
  const opportunityIdSelect = columns.has("opportunity_id") ? "opportunity_id AS opportunityId," : "'' AS opportunityId,";
  const resumeLabelSelect = columns.has("resume_label") ? "resume_label AS resumeLabel," : "'' AS resumeLabel,";
  const sourceSelect = columns.has('source_id') ? "source_id AS sourceId, COALESCE((SELECT position_json FROM resume_sources WHERE id=resume_records.source_id AND user_id=resume_records.user_id),'{}') AS positionJson," : "NULL AS sourceId, '{}' AS positionJson,";
  const rows = await env.DB.prepare(
    `SELECT id, ${reportIdSelect} ${opportunityIdSelect} ${resumeLabelSelect} ${sourceSelect} user_id AS userId, target_role AS targetRole, job_context AS jobContext, profile_json AS profileJson,
      analysis_json AS analysisJson, raw_resume_retained AS rawResumeRetained, raw_resume_text AS rawResumeText,
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
      position: JSON.parse(row.positionJson),
      positionJson: undefined,
      rawResumeRetained: Boolean(row.rawResumeRetained)
    }))
  });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Sign in with a verified account." }, 401);

  try {
    const body = await readSourceJson(request);
    if (body.consent !== true || body.consentVersion !== CONSENT_VERSION) {
      return json({ error: "Resume storage requires explicit current consent." }, 400);
    }

    const record = normalizeResumeRecord(body);
    const now = new Date().toISOString();
    const columns = await tableColumns(env.DB, "resume_records");
    const canStoreReportId = columns.has("report_id");
    const canStoreOpportunityId = columns.has("opportunity_id");
    const canStoreResumeLabel = columns.has("resume_label");
    const source = body.sourceId ? await requireOwnedSource(env,identity.userId,body.sourceId,{kind:'snapshot'}) : null;
    if(source) {
      if(!columns.has('source_id')) throw new ResumeSourceError('Resume source linking is not available yet. Your source copy remains saved.',503);
      for(const [key,column] of [['resumeText','resume_text'],['targetRole','target_role'],['jobContext','job_context']]) {
        if(body[key]!==undefined && body[key]!==source[column]) throw new ResumeSourceError('This review differs from the saved resume version. Save a new version first.',409);
      }
      record.targetRole=source.target_role;record.jobContext=source.job_context;record.rawResumeText=source.resume_text;
      record.resumeLabel=source.resume_label;
      if(source.opportunity_id && record.opportunityId && source.opportunity_id!==record.opportunityId) throw new ResumeSourceError('This review belongs to a different saved opportunity.',409);
      record.opportunityId=source.opportunity_id||record.opportunityId;
    }
    if(record.opportunityId) {
      const owned=await env.DB.prepare('SELECT id FROM application_captures WHERE id=? AND user_id=?').bind(record.opportunityId,identity.userId).first();
      if(!owned)throw new ResumeSourceError('Saved opportunity not found.',404);
    }
    const priorSourceSave = async () => {
      if(!source)return null;
      const prior=await env.DB.prepare('SELECT id,report_id AS reportId,opportunity_id AS opportunityId,captured_at AS savedAt,analysis_json AS analysisJson,profile_json AS profileJson FROM resume_records WHERE user_id=? AND source_id=?').bind(identity.userId,source.id).first();
      if(prior && (prior.analysisJson!==JSON.stringify(record.analysis)||prior.profileJson!==JSON.stringify(record.profile)))throw new ResumeSourceError('A review is already saved for this version. Save a new version for another analysis.',409);
      if(!prior)return null;
      return json({ok:true,id:prior.id,reportId:prior.reportId,opportunityId:prior.opportunityId,sourceId:source.id,savedAt:prior.savedAt,reused:true});
    };
    const previous=await priorSourceSave();if(previous)return previous;
    const reportId = canStoreReportId ? await nextPlatformId(env.DB, "report") : "";
    const recordId = record.id;

    const insertColumns = ["id"];
    const insertValues = [recordId];
    if(source){insertColumns.push('source_id');insertValues.push(source.id);}
    if (canStoreReportId) {
      insertColumns.push("report_id");
      insertValues.push(reportId);
    }
    if (canStoreOpportunityId) {
      insertColumns.push("opportunity_id");
      insertValues.push(record.opportunityId);
    }
    if (canStoreResumeLabel) {
      insertColumns.push("resume_label");
      insertValues.push(record.resumeLabel);
    }
    insertColumns.push(
      "client_hash", "user_id", "target_role", "job_context", "profile_json", "analysis_json",
      "raw_resume_text", "raw_resume_retained", "data_category", "consent_version", "captured_at", "updated_at"
    );
    insertValues.push(
      identity.clientHash,
      identity.userId,
      record.targetRole,
      record.jobContext,
      JSON.stringify(record.profile),
      JSON.stringify(record.analysis),
      record.rawResumeText,
      record.rawResumeText ? 1 : 0,
      "workforce_resume_profile",
      CONSENT_VERSION,
      now,
      now
    );

    try { await env.DB.prepare(
      `INSERT INTO resume_records (${insertColumns.join(", ")})
       VALUES (${insertColumns.map(() => "?").join(", ")})`
    )
      .bind(...insertValues)
      .run(); } catch(error) {const previous=await priorSourceSave();if(previous)return previous;throw error;}

    return json({ ok: true, id: recordId, reportId, opportunityId: record.opportunityId, sourceId:source?.id||null, savedAt: now });
  } catch (error) {
    return json({ error: error instanceof ResumeSourceError ? error.message : error instanceof Error && error.message.startsWith('Missing ') ? error.message : "Could not save the review. Any retained resume source remains available." }, error instanceof ResumeSourceError ? error.status : 400);
  }
}

export async function onRequestDelete({ request, env }) {
  const auth = await requireAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const identity = await ensureUser(request, env);
  if (!identity) return json({ error: "Sign in with a verified account." }, 401);

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
    rawResumeText: retainRawResumeText ? cleanRawText(body.resumeText, MAX_RAW_RESUME_LENGTH) : "",
    opportunityId: clean(body.opportunityId, 80),
    resumeLabel: clean(body.resumeLabel, 180) || "Untitled resume"
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
    scoringVersion: clean(analysis.scoringVersion, 80),
    summary: clean(analysis.summary, 1200),
    jobDetails: normalizeJobDetails(analysis.jobDetails),
    jobQualifications: normalizeJobQualifications(analysis.jobQualifications),
    scoreAudit: normalizeScoreAudit(analysis.scoreAudit),
    orchestration: normalizeOrchestration(analysis.orchestration),
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

function normalizeScoreAudit(value) {
  if (!value || typeof value !== "object") return null;
  return {
    verdict: value.verdict === "review" ? "review" : "reasonable",
    confidence: clampNumber(value.confidence, 0, 100),
    expectedMin: clampNumber(value.expectedMin, 0, 100),
    expectedMax: clampNumber(value.expectedMax, 0, 100),
    explanation: clean(value.explanation, 800),
    flags: cleanList(value.flags, 8, 240),
    historicalContext: clean(value.historicalContext, 500)
  };
}

function normalizeOrchestration(value) {
  if (!value || typeof value !== "object") return null;
  return {
    provider: clean(value.provider, 120),
    stages: cleanList(value.stages, 8, 120)
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
    sourceUrl: clean(value.sourceUrl, 1000)
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
  if (!(await hasVerifiedAccess(request, env))) {
    return json({ error: "Sign in with a verified account." }, 401);
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
