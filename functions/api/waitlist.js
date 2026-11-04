import { nextPlatformId, tableColumns } from "./ids.js";
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

const ORGANIZATION_USER_TYPES = new Set([
  "Career Counselor / Advisor",
  "Institution / Program Leader",
  "Workforce / Gov / Nonprofit",
  "Employer / Hiring Partner"
]);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  try {
    const body = await request.json();
    validateFormPayload(body);
    const columns = await tableColumns(env.DB, "waitlist_signups");
    if (!["email", "phone", "intake_details_json"].every((column) => columns.has(column))) {
      return json({ error: "Contact storage is not ready. Apply migration 0019_waitlist_contact_details.sql before accepting signups." }, 503);
    }
    const record = await normalizeSignup(body, request, env);
    const { id, leadId, contactId, organizationId, candidateId, emailHash, ...intakeDetails } = record;
    record.intakeDetails = { ...intakeDetails, formVersion: clean(body.formVersion, 80) || 'legacy-client', originalAnswers: body };
    const now = new Date().toISOString();

    if (columns.has("school_name") && columns.has("program_name")) {
      await insertAcademicSignup(env.DB, record, now);
    } else if (columns.has("program_name")) {
      await insertInstitutionalSignup(env.DB, record, now);
    } else if (columns.has("workforce_region")) {
      await insertResearchSignup(env.DB, record, now);
    } else if (columns.has("branch_profile_json")) {
      await insertBranchedSignup(env.DB, record, now);
    } else if (columns.has("lead_id")) {
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
  body = normalizeActiveBranch(body);
  const userType = clean(body.userType, 80) || "Institution / Program Leader";
  const organization = clean(body.organization, 180);
  if (ORGANIZATION_USER_TYPES.has(userType) && !organization) {
    throw new Error(userType === "Employer / Hiring Partner" ? "Enter your company name." : "Enter your organization name.");
  }
  const gpa = cleanGpa(body.gpa);
  const email = normalizeEmail(body.email);
  if (!email || email.length > 254 || !isValidEmail(email)) throw new Error("Enter a valid email address.");
  const phone = clean(body.phone, 80);
  const preferredContactMethod = clean(body.preferredContactMethod, 80);
  const linkedinUrl = cleanLinkedInUrl(body.linkedinUrl);
  if (preferredContactMethod === "Phone" && !phone) throw new Error("Enter a phone number for your preferred contact method.");
  if (preferredContactMethod === "LinkedIn" && !linkedinUrl) throw new Error("Enter your LinkedIn profile URL so we can contact you there.");

  const emailDomain = domainFromEmail(email);
  const emailDomainType = classifyEmailDomain(emailDomain);
  const countryFromEdge = cleanCountry(request.headers.get("CF-IPCountry"));
  const location = deriveLocation(body, countryFromEdge);

  const ids = await buildSignupIds(env.DB, body);
  const scoring = scoreLead(body);

  return {
    id: crypto.randomUUID(),
    ...ids,
    name: clean(body.name, 120, true),
    email,
    phone,
    emailHash: await hashEmail(email, env),
    emailDomain,
    emailDomainType,
    organization,
    organizationType: clean(body.organizationType, 80),
    role: clean(body.role, 120),
    city: clean(body.city, 120),
    state: location.state,
    country: location.country,
    linkedinUrl,
    zipPostal: location.zipPostal,
    county: location.county,
    metroArea: location.metroArea,
    workforceRegion: location.workforceRegion,
    preferredContactMethod,
    biggestChallenge: clean(body.biggestChallenge, 1200),
    currentTools: clean(body.currentTools, 800),
    desiredFeatures: clean(body.desiredFeatures, 1200),
    interviewInterest: body.interviewInterest === true,
    betaInterest: body.betaInterest === true,
    pilotInterest: body.pilotInterest === true,
    budgetInterest: body.budgetInterest === true,
    userType,
    referralSource: clean(body.referralSource, 80),
    buyingAuthority: clean(body.buyingAuthority, 80),
    timeline: clean(body.timeline, 80),
    branchStatus: branchStatus(body),
    targetRole: clean(body.targetRole, 180),
    targetIndustry: clean(body.targetIndustry, 120),
    experienceLevel: clean(body.experienceLevel, 80),
    programName: clean(userType === 'Student' ? (body.degreeProgram || body.programName) : (body.programName || body.programType), 180),
    majorField: clean(body.majorField, 180),
    schoolName: clean(body.schoolName || (userType === 'Student' ? body.organization : ''), 180),
    gpa,
    certifications: clean(body.certifications, 1200),
    degreeLevel: clean(body.degreeLevel || body.studentType, 120),
    classYear: clean(body.expectedGraduationYear || body.classYear, 40),
    studentStatus: clean(body.careerStage || body.studentStatus, 120),
    seekingStatus: clean(body.currentStatus || body.seekingStatus, 120),
    domesticInternational: clean(body.domesticInternational, 80),
    currentProcess: clean(body.currentProcess, 120),
    populationServed: clean(body.populationServed, 80),
    reportingWish: clean(body.reportingWish, 1600),
    branchProfile: buildBranchProfile(body, location),
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
      source, status, created_at, updated_at, email, phone, intake_details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`
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
      now,
      record.email,
      record.phone,
      JSON.stringify(record.intakeDetails)
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
      status, created_at, updated_at, email, phone, intake_details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`
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
      now,
      record.email,
      record.phone,
      JSON.stringify(record.intakeDetails)
    )
    .run();
}

async function insertBranchedSignup(db, record, now) {
  await db.prepare(
    `INSERT INTO waitlist_signups (
      id, lead_id, contact_id, organization_id, candidate_id, name, email_hash,
      email_domain, email_domain_type, organization, organization_type, user_type, role,
      city, state, country, zip_postal, preferred_contact_method, linkedin_url,
      biggest_challenge, current_tools, desired_features, interview_interest,
      beta_interest, pilot_interest, budget_interest, source, referral_source,
      buying_authority, timeline, lead_score, lead_priority, recommended_action,
      score_breakdown_json, branch_status, target_role, target_industry, experience_level,
      current_process, population_served, reporting_wish, branch_profile_json,
      status, created_at, updated_at, email, phone, intake_details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`
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
      record.zipPostal,
      record.preferredContactMethod,
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
      record.branchStatus,
      record.targetRole,
      record.targetIndustry,
      record.experienceLevel,
      record.currentProcess,
      record.populationServed,
      record.reportingWish,
      JSON.stringify(record.branchProfile),
      now,
      now,
      record.email,
      record.phone,
      JSON.stringify(record.intakeDetails)
    )
    .run();
}

async function insertResearchSignup(db, record, now) {
  await db.prepare(
    `INSERT INTO waitlist_signups (
      id, lead_id, contact_id, organization_id, candidate_id, name, email_hash,
      email_domain, email_domain_type, organization, organization_type, user_type, role,
      city, state, country, zip_postal, county, metro_area, workforce_region,
      preferred_contact_method, linkedin_url, biggest_challenge, current_tools,
      desired_features, interview_interest, beta_interest, pilot_interest, budget_interest,
      source, referral_source, buying_authority, timeline, lead_score, lead_priority,
      recommended_action, score_breakdown_json, branch_status, target_role, target_industry,
      experience_level, current_process, population_served, reporting_wish, branch_profile_json,
      status, created_at, updated_at, email, phone, intake_details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`
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
      record.zipPostal,
      record.county,
      record.metroArea,
      record.workforceRegion,
      record.preferredContactMethod,
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
      record.branchStatus,
      record.targetRole,
      record.targetIndustry,
      record.experienceLevel,
      record.currentProcess,
      record.populationServed,
      record.reportingWish,
      JSON.stringify(record.branchProfile),
      now,
      now,
      record.email,
      record.phone,
      JSON.stringify(record.intakeDetails)
    )
    .run();
}

async function insertInstitutionalSignup(db, record, now) {
  await db.prepare(
    `INSERT INTO waitlist_signups (
      id, lead_id, contact_id, organization_id, candidate_id, name, email_hash,
      email_domain, email_domain_type, organization, organization_type, user_type, role,
      city, state, country, zip_postal, county, metro_area, workforce_region,
      preferred_contact_method, linkedin_url, biggest_challenge, current_tools,
      desired_features, interview_interest, beta_interest, pilot_interest, budget_interest,
      source, referral_source, buying_authority, timeline, lead_score, lead_priority,
      recommended_action, score_breakdown_json, branch_status, target_role, target_industry,
      experience_level, program_name, major_field, degree_level, class_year, student_status,
      seeking_status, domestic_international, current_process, population_served, reporting_wish,
      branch_profile_json, status, created_at, updated_at, email, phone, intake_details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`
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
      record.zipPostal,
      record.county,
      record.metroArea,
      record.workforceRegion,
      record.preferredContactMethod,
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
      record.branchStatus,
      record.targetRole,
      record.targetIndustry,
      record.experienceLevel,
      record.programName,
      record.majorField,
      record.degreeLevel,
      record.classYear,
      record.studentStatus,
      record.seekingStatus,
      record.domesticInternational,
      record.currentProcess,
      record.populationServed,
      record.reportingWish,
      JSON.stringify(record.branchProfile),
      now,
      now,
      record.email,
      record.phone,
      JSON.stringify(record.intakeDetails)
    )
    .run();
}

async function insertAcademicSignup(db, record, now) {
  await db.prepare(
    `INSERT INTO waitlist_signups (
      id, lead_id, contact_id, organization_id, candidate_id, name, email_hash,
      email_domain, email_domain_type, organization, organization_type, user_type, role,
      city, state, country, zip_postal, county, metro_area, workforce_region,
      preferred_contact_method, linkedin_url, biggest_challenge, current_tools,
      desired_features, interview_interest, beta_interest, pilot_interest, budget_interest,
      source, referral_source, buying_authority, timeline, lead_score, lead_priority,
      recommended_action, score_breakdown_json, branch_status, target_role, target_industry,
      experience_level, program_name, major_field, school_name, gpa, certifications, degree_level,
      class_year, student_status, seeking_status, domestic_international, current_process,
      population_served, reporting_wish, branch_profile_json, status, created_at, updated_at, email, phone, intake_details_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?)`
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
      record.zipPostal,
      record.county,
      record.metroArea,
      record.workforceRegion,
      record.preferredContactMethod,
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
      record.branchStatus,
      record.targetRole,
      record.targetIndustry,
      record.experienceLevel,
      record.programName,
      record.majorField,
      record.schoolName,
      record.gpa,
      record.certifications,
      record.degreeLevel,
      record.classYear,
      record.studentStatus,
      record.seekingStatus,
      record.domesticInternational,
      record.currentProcess,
      record.populationServed,
      record.reportingWish,
      JSON.stringify(record.branchProfile),
      now,
      now,
      record.email,
      record.phone,
      JSON.stringify(record.intakeDetails)
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

function normalizeActiveBranch(input) {
  const body = { ...input };
  const branch = String(body.userType || 'Institution / Program Leader');
  const people = ['Individual Job Seeker', 'Student'];
  const organizations = [...ORGANIZATION_USER_TYPES];
  const sharedOrg = ['Career Counselor / Advisor','Institution / Program Leader','Workforce / Gov / Nonprofit'];
  const fields = [
    [['currentStatus','experienceLevel','currentIncomeRange','individualChallenges','individualTools','individualChallengesOther','individualToolsOther'], ['Individual Job Seeker']],
    [['studentType','degreeProgram','majorField','schoolName','gpa','certifications','degreeLevel','expectedGraduationYear','domesticInternational','careerStage','studentChallenges','studentTools','studentChallengesOther','studentToolsOther'], ['Student']],
    [['targetRole','targetIndustry','targetIndustryOther','minimumSalary','targetSalary','dreamSalary','salaryExpectationCurrency','salaryExpectationPeriod'], people],
    [['organizationType','organizationTypeOther','populationServed','currentProcess'], sharedOrg],
    [['operationalChallenges','operationalChallengesOther','reportingWish'], sharedOrg],
    [['primaryPopulation','primaryPopulationOther'], ['Career Counselor / Advisor','Workforce / Gov / Nonprofit']],
    [['geographicReach','advisingStaffCount'], ['Institution / Program Leader']],
    [['programType','fundingSource'], ['Workforce / Gov / Nonprofit']],
    [['companySize','hiringVolume','rolesHiringFor','skillsHardToFind','employerPainPoints','employerInterestTypes','employerPainPointsOther','employerInterestTypesOther'], ['Employer / Hiring Partner']],
    [['buyingAuthority','timeline','pilotInterestLevel','pilotInterest','budgetInterest'], organizations]
  ];
  for (const [names, branches] of fields) if (!branches.includes(branch)) {
    for (const name of names) body[name] = Array.isArray(body[name]) ? [] : typeof body[name] === 'boolean' ? false : '';
  }
  return body;
}

function branchStatus(body) {
  const userType = clean(body.userType, 80);
  if (userType === "Individual Job Seeker") return clean(body.currentStatus, 120);
  if (userType === "Student") return clean(body.careerStage, 120) || clean(body.studentType, 120);
  if (userType === "Employer / Hiring Partner") return clean(body.hiringVolume, 120);
  return clean(body.pilotInterestLevel, 120) || clean(body.currentProcess, 120);
}

function buildBranchProfile(body, location) {
  const userType = clean(body.userType, 80);
  return compactObject({
    userType,
    location,
    currentStatus: clean(body.currentStatus, 160),
    targetRole: clean(body.targetRole, 180),
    targetIndustry: clean(body.targetIndustry, 120),
    experienceLevel: clean(body.experienceLevel, 80),
    currentIncomeRange: clean(body.currentIncomeRange, 120),
    minimumSalary: clean(body.minimumSalary, 120),
    targetSalary: clean(body.targetSalary, 120),
    dreamSalary: clean(body.dreamSalary, 120),
    salaryExpectationCurrency: clean(body.salaryExpectationCurrency, 20),
    salaryExpectationPeriod: clean(body.salaryExpectationPeriod, 80),
    studentType: clean(body.studentType, 120),
    degreeProgram: clean(body.degreeProgram, 180),
    majorField: clean(body.majorField, 180),
    schoolName: clean(body.schoolName || (userType === 'Student' ? body.organization : ''), 180),
    gpa: cleanGpa(body.gpa),
    certifications: clean(body.certifications, 1200),
    degreeLevel: clean(body.degreeLevel, 120),
    expectedGraduationYear: clean(body.expectedGraduationYear, 40),
    domesticInternational: clean(body.domesticInternational, 80),
    careerStage: clean(body.careerStage, 120),
    primaryPopulation: cleanList(body.primaryPopulation, 20, 120),
    currentProcess: clean(body.currentProcess, 120),
    populationServed: clean(body.populationServed, 80),
    reportingWish: clean(body.reportingWish, 1600),
    geographicReach: clean(body.geographicReach, 80),
    advisingStaffCount: clean(body.advisingStaffCount, 80),
    programType: clean(body.programType, 120),
    fundingSource: clean(body.fundingSource, 120),
    companySize: clean(body.companySize, 80),
    hiringVolume: clean(body.hiringVolume, 80),
    rolesHiringFor: clean(body.rolesHiringFor, 800),
    skillsHardToFind: clean(body.skillsHardToFind, 800),
    pilotInterestLevel: clean(body.pilotInterestLevel, 120),
    individualChallenges: cleanList(body.individualChallenges, 20, 160),
    individualTools: cleanList(body.individualTools, 20, 120),
    studentChallenges: cleanList(body.studentChallenges, 20, 160),
    studentTools: cleanList(body.studentTools, 20, 120),
    operationalChallenges: cleanList(body.operationalChallenges, 30, 160),
    employerPainPoints: cleanList(body.employerPainPoints, 20, 160),
    employerInterestTypes: cleanList(body.employerInterestTypes, 20, 160),
    interests: compactObject({
      resumeAnalysis: body.resumeAnalysisInterest === true,
      applicationTracker: body.applicationTrackerInterest === true,
      productUpdates: body.productUpdatesInterest === true,
      feedback: body.feedbackInterest === true,
      interview: body.interviewInterest === true,
      beta: body.betaInterest === true,
      pilot: body.pilotInterest === true,
      budget: body.budgetInterest === true
    })
  });
}

function deriveLocation(body, countryFromEdge) {
  const state = clean(body.state, 80);
  const country = clean(body.country, 80) || countryFromEdge;
  const zipPostal = clean(body.zipPostal, 40);
  return {
    state,
    country,
    zipPostal,
    county: "",
    metroArea: "",
    workforceRegion: deriveWorkforceRegion(country, state)
  };
}

function deriveWorkforceRegion(country, state) {
  const normalizedCountry = String(country || "").trim().toUpperCase();
  let normalizedState = String(state || "").trim().toUpperCase();
  if (!normalizedState) return "";
  if (!["US", "USA", "UNITED STATES"].includes(normalizedCountry)) return normalizedState;
  const stateCodes = {
    ALABAMA:'AL', ALASKA:'AK', ARIZONA:'AZ', ARKANSAS:'AR', CALIFORNIA:'CA', COLORADO:'CO', CONNECTICUT:'CT', DELAWARE:'DE',
    'DISTRICT OF COLUMBIA':'DC', FLORIDA:'FL', GEORGIA:'GA', HAWAII:'HI', IDAHO:'ID', ILLINOIS:'IL', INDIANA:'IN', IOWA:'IA',
    KANSAS:'KS', KENTUCKY:'KY', LOUISIANA:'LA', MAINE:'ME', MARYLAND:'MD', MASSACHUSETTS:'MA', MICHIGAN:'MI', MINNESOTA:'MN',
    MISSISSIPPI:'MS', MISSOURI:'MO', MONTANA:'MT', NEBRASKA:'NE', NEVADA:'NV', 'NEW HAMPSHIRE':'NH', 'NEW JERSEY':'NJ',
    'NEW MEXICO':'NM', 'NEW YORK':'NY', 'NORTH CAROLINA':'NC', 'NORTH DAKOTA':'ND', OHIO:'OH', OKLAHOMA:'OK', OREGON:'OR',
    PENNSYLVANIA:'PA', 'RHODE ISLAND':'RI', 'SOUTH CAROLINA':'SC', 'SOUTH DAKOTA':'SD', TENNESSEE:'TN', TEXAS:'TX', UTAH:'UT',
    VERMONT:'VT', VIRGINIA:'VA', WASHINGTON:'WA', 'WEST VIRGINIA':'WV', WISCONSIN:'WI', WYOMING:'WY'
  };
  normalizedState = stateCodes[normalizedState] || normalizedState;
  const regions = {
    Northeast: ["CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"],
    Midwest: ["IL", "IN", "MI", "OH", "WI", "IA", "KS", "MN", "MO", "NE", "ND", "SD"],
    South: ["DE", "FL", "GA", "MD", "NC", "SC", "VA", "DC", "WV", "AL", "KY", "MS", "TN", "AR", "LA", "OK", "TX"],
    West: ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY", "AK", "CA", "HI", "OR", "WA"]
  };
  const found = Object.entries(regions).find(([, states]) => states.includes(normalizedState));
  return found ? `${found[0]} - ${normalizedState}` : normalizedState;
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === "boolean" || typeof entry === "number") return true;
      return Boolean(entry);
    })
  );
}

function cleanList(value, maxItems, maxLength) {
  if (Array.isArray(value) && value.length > maxItems) throw new Error(`Choose no more than ${maxItems} items per response.`);
  return Array.isArray(value)
    ? value.map((item) => clean(item, maxLength)).filter(Boolean)
    : [];
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
  const next = String(value ?? "").trim();
  if (next.length > maxLength) throw new Error(`A response exceeds the ${maxLength}-character limit. Shorten it before submitting.`);
  if (required && !next) throw new Error("Name is required.");
  return next;
}

function cleanGpa(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(parsed) || parsed < 0 || parsed > 4) {
    throw new Error("Enter a GPA from 0 to 4, or leave it blank.");
  }
  return parsed;
}

function cleanLinkedInUrl(value) {
  const url = clean(value, 1000);
  if (!url) return "";
  const normalized = /^(?:www\.)?linkedin\.com(?=\/|[?#]|$)/i.test(url) ? `https://${url}` : url;
  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    if (!["http:", "https:"].includes(parsed.protocol) ||
      !(hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) ||
      parsed.username || parsed.password) {
      throw new Error("Invalid LinkedIn URL");
    }
    return parsed.toString();
  } catch {
    throw new Error("Enter a valid LinkedIn profile URL, or leave it blank.");
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
