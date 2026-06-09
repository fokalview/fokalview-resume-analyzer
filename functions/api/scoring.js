const SCORING_VERSION = "sagittaiq-readiness-v1.3";
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
  const resumeTokens = new Set(tokens(resume).map(stem));
  const targetTokens = [...new Set(tokens(target).map(stem))];

  const rubric = qualificationRubric(jobQualifications, jobContext);
  const requiredCoverage = termListCoverage(rubric.requiredSkills, resume, resumeTokens, 0.5);
  const preferredCoverage = termListCoverage(rubric.preferredSkills, resume, resumeTokens, 0.5);
  const toolCoverage = termListCoverage(rubric.tools, resume, resumeTokens, 0.5);
  const responsibilityCoverage = termListCoverage(rubric.responsibilities, resume, resumeTokens, 0.5);
  const credentialCoverage = termListCoverage(
    [...rubric.education, ...rubric.certifications],
    resume,
    resumeTokens,
    0.5
  );
  const keywordCoverage = weightedAverage([
    [requiredCoverage, 25],
    [preferredCoverage, 15],
    [toolCoverage, 10],
    [responsibilityCoverage, 15],
    [credentialCoverage, 10]
  ]);
  const roleCoverage = ratio(targetTokens.filter((token) => resumeTokens.has(token)).length, targetTokens.length, 0.5);
  const structureCoverage = structureScore(resume);
  const impactCoverage = impactScore(resume);
  const depthCoverage = depthScore(resume);

  const score = clamp(Math.round(
    requiredCoverage * 25 +
    preferredCoverage * 15 +
    toolCoverage * 10 +
    responsibilityCoverage * 15 +
    credentialCoverage * 10 +
    roleCoverage * 5 +
    structureCoverage * 5 +
    impactCoverage * 10 +
    depthCoverage * 5
  ), 0, 100);

  return {
    ...analysis,
    jobQualifications: jobQualifications || analysis.jobQualifications,
    score,
    scoringVersion: SCORING_VERSION,
    sections: [
      section("Required Qualifications", requiredCoverage, "Coverage of the opportunity's required skills and qualifications."),
      section("Preferred Qualifications", preferredCoverage, "Coverage of preferred qualifications that can strengthen candidacy."),
      section("Tools and Technologies", toolCoverage, "Coverage of named tools and technologies in the opportunity."),
      section("Responsibility Alignment", responsibilityCoverage, "Evidence aligned with the opportunity's primary responsibilities."),
      section("Education and Certifications", credentialCoverage, "Coverage of stated education and certification expectations."),
      section("ATS Keyword Match", keywordCoverage, "Weighted coverage across the locked opportunity qualification rubric."),
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

function qualificationRubric(value, jobContext) {
  if (value && typeof value === "object") {
    return {
      requiredSkills: cleanList(value.requiredSkills),
      preferredSkills: cleanList(value.preferredSkills),
      tools: cleanList(value.tools),
      responsibilities: cleanList(value.responsibilities),
      education: cleanList(value.education),
      certifications: cleanList(value.certifications)
    };
  }

  const fallback = prioritizedTerms(jobContext, 45);
  return {
    requiredSkills: fallback,
    preferredSkills: [],
    tools: [],
    responsibilities: [],
    education: [],
    certifications: []
  };
}

function cleanList(value) {
  return Array.isArray(value) ? value.map((item) => normalize(item)).filter(Boolean) : [];
}

function prioritizedTerms(value, limit) {
  const frequencies = tokens(normalize(value)).map(stem).reduce((counts, term) => {
    counts.set(term, (counts.get(term) || 0) + 1);
    return counts;
  }, new Map());
  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function termListCoverage(items, resume, resumeTokens, fallback) {
  if (!items.length) return fallback;
  const scores = items.map((item) => termCoverage(item, resume, resumeTokens));
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
}

function termCoverage(item, resume, resumeTokens) {
  const normalizedItem = normalize(item);
  if (!normalizedItem) return 0;
  if (normalizedItem.length >= 4 && resume.includes(normalizedItem)) return 1;

  const itemTokens = [...new Set(tokens(normalizedItem).map(stem))];
  if (!itemTokens.length) return 0;
  return ratio(itemTokens.filter((token) => resumeTokens.has(token)).length, itemTokens.length, 0);
}

function weightedAverage(values) {
  const totalWeight = values.reduce((sum, [, weight]) => sum + weight, 0);
  return values.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
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
  const actionCount = ACTION_VERBS.reduce(
    (count, verb) => count + (resume.match(new RegExp(`\\b${verb}\\b`, "g")) || []).length,
    0
  );
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
