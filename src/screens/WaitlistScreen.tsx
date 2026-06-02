import { useId, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Rocket,
  ShieldCheck,
  Target,
  UsersRound
} from "lucide-react";

const USER_TYPES = [
  "Individual Job Seeker",
  "Student",
  "Career Counselor / Advisor",
  "Institution / Program Leader",
  "Workforce / Gov / Nonprofit",
  "Employer / Hiring Partner"
];

const REFERRAL_SOURCES = [
  "LinkedIn",
  "Referral",
  "Conference",
  "University",
  "Workforce Board",
  "Search Engine",
  "Social Media",
  "Other"
];

const CONTACT_METHODS = ["Email", "LinkedIn", "Phone", "No preference"];
const BUYING_AUTHORITY = ["Researching", "Recommender", "Evaluator", "Budget Influencer", "Decision Maker"];
const TIMELINES = ["Immediately", "Within 3 months", "Within 6 months", "Within 12 months", "Just exploring"];
const PILOT_INTEREST = ["Yes, interested in pilot", "Maybe later", "Not yet", "Just exploring"];
const TARGET_INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Government",
  "Manufacturing",
  "Creative or Media",
  "Skilled Trades",
  "Other"
];
const POPULATION_RANGES = ["Under 100", "100-500", "500-2,500", "2,500-10,000", "10,000+"];
const CURRENT_PROCESSES = [
  "Mostly spreadsheets",
  "Multiple disconnected tools",
  "Dedicated career platform",
  "Case management system",
  "Internal solution",
  "Email and manual review",
  "Manual advising",
  "No formal process"
];

const FEATURE_CARDS = [
  {
    icon: FileText,
    title: "Resume Intelligence",
    bullets: ["Resume analysis", "ATS compatibility review", "Resume readiness scoring"]
  },
  {
    icon: Target,
    title: "Career Readiness",
    bullets: ["Skill gap detection", "Role alignment insights", "Progress tracking"]
  },
  {
    icon: BarChart3,
    title: "Application Tracking",
    bullets: ["Track applications", "Monitor interviews", "Record offers and outcomes"]
  },
  {
    icon: Rocket,
    title: "Early Beta Access",
    bullets: ["Access new features first", "Provide direct feedback", "Influence product development"]
  }
];

const INITIAL_FORM = {
  userType: "Individual Job Seeker",
  name: "",
  email: "",
  country: "",
  state: "",
  city: "",
  zipPostal: "",
  linkedinUrl: "",
  preferredContactMethod: "Email",
  biggestChallenge: "",
  referralSource: "LinkedIn",
  organization: "",
  organizationType: "",
  role: "",
  currentStatus: "",
  targetRole: "",
  targetIndustry: "",
  experienceLevel: "",
  currentIncomeRange: "",
  minimumSalary: "",
  targetSalary: "",
  dreamSalary: "",
  studentType: "",
  degreeProgram: "",
  majorField: "",
  expectedGraduationYear: "",
  careerStage: "",
  populationServed: "",
  primaryPopulation: [] as string[],
  currentProcess: "",
  currentTools: "",
  reportingWish: "",
  desiredFeatures: "",
  geographicReach: "",
  advisingStaffCount: "",
  programType: "",
  fundingSource: "",
  companySize: "",
  hiringVolume: "",
  rolesHiringFor: "",
  skillsHardToFind: "",
  pilotInterestLevel: "Just exploring",
  buyingAuthority: "Researching",
  timeline: "Just exploring",
  individualChallenges: [] as string[],
  individualTools: [] as string[],
  studentChallenges: [] as string[],
  studentTools: [] as string[],
  operationalChallenges: [] as string[],
  employerPainPoints: [] as string[],
  employerInterestTypes: [] as string[],
  interviewInterest: true,
  betaInterest: true,
  pilotInterest: false,
  budgetInterest: false,
  resumeAnalysisInterest: true,
  applicationTrackerInterest: true,
  productUpdatesInterest: true,
  feedbackInterest: true
};

type WaitlistForm = typeof INITIAL_FORM;

export default function WaitlistScreen() {
  const [form, setForm] = useState<WaitlistForm>(INITIAL_FORM);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOrganization = !["Individual Job Seeker", "Student"].includes(form.userType);
  const branchTitle = useMemo(() => branchHeading(form.userType), [form.userType]);

  function setField<K extends keyof WaitlistForm>(key: K, value: WaitlistForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "public_waitlist" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not join waitlist.");
      setStatus("You're on the list. Your answers help route beta access, discovery, and pilot outreach.");
      setForm(INITIAL_FORM);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not join waitlist.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="waitlist-shell">
      <a className="skip-link" href="#waitlist-form">Skip to waitlist form</a>
      <section className="waitlist-card">
        <div className="waitlist-hero">
          <div className="waitlist-copy">
            <p className="eyebrow">SagittaIQ - Early Access</p>
            <h1>Workforce readiness, built on real data.</h1>
            <p>
              Analytics powered by actual resume and application data, not assumptions. Built for
              individuals, career teams, workforce partners, and employers who need actionable insight.
            </p>
            <div className="waitlist-tags">
              <span>Resume scoring</span>
              <span>Cohort analytics</span>
              <span>Advisor workflows</span>
              <span>Application outcomes</span>
              <span>Pilot program</span>
            </div>
          </div>

          <div className="waitlist-summary">
            <article>
              <BarChart3 size={20} />
              <div>
                <strong>Resume and application intelligence</strong>
                <span>Aggregate cohort data, score trends, skill gaps, and outcomes in one readiness view.</span>
              </div>
            </article>
            <article>
              <UsersRound size={20} />
              <div>
                <strong>Built for career advisors</strong>
                <span>Flag at-risk students, track progress, and generate reports your leadership can use.</span>
              </div>
            </article>
            <article>
              <ShieldCheck size={20} />
              <div>
                <strong>Institutional-grade trust</strong>
                <span>Designed for privacy-conscious environments. Your data stays yours.</span>
              </div>
            </article>
            <div className="waitlist-stats" aria-label="Early access stats">
              <span><strong>Beta</strong><small>cohort forming</small></span>
              <span><strong>Free</strong><small>pilot access</small></span>
              <span><strong>3x</strong><small>faster reporting</small></span>
            </div>
          </div>
        </div>

        <section className="feature-preview" aria-label="What SagittaIQ includes">
          {FEATURE_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <article key={card.title} style={{ animationDelay: `${index * 100}ms` }}>
                <Icon size={22} />
                <div>
                  <strong>{card.title}</strong>
                  <ul>
                    {card.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </section>

        <form id="waitlist-form" className="waitlist-form" onSubmit={submit} aria-label="SagittaIQ waitlist signup" aria-busy={isSubmitting}>
          <div className="form-section-title">
            <span>Start here</span>
          </div>
          <label className="wide-field">
            <span>Who are you joining as? <span className="required-mark" aria-hidden="true">*</span></span>
            <select value={form.userType} onChange={(event) => setField("userType", event.target.value)}>
              {USER_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <div className="branch-note" aria-live="polite">
            <strong>{branchTitle}</strong>
            <span>The next questions adjust to keep this short and relevant.</span>
          </div>

          <div className="form-section-title">
            <span>Your information</span>
          </div>
          <TextField label="Full name" value={form.name} onChange={(value) => setField("name", value)} required />
          <TextField label="Email" value={form.email} onChange={(value) => setField("email", value)} type="email" required />
          <TextField label="Country" value={form.country} onChange={(value) => setField("country", value)} required />
          <TextField label="State / province" value={form.state} onChange={(value) => setField("state", value)} required />
          <TextField label="City" value={form.city} onChange={(value) => setField("city", value)} required={isOrganization} />
          <TextField
            label="ZIP / postal code"
            value={form.zipPostal}
            onChange={(value) => setField("zipPostal", value)}
            required={isOrganization}
          />
          <label>
            <span>Referral source</span>
            <select value={form.referralSource} onChange={(event) => setField("referralSource", event.target.value)}>
              {REFERRAL_SOURCES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Preferred contact</span>
            <select
              value={form.preferredContactMethod}
              onChange={(event) => setField("preferredContactMethod", event.target.value)}
            >
              {CONTACT_METHODS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <TextField
            className="wide-field"
            label="LinkedIn profile"
            value={form.linkedinUrl}
            onChange={(value) => setField("linkedinUrl", value)}
            placeholder="https://linkedin.com/in/..."
          />
          <TextArea
            className="wide-field"
            label="What are you trying to improve?"
            value={form.biggestChallenge}
            onChange={(value) => setField("biggestChallenge", value)}
            placeholder="Resume results, application tracking, reporting, skill visibility..."
            required
          />

          {form.userType === "Individual Job Seeker" && <IndividualBranch form={form} setField={setField} />}
          {form.userType === "Student" && <StudentBranch form={form} setField={setField} />}
          {form.userType === "Career Counselor / Advisor" && <AdvisorBranch form={form} setField={setField} />}
          {form.userType === "Institution / Program Leader" && <InstitutionBranch form={form} setField={setField} />}
          {form.userType === "Workforce / Gov / Nonprofit" && <WorkforceBranch form={form} setField={setField} />}
          {form.userType === "Employer / Hiring Partner" && <EmployerBranch form={form} setField={setField} />}

          <div className="form-section-title">
            <span>Engagement interest</span>
          </div>
          <section className="waitlist-options">
            <Toggle
              label="Early beta access"
              help="Use features before public launch"
              checked={form.betaInterest}
              onChange={(value) => setField("betaInterest", value)}
            />
            <Toggle
              label="Resume analysis"
              help="Try readiness scoring and feedback"
              checked={form.resumeAnalysisInterest}
              onChange={(value) => setField("resumeAnalysisInterest", value)}
            />
            <Toggle
              label="Application tracker"
              help="Track applications, interviews, and offers"
              checked={form.applicationTrackerInterest}
              onChange={(value) => setField("applicationTrackerInterest", value)}
            />
            <Toggle
              label="Willing to give feedback"
              help="Help shape the product"
              checked={form.feedbackInterest}
              onChange={(value) => setField("feedbackInterest", value)}
            />
            <Toggle
              label="Intro or discovery call"
              help="Talk with the SagittaIQ team"
              checked={form.interviewInterest}
              onChange={(value) => setField("interviewInterest", value)}
            />
            {isOrganization && (
              <Toggle
                label="Pilot discussion"
                help="Explore a formal pilot"
                checked={form.pilotInterest}
                onChange={(value) => setField("pilotInterest", value)}
              />
            )}
            {isOrganization && (
              <Toggle
                label="Procurement involvement"
                help="Influence or hold budget decisions"
                checked={form.budgetInterest}
                onChange={(value) => setField("budgetInterest", value)}
              />
            )}
            <Toggle
              label="Product updates"
              help="Receive launch and feature updates"
              checked={form.productUpdatesInterest}
              onChange={(value) => setField("productUpdatesInterest", value)}
            />
          </section>

          {error && <p className="error-message" role="alert">{error}</p>}
          {status && <p className="success-message" role="status" aria-live="polite">{status}</p>}

          <button className="primary-button waitlist-submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Request access"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

function IndividualBranch({ form, setField }: BranchProps) {
  return (
    <>
      <div className="form-section-title"><span>Job seeker profile</span></div>
      <SelectField label="Current status" value={form.currentStatus} onChange={(value) => setField("currentStatus", value)} options={[
        "Unemployed and actively looking",
        "Employed but looking",
        "Career changer",
        "Recent graduate",
        "Returning to workforce",
        "Freelancer / contractor",
        "Other"
      ]} />
      <TextField label="Target role" value={form.targetRole} onChange={(value) => setField("targetRole", value)} />
      <SelectField label="Target industry" value={form.targetIndustry} onChange={(value) => setField("targetIndustry", value)} options={TARGET_INDUSTRIES} />
      <SelectField label="Experience level" value={form.experienceLevel} onChange={(value) => setField("experienceLevel", value)} options={[
        "Entry Level",
        "Early Career",
        "Mid Career",
        "Senior",
        "Career Changer",
        "Not Sure"
      ]} />
      <CheckboxGroup label="Biggest challenges" values={form.individualChallenges} onChange={(value) => setField("individualChallenges", value)} options={[
        "Resume is not getting responses",
        "Not getting interviews",
        "Not sure what jobs fit me",
        "Skill gaps",
        "Application tracking",
        "Career change",
        "Salary uncertainty",
        "Accessibility or disability barriers",
        "Confidence or imposter syndrome",
        "Other"
      ]} />
      <CheckboxGroup label="Current tools" values={form.individualTools} onChange={(value) => setField("individualTools", value)} options={[
        "LinkedIn",
        "Indeed",
        "Handshake",
        "Google Sheets",
        "Resume builder",
        "Career coach",
        "ChatGPT or AI tools",
        "None",
        "Other"
      ]} />
      <SelectField label="Current income range" value={form.currentIncomeRange} onChange={(value) => setField("currentIncomeRange", value)} options={[
        "Not currently earning income",
        "Under $40k",
        "$40k to $60k",
        "$60k to $80k",
        "$80k to $100k",
        "$100k to $150k",
        "$150k+",
        "Prefer not to say"
      ]} />
      <TextField label="Minimum acceptable salary" value={form.minimumSalary} onChange={(value) => setField("minimumSalary", value)} />
      <TextField label="Target salary" value={form.targetSalary} onChange={(value) => setField("targetSalary", value)} />
      <TextField label="Dream salary" value={form.dreamSalary} onChange={(value) => setField("dreamSalary", value)} />
    </>
  );
}

function StudentBranch({ form, setField }: BranchProps) {
  return (
    <>
      <div className="form-section-title"><span>Student profile</span></div>
      <SelectField label="Student type" value={form.studentType} onChange={(value) => setField("studentType", value)} options={[
        "High school student",
        "Community college student",
        "Undergraduate student",
        "Graduate student",
        "Recent graduate",
        "Certificate or bootcamp student",
        "Other"
      ]} />
      <TextField label="School / institution" value={form.organization} onChange={(value) => setField("organization", value)} />
      <TextField label="Degree / program" value={form.degreeProgram} onChange={(value) => setField("degreeProgram", value)} />
      <TextField label="Major / field" value={form.majorField} onChange={(value) => setField("majorField", value)} />
      <TextField label="Expected graduation year" value={form.expectedGraduationYear} onChange={(value) => setField("expectedGraduationYear", value)} />
      <TextField label="Target role" value={form.targetRole} onChange={(value) => setField("targetRole", value)} />
      <SelectField label="Target industry" value={form.targetIndustry} onChange={(value) => setField("targetIndustry", value)} options={TARGET_INDUSTRIES} />
      <SelectField label="Career stage" value={form.careerStage} onChange={(value) => setField("careerStage", value)} options={[
        "Exploring careers",
        "Preparing for internship",
        "Preparing for full-time job",
        "Applying now",
        "Interviewing now",
        "Received offer",
        "Not sure"
      ]} />
      <CheckboxGroup label="Biggest challenges" values={form.studentChallenges} onChange={(value) => setField("studentChallenges", value)} options={[
        "Building first resume",
        "Getting internship",
        "Getting full-time job",
        "Not sure what jobs fit",
        "Missing skills",
        "No experience",
        "Application tracking",
        "Interview preparation",
        "Career center support",
        "Other"
      ]} />
      <CheckboxGroup label="Current tools" values={form.studentTools} onChange={(value) => setField("studentTools", value)} options={[
        "Career center",
        "Handshake",
        "LinkedIn",
        "Indeed",
        "Google Sheets",
        "Resume builder",
        "ChatGPT or AI tools",
        "None",
        "Other"
      ]} />
      <TextField label="Minimum salary after graduation" value={form.minimumSalary} onChange={(value) => setField("minimumSalary", value)} />
      <TextField label="Target salary after graduation" value={form.targetSalary} onChange={(value) => setField("targetSalary", value)} />
      <TextField label="Dream salary" value={form.dreamSalary} onChange={(value) => setField("dreamSalary", value)} />
    </>
  );
}

function AdvisorBranch({ form, setField }: BranchProps) {
  return (
    <>
      <OrganizationFields form={form} setField={setField} title="Advisor profile" />
      <CheckboxGroup label="Primary population served" values={form.primaryPopulation} onChange={(value) => setField("primaryPopulation", value)} options={populationOptions()} />
      <CheckboxGroup label="Operational challenges" values={form.operationalChallenges} onChange={(value) => setField("operationalChallenges", value)} options={operationalChallengeOptions()} />
      <TextArea className="wide-field" label="Reporting wish" value={form.reportingWish} onChange={(value) => setField("reportingWish", value)} placeholder="What report do you wish you could generate today but cannot?" />
      <SalesFields form={form} setField={setField} />
    </>
  );
}

function InstitutionBranch({ form, setField }: BranchProps) {
  return (
    <>
      <OrganizationFields form={form} setField={setField} title="Institution profile" />
      <SelectField label="Geographic reach" value={form.geographicReach} onChange={(value) => setField("geographicReach", value)} options={["Local", "Regional", "Statewide", "National", "International"]} />
      <SelectField label="Career / advising staff" value={form.advisingStaffCount} onChange={(value) => setField("advisingStaffCount", value)} options={["1", "2-5", "6-10", "11-25", "25+"]} />
      <CheckboxGroup label="Primary pain points" values={form.operationalChallenges} onChange={(value) => setField("operationalChallenges", value)} options={operationalChallengeOptions()} />
      <TextArea className="wide-field" label="Reporting wish" value={form.reportingWish} onChange={(value) => setField("reportingWish", value)} placeholder="What report do you wish your organization could generate today but cannot?" />
      <SalesFields form={form} setField={setField} showPilotLevel />
    </>
  );
}

function WorkforceBranch({ form, setField }: BranchProps) {
  return (
    <>
      <OrganizationFields form={form} setField={setField} title="Workforce profile" />
      <SelectField label="Program type" value={form.programType} onChange={(value) => setField("programType", value)} options={[
        "Workforce development",
        "Disability employment",
        "Youth employment",
        "Adult education",
        "Re-entry program",
        "Veteran employment",
        "Economic development",
        "Career training",
        "Other"
      ]} />
      <SelectField label="Funding source" value={form.fundingSource} onChange={(value) => setField("fundingSource", value)} options={[
        "WIOA",
        "Vocational Rehabilitation",
        "Perkins",
        "State grant",
        "Federal grant",
        "Local government",
        "Philanthropy",
        "Unknown",
        "Other"
      ]} />
      <CheckboxGroup label="Primary population" values={form.primaryPopulation} onChange={(value) => setField("primaryPopulation", value)} options={populationOptions()} />
      <CheckboxGroup label="Biggest challenges" values={form.operationalChallenges} onChange={(value) => setField("operationalChallenges", value)} options={operationalChallengeOptions()} />
      <TextArea className="wide-field" label="Reporting wish" value={form.reportingWish} onChange={(value) => setField("reportingWish", value)} placeholder="What report do you wish your organization could generate today but cannot?" />
      <SalesFields form={form} setField={setField} showPilotLevel />
    </>
  );
}

function EmployerBranch({ form, setField }: BranchProps) {
  return (
    <>
      <div className="form-section-title"><span>Employer profile</span></div>
      <TextField label="Company name" value={form.organization} onChange={(value) => setField("organization", value)} required />
      <TextField label="Role / title" value={form.role} onChange={(value) => setField("role", value)} />
      <SelectField label="Company size" value={form.companySize} onChange={(value) => setField("companySize", value)} options={["1-10", "11-50", "51-250", "251-1,000", "1,000+"]} />
      <SelectField label="Hiring volume / year" value={form.hiringVolume} onChange={(value) => setField("hiringVolume", value)} options={["1-10", "11-50", "51-250", "250+"]} />
      <TextArea label="Roles hiring for" value={form.rolesHiringFor} onChange={(value) => setField("rolesHiringFor", value)} />
      <TextArea label="Skills hard to find" value={form.skillsHardToFind} onChange={(value) => setField("skillsHardToFind", value)} />
      <CheckboxGroup label="Hiring pain points" values={form.employerPainPoints} onChange={(value) => setField("employerPainPoints", value)} options={[
        "Too many unqualified applicants",
        "Hard to identify readiness",
        "Skills mismatch",
        "Resume quality",
        "Entry-level hiring",
        "Internship hiring",
        "Diversity pipeline",
        "Workforce partnerships",
        "Other"
      ]} />
      <CheckboxGroup label="Interest type" values={form.employerInterestTypes} onChange={(value) => setField("employerInterestTypes", value)} options={[
        "Candidate readiness reports",
        "Employer partnership",
        "Workforce pipeline",
        "Internship pipeline",
        "Product feedback",
        "Pilot discussion"
      ]} />
      <SalesFields form={form} setField={setField} />
    </>
  );
}

function OrganizationFields({ form, setField, title }: BranchProps & { title: string }) {
  return (
    <>
      <div className="form-section-title"><span>{title}</span></div>
      <TextField label="Organization name" value={form.organization} onChange={(value) => setField("organization", value)} required />
      <SelectField label="Organization type" value={form.organizationType} onChange={(value) => setField("organizationType", value)} options={[
        "University",
        "Community College",
        "High School",
        "High School District",
        "CTE Program",
        "Bootcamp",
        "Workforce Board",
        "Vocational Rehabilitation",
        "Government Agency",
        "Nonprofit",
        "Employer",
        "Other"
      ]} />
      <TextField label="Role / title" value={form.role} onChange={(value) => setField("role", value)} />
      <SelectField label="Population served annually" value={form.populationServed} onChange={(value) => setField("populationServed", value)} options={POPULATION_RANGES} />
      <SelectField label="Current process" value={form.currentProcess} onChange={(value) => setField("currentProcess", value)} options={CURRENT_PROCESSES} />
      <TextArea label="Current tools" value={form.currentTools} onChange={(value) => setField("currentTools", value)} placeholder="Handshake, Salesforce, spreadsheets, advising notes..." />
      <TextArea label="Desired features" value={form.desiredFeatures} onChange={(value) => setField("desiredFeatures", value)} placeholder="Dashboards, scoring, cohort reports, advisor workflows..." />
    </>
  );
}

function SalesFields({ form, setField, showPilotLevel = false }: BranchProps & { showPilotLevel?: boolean }) {
  return (
    <>
      {showPilotLevel && (
        <SelectField label="Pilot interest" value={form.pilotInterestLevel} onChange={(value) => setField("pilotInterestLevel", value)} options={PILOT_INTEREST} />
      )}
      <SelectField label="Buying authority" value={form.buyingAuthority} onChange={(value) => setField("buyingAuthority", value)} options={BUYING_AUTHORITY} />
      <SelectField label="Timeline" value={form.timeline} onChange={(value) => setField("timeline", value)} options={TIMELINES} />
    </>
  );
}

type SetField = <K extends keyof WaitlistForm>(key: K, value: WaitlistForm[K]) => void;
type BranchProps = { form: WaitlistForm; setField: SetField };

function TextField({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  placeholder = "",
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const inputId = useId();
  return (
    <label className={className} htmlFor={inputId}>
      <span>
        {label}
        {required && <span className="required-mark" aria-hidden="true"> *</span>}
      </span>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  className = "",
  placeholder = "",
  required = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const inputId = useId();
  return (
    <label className={className} htmlFor={inputId}>
      <span>
        {label}
        {required && <span className="required-mark" aria-hidden="true"> *</span>}
      </span>
      <textarea
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const inputId = useId();
  return (
    <label htmlFor={inputId}>
      <span>{label}</span>
      <select id={inputId} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGroup({
  label,
  values,
  onChange,
  options
}: {
  label: string;
  values: string[];
  onChange: (value: string[]) => void;
  options: string[];
}) {
  return (
    <fieldset className="checkbox-group">
      <legend>{label}</legend>
      {options.map((item) => (
        <label key={item}>
          <input
            type="checkbox"
            checked={values.includes(item)}
            onChange={(event) =>
              onChange(event.target.checked ? [...values, item] : values.filter((value) => value !== item))
            }
          />
          <span>{item}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
      </span>
    </label>
  );
}

function branchHeading(userType: string) {
  if (userType === "Individual Job Seeker") return "Personal career intelligence";
  if (userType === "Student") return "Student readiness and launch planning";
  if (userType === "Career Counselor / Advisor") return "Advisor workflow and reporting";
  if (userType === "Institution / Program Leader") return "Institutional pilot qualification";
  if (userType === "Workforce / Gov / Nonprofit") return "Workforce and grant reporting fit";
  return "Employer pipeline intelligence";
}

function populationOptions() {
  return [
    "High school students",
    "College students",
    "Graduate students",
    "Adult learners",
    "Unemployed job seekers",
    "Disabled job seekers",
    "Career changers",
    "Veterans",
    "Justice-impacted individuals",
    "Immigrants or refugees",
    "Low-income workers",
    "Other"
  ];
}

function operationalChallengeOptions() {
  return [
    "Resume readiness",
    "Career readiness",
    "Resume review workload",
    "Student engagement",
    "Application tracking",
    "Outcome reporting",
    "Employer alignment",
    "Skill gap visibility",
    "Advisor workload",
    "Grant reporting",
    "Program evaluation",
    "Data visibility",
    "Other"
  ];
}
