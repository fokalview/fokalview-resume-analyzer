import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { ProductBrand } from "../components/BrandFamily";
import PublicSiteMenu from "../components/PublicSiteMenu";
import { SearchableSelect } from "../components/SearchableSelect";
import { FormErrorSummary } from "../components/FormErrorSummary";
import { CURRENCY_SUGGESTIONS } from "../lib/formSuggestions";
import "../public-form-clarity.css";

const CURRENT_STATUSES = [
  "Still exploring",
  "Actively applying",
  "Interviewing",
  "Received offer",
  "Accepted role",
  "Paused search",
  "Other"
];

const PLACEMENT_STATUSES = ["Not placed", "Interviewing", "Offer received", "Placed", "Prefer not to say"];
const INDUSTRIES = ["Technology", "Healthcare", "Finance", "Education", "Government", "Manufacturing", "Creative or Media", "Skilled Trades", "Other"];
const SALARY_RANGES = ["Under $40k", "$40k to $60k", "$60k to $80k", "$80k to $100k", "$100k to $150k", "$150k+", "Prefer not to say"];
const SALARY_PERIODS = ["Annual", "Hourly", "Monthly", "Stipend", "Other"];
const VERIFICATION_STATUSES = ["Self-reported", "Advisor verified", "Employer verified", "Imported", "Unknown"];

export default function FollowUpScreen() {
  const params = new URLSearchParams(window.location.search);
  const [form, setForm] = useState({
    leadId: params.get("leadId") || "",
    candidateId: params.get("candidateId") || "",
    contactId: params.get("contactId") || "",
    email: "",
    phone: "",
    currentStatus: "",
    applicationCount: "",
    interviewCount: "",
    offerCount: "",
    placementStatus: "",
    currentRole: "",
    currentIndustry: "",
    salaryRange: "",
    employer: "",
    jobTitle: "",
    salaryAmount: "",
    salaryCurrency: "",
    salaryPeriod: "",
    outcomeDate: "",
    jobLocation: "",
    dataSource: "Self-reported follow-up",
    verificationStatus: "Self-reported",
    supportNeeded: "",
    notes: "",
    currentIndustryOther: ""
  });
  type FollowUpForm = typeof form;
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FollowUpForm, string>>>({});
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorAttempt, setErrorAttempt] = useState(0);

  function updateField<K extends keyof FollowUpForm>(key: K, value: FollowUpForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    setError("");

    const nextFieldErrors = validateFollowUp(form);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length) {
      setError("Please fix the highlighted fields before submitting.");
      setErrorAttempt(value => value + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, formVersion: "2026-11-04-clarity", source: "public_follow_up" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save follow-up.");
      setStatus("Follow-up saved. Thank you for helping improve the readiness data.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save follow-up.");
      setErrorAttempt(value => value + 1);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="waitlist-shell public-form-clarity" data-theme={theme}>
      <a className="skip-link" href="#follow-up-form">Skip to follow-up form</a>
      <PublicSiteMenu />
      <button className="theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <section className="waitlist-card followup-card">
        <div className="followup-hero">
          <ProductBrand product="connect" inverse />
          <p className="eyebrow">SagittaIQ follow-up</p>
          <h1>Update your career progress.</h1>
          <p>
            Share what happened after your resume review or waitlist signup. This helps improve future
            recommendations and workforce reporting. We retain the contact details you provide so our team can follow up.
          </p>
        </div>

        <form id="follow-up-form" className="waitlist-form" onSubmit={submit} aria-label="SagittaIQ career progress follow-up" aria-busy={isSubmitting} noValidate>
          <div className="form-introduction"><h2>Share your latest update</h2><p>Use the email from your signup, or the reference supplied by your advisor. Leave answers blank when unknown; enter 0 only when the count is zero.</p></div>
          <FormErrorSummary formId="follow-up-form" message={error} attempt={errorAttempt} />
          <div className="form-section-title"><span>Contact details</span></div>
          <TextField label="Email" value={form.email} onChange={(value) => updateField("email", value)} type="email" placeholder="Email address for follow-up" error={fieldErrors.email} />
          <TextField label="Phone number (optional, include country code)" value={form.phone} onChange={(value) => updateField("phone", value)} type="tel" />
          <details className="form-reference-details" open={Boolean(fieldErrors.leadId || fieldErrors.candidateId || fieldErrors.contactId) || undefined}>
            <summary>Invitation references (optional)</summary>
            <p className="field-help">Keep references from your invitation unchanged. They identify a record; they do not verify your identity. You can use your signup email instead.</p>
            <div className="form-reference-fields">
              <TextField label="Lead ID" value={form.leadId} onChange={(value) => updateField("leadId", value)} placeholder="LD-000001" error={fieldErrors.leadId} />
              <TextField label="Candidate ID" value={form.candidateId} onChange={(value) => updateField("candidateId", value)} placeholder="SGQ-C-000001" error={fieldErrors.candidateId} />
              <TextField label="Contact ID" value={form.contactId} onChange={(value) => updateField("contactId", value)} placeholder="CT-000001" error={fieldErrors.contactId} />
            </div>
          </details>

          <div className="form-section-title"><span>Progress</span></div>
          <SelectField label="Current status" value={form.currentStatus} onChange={(value) => updateField("currentStatus", value)} options={CURRENT_STATUSES} />
          <SelectField label="Placement status" value={form.placementStatus} onChange={(value) => updateField("placementStatus", value)} options={PLACEMENT_STATUSES} />
          <TextField label="Applications sent" value={form.applicationCount} onChange={(value) => updateField("applicationCount", value)} type="number" error={fieldErrors.applicationCount} />
          <TextField label="Interviews" value={form.interviewCount} onChange={(value) => updateField("interviewCount", value)} type="number" error={fieldErrors.interviewCount} />
          <TextField label="Offers" value={form.offerCount} onChange={(value) => updateField("offerCount", value)} type="number" error={fieldErrors.offerCount} />
          <TextField label="Current role" value={form.currentRole} onChange={(value) => updateField("currentRole", value)} />
          <SelectField label="Current industry" value={form.currentIndustry} onChange={(value) => updateField("currentIndustry", value)} options={INDUSTRIES} />
          {form.currentIndustry === "Other" && <TextField label="Other current industry" value={form.currentIndustryOther} onChange={value => updateField("currentIndustryOther", value)} />}
          <div className="form-section-title"><span>Role and compensation</span></div>
          <p className="wide-field field-help">Current role describes your present work; job title describes the offer or outcome you are reporting. The optional salary-range choices below use historical dollar labels with no recorded currency; use the exact amount, currency and period for a clear comparison.</p>
          <SelectField label="Salary range" value={form.salaryRange} onChange={(value) => updateField("salaryRange", value)} options={SALARY_RANGES} />
          <TextField label="Employer" value={form.employer} onChange={(value) => updateField("employer", value)} placeholder="Company or organization" />
          <TextField label="Job title" value={form.jobTitle} onChange={(value) => updateField("jobTitle", value)} placeholder="Software Engineer, Data Analyst..." />
          <TextField label="Salary amount" value={form.salaryAmount} onChange={(value) => updateField("salaryAmount", value)} type="number" step="0.01" placeholder="103400" error={fieldErrors.salaryAmount} />
          <SearchableSelect label="Salary currency (3-letter code, optional)" value={form.salaryCurrency} onChange={(value) => updateField("salaryCurrency", value.toUpperCase())} options={CURRENCY_SUGGESTIONS} placeholder="USD, EUR, GBP…" error={fieldErrors.salaryCurrency} help="Common suggestions are shown. You can enter another three-letter currency code; leave blank if unknown." />
          <SelectField label="Salary period" value={form.salaryPeriod} onChange={(value) => updateField("salaryPeriod", value)} options={SALARY_PERIODS} />
          <TextField label="Outcome date" value={form.outcomeDate} onChange={(value) => updateField("outcomeDate", value)} type="date" />
          <TextField label="Job location" value={form.jobLocation} onChange={(value) => updateField("jobLocation", value)} placeholder="Boston, MA / Remote" />
          <div className="form-section-title"><span>Source and support</span></div>
          <p className="wide-field field-help">This is a self-reported update. Any verification status you select is your claim and will be retained as such; it does not become independent advisor or employer verification.</p>
          <SelectField label="Reported verification status" value={form.verificationStatus} onChange={(value) => updateField("verificationStatus", value)} options={VERIFICATION_STATUSES} />
          <TextField label="Data source" value={form.dataSource} onChange={(value) => updateField("dataSource", value)} placeholder="Self-reported follow-up" />
          <label className="wide-field">
            <span>Support needed</span>
            <textarea
              value={form.supportNeeded}
              onChange={(event) => updateField("supportNeeded", event.target.value)}
              placeholder="Resume help, interview prep, application strategy, salary negotiation..."
            />
          </label>
          <label className="wide-field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              placeholder="Anything else you want the team to know."
            />
          </label>

          <p className="wide-field contact-notice">
            Your contact details and responses are available to authorized SagittaIQ administrators for follow-up and progress reporting.
          </p>
          {status && <p className="success-message" role="status" aria-live="polite">{status}</p>}

          <button className="primary-button waitlist-submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit follow-up"}
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  error = "",
  step = "1"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  step?: string;
}) {
  const inputId = useId();
  const errorId = useId();
  return (
    <label className={error ? "field-error" : ""} htmlFor={inputId}>
      <span id={`${inputId}-label`}>{label}</span>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : label === "Employer" ? "organization" : label === "Current role" ? "organization-title" : undefined}
        inputMode={type === "number" ? step === "0.01" ? "decimal" : "numeric" : undefined}
        step={type === "number" ? step : undefined} min={type === "number" ? 0 : undefined} max={type === "number" ? step === "0.01" ? 10000000 : 999 : undefined}
        aria-invalid={Boolean(error)}
        aria-labelledby={`${inputId}-label`}
        aria-describedby={error ? errorId : undefined}
      />
      {error && <small id={errorId} className="field-error-text">{error}</small>}
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

function validateFollowUp(form: {
  leadId: string;
  candidateId: string;
  contactId: string;
  email: string;
  applicationCount: string;
  interviewCount: string;
  offerCount: string;
  salaryAmount: string;
  salaryCurrency: string;
}) {
  const errors: Partial<Record<keyof typeof form, string>> = {};
  if (!form.leadId.trim() && !form.candidateId.trim() && !form.contactId.trim() && !form.email.trim()) {
    errors.email = "Enter your signup email or an invitation reference so this can be linked.";
  }
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  (["applicationCount", "interviewCount", "offerCount"] as const).forEach((key) => {
    const value = Number(form[key]);
    if (form[key].trim() && (!/^\d+$/.test(form[key].trim()) || !Number.isInteger(value) || value < 0 || value > 999)) {
      errors[key] = "Enter a whole number from 0 to 999, or leave blank if unknown.";
    }
  });
  if (form.salaryAmount.trim() && (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(form.salaryAmount.trim()) || Number(form.salaryAmount) > 10000000)) errors.salaryAmount = "Enter an amount from 0 to 10,000,000 with at most two decimal places, or leave blank.";
  if (form.salaryCurrency.trim() && !/^[A-Za-z]{3}$/.test(form.salaryCurrency.trim())) errors.salaryCurrency = "Enter a three-letter currency code, or leave blank.";
  return errors;
}
