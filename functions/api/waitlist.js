import { nextPlatformId, tableColumns } from "./ids.js";

const PERSONAL_DOMAINS = new Set([
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
]);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  try {
    const body = await request.json();
    const record = await normalizeSignup(body, request, env);
    const now = new Date().toISOString();
    const columns = await tableColumns(env.DB, "waitlist_signups");

    if (columns.has("lead_id")) {
      await insertExtendedSignup(env.DB, record, now);
    } else {
      await insertBasicSignup(env.DB, record, now);
    }

    return json({ ok: true, id: record.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not join waitlist." }, 400);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

async function normalizeSignup(body, request, env) {
  const email = normalizeEmail(body.email);
  if (!email || !isValidEmail(email)) throw new Error("Enter a valid email address.");

  const emailDomain = domainFromEmail(email);
  const emailDomainType = classifyEmailDomain(emailDomain);
  const countryFromEdge = cleanCountry(request.headers.get("CF-IPCountry"));

  const ids = await buildSignupIds(env.DB, body);
  const scoring = scoreLead(body);

  return {
    id: crypto.randomUUID(),
    ...ids,
    name: clean(body.name, 120, true),
    emailHash: await hashEmail(email, env),
    emailDomain: emailDomainType === "personal" ? "personal_email" : emailDomain,
    emailDomainType,
    organization: clean(body.organization, 180),
    organizationType: clean(body.organizationType, 80),
    role: clean(body.role, 120),
    city: clean(body.city, 120),
    state: clean(body.state, 80),
    country: clean(body.country, 80) || countryFromEdge,
    linkedinUrl: cleanUrl(body.linkedinUrl),
    biggestChallenge: clean(body.biggestChallenge, 1200),
    currentTools: clean(body.currentTools, 800),
    desiredFeatures: clean(body.desiredFeatures, 1200),
    interviewInterest: body.interviewInterest === true,
    betaInterest: body.betaInterest === true,
    pilotInterest: body.pilotInterest === true,
    budgetInterest: body.budgetInterest === true,
    userType: clean(body.userType, 80) || "Institution / Program Leader",
    referralSource: clean(body.referralSource, 80) || "Direct",
    buyingAuthority: clean(body.buyingAuthority, 80),
    timeline: clean(body.timeline, 80),
    source: clean(body.source, 120) || "waitlist",
    ...scoring
  };
}

async function buildSignupIds(db, body) {
  const hasOrganization = Boolean(clean(body.organization, 180));
  const userType = clean(body.userType, 80).toLowerCase();
  const isCandidate = ["individual", "student", "job seeker"].some((term) => userType.includes(term));

  return {
    leadId: await nextPlatformId(db, "lead"),
    contactId: await nextPlatformId(db, "contact"),
    organizationId: hasOrganization ? await nextPlatformId(db, "organization") : "",
    candidateId: isCandidate ? await nextPlatformId(db, "candidate") : ""
  };
}

async function insertBasicSignup(db, record, now) {
  await db.prepare(
    `INSERT INTO waitlist_signups (
      id, name, email_hash, email_domain, email_domain_type, organization, organization_type,
      role, city, state, country, linkedin_url, biggest_challenge, current_tools,
      desired_features, interview_interest, beta_interest, pilot_interest, budget_interest,
      source, status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?)`
  )
    .bind(
      record.id,
      record.name,
      record.emailHash,
      record.emailDomain,
      record.emailDomainType,
      record.organization,
      record.organizationType,
      record.role,
      record.city,
      record.state,
      record.country,
      record.linkedinUrl,
      record.biggestChallenge,
      record.currentTools,
      record.desiredFeatures,
      record.interviewInterest ? 1 : 0,
      record.betaInterest ? 1 : 0,
      record.pilotInterest ? 1 : 0,
      record.budgetInterest ? 1 : 0,
      record.source,
      now,
      now
    )
    .run();
}

async function insertExtendedSignup(db, record, now) {
  await db.prepare(
    `INSERT INTO waitlist_signups (
      id, lead_id, contact_id, organization_id, candidate_id, name, email_hash,
      email_domain, email_domain_type, organization, organization_type, user_type, role,
      city, state, country, linkedin_url, biggest_challenge, current_tools, desired_features,
      interview_interest, beta_interest, pilot_interest, budget_interest, source, referral_source,
      buying_authority, timeline, lead_score, lead_priority, recommended_action, score_breakdown_json,
      status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?)`
  )
    .bind(
      record.id,
      record.leadId,
      record.contactId,
      record.organizationId,
      record.candidateId,
      record.name,
      record.emailHash,
      record.emailDomain,
      record.emailDomainType,
      record.organization,
      record.organizationType,
      record.userType,
      record.role,
      record.city,
      record.state,
      record.country,
      record.linkedinUrl,
      record.biggestChallenge,
      record.currentTools,
      record.desiredFeatures,
      record.interviewInterest ? 1 : 0,
      record.betaInterest ? 1 : 0,
      record.pilotInterest ? 1 : 0,
      record.budgetInterest ? 1 : 0,
      record.source,
      record.referralSource,
      record.buyingAuthority,
      record.timeline,
      record.leadScore,
      record.leadPriority,
      record.recommendedAction,
      JSON.stringify(record.scoreBreakdown),
      now,
      now
    )
    .run();
}

function scoreLead(body) {
  const factors = [];
  let score = 0;

  const add = (label, points) => {
    if (!points) return;
    factors.push({ label, points });
    score += points;
  };

  const authority = clean(body.buyingAuthority, 80).toLowerCase();
  if (authority.includes("decision")) add("Decision Maker", 30);
  else if (authority.includes("budget")) add("Budget Influencer", 20);
  else if (authority.includes("evaluator")) add("Evaluator", 15);
  else if (authority.includes("recommender")) add("Recommender", 10);
  else if (authority.includes("research")) add("Researching", 5);

  const timeline = clean(body.timeline, 80).toLowerCase();
  if (timeline.includes("immediate")) add("Timeline: Immediately", 20);
  else if (timeline.includes("3")) add("Timeline: Within 3 months", 15);
  else if (timeline.includes("6")) add("Timeline: Within 6 months", 10);
  else if (timeline.includes("12")) add("Timeline: Within 12 months", 5);

  if (body.pilotInterest === true) add("Pilot Interest", 20);
  if (body.interviewInterest === true) add("Discovery Call Interest", 10);
  if (body.budgetInterest === true && !authority.includes("budget") && !authority.includes("decision")) {
    add("Budget Signal", 10);
  }

  const role = clean(body.role, 120).toLowerCase();
  if (["director", "dean", "workforce", "vr program", "hr leader"].some((term) => role.includes(term))) {
    add("Leadership Role", 10);
  } else if (role.includes("advisor") || role.includes("counselor")) {
    add("Advisor Role", 5);
  }

  score = Math.min(100, score);
  return {
    leadScore: score,
    leadPriority: priorityForScore(score),
    recommendedAction: actionForScore(score),
    scoreBreakdown: factors
  };
}

function priorityForScore(score) {
  if (score >= 90) return "Critical";
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  if (score >= 25) return "Low";
  return "Very Low";
}

function actionForScore(score) {
  if (score >= 90) return "Contact within 24 hours";
  if (score >= 75) return "Contact within 3 days";
  if (score >= 50) return "Contact within 7 days";
  if (score >= 25) return "Add to nurture sequence";
  return "Monitor";
}

async function hashEmail(email, env) {
  const salt = env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE || "fokalview";
  const bytes = new TextEncoder().encode(`${salt}:waitlist:${email}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function domainFromEmail(email) {
  const parts = email.split("@");
  const domain = parts.length === 2 ? parts[1] : "";
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain : "";
}

function classifyEmailDomain(domain) {
  if (!domain) return "";
  if (domain.endsWith(".edu")) return "education";
  if (PERSONAL_DOMAINS.has(domain)) return "personal";
  return "organization";
}

function clean(value, maxLength, required = false) {
  const next = String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  if (required && !next) throw new Error("Name is required.");
  return next;
}

function cleanUrl(value) {
  const url = clean(value, 1000);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function cleanCountry(value) {
  const country = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : "";
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
