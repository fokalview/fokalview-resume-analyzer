export async function onRequestGet({ request, env }) {
  const auth = requireAdminAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const [resumeRows, applicationRows] = await Promise.all([
    env.DB.prepare(
      `SELECT user_id AS userId, client_hash AS clientHash, target_role AS targetRole, profile_json AS profileJson,
        analysis_json AS analysisJson, raw_resume_retained AS rawResumeRetained,
        captured_at AS capturedAt
       FROM resume_records
       ORDER BY captured_at DESC
       LIMIT 1000`
    ).all(),
    env.DB.prepare(
      `SELECT user_id AS userId, client_hash AS clientHash, title, company, status, source, captured_at AS capturedAt
       FROM application_captures
       ORDER BY captured_at DESC
       LIMIT 1000`
    ).all()
  ]);

  const resumes = (resumeRows.results || []).map(parseResumeRow).filter(Boolean);
  const applications = applicationRows.results || [];
  const readinessThreshold = Number(env.READINESS_THRESHOLD || 85);
  const averageReadinessScore = average(resumes.map((item) => item.analysis.score));
  const uniqueUsers = new Set([
    ...resumes.map((item) => item.userId || item.clientHash),
    ...applications.map((item) => item.userId || item.clientHash)
  ].filter(Boolean)).size;
  const allGapItems = resumes.flatMap((item) => cleanGapItems(item.analysis.keywordAnalysis.missing));

  return json({
    meta: {
      readinessThreshold,
      lastLoadedAt: new Date().toISOString()
    },
    totals: {
      resumeRecords: resumes.length,
      applicationCaptures: applications.length,
      uniqueUsers,
      rawResumeRecords: resumes.filter((item) => item.rawResumeRetained).length,
      averageReadinessScore,
      readinessDelta: averageReadinessScore - readinessThreshold
    },
    systemInfo: {
      rawResumeRecords: resumes.filter((item) => item.rawResumeRetained).length,
      rawResumeRetentionRate: resumes.length
        ? Math.round((resumes.filter((item) => item.rawResumeRetained).length / resumes.length) * 100)
        : 0
    },
    usageByDay: buildUsageByDay(resumes, applications),
    careerLevels: careerLevelCounts(resumes),
    targetRoles: topCounts(resumes.map((item) => item.targetRole).filter(Boolean), 12),
    topSkills: topCounts(resumes.flatMap((item) => item.profile.skills.technical), 20),
    topTools: topCounts(resumes.flatMap((item) => item.profile.skills.tools), 20),
    commonSkillGaps: groupSkillGaps(allGapItems, resumes.length),
    applicationStatuses: countBy(applications.map((item) => item.status || "Unknown")),
    applicationSources: topCounts(applications.map((item) => item.source).filter(Boolean), 12),
    readinessBands: {
      "0-49": resumes.filter((item) => item.analysis.score < 50).length,
      "50-69": resumes.filter((item) => item.analysis.score >= 50 && item.analysis.score < 70).length,
      "70-84": resumes.filter((item) => item.analysis.score >= 70 && item.analysis.score < 85).length,
      "85-100": resumes.filter((item) => item.analysis.score >= 85).length
    },
    recentResumeRecords: resumes.slice(0, 20).map((item) => ({
      candidateId: item.userId || candidateLabel(item.clientHash),
      userId: item.userId,
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
      clientHash: row.clientHash,
      userId: row.userId,
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

function buildUsageByDay(resumes, applications) {
  const days = [];
  const today = new Date();

  for (let index = 13; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    days.push({
      date: key,
      resumes: resumes.filter((item) => dateKey(item.capturedAt) === key).length,
      applications: applications.filter((item) => dateKey(item.capturedAt) === key).length,
      uniqueUsers: new Set(
        [
          ...resumes.filter((item) => dateKey(item.capturedAt) === key).map((item) => item.userId || item.clientHash),
          ...applications.filter((item) => dateKey(item.capturedAt) === key).map((item) => item.userId || item.clientHash)
        ].filter(Boolean)
      ).size
    });
  }

  return days;
}

function dateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function careerLevelCounts(resumes) {
  const counts = countBy(resumes.map((item) => normalizeCareerLevel(item.profile.careerLevel)));
  return ["Entry", "Mid Career", "Senior", "Lead", "Executive"].reduce((nextCounts, level) => {
    nextCounts[level] = counts[level] || 0;
    return nextCounts;
  }, {});
}

function normalizeCareerLevel(value) {
  const level = String(value || "Unknown").toLowerCase();
  if (level.includes("entry") || level.includes("early")) return "Entry";
  if (level.includes("senior")) return "Senior";
  if (level.includes("lead") || level.includes("leadership")) return "Lead";
  if (level.includes("executive")) return "Executive";
  return "Mid Career";
}

function cleanGapItems(values) {
  return values
    .flatMap((value) =>
      String(value || "")
        .split(/[,;\n]+|","|","|"\s*,\s*"/)
        .map((item) => item.replace(/^["'\s]+|["'\s]+$/g, ""))
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function groupSkillGaps(values, totalRecords) {
  const groups = {
    "Technical Skills": [],
    "Domain Knowledge": [],
    "Soft Skills": []
  };

  topCounts(values, 60).forEach((item) => {
    const category = gapCategory(item.label);
    groups[category].push({
      ...item,
      percentAffected: totalRecords ? Math.round((item.count / totalRecords) * 100) : 0
    });
  });

  return groups;
}

function gapCategory(label) {
  const value = label.toLowerCase();
  if (
    ["lte", "bluetooth", "wifi", "wireless", "api", "python", "sql", "cloud", "data", "automation"].some((term) =>
      value.includes(term)
    )
  ) {
    return "Technical Skills";
  }
  if (
    ["communication", "urgency", "team", "leadership", "collaboration", "attitude"].some((term) =>
      value.includes(term)
    )
  ) {
    return "Soft Skills";
  }
  return "Domain Knowledge";
}

function candidateLabel(hash) {
  return hash ? `Candidate ${hash.slice(0, 6).toUpperCase()}` : "Candidate";
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
