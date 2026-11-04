const FIELD_LABELS = {
  id: "Record ID", leadId: "Lead ID", contactId: "Contact ID", candidateId: "Candidate ID",
  organizationId: "Organization ID", name: "Full name", email: "Email address", emailStatus: "Email availability",
  phone: "Phone number", linkedinUrl: "LinkedIn profile", preferredContactMethod: "Preferred contact method",
  emailDomain: "Email domain", emailDomainType: "Email domain type", zipPostal: "ZIP / postal code",
  state: "State / province", county: "County", metroArea: "Metro area", country: "Country", city: "City",
  userType: "Joining as", organizationType: "Organization type", branchStatus: "Profile status",
  branchProfile: "Branch profile", intakeDetails: "Original signup answers", responseDetails: "Follow-up answers",
  scoreBreakdown: "Lead score breakdown", gpa: "GPA", programName: "Program", degreeProgram: "Degree / program",
  majorField: "Major / field", classYear: "Class / graduation year", expectedGraduationYear: "Expected graduation year",
  domesticInternational: "Domestic / international status", minimumSalary: "Minimum acceptable salary",
  targetSalary: "Target salary", dreamSalary: "Dream salary", currentIncomeRange: "Current income range",
  biggestChallenge: "What they want to improve", desiredFeatures: "Requested features",
  interviewInterest: "Intro / discovery call interest", interview: "Intro / discovery call interest",
  betaInterest: "Early beta access interest", beta: "Early beta access interest",
  pilotInterest: "Pilot discussion interest", pilot: "Pilot discussion interest",
  budgetInterest: "Procurement involvement", budget: "Procurement involvement",
  resumeAnalysisInterest: "Resume analysis interest", resumeAnalysis: "Resume analysis interest",
  applicationTrackerInterest: "Application tracker interest", applicationTracker: "Application tracker interest",
  productUpdatesInterest: "Product updates requested", productUpdates: "Product updates requested",
  feedbackInterest: "Willing to give feedback", feedback: "Willing to give feedback",
  createdAt: "Signed up at", updatedAt: "Last updated at", submittedAt: "Follow-up submitted at",
  applicationCount: "Applications sent", interviewCount: "Interviews", offerCount: "Offers",
  schoolName: "School", studentType: "Student type", primaryPopulation: "Populations served",
  individualChallenges: "Job seeker challenges", individualTools: "Job seeker tools",
  studentChallenges: "Student challenges", studentTools: "Student tools",
  employerPainPoints: "Employer challenges", employerInterestTypes: "Employer interests"
};

export function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export function displayValue(value) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join("; ") : "None selected";
  if (typeof value === "object") return Object.entries(value).map(([key, entry]) => `${fieldLabel(key)}: ${displayValue(entry)}`).join("; ") || "Not provided";
  if (value === "personal_email") return "Personal email domain (legacy record)";
  return String(value);
}

export function flattenRecord(record) {
  const result = {};
  function visit(value, path) {
    if (value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) {
      for (const [key, entry] of Object.entries(value)) visit(entry, [...path, fieldLabel(key)]);
      return;
    }
    result[path.join(" / ")] = typeof value === "number" ? value : displayValue(value);
  }
  for (const [key, value] of Object.entries(record)) visit(value, [fieldLabel(key)]);
  return result;
}

function csvCell(value) {
  let text = value === undefined ? "" : String(value);
  // Quoting alone does not stop spreadsheet formulas in user-entered text.
  if (typeof value !== "number" && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvForRecords(records) {
  const rows = records.map(flattenRecord);
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (!columns.length) return "";
  return [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\r\n");
}
