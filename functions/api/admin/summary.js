import { tableColumns } from "../ids.js";

export async function onRequestGet({ request, env }) {
  const auth = requireAdminAccess(request, env);
  if (auth) return auth;

  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  try {
    return await buildSummary(request, env);
  } catch {
    return json({ error: "Dashboard data could not be loaded. Your previous data has not been replaced.", sourceErrors: ["dashboard"] }, 503);
  }
}

async function buildSummary(request, env) {
  const query = new URL(request.url).searchParams.get("q") || "";
  const [userColumns, resumeColumns, applicationColumns, waitlistColumns, followupColumns, eventColumns] = await Promise.all([
    tableColumns(env.DB, "users"),
    tableColumns(env.DB, "resume_records"),
    tableColumns(env.DB, "application_captures"),
    tableColumns(env.DB, "waitlist_signups"),
    tableColumns(env.DB, "waitlist_followups"),
    tableColumns(env.DB, "user_events")
  ]);
  const hasUserMetadata =
    userColumns.has("email_domain") && userColumns.has("email_domain_type") && userColumns.has("country");
  const userSelect = hasUserMetadata
    ? `u.email_domain AS emailDomain, u.email_domain_type AS emailDomainType, u.country AS country,
       ${userColumns.has("candidate_id") ? "u.candidate_id" : "''"} AS candidateId`
    : "'' AS emailDomain, '' AS emailDomainType, '' AS country, '' AS candidateId";
  const userJoin = "LEFT JOIN users u ON u.id = r.user_id";
  const appUserJoin = "LEFT JOIN users u ON u.id = a.user_id";
  const reportIdSelect = resumeColumns.has("report_id") ? "r.report_id AS reportId," : "'' AS reportId,";
  const applicationIdSelect = applicationColumns.has("application_id")
    ? "a.application_id AS applicationId,"
    : "'' AS applicationId,";
  const waitlistContactSelect = `${contactSelect(waitlistColumns, "legacySignupHash")},
    ${waitlistColumns.has("intake_details_json") ? "intake_details_json" : "NULL"} AS intakeDetailsJson,
    linkedin_url AS linkedinUrl, biggest_challenge AS biggestChallenge,
    current_tools AS currentTools, desired_features AS desiredFeatures, updated_at AS updatedAt,`;
  const waitlistSelect = waitlistColumns.has("lead_id")
    ? `${waitlistContactSelect} id, lead_id AS leadId, contact_id AS contactId, organization_id AS organizationId,
       candidate_id AS candidateId, user_type AS userType, name, email_domain AS emailDomain,
       email_domain_type AS emailDomainType, organization, organization_type AS organizationType,
       role, city, state, country, interview_interest AS interviewInterest,
       beta_interest AS betaInterest, pilot_interest AS pilotInterest, budget_interest AS budgetInterest,
       source, referral_source AS referralSource, buying_authority AS buyingAuthority, timeline,
       lead_score AS leadScore, lead_priority AS leadPriority, recommended_action AS recommendedAction,
       score_breakdown_json AS scoreBreakdownJson, status, created_at AS createdAt,
       ${waitlistColumns.has("zip_postal") ? "zip_postal" : "''"} AS zipPostal,
       ${waitlistColumns.has("county") ? "county" : "''"} AS county,
       ${waitlistColumns.has("metro_area") ? "metro_area" : "''"} AS metroArea,
       ${waitlistColumns.has("workforce_region") ? "workforce_region" : "''"} AS workforceRegion,
       ${waitlistColumns.has("preferred_contact_method") ? "preferred_contact_method" : "''"} AS preferredContactMethod,
       ${waitlistColumns.has("branch_status") ? "branch_status" : "''"} AS branchStatus,
       ${waitlistColumns.has("target_role") ? "target_role" : "''"} AS targetRole,
       ${waitlistColumns.has("target_industry") ? "target_industry" : "''"} AS targetIndustry,
       ${waitlistColumns.has("experience_level") ? "experience_level" : "''"} AS experienceLevel,
       ${waitlistColumns.has("program_name") ? "program_name" : "''"} AS programName,
       ${waitlistColumns.has("major_field") ? "major_field" : "''"} AS majorField,
       ${waitlistColumns.has("school_name") ? "school_name" : "''"} AS schoolName,
       ${waitlistColumns.has("gpa") ? "gpa" : "NULL"} AS gpa,
       ${waitlistColumns.has("certifications") ? "certifications" : "''"} AS certifications,
       ${waitlistColumns.has("degree_level") ? "degree_level" : "''"} AS degreeLevel,
       ${waitlistColumns.has("class_year") ? "class_year" : "''"} AS classYear,
       ${waitlistColumns.has("student_status") ? "student_status" : "''"} AS studentStatus,
       ${waitlistColumns.has("seeking_status") ? "seeking_status" : "''"} AS seekingStatus,
       ${waitlistColumns.has("domestic_international") ? "domestic_international" : "''"} AS domesticInternational,
       ${waitlistColumns.has("current_process") ? "current_process" : "''"} AS currentProcess,
       ${waitlistColumns.has("population_served") ? "population_served" : "''"} AS populationServed,
       ${waitlistColumns.has("reporting_wish") ? "reporting_wish" : "''"} AS reportingWish,
       ${waitlistColumns.has("branch_profile_json") ? "branch_profile_json" : "''"} AS branchProfileJson`
    : `${waitlistContactSelect} id, '' AS leadId, '' AS contactId, '' AS organizationId, '' AS candidateId,
       '' AS userType, name, email_domain AS emailDomain, email_domain_type AS emailDomainType,
       organization, organization_type AS organizationType, role, city, state, country,
       interview_interest AS interviewInterest, beta_interest AS betaInterest, pilot_interest AS pilotInterest,
       budget_interest AS budgetInterest, source, '' AS referralSource, '' AS buyingAuthority,
       '' AS timeline, 0 AS leadScore, '' AS leadPriority, '' AS recommendedAction,
       '' AS scoreBreakdownJson, status, created_at AS createdAt`;

  const followupSelect = followupColumns.has("id")
    ? `id, ${contactSelect(followupColumns, "legacyFollowupHash")},
       ${followupColumns.has("response_details_json") ? "response_details_json" : "NULL"} AS responseDetailsJson,
       notes, source, lead_id AS leadId, candidate_id AS candidateId, contact_id AS contactId,
       email_domain AS emailDomain, email_domain_type AS emailDomainType,
       current_status AS currentStatus, application_count AS applicationCount,
       interview_count AS interviewCount, offer_count AS offerCount,
       placement_status AS placementStatus, current_role AS currentRole,
       current_industry AS currentIndustry, salary_range AS salaryRange,
       ${followupColumns.has("employer") ? "employer" : "''"} AS employer,
       ${followupColumns.has("job_title") ? "job_title" : "''"} AS jobTitle,
       ${followupColumns.has("salary_amount") ? "salary_amount" : "NULL"} AS salaryAmount,
       ${followupColumns.has("salary_period") ? "salary_period" : "''"} AS salaryPeriod,
       ${followupColumns.has("outcome_date") ? "outcome_date" : "''"} AS outcomeDate,
       ${followupColumns.has("job_location") ? "job_location" : "''"} AS jobLocation,
       ${followupColumns.has("data_source") ? "data_source" : "''"} AS dataSource,
       ${followupColumns.has("verification_status") ? "verification_status" : "''"} AS verificationStatus,
       support_needed AS supportNeeded, submitted_at AS submittedAt`
    : "'' AS leadId, '' AS candidateId, '' AS contactId, '' AS emailDomain, '' AS emailDomainType, '' AS currentStatus, 0 AS applicationCount, 0 AS interviewCount, 0 AS offerCount, '' AS placementStatus, '' AS currentRole, '' AS currentIndustry, '' AS salaryRange, '' AS employer, '' AS jobTitle, NULL AS salaryAmount, '' AS salaryPeriod, '' AS outcomeDate, '' AS jobLocation, '' AS dataSource, '' AS verificationStatus, '' AS supportNeeded, '' AS submittedAt";

  const eventSelect = eventColumns.has("event_type")
    ? `user_id AS userId, candidate_id AS candidateId, lead_id AS leadId,
       event_type AS eventType, event_source AS eventSource, page_path AS pagePath,
       session_id AS sessionId, duration_seconds AS durationSeconds, campaign,
       metadata_json AS metadataJson, created_at AS createdAt`
    : "'' AS userId, '' AS candidateId, '' AS leadId, '' AS eventType, '' AS eventSource, '' AS pagePath, '' AS sessionId, 0 AS durationSeconds, '' AS campaign, '{}' AS metadataJson, '' AS createdAt";

  const sourceNames = ["resumes", "applications", "waitlist", "followups", "events"];
  const sourceResults = await Promise.allSettled([
    env.DB.prepare(
      `SELECT ${reportIdSelect} r.id AS recordId, r.user_id AS userId, r.client_hash AS clientHash, r.target_role AS targetRole, r.profile_json AS profileJson,
        r.analysis_json AS analysisJson, r.raw_resume_retained AS rawResumeRetained, r.raw_resume_text AS rawResumeText,
        r.captured_at AS capturedAt, ${userSelect}
       FROM resume_records r
       ${userJoin}
       ORDER BY r.captured_at DESC`
    ).all(),
    env.DB.prepare(
      `SELECT ${applicationIdSelect} a.user_id AS userId, a.client_hash AS clientHash, a.title, a.company, a.status, a.source, a.captured_at AS capturedAt,
        ${userSelect}
       FROM application_captures a
       ${appUserJoin}
       ORDER BY a.captured_at DESC`
    ).all(),
    env.DB.prepare(
      `SELECT ${waitlistSelect}
       FROM waitlist_signups
       ORDER BY created_at DESC`
    ).all(),
    env.DB.prepare(
      `SELECT ${followupSelect}
       FROM waitlist_followups
       ORDER BY submitted_at DESC`
    ).all(),
    eventColumns.has("event_type")
      ? env.DB.prepare(
        `SELECT ${eventSelect}
         FROM user_events
         ORDER BY created_at DESC`
      ).all()
      : Promise.reject(new Error("Session events schema is unavailable."))
  ]);

  const sourceErrors = sourceResults.flatMap((result, index) => result.status === "rejected" || result.value?.success === false ? [sourceNames[index]] : []);
  if (sourceErrors.length) return json({ error: "Dashboard data could not be loaded. Your previous data has not been replaced.", sourceErrors }, 503);
  const [resumeRows, applicationRows, waitlistRows, followupRows, eventRows] = sourceResults.map((result) => result.value);
  const sources = Object.fromEntries(sourceResults.map((result, index) => [sourceNames[index], { status: "available", count: (result.value.results || []).length }]));
  const allResumes = (resumeRows.results || []).map(parseResumeRow).filter(Boolean);
  if (allResumes.length !== (resumeRows.results || []).length) {
    return json({ error: "One or more stored reports could not be read. Your previous data has not been replaced.", sourceErrors: ["resumes"] }, 503);
  }
  const allApplications = applicationRows.results || [];
  const resumes = filterResumes(allResumes, query);
  const applications = filterApplications(allApplications, query);
  const allWaitlist = (waitlistRows.results || []).map((row) => hydrateDetails(row, "intakeDetailsJson"));
  const waitlist = filterWaitlist(allWaitlist, query);
  const allFollowups = (followupRows.results || []).map((row) => hydrateDetails(row, "responseDetailsJson"));
  const followups = filterFollowups(allFollowups, query);
  const globalCohort = buildContactCohort(allWaitlist, allFollowups);
  const respondedSignups = new Set(globalCohort.groups.filter((group) => group.responses.length).flatMap((group) => group.signups));
  const signupGroups = new Map(globalCohort.groups.flatMap((group) => group.signups.map((item) => [item, group])));
  const responseGroups = new Map(globalCohort.groups.flatMap((group) => group.responses.map((item) => [item, group])));
  const serializedFollowups = new Map(allFollowups.map((item) => [item, serializeFollowUp(item, responseGroups.get(item))]));
  const selectedSignupSet = new Set(waitlist);
  const selectedResponseSet = new Set(followups);
  const selectedGroups = globalCohort.groups.filter((group) => group.signups.some((row) => selectedSignupSet.has(row)) || group.responses.some((row) => selectedResponseSet.has(row)));
  const latestFollowups = selectedGroups.filter((group) => group.identifiable && group.responses.length).map((group) => group.latestResponse);
  const waitlistGroups = globalCohort.groups.filter((group) => group.signups.some((row) => selectedSignupSet.has(row)));
  const coverage = { contacts: waitlistGroups.length, responded: waitlistGroups.filter((group) => group.responses.length).length };
  const unlinkedFollowups = selectedGroups.filter((group) => !group.identifiable).reduce((count, group) => count + group.responses.length, 0);
  const events = filterEvents(eventRows.results || [], query);
  const sessionMetrics = buildSessionMetrics(events);
  const readinessThreshold = Number(env.READINESS_THRESHOLD || 85);
  const averageReadinessScore = average(resumes.map((item) => item.analysis.score));
  const followUpTotals = buildFollowUpTotals(latestFollowups);
  const salaryStats = buildSalaryStats(latestFollowups);
  const followUpQueues = buildFollowUpQueues(waitlist, followups, respondedSignups);
  const uniqueUsers = new Set([
    ...resumes.map((item) => item.userId || item.clientHash),
    ...applications.map((item) => item.userId || item.clientHash)
  ].filter(Boolean)).size;
  const allGapItems = resumes.flatMap((item) => [...new Set(cleanGapItems(item.analysis.keywordAnalysis?.missing || []).map((gap) => gap.toLowerCase()))]);
  const decisionSignals = buildDecisionSignals({
    resumes,
    applications,
    waitlist,
    followups: latestFollowups,
    coverage,
    followUpTotals,
    followUpQueues,
    readinessThreshold,
    sessionMetrics
  });

  return json({
    meta: {
      readinessThreshold,
      lastLoadedAt: new Date().toISOString(),
      query: query.trim(),
      recordScope: "All matching records",
      sources,
      reportingMethod: "Outcome totals use the latest response per saved contact identity; response history is retained. Coverage counts distinct waitlist identities with a matched follow-up. Records without usable identity are excluded from respondent rates.",
      waitlistRecordsReturned: waitlist.length,
      followupRecordsReturned: followups.length
    },
    globalTotals: {
      resumeRecords: allResumes.length,
      applicationCaptures: allApplications.length,
      waitlistSignups: allWaitlist.length,
      followUpSurveys: allFollowups.length,
      followUpRespondents: globalCohort.groups.filter((group) => group.identifiable && group.responses.length).length,
      uniqueWaitlistContacts: globalCohort.groups.filter((group) => group.signups.length).length
    },
    salaryByPeriod: salaryStats.byPeriod,
    totals: {
      followUpRespondents: latestFollowups.length,
      unlinkedFollowUpResponses: unlinkedFollowups,
      uniqueWaitlistContacts: coverage.contacts,
      waitlistContactsWithFollowUp: coverage.responded,
      resumeRecords: resumes.length,
      applicationCaptures: applications.length,
      waitlistSignups: waitlist.length,
      interviewVolunteers: waitlist.filter((item) => item.interviewInterest).length,
      pilotProspects: waitlist.filter((item) => item.pilotInterest).length,
      budgetQualified: waitlist.filter((item) => item.budgetInterest).length,
      averageLeadScore: average(waitlist.map((item) => Number(item.leadScore || 0))),
      followUpSurveys: followups.length,
      pendingIntakeFollowUps: followUpQueues.pendingCount,
      completedFollowUps: followUpQueues.completedCount,
      followUpApplications: followUpTotals.applications,
      followUpInterviews: followUpTotals.interviews,
      followUpOffers: followUpTotals.offers,
      followUpPlacements: followUpTotals.placements,
      salaryResponses: salaryStats.count,
      medianSalary: salaryStats.median,
      averageSalary: salaryStats.average,
      salarySummaryCurrency: salaryStats.currency,
      salarySummaryPeriod: salaryStats.period,
      sessions: sessionMetrics.sessions,
      averageSessionSeconds: sessionMetrics.averageSessionSeconds,
      totalSessionMinutes: sessionMetrics.totalSessionMinutes,
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
    applicationEmployers: topCounts(applications.map((item) => item.company).filter(Boolean), 12),
    applicationTitles: topCounts(applications.map((item) => item.title).filter(Boolean), 12),
    waitlistOrganizationTypes: topCounts(waitlist.map((item) => item.organizationType).filter(Boolean), 12),
    waitlistSources: topCounts(waitlist.map((item) => item.source).filter(Boolean), 12),
    waitlistUserTypes: topCounts(waitlist.map((item) => item.userType).filter(Boolean), 12),
    waitlistReferralSources: topCounts(waitlist.map((item) => item.referralSource).filter(Boolean), 12),
    waitlistLeadPriorities: countBy(waitlist.map((item) => item.leadPriority).filter(Boolean)),
    waitlistBranchStatuses: topCounts(waitlist.map((item) => item.branchStatus).filter(Boolean), 12),
    waitlistTargetIndustries: topCounts(waitlist.map((item) => item.targetIndustry).filter(Boolean), 12),
    waitlistCurrentProcesses: topCounts(waitlist.map((item) => item.currentProcess).filter(Boolean), 12),
    waitlistWorkforceRegions: topCounts(waitlist.map((item) => item.workforceRegion).filter(Boolean), 12),
    followUpOutcomes: countBy(latestFollowups.map((item) => item.placementStatus).filter(Boolean)),
    followUpStatuses: countBy(latestFollowups.map((item) => item.currentStatus).filter(Boolean)),
    followUpIndustries: topCounts(latestFollowups.map((item) => item.currentIndustry).filter(Boolean), 12),
    followUpSalaryRanges: topCounts(latestFollowups.map((item) => item.salaryRange).filter(Boolean), 12),
    followUpEmployers: topCounts(latestFollowups.map((item) => item.employer).filter(Boolean), 12),
    followUpJobTitles: topCounts(latestFollowups.map((item) => item.jobTitle || item.currentRole).filter(Boolean), 12),
    followUpVerificationStatuses: topCounts(latestFollowups.map((item) => item.verificationStatus).filter(Boolean), 12),
    sessionSources: topCounts(sessionMetrics.sources, 12),
    sessionPages: topCounts(sessionMetrics.pages, 12),
    sessionCampaigns: topCounts(sessionMetrics.campaigns, 12),
    userEventTypes: countBy(events.map((item) => item.eventType).filter(Boolean)),
    waitlistPrograms: topCounts(waitlist.map((item) => item.programName).filter(Boolean), 12),
    waitlistMajors: topCounts(waitlist.map((item) => item.majorField).filter(Boolean), 12),
    waitlistSchools: topCounts(waitlist.map((item) => item.schoolName || item.organization).filter(Boolean), 12),
    waitlistGpaBands: buildGpaBands(waitlist),
    waitlistCertifications: topCounts(waitlist.flatMap((item) => splitDelimited(item.certifications)), 12),
    waitlistDegreeLevels: topCounts(waitlist.map((item) => item.degreeLevel).filter(Boolean), 12),
    waitlistClassYears: topCounts(waitlist.map((item) => item.classYear).filter(Boolean), 12),
    waitlistStudentStatuses: topCounts(waitlist.map((item) => item.studentStatus).filter(Boolean), 12),
    waitlistSeekingStatuses: topCounts(waitlist.map((item) => item.seekingStatus).filter(Boolean), 12),
    waitlistDomesticInternational: topCounts(waitlist.map((item) => item.domesticInternational).filter(Boolean), 12),
    waitlistLeadScoreBands: buildLeadScoreBands(waitlist),
    waitlistFunnel: buildWaitlistFunnel(waitlist, respondedSignups),
    followUpFunnel: buildFollowUpFunnel(latestFollowups),
    conversionMetrics: buildConversionMetrics(waitlist, latestFollowups, coverage),
    decisionSignals,
    waitlistInterest: {
      Interviews: waitlist.filter((item) => item.interviewInterest).length,
      Beta: waitlist.filter((item) => item.betaInterest).length,
      Pilots: waitlist.filter((item) => item.pilotInterest).length,
      Budget: waitlist.filter((item) => item.budgetInterest).length
    },
    emailDomains: topCounts(resumes.map((item) => item.emailDomain).filter(Boolean), 12),
    emailDomainTypes: countBy(resumes.map((item) => item.emailDomainType).filter(Boolean)),
    countries: topCounts(resumes.map((item) => item.country).filter(Boolean), 12),
    readinessBands: {
      "0-49": resumes.filter((item) => item.analysis.score < 50).length,
      "50-69": resumes.filter((item) => item.analysis.score >= 50 && item.analysis.score < 70).length,
      "70-84": resumes.filter((item) => item.analysis.score >= 70 && item.analysis.score < 85).length,
      "85-100": resumes.filter((item) => item.analysis.score >= 85).length
    },
    recentResumeRecords: resumes.map((item) => ({
      id: item.reportId || item.recordId,
      analysis: item.analysis,
      profile: item.profile,
      candidateId: item.candidateId || item.userId || candidateLabel(item.clientHash),
      systemUserId: item.userId,
      reportId: item.reportId || "",
      userId: item.userId,
      targetRole: item.targetRole,
      currentTitle: item.profile.currentTitle,
      careerLevel: item.profile.careerLevel,
      score: item.analysis.score,
      searchableText: item.searchableText,
      emailDomain: item.emailDomain,
      emailDomainType: item.emailDomainType,
      country: item.country,
      capturedAt: item.capturedAt,
      rawResumeRetained: item.rawResumeRetained
    })),
    recentWaitlistSignups: waitlist.map((item) => ({
      id: item.id,
      linkedFollowUpIds: (signupGroups.get(item)?.responses || []).map((response) => response.id),
      linkedFollowUps: (signupGroups.get(item)?.responses || []).map((response) => serializedFollowups.get(response)),
      ...contactDetails(item),
      linkedinUrl: item.linkedinUrl,
      preferredContactMethod: item.preferredContactMethod,
      city: item.city,
      state: item.state,
      zipPostal: item.zipPostal,
      county: item.county,
      metroArea: item.metroArea,
      biggestChallenge: item.biggestChallenge,
      currentTools: item.currentTools,
      desiredFeatures: item.desiredFeatures,
      experienceLevel: item.experienceLevel,
      source: item.source,
      updatedAt: item.updatedAt,
      intakeDetails: parseJsonObject(item.intakeDetailsJson),
      leadId: item.leadId,
      contactId: item.contactId,
      organizationId: item.organizationId,
      candidateId: item.candidateId,
      name: item.name,
      userType: item.userType,
      organization: item.organization,
      organizationType: item.organizationType,
      role: item.role,
      country: item.country,
      emailDomain: item.emailDomain,
      emailDomainType: item.emailDomainType,
      interviewInterest: Boolean(item.interviewInterest),
      betaInterest: Boolean(item.betaInterest),
      pilotInterest: Boolean(item.pilotInterest),
      budgetInterest: Boolean(item.budgetInterest),
      referralSource: item.referralSource,
      buyingAuthority: item.buyingAuthority,
      timeline: item.timeline,
      branchStatus: item.branchStatus,
      targetRole: item.targetRole,
      targetIndustry: item.targetIndustry,
      programName: item.programName,
      majorField: item.majorField,
      schoolName: item.schoolName,
      gpa: item.gpa === null || item.gpa === undefined || item.gpa === "" ? null : Number(item.gpa),
      certifications: item.certifications,
      degreeLevel: item.degreeLevel,
      classYear: item.classYear,
      studentStatus: item.studentStatus,
      seekingStatus: item.seekingStatus,
      domesticInternational: item.domesticInternational,
      workforceRegion: item.workforceRegion,
      currentProcess: item.currentProcess,
      populationServed: item.populationServed,
      reportingWish: item.reportingWish,
      branchProfile: parseJsonObject(item.branchProfileJson),
      scoreBreakdown: parseJsonObject(item.scoreBreakdownJson),
      leadScore: Number(item.leadScore || 0),
      leadPriority: item.leadPriority,
      recommendedAction: item.recommendedAction,
      status: item.status,
      createdAt: item.createdAt
    })),
    pendingIntakeFollowUps: followUpQueues.pending.map((item) => ({
      id: item.id,
      ...contactDetails(item),
      linkedinUrl: item.linkedinUrl,
      intakeDetails: parseJsonObject(item.intakeDetailsJson),
      leadId: item.leadId,
      candidateId: item.candidateId,
      contactId: item.contactId,
      name: item.name,
      userType: item.userType,
      organization: item.organization,
      role: item.role,
      emailDomain: item.emailDomain,
      emailDomainType: item.emailDomainType,
      targetRole: item.targetRole,
      targetIndustry: item.targetIndustry,
      schoolName: item.schoolName,
      majorField: item.majorField,
      classYear: item.classYear,
      preferredContactMethod: item.preferredContactMethod,
      leadScore: Number(item.leadScore || 0),
      leadPriority: item.leadPriority,
      recommendedAction: item.recommendedAction,
      createdAt: item.createdAt
    })),
    completedFollowUps: followUpQueues.completed.map((item) => serializedFollowups.get(item)),
    recentFollowUps: followups.map((item) => serializedFollowups.get(item))
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

function serializeFollowUp(item, group) {
  return {
    matchedContactName: group?.signups.find((signup) => signup.name)?.name || "",
    matchedSignupIds: (group?.signups || []).map((signup) => signup.id),
    salaryCurrency: item.salaryCurrency || "",
      id: item.id,
      ...contactDetails(item),
      notes: item.notes,
      source: item.source,
      responseDetails: parseJsonObject(item.responseDetailsJson),
      leadId: item.leadId,
      candidateId: item.candidateId,
      contactId: item.contactId,
      emailDomain: item.emailDomain,
      emailDomainType: item.emailDomainType,
      currentStatus: item.currentStatus,
      applicationCount: Number(item.applicationCount || 0),
      interviewCount: Number(item.interviewCount || 0),
      offerCount: Number(item.offerCount || 0),
      placementStatus: item.placementStatus,
      currentRole: item.currentRole,
      currentIndustry: item.currentIndustry,
      salaryRange: item.salaryRange,
      employer: item.employer,
      jobTitle: item.jobTitle,
      salaryAmount: item.salaryAmount === null || item.salaryAmount === undefined || item.salaryAmount === "" ? null : Number(item.salaryAmount),
      salaryPeriod: item.salaryPeriod,
      outcomeDate: item.outcomeDate,
      jobLocation: item.jobLocation,
      dataSource: item.dataSource,
      verificationStatus: item.verificationStatus,
      supportNeeded: item.supportNeeded,
      submittedAt: item.submittedAt

  };
}

function contactSelect(columns, hashAlias) {
  return `${columns.has("email") ? "email" : "NULL"} AS email,
    ${columns.has("phone") ? "phone" : "NULL"} AS phone,
    ${columns.has("email_hash") ? "email_hash" : "NULL"} AS ${hashAlias}`;
}

function contactDetails(item) {
  return {
    email: item.email || "",
    phone: item.phone || "",
    emailStatus: item.email ? "Available" : item.email == null ? "Not retained for this legacy record" : "Not provided"
  };
}

function hydrateDetails(row, key) {
  const details = parseJsonObject(row[key]);
  const result = { ...details };
  for (const [name, value] of Object.entries(row)) {
    if ((value !== null && value !== undefined && value !== "") || !(name in result)) result[name] = value;
  }
  if (!result.branchProfileJson && details.branchProfile) result.branchProfileJson = JSON.stringify(details.branchProfile);
  return result;
}

function parseResumeRow(row) {
  try {
    const parsed = {
      recordId: row.recordId,
      clientHash: row.clientHash,
      userId: row.userId,
      candidateId: row.candidateId || "",
      reportId: row.reportId || "",
      targetRole: row.targetRole || "",
      profile: JSON.parse(row.profileJson),
      analysis: JSON.parse(row.analysisJson),
      rawResumeRetained: Boolean(row.rawResumeRetained),
      rawResumeText: row.rawResumeText || "",
      emailDomain: row.emailDomain || "",
      emailDomainType: row.emailDomainType || "",
      country: row.country || "",
      capturedAt: row.capturedAt
    };
    parsed.searchableText = searchableResumeText(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function filterResumes(resumes, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return resumes;
  return resumes.filter((item) => item.searchableText.includes(needle));
}

function filterApplications(applications, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return applications;
  return applications.filter((item) =>
    [
      item.userId,
      item.clientHash,
      item.title,
      item.company,
      item.status,
      item.source,
      item.emailDomain,
      item.emailDomainType,
      item.country
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function filterWaitlist(signups, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return signups;
  return signups.filter((item) =>
    [
      item.id,
      item.leadId,
      item.contactId,
      item.organizationId,
      item.candidateId,
      item.name,
      item.email,
      item.phone,
      item.emailDomain,
      item.emailDomainType,
      item.organization,
      item.organizationType,
      item.userType,
      item.role,
      item.city,
      item.state,
      item.country,
      item.referralSource,
      item.buyingAuthority,
      item.timeline,
      item.branchStatus,
      item.targetRole,
      item.targetIndustry,
      item.experienceLevel,
      item.programName,
      item.majorField,
      item.schoolName,
      item.certifications,
      item.degreeLevel,
      item.classYear,
      item.studentStatus,
      item.seekingStatus,
      item.domesticInternational,
      item.workforceRegion,
      item.currentProcess,
      item.populationServed,
      item.reportingWish,
      item.biggestChallenge,
      item.currentTools,
      item.desiredFeatures,
      item.linkedinUrl,
      item.leadScore,
      item.leadPriority,
      item.recommendedAction,
      item.source,
      item.status
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function filterFollowups(followups, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return followups;
  return followups.filter((item) =>
    [
      item.leadId,
      item.candidateId,
      item.contactId,
      item.email,
      item.phone,
      item.emailDomain,
      item.emailDomainType,
      item.currentStatus,
      item.placementStatus,
      item.currentRole,
      item.currentIndustry,
      item.salaryRange,
      item.employer,
      item.jobTitle,
      item.salaryAmount,
      item.salaryPeriod,
      item.outcomeDate,
      item.jobLocation,
      item.dataSource,
      item.verificationStatus,
      item.supportNeeded,
      item.notes
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function filterEvents(events, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return events;
  return events.filter((item) =>
    [
      item.userId,
      item.candidateId,
      item.leadId,
      item.eventType,
      item.eventSource,
      item.pagePath,
      item.campaign
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function searchableResumeText(item) {
  const profile = item.profile || {};
  const analysis = item.analysis || {};
  return [
    item.userId,
    item.candidateId,
    item.reportId,
    item.clientHash,
    item.targetRole,
    item.emailDomain,
    item.emailDomainType,
    item.country,
    profile.currentTitle,
    profile.careerLevel,
    ...(profile.industries || []),
    ...(profile.skills?.technical || []),
    ...(profile.skills?.tools || []),
    ...(profile.skills?.soft || []),
    ...(profile.workHistory || []).flatMap((entry) => [
      entry.title,
      entry.company,
      ...(entry.highlights || [])
    ]),
    ...(profile.education || []).flatMap((entry) => [entry.institution, entry.credential, entry.field]),
    ...(profile.certifications || []),
    ...(profile.projects || []),
    ...(profile.languages || []),
    ...(profile.locationSignals || []),
    analysis.score,
    analysis.summary,
    ...(analysis.strengths || []),
    ...(analysis.improvements || []).flatMap((entry) => [entry.title, entry.detail, entry.priority]),
    ...(analysis.keywordAnalysis?.matched || []),
    ...(analysis.keywordAnalysis?.missing || []),
    ...(analysis.sections || []).flatMap((entry) => [entry.name, entry.score, entry.note]),
    item.rawResumeText
  ]
    .join(" ")
    .toLowerCase();
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

function buildSessionMetrics(events) {
  const sessions = new Map();
  for (const event of events) {
    if (!["session_started", "session_heartbeat", "session_completed"].includes(event.eventType)) continue;
    const key = event.sessionId || `${event.userId || "unknown"}:${event.createdAt}`;
    const current = sessions.get(key) || {
      source: event.eventSource || "unknown",
      page: event.pagePath || "unknown",
      campaign: event.campaign || "",
      duration: 0
    };
    current.duration = Math.max(current.duration, Number(event.durationSeconds || 0));
    current.source = current.source || event.eventSource || "unknown";
    current.page = current.page || event.pagePath || "unknown";
    sessions.set(key, current);
  }

  const completedDurations = [...sessions.values()].map((item) => item.duration).filter((value) => value > 0);
  const totalSeconds = completedDurations.reduce((sum, value) => sum + value, 0);

  return {
    sessions: sessions.size,
    averageSessionSeconds: completedDurations.length ? Math.round(totalSeconds / completedDurations.length) : 0,
    totalSessionMinutes: Math.round(totalSeconds / 60),
    sources: [...sessions.values()].map((item) => item.source).filter(Boolean),
    pages: [...sessions.values()].map((item) => item.page).filter(Boolean),
    campaigns: [...sessions.values()].map((item) => item.campaign).filter(Boolean)
  };
}

function dateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function careerLevelCounts(resumes) {
  const counts = countBy(resumes.map((item) => normalizeCareerLevel(item.profile.careerLevel)));
  return ["Entry", "Mid Career", "Senior", "Lead", "Executive", "Unknown"].reduce((nextCounts, level) => {
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
  if (level.includes("mid") || level.includes("intermediate")) return "Mid Career";
  return "Unknown";
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

function buildFollowUpTotals(followups) {
  return followups.reduce(
    (totals, item) => {
      const applications = Number(item.applicationCount || 0);
      const interviews = Number(item.interviewCount || 0);
      const offers = Number(item.offerCount || 0);
      totals.applications += Number.isFinite(applications) ? applications : 0;
      totals.interviews += Number.isFinite(interviews) ? interviews : 0;
      totals.offers += Number.isFinite(offers) ? offers : 0;
      if (isPlaced(item)) totals.placements += 1;
      return totals;
    },
    { applications: 0, interviews: 0, offers: 0, placements: 0 }
  );
}

function buildFollowUpQueues(waitlist, followups, respondedSignups) {
  const completed = followups;
  const allPending = waitlist
    .filter((item) => Boolean(item.interviewInterest))
    .filter((item) => !respondedSignups.has(item))
    .sort((left, right) => Number(right.leadScore || 0) - Number(left.leadScore || 0) || String(right.createdAt || "").localeCompare(String(left.createdAt || "")));

  return {
    pending: allPending,
    completed,
    pendingCount: allPending.length,
    completedCount: followups.length
  };
}

function recordMatchKeys(item) {
  return [
    item.leadId && `lead:${item.leadId}`,
    item.candidateId && `candidate:${item.candidateId}`,
    item.contactId && `contact:${item.contactId}`,
    item.email && `email:${String(item.email).trim().toLowerCase()}`,
    item.legacySignupHash && `signup-hash:${item.legacySignupHash}`,
    item.legacyFollowupHash && `followup-hash:${item.legacyFollowupHash}`
  ].filter(Boolean);
}

// Link only exact saved identities. Signup and follow-up hashes use different
// salt contexts, so each remains a separate namespace and never guesses a link.
function buildContactCohort(waitlist, followups) {
  const records = [...waitlist, ...followups];
  const parents = records.map((_, index) => index);
  const firstForKey = new Map();
  function root(index) {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  }
  records.forEach((record, index) => {
    for (const key of recordMatchKeys(record)) {
      if (firstForKey.has(key)) parents[root(index)] = root(firstForKey.get(key));
      else firstForKey.set(key, index);
    }
  });
  const byIdentity = new Map();
  records.forEach((record, index) => {
    const key = root(index);
    const group = byIdentity.get(key) || { signups: [], responses: [], identifiable: false };
    group[index < waitlist.length ? "signups" : "responses"].push(record);
    group.identifiable ||= recordMatchKeys(record).length > 0;
    byIdentity.set(key, group);
  });
  const groups = [...byIdentity.values()];
  for (const group of groups) {
    group.responses.sort((left, right) => String(right.submittedAt || "").localeCompare(String(left.submittedAt || "")) || String(right.id || "").localeCompare(String(left.id || "")));
    group.latestResponse = group.responses[0] || null;
  }
  return { groups };
}

function isPlaced(item) {
  const status = String(item.placementStatus || "").trim().toLowerCase();
  return ["placed", "accepted", "accepted role", "accepted offer", "offer accepted"].includes(status);
}

function hasInterview(item) {
  return Number(item.interviewCount || 0) > 0 || String(item.currentStatus || "").trim().toLowerCase() === "interviewing";
}

function hasOffer(item) {
  return Number(item.offerCount || 0) > 0 || ["offer received", "received offer"].includes(String(item.placementStatus || "").trim().toLowerCase())
    || String(item.currentStatus || "").trim().toLowerCase() === "received offer";
}

function buildSalaryStats(followups) {
  const periods = new Map();
  for (const item of followups) {
    if (item.salaryAmount === null || item.salaryAmount === undefined || item.salaryAmount === "") continue;
    const amount = Number(item.salaryAmount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const knownPeriods = { annual: "Annual", hourly: "Hourly", monthly: "Monthly", stipend: "Stipend", other: "Other" };
    const period = knownPeriods[String(item.salaryPeriod || "").trim().toLowerCase()] || "Not provided";
    const providedCurrency = String(item.salaryCurrency || "").trim().toUpperCase();
    const currency = /^[A-Z]{3}$/.test(providedCurrency) && providedCurrency !== "XXX" ? providedCurrency : "";
    const key = `${currency}:${period}`;
    const group = periods.get(key) || { currency, period, values: [] };
    group.values.push(amount);
    periods.set(key, group);
  }
  const byPeriod = [...periods.values()].map(({ currency, period, values }) => {
    values.sort((left, right) => left - right);
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    const comparable = currency && !["Other", "Not provided"].includes(period);
    const note = !currency ? "Currency was not provided; amounts remain available in individual responses."
      : !comparable ? "Payment period is not comparable; amounts remain available in individual responses."
      : "Latest response per saved identity; no currency conversion or annualization.";
    return { currency, period, count: values.length, median: comparable ? median : null, average: comparable ? values.reduce((sum, value) => sum + value, 0) / values.length : null, note };
  }).sort((left, right) => left.currency.localeCompare(right.currency) || left.period.localeCompare(right.period));
  const comparable = byPeriod.length === 1 && byPeriod[0].median !== null ? byPeriod[0] : null;
  return { count: byPeriod.reduce((sum, group) => sum + group.count, 0), median: comparable?.median ?? null, average: comparable?.average ?? null, currency: comparable?.currency || null, period: comparable?.period || null, byPeriod };
}

function buildGpaBands(waitlist) {
  const gpas = waitlist
    .filter((item) => item.gpa !== null && item.gpa !== undefined && item.gpa !== "")
    .map((item) => Number(item.gpa))
    .filter((value) => Number.isFinite(value) && value >= 0);
  return {
    "0.00-2.49": gpas.filter((value) => value < 2.5).length,
    "2.50-2.99": gpas.filter((value) => value >= 2.5 && value < 3).length,
    "3.00-3.49": gpas.filter((value) => value >= 3 && value < 3.5).length,
    "3.50-4.00": gpas.filter((value) => value >= 3.5 && value <= 4).length,
    "4.00+": gpas.filter((value) => value > 4).length
  };
}

function buildLeadScoreBands(waitlist) {
  return {
    "0-24": waitlist.filter((item) => Number(item.leadScore || 0) < 25).length,
    "25-49": waitlist.filter((item) => Number(item.leadScore || 0) >= 25 && Number(item.leadScore || 0) < 50).length,
    "50-74": waitlist.filter((item) => Number(item.leadScore || 0) >= 50 && Number(item.leadScore || 0) < 75).length,
    "75-89": waitlist.filter((item) => Number(item.leadScore || 0) >= 75 && Number(item.leadScore || 0) < 90).length,
    "90-100": waitlist.filter((item) => Number(item.leadScore || 0) >= 90).length
  };
}

function buildWaitlistFunnel(waitlist, respondedSignups) {
  const total = waitlist.length;
  const matchedFollowups = waitlist.filter((item) => respondedSignups.has(item)).length;

  return [
    { label: "Waitlist signups", count: total, rate: total ? 100 : 0 },
    { label: "Interview volunteers", count: waitlist.filter((item) => item.interviewInterest).length, rate: percentNumber(waitlist.filter((item) => item.interviewInterest).length, total) },
    { label: "Pilot interest", count: waitlist.filter((item) => item.pilotInterest).length, rate: percentNumber(waitlist.filter((item) => item.pilotInterest).length, total) },
    { label: "Budget / procurement interest", count: waitlist.filter((item) => item.budgetInterest).length, rate: percentNumber(waitlist.filter((item) => item.budgetInterest).length, total) },
    { label: "Submitted follow-up", count: matchedFollowups, rate: percentNumber(matchedFollowups, total) }
  ];
}

function buildFollowUpFunnel(respondents) {
  const total = respondents.length;
  const row = (label, count) => ({ label, count, rate: percentNumber(count, total), denominator: total });
  return [
    row("Distinct respondents", total),
    row("Respondents reporting applications", respondents.filter((item) => Number(item.applicationCount || 0) > 0).length),
    row("Respondents reporting interviews", respondents.filter(hasInterview).length),
    row("Respondents reporting offers", respondents.filter(hasOffer).length),
    row("Respondents placed / accepted", respondents.filter(isPlaced).length)
  ];
}

function buildConversionMetrics(waitlist, respondents, coverage) {
  return [
    { label: "Discovery interest", value: percentNumber(waitlist.filter((item) => item.interviewInterest).length, waitlist.length), detail: "Waitlist leads open to a call" },
    { label: "Pilot interest", value: percentNumber(waitlist.filter((item) => item.pilotInterest).length, waitlist.length), detail: "Institutional or partner pilot signal" },
    { label: "Budget signal", value: percentNumber(waitlist.filter((item) => item.budgetInterest).length, waitlist.length), detail: "Procurement or budget influence" },
    { label: "Follow-up coverage", value: percentNumber(coverage.responded, coverage.contacts), detail: `${coverage.responded} of ${coverage.contacts} distinct waitlist contacts have matched responses` },
    { label: "Respondents with offers", value: percentNumber(respondents.filter(hasOffer).length, respondents.length), detail: `${respondents.filter(hasOffer).length} of ${respondents.length} distinct respondents; latest response each` },
    { label: "Respondents placed", value: percentNumber(respondents.filter(isPlaced).length, respondents.length), detail: `${respondents.filter(isPlaced).length} of ${respondents.length} distinct respondents; latest response each` }
  ];
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

function buildDecisionSignals({
  resumes,
  applications,
  waitlist,
  followups,
  coverage,
  followUpTotals,
  followUpQueues,
  readinessThreshold,
  sessionMetrics
}) {
  const belowThreshold = resumes.filter((item) => Number(item.analysis?.score || 0) < readinessThreshold).length;
  const interviewConversion = percentNumber(followUpTotals.interviews, followUpTotals.applications);
  const offerConversion = percentNumber(followUpTotals.offers, followUpTotals.interviews);
  const followUpCoverage = percentNumber(coverage.responded, coverage.contacts);
  const pilotConversion = percentNumber(waitlist.filter((item) => item.pilotInterest).length, waitlist.length);
  const inactiveApplications = applications.filter((item) => {
    const captured = new Date(item.capturedAt || "").getTime();
    const status = String(item.status || "").toLowerCase();
    return Number.isFinite(captured) && Date.now() - captured > 14 * 24 * 60 * 60 * 1000
      && !status.includes("offer") && !status.includes("accept") && !status.includes("reject");
  }).length;

  return [
    {
      label: "Readiness intervention",
      value: belowThreshold,
      unit: "records",
      severity: belowThreshold ? "attention" : "positive",
      detail: `${belowThreshold} of ${resumes.length} resume records are below the ${readinessThreshold}% strong-match threshold.`,
      action: belowThreshold ? "Prioritize skill-gap and resume-targeting support." : "Maintain the current readiness workflow."
    },
    {
      label: "Application momentum",
      value: inactiveApplications,
      unit: "stale opportunities",
      severity: inactiveApplications ? "attention" : "positive",
      detail: `${inactiveApplications} tracked opportunities have no terminal status and are older than 14 days.`,
      action: inactiveApplications ? "Prompt participants to update status or schedule follow-up." : "No stale opportunity records detected."
    },
    {
      label: "Interview activity rate",
      value: interviewConversion,
      unit: "per 100 applications",
      severity: interviewConversion >= 20 ? "positive" : interviewConversion ? "attention" : "neutral",
      detail: `${followUpTotals.interviews} cumulative interviews and ${followUpTotals.applications} applications across latest respondent reports; not a probability or attributed outcome.`,
      action: interviewConversion >= 20 ? "Identify which roles and resumes drive this conversion." : "Review targeting, tailoring, and application quality."
    },
    {
      label: "Offer activity rate",
      value: offerConversion,
      unit: "per 100 interviews",
      severity: offerConversion >= 20 ? "positive" : offerConversion ? "attention" : "neutral",
      detail: `${followUpTotals.offers} cumulative offers and ${followUpTotals.interviews} interviews across latest respondent reports; not a probability or attributed outcome.`,
      action: offerConversion >= 20 ? "Document successful interview-preparation patterns." : "Strengthen interview preparation and outcome follow-up."
    },
    {
      label: "Outcome-data coverage",
      value: followUpCoverage,
      unit: "%",
      severity: followUpCoverage >= 60 ? "positive" : "attention",
      detail: `${coverage.responded} of ${coverage.contacts} distinct waitlist contacts have a matched follow-up.`,
      action: followUpCoverage >= 60 ? "Maintain follow-up cadence." : `Contact ${followUpQueues.pendingCount} pending intake or follow-up records.`
    },
    {
      label: "Pilot interest",
      value: pilotConversion,
      unit: "%",
      severity: pilotConversion >= 20 ? "positive" : "neutral",
      detail: `${waitlist.filter((item) => item.pilotInterest).length} waitlist leads expressed pilot interest.`,
      action: pilotConversion ? "Qualify pilot scope, authority, timeline, and budget." : "Use discovery interviews to test institutional demand."
    },
    {
      label: "Observed engagement",
      value: sessionMetrics.averageSessionSeconds,
      unit: "sec avg",
      severity: sessionMetrics.averageSessionSeconds >= 120 ? "positive" : "neutral",
      detail: `${sessionMetrics.sessions} sessions generated ${sessionMetrics.totalSessionMinutes} total engaged minutes.`,
      action: "Compare engagement by campaign and page before changing acquisition strategy."
    }
  ];
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function percentNumber(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
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

function splitDelimited(value) {
  return String(value || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function hasUserMetadataColumns(db) {
  const columns = await db.prepare("PRAGMA table_info(users)").all();
  const names = new Set((columns.results || []).map((column) => column.name));
  return names.has("email_domain") && names.has("email_domain_type") && names.has("country");
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }
  });
}
