import { tableColumns } from "./ids.js";
import { buildSignupGroups, matchResponse } from "../lib/contact-cohort.js";
import { validateFormPayload } from "../lib/form-payload.js";

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
    validateFormPayload(body);
    const email = normalizeEmail(body.email);
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Enter a valid email address.");
    const phone = clean(body.phone, 80);
    const identity = { email, leadId: clean(body.leadId, 80), candidateId: clean(body.candidateId, 80), contactId: clean(body.contactId, 80) };
    if (!Object.values(identity).some(Boolean)) throw new Error('Enter your email or a reference ID so this response can be identified.');
    for (const field of ['leadId', 'candidateId', 'contactId']) {
      if (identity[field] && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(identity[field])) throw new Error('Check your reference IDs, or use your email instead.');
    }
    const salaryCurrency = clean(body.salaryCurrency, 20).toUpperCase();
    if (salaryCurrency && !/^[A-Z]{3}$/.test(salaryCurrency)) throw new Error('Enter a 3-letter salary currency code, such as USD or EUR.');
    const emailDomain = domainFromEmail(email);
    const emailDomainType = classifyEmailDomain(emailDomain);
    const now = new Date().toISOString();
    const columns = await tableColumns(env.DB, "waitlist_followups");
    if (!["email", "phone", "response_details_json"].every((column) => columns.has(column))) {
      return json({ error: "Contact storage is not ready. Apply migration 0019_waitlist_contact_details.sql before accepting follow-ups." }, 503);
    }
    const signupColumns = await tableColumns(env.DB, 'waitlist_signups');
    const identitySelect = [['lead_id','leadId'],['candidate_id','candidateId'],['contact_id','contactId'],['email','email'],['email_hash','legacySignupHash']]
      .map(([column, alias]) => `${signupColumns.has(column) ? column : "''"} AS ${alias}`).join(', ');
    const savedSignups = await env.DB.prepare(`SELECT id, ${identitySelect} FROM waitlist_signups`).all();
    if (matchResponse(identity, buildSignupGroups(savedSignups.results || [])).status === 'needs_review') {
      throw new Error('The supplied contact references do not agree. Check your email and reference IDs before submitting.');
    }
    const responseDetails = {
      formVersion: clean(body.formVersion, 80) || 'legacy-client',
      originalAnswers: body,
      ...identity,
      email,
      phone,
      currentStatus: clean(body.currentStatus, 160),
      applicationCount: strictCount(body.applicationCount, 'Application count'),
      interviewCount: strictCount(body.interviewCount, 'Interview count'),
      offerCount: strictCount(body.offerCount, 'Offer count'),
      placementStatus: clean(body.placementStatus, 120),
      currentRole: clean(body.currentRole, 180),
      currentIndustry: clean(body.currentIndustry, 120),
      currentIndustryOther: clean(body.currentIndustryOther, 240),
      salaryRange: clean(body.salaryRange, 120),
      employer: clean(body.employer, 180),
      jobTitle: clean(body.jobTitle, 180),
      salaryAmount: strictSalary(body.salaryAmount),
      salaryValueOriginal: clean(body.salaryAmount, 80),
      salaryCurrency,
      salaryPeriod: clean(body.salaryPeriod, 80),
      outcomeDate: clean(body.outcomeDate, 40),
      jobLocation: clean(body.jobLocation, 180),
      dataSource: clean(body.dataSource, 120) || "Self-reported follow-up",
      verificationStatus: "Self-reported",
      verificationClaim: clean(body.verificationStatus, 120) || "Self-reported",
      verificationEvidenceStatus: 'Unverified self-report',
      supportNeeded: clean(body.supportNeeded, 1200),
      notes: clean(body.notes, 1600),
      source: clean(body.source, 120) || "public_follow_up"
    };

    if (columns.has("salary_amount")) {
      await env.DB.prepare(
        `INSERT INTO waitlist_followups (
          id, lead_id, candidate_id, contact_id, email_hash, email_domain, email_domain_type,
          current_status, application_count, interview_count, offer_count, placement_status,
          current_role, current_industry, salary_range, employer, job_title, salary_amount,
          salary_period, outcome_date, job_location, data_source, verification_status,
          support_needed, notes, source, submitted_at, email, phone, response_details_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          crypto.randomUUID(),
          clean(body.leadId, 80),
          clean(body.candidateId, 80),
          clean(body.contactId, 80),
          email ? await hashEmail(email, env) : "",
          emailDomain,
          emailDomainType,
          clean(body.currentStatus, 160),
          responseDetails.applicationCount ?? 0,
          responseDetails.interviewCount ?? 0,
          responseDetails.offerCount ?? 0,
          clean(body.placementStatus, 120),
          clean(body.currentRole, 180),
          clean(body.currentIndustry, 120),
          clean(body.salaryRange, 120),
          clean(body.employer, 180),
          clean(body.jobTitle, 180),
          responseDetails.salaryAmount,
          responseDetails.salaryPeriod,
          clean(body.outcomeDate, 40),
          clean(body.jobLocation, 180),
          clean(body.dataSource, 120) || "Self-reported follow-up",
          responseDetails.verificationStatus,
          clean(body.supportNeeded, 1200),
          clean(body.notes, 1600),
          clean(body.source, 120) || "public_follow_up",
          now,
          email,
          phone,
          JSON.stringify(responseDetails)
        )
        .run();

      return json({ ok: true, submittedAt: now });
    }

    await env.DB.prepare(
      `INSERT INTO waitlist_followups (
        id, lead_id, candidate_id, contact_id, email_hash, email_domain, email_domain_type,
        current_status, application_count, interview_count, offer_count, placement_status,
        current_role, current_industry, salary_range, support_needed, notes, source, submitted_at, email, phone, response_details_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        clean(body.leadId, 80),
        clean(body.candidateId, 80),
        clean(body.contactId, 80),
        email ? await hashEmail(email, env) : "",
        emailDomain,
        emailDomainType,
        clean(body.currentStatus, 160),
        responseDetails.applicationCount ?? 0,
        responseDetails.interviewCount ?? 0,
        responseDetails.offerCount ?? 0,
        clean(body.placementStatus, 120),
        clean(body.currentRole, 180),
        clean(body.currentIndustry, 120),
        clean(body.salaryRange, 120),
        clean(body.supportNeeded, 1200),
        clean(body.notes, 1600),
        clean(body.source, 120) || "public_follow_up",
        now,
        email,
        phone,
        JSON.stringify(responseDetails)
      )
      .run();

    return json({ ok: true, submittedAt: now });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not save follow-up." }, 400);
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

async function hashEmail(email, env) {
  const salt = env.APPLICATION_SYNC_SALT || env.BETA_ACCESS_CODE || "fokalview";
  const bytes = new TextEncoder().encode(`${salt}:follow-up:${email}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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

function clean(value, maxLength) {
  const next = String(value ?? "").trim();
  if (next.length > maxLength) throw new Error(`A response exceeds the ${maxLength}-character limit. Shorten it before submitting.`);
  return next;
}

function strictCount(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > 999) {
    throw new Error(`${label} must be a whole number from 0 to 999, or left blank if unknown.`);
  }
  return Number(text);
}

function strictSalary(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim();
  const number = Number(text);
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text) || !Number.isFinite(number) || number < 0 || number > 10000000) {
    throw new Error('Salary amount must be a number from 0 to 10000000 with up to two decimal places, or left blank.');
  }
  return number;
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
