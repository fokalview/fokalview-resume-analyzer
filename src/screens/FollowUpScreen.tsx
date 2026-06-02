import { useId, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardCheck, Moon, Sun } from "lucide-react";

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

export default function FollowUpScreen() {
  const params = new URLSearchParams(window.location.search);
  const [form, setForm] = useState({
    leadId: params.get("leadId") || "",
    candidateId: params.get("candidateId") || "",
    contactId: params.get("contactId") || "",
    email: "",
    currentStatus: "Actively applying",
    applicationCount: "0",
    interviewCount: "0",
    offerCount: "0",
    placementStatus: "Not placed",
    currentRole: "",
    currentIndustry: "",
    salaryRange: "",
    supportNeeded: "",
    notes: ""
  });
  type FollowUpForm = typeof form;
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FollowUpForm, string>>>({});
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "public_follow_up" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save follow-up.");
      setStatus("Follow-up saved. Thank you for helping improve the readiness data.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save follow-up.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="waitlist-shell" data-theme={theme}>
      <a className="skip-link" href="#follow-up-form">Skip to follow-up form</a>
      <button className="theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <section className="waitlist-card followup-card">
        <div className="followup-hero">
          <ClipboardCheck size={32} />
          <p className="eyebrow">SagittaIQ follow-up</p>
          <h1>Update your career progress.</h1>
          <p>
            Share what happened after your resume review or waitlist signup. This helps improve future
            recommendations and workforce reporting without storing your raw email address.
          </p>
        </div>

        <form id="follow-up-form" className="waitlist-form" onSubmit={submit} aria-label="SagittaIQ career progress follow-up" aria-busy={isSubmitting} noValidate>
          <div className="form-section-title"><span>Identifiers</span></div>
          <TextField label="Lead ID" value={form.leadId} onChange={(value) => updateField("leadId", value)} placeholder="LD-000001" error={fieldErrors.leadId} />
          <TextField label="Candidate ID" value={form.candidateId} onChange={(value) => updateField("candidateId", value)} placeholder="SGQ-C-000001" />
          <TextField label="Contact ID" value={form.contactId} onChange={(value) => updateField("contactId", value)} placeholder="CT-000001" />
          <TextField label="Email" value={form.email} onChange={(value) => updateField("email", value)} type="email" placeholder="Used only as hashed linkage" error={fieldErrors.email} />

          <div className="form-section-title"><span>Progress</span></div>
          <SelectField label="Current status" value={form.currentStatus} onChange={(value) => updateField("currentStatus", value)} options={CURRENT_STATUSES} />
          <SelectField label="Placement status" value={form.placementStatus} onChange={(value) => updateField("placementStatus", value)} options={PLACEMENT_STATUSES} />
          <TextField label="Applications sent" value={form.applicationCount} onChange={(value) => updateField("applicationCount", value)} type="number" error={fieldErrors.applicationCount} />
          <TextField label="Interviews" value={form.interviewCount} onChange={(value) => updateField("interviewCount", value)} type="number" error={fieldErrors.interviewCount} />
          <TextField label="Offers" value={form.offerCount} onChange={(value) => updateField("offerCount", value)} type="number" error={fieldErrors.offerCount} />
          <TextField label="Current role" value={form.currentRole} onChange={(value) => updateField("currentRole", value)} />
          <SelectField label="Current industry" value={form.currentIndustry} onChange={(value) => updateField("currentIndustry", value)} options={INDUSTRIES} />
          <SelectField label="Salary range" value={form.salaryRange} onChange={(value) => updateField("salaryRange", value)} options={SALARY_RANGES} />
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

          {error && <p className="error-message" role="alert">{error}</p>}
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
  error = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
}) {
  const inputId = useId();
  const errorId = useId();
  return (
    <label className={error ? "field-error" : ""} htmlFor={inputId}>
      <span>{label}</span>
      <input
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
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
}) {
  const errors: Partial<Record<keyof typeof form, string>> = {};
  if (!form.leadId.trim() && !form.candidateId.trim() && !form.contactId.trim() && !form.email.trim()) {
    errors.leadId = "Enter at least one identifier or email so this can be linked.";
  }
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  (["applicationCount", "interviewCount", "offerCount"] as const).forEach((key) => {
    const value = Number(form[key]);
    if (!Number.isFinite(value) || value < 0) {
      errors[key] = "Enter zero or a positive number.";
    }
  });
  return errors;
}
