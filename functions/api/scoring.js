const SCORING_VERSION = "sagittaiq-readiness-v1";
const STOP_WORDS = new Set([
  "about", "after", "also", "and", "are", "because", "been", "being", "but", "can", "company",
  "from", "have", "into", "job", "more", "must", "not", "our", "role", "that", "the", "their",
  "they", "this", "through", "using", "will", "with", "work", "years", "you", "your"
]);
const ACTION_VERBS = [
  "achieved", "automated", "built", "created", "delivered", "designed", "developed", "drove",
  "implemented", "improved", "increased", "launched", "led", "managed", "optimized", "reduced",
  "saved", "scaled", "streamlined"
];

export function applyDeterministicScoring(analysis, { resumeText, targetRole, jobContext }) {
  const resume = normalize(resumeText);
  const target = normalize(targetRole);
  const job = normalize(`${targetRole || ""} ${jobContext || ""}`);
  const resumeTokens = new Set(tokens(resume));
  const jobTokens = [...new Set(tokens(job))].slice(0, 140);
  const targetTokens = [...new Set(tokens(target))];

  const keywordCoverage = ratio(jobTokens.filter((token) => resumeTokens.has(token)).length, jobTokens.length, 0.5);
  const roleCoverage = ratio(targetTokens.filter((token) => resumeTokens.has(token)).length, targetTokens.length, 0.5);
  const structureCoverage = structureScore(resume);
  const impactCoverage = impactScore(resume);
  const depthCoverage = depthScore(resume);

  const score = clamp(Math.round(
    30 +
    keywordCoverage * 35 +
    roleCoverage * 10 +
    structureCoverage * 10 +
    impactCoverage * 10 +
    depthCoverage * 5
  ), 0, 100);

  return {
    ...analysis,
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

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+#./% -]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value) {
  return value
    .split(/\s+/)
    .map((token) => token.replace(/^[./%-]+|[./%-]+$/g, ""))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token));
}

function structureScore(resume) {
  const signals = [
    /\b(summary|profile|objective|headline)\b/,
    /\b(experience|employment|work history|professional experience)\b/,
    /\b(education|academic)\b/,
    /\b(skills|technologies|technical skills|competencies)\b/,
    /\b(projects|portfolio|selected projects)\b/
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
