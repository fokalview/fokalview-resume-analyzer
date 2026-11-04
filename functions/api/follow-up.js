import { tableColumns } from "./ids.js";

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
    const email = normalizeEmail(body.email);
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error("Enter a valid email address.");
    const phone = clean(body.phone, 80);
    const emailDomain = domainFromEmail(email);
    const emailDomainType = classifyEmailDomain(emailDomain);
    const now = new Date().toISOString();
    const columns = await tableColumns(env.DB, "waitlist_followups");
    if (!["email", "phone", "response_details_json"].every((column) => columns.has(column))) {
      return json({ error: "Contact storage is not ready. Apply migration 0019_waitlist_contact_details.sql before accepting follow-ups." }, 503);
    }
    const responseDetails = {
      email,
      phone,
      currentStatus: clean(body.currentStatus, 160),
      applicationCount: clampInteger(body.applicationCount, 0, 999),
      interviewCount: clampInteger(body.interviewCount, 0, 999),
      offerCount: clampInteger(body.offerCount, 0, 999),
      placementStatus: clean(body.placementStatus, 120),
      currentRole: clean(body.currentRole, 180),
      currentIndustry: clean(body.currentIndustry, 120),
      salaryRange: clean(body.salaryRange, 120),
      employer: clean(body.employer, 180),
      jobTitle: clean(body.jobTitle, 180),
      salaryAmount: clampOptionalInteger(body.salaryAmount, 0, 10000000),
      salaryPeriod: clean(body.salaryPeriod, 80) || "Annual",
      outcomeDate: clean(body.outcomeDate, 40),
      jobLocation: clean(body.jobLocation, 180),
      dataSource: clean(body.dataSource, 120) || "Self-reported follow-up",
      verificationStatus: clean(body.verificationStatus, 120) || "Self-reported",
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
          clampInteger(body.applicationCount, 0, 999),
          clampInteger(body.interviewCount, 0, 999),
          clampInteger(body.offerCount, 0, 999),
          clean(body.placementStatus, 120),
          clean(body.currentRole, 180),
          clean(body.currentIndustry, 120),
          clean(body.salaryRange, 120),
          clean(body.employer, 180),
          clean(body.jobTitle, 180),
          clampOptionalInteger(body.salaryAmount, 0, 10000000),
          clean(body.salaryPeriod, 80) || "Annual",
          clean(body.outcomeDate, 40),
          clean(body.jobLocation, 180),
          clean(body.dataSource, 120) || "Self-reported follow-up",
          clean(body.verificationStatus, 120) || "Self-reported",
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
        clampInteger(body.applicationCount, 0, 999),
        clampInteger(body.interviewCount, 0, 999),
        clampInteger(body.offerCount, 0, 999),
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

function clampInteger(value, min, max) {
  const number = Number.parseInt(String(value || 0), 10);
  if (Number.isNaN(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function clampOptionalInteger(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number.parseInt(String(value).replace(/[$,]/g, ""), 10);
  if (Number.isNaN(number)) return null;
  return Math.min(max, Math.max(min, number));
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}
