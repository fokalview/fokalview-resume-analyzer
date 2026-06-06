const SCORING_VERSION = "sagittaiq-readiness-v1.2";
const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "because", "been", "being", "but", "can", "company",
  "from", "have", "into", "job", "more", "must", "not", "our", "role", "that", "the", "their",
  "they", "this", "through", "using", "will", "with", "work", "years", "you", "your", "ability",
  "all", "applicant", "applicants", "based", "benefits", "candidate", "candidates", "description",
  "duties", "equal", "including", "knowledge", "may", "opportunity", "preferred", "provide",
  "qualifications", "required", "requirements", "responsibilities", "responsible", "skills",
  "status", "team", "within"
]);
const ACTION_VERBS = [
  "achieved", "automated", "built", "created", "delivered", "designed", "developed", "drove",
  "implemented", "improved", "increased", "launched", "led", "managed", "optimized", "reduced",
  "saved", "scaled", "streamlined"
];

export function applyDeterministicScoring(analysis, { resumeText, targetRole, jobContext, jobQualifications }) {
  const resume = normalize(resumeText);
  const target = normalize(targetRole);
  const qualificationText = qualificationsToText(jobQualifications);
  const job = normalize(`${targetRole || ""} ${qualificationText || jobContext || ""}`);
  const resumeTokens = new Set(tokens(resume).map(stem));
  const jobTokens = prioritizedJobTokens(job, target);
  const targetTokens = [...new Set(tokens(target).map(stem))];

  const keywordCoverage = ratio(jobTokens.filter((token) => resumeTokens.has(token)).length, jobTokens.length, 0.5);
  const roleCoverage = ratio(targetTokens.filter((token) => resumeTokens.has(token)).length, targetTokens.length, 0.5);
  const structureCoverage = structureScore(resume);
  const impactCoverage = impactScore(resume);
  const depthCoverage = depthScore(resume);

  const score = clamp(Math.round(
    35 +
    keywordCoverage * 30 +
    roleCoverage * 10 +
    structureCoverage * 10 +
    impactCoverage * 10 +
    depthCoverage * 5
  ), 0, 100);

  return {
    ...analysis,
    jobQualifications: jobQualifications || analysis.jobQualifications,
    score,
    scoringVersion: SCORING_VERSION,
    sections: [
      section("ATS Keyword Match", keywordCoverage, "Share of meaningful target-opportunity terms found in the career materials."),
      section("Target Role Alignment", roleCoverage, "Alignment between the stated target role and language present in the career materials."),
      section("Resume Structure", structureCoverage, "Presence of recognizable experience, education, skills, projects, and summary sections."),
      section("Impact Evidence", impactCoverage, "Use of action-oriented accomplishments and quantified evidence."),
      section("Content Depth", depthCoverage, "Amount of readable career evidence available for assessment.")
    ]
  };
}

function qualificationsToText(value) {
  if (!value || typeof value !== "object") return "";
  return [
    ...(value.requiredSkills || []),
    ...(value.requiredSkills || []),
    ...(value.preferredSkills || []),
    ...(value.tools || []),
    ...(value.responsibilities || []),
    ...(value.education || []),
    ...(value.certifications || []),
    value.experienceLevel,
    value.yearsExperience,
    value.employmentType
  ].filter(Boolean).join(" ");
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+#./% -]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value) {
  return value
    .split(/\s+/)
    .map((token) => token.replace(/^[./%-]+|[./%-]+$/g, ""))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function prioritizedJobTokens(job, target) {
  const jobTerms = tokens(job).map(stem);
  const targetTerms = tokens(target).map(stem);
  const frequencies = jobTerms.reduce((counts, term) => {
    counts.set(term, (counts.get(term) || 0) + 1);
    return counts;
  }, new Map());
  const priority = [...new Set([
    ...targetTerms,
    ...[...frequencies.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
      .map(([term]) => term)
  ])];
  return priority.slice(0, 45);
}

function stem(token) {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function structureScore(resume) {
  const signals = [
    /\b(summary|profile|objective|headline|professional summary)\b/,
    /\b(experience|employment|work history|professional experience|career history)\b/,
    /\b(education|academic)\b/,
    /\b(skills|technologies|technical skills|competencies)\b/,
    /\b(projects|portfolio|selected projects|leadership|activities)\b/
  ];
  return ratio(signals.filter((pattern) => pattern.test(resume)).length, signals.length, 0);
}

function impactScore(resume) {
  const actionCount = ACTION_VERBS.filter((verb) => new RegExp(`\\b${verb}\\b`).test(resume)).length;
  const quantifiedCount = (resume.match(/\b(?:\d+(?:\.\d+)?%|\$[\d,.]+|\d+\+|[\d,.]+\s*(?:users|clients|projects|teams|hours|days|weeks|months|years))\b/g) || []).length;
  return clamp((Math.min(actionCount, 8) / 8) * 0.55 + (Math.min(quantifiedCount, 6) / 6) * 0.45, 0, 1);
}

function depthScore(resume) {
  const wordCount = resume ? resume.split(/\s+/).length : 0;
  if (wordCount <= 100) return wordCount / 200;
  if (wordCount <= 450) return 0.5 + ((wordCount - 100) / 350) * 0.5;
  return 1;
}

function section(name, value, note) {
  return { name, score: clamp(Math.round(value * 100), 0, 100), note };
}

function ratio(numerator, denominator, fallback) {
  return denominator > 0 ? numerator / denominator : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
