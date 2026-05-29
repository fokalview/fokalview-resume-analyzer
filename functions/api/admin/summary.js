export async function onRequestGet({ request, env }) {
  const auth = requireAdminAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const [resumeRows, applicationRows] = await Promise.all([
    env.DB.prepare(
      `SELECT target_role AS targetRole, profile_json AS profileJson,
        analysis_json AS analysisJson, raw_resume_retained AS rawResumeRetained,
        captured_at AS capturedAt
       FROM resume_records
       ORDER BY captured_at DESC
       LIMIT 1000`
    ).all(),
    env.DB.prepare(
      `SELECT title, company, status, source, captured_at AS capturedAt
       FROM application_captures
       ORDER BY captured_at DESC
       LIMIT 1000`
    ).all()
  ]);

  const resumes = (resumeRows.results || []).map(parseResumeRow).filter(Boolean);
  const applications = applicationRows.results || [];

  return json({
    totals: {
      resumeRecords: resumes.length,
      applicationCaptures: applications.length,
      rawResumeRecords: resumes.filter((item) => item.rawResumeRetained).length,
      averageReadinessScore: average(resumes.map((item) => item.analysis.score))
    },
    careerLevels: countBy(resumes.map((item) => item.profile.careerLevel || "Unknown")),
    targetRoles: topCounts(resumes.map((item) => item.targetRole).filter(Boolean), 12),
    topSkills: topCounts(resumes.flatMap((item) => item.profile.skills.technical), 20),
    topTools: topCounts(resumes.flatMap((item) => item.profile.skills.tools), 20),
    commonSkillGaps: topCounts(
      resumes.flatMap((item) => item.analysis.keywordAnalysis.missing),
      20
    ),
    applicationStatuses: countBy(applications.map((item) => item.status || "Unknown")),
    applicationSources: topCounts(applications.map((item) => item.source).filter(Boolean), 12),
    readinessBands: {
      "0-49": resumes.filter((item) => item.analysis.score < 50).length,
      "50-69": resumes.filter((item) => item.analysis.score >= 50 && item.analysis.score < 70).length,
      "70-84": resumes.filter((item) => item.analysis.score >= 70 && item.analysis.score < 85).length,
      "85-100": resumes.filter((item) => item.analysis.score >= 85).length
    },
    recentResumeRecords: resumes.slice(0, 20).map((item) => ({
      targetRole: item.targetRole,
      currentTitle: item.profile.currentTitle,
      careerLevel: item.profile.careerLevel,
      score: item.analysis.score,
      capturedAt: item.capturedAt,
      rawResumeRetained: item.rawResumeRetained
    }))
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "X-Admin-Access-Code"
    }
  });
}

function requireAdminAccess(request, env) {
  const adminCode = env.ADMIN_ACCESS_CODE || "";
  const ownerCode = env.OWNER_ACCESS_CODE || "";
  const suppliedCode = request.headers.get("X-Admin-Access-Code") || "";

  if (!adminCode && !ownerCode) {
    return json({ error: "Admin access is not configured." }, 503);
  }

  if (suppliedCode && (suppliedCode === adminCode || suppliedCode === ownerCode)) {
    return null;
  }

  return json({ error: "Invalid admin access code." }, 401);
}

function parseResumeRow(row) {
  try {
    return {
      targetRole: row.targetRole || "",
      profile: JSON.parse(row.profileJson),
      analysis: JSON.parse(row.analysisJson),
      rawResumeRetained: Boolean(row.rawResumeRetained),
      capturedAt: row.capturedAt
    };
  } catch {
    return null;
  }
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function countBy(values) {
  return values.reduce((counts, value) => {
    const key = value || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function topCounts(values, limit) {
  return Object.entries(countBy(values))
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
