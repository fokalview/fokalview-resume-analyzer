import { useId, useState, type FormEvent } from "react";
import { ArrowRight, ClipboardCheck } from "lucide-react";

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
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("");
    setError("");
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
    <main className="waitlist-shell">
      <a className="skip-link" href="#follow-up-form">Skip to follow-up form</a>
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

        <form id="follow-up-form" className="waitlist-form" onSubmit={submit} aria-label="SagittaIQ career progress follow-up" aria-busy={isSubmitting}>
          <div className="form-section-title"><span>Identifiers</span></div>
          <TextField label="Lead ID" value={form.leadId} onChange={(value) => setForm({ ...form, leadId: value })} placeholder="LD-000001" />
          <TextField label="Candidate ID" value={form.candidateId} onChange={(value) => setForm({ ...form, candidateId: value })} placeholder="SGQ-C-000001" />
          <TextField label="Contact ID" value={form.contactId} onChange={(value) => setForm({ ...form, contactId: value })} placeholder="CT-000001" />
          <TextField label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} type="email" placeholder="Used only as hashed linkage" />

          <div className="form-section-title"><span>Progress</span></div>
          <SelectField label="Current status" value={form.currentStatus} onChange={(value) => setForm({ ...form, currentStatus: value })} options={CURRENT_STATUSES} />
          <SelectField label="Placement status" value={form.placementStatus} onChange={(value) => setForm({ ...form, placementStatus: value })} options={PLACEMENT_STATUSES} />
          <TextField label="Applications sent" value={form.applicationCount} onChange={(value) => setForm({ ...form, applicationCount: value })} type="number" />
          <TextField label="Interviews" value={form.interviewCount} onChange={(value) => setForm({ ...form, interviewCount: value })} type="number" />
          <TextField label="Offers" value={form.offerCount} onChange={(value) => setForm({ ...form, offerCount: value })} type="number" />
          <TextField label="Current role" value={form.currentRole} onChange={(value) => setForm({ ...form, currentRole: value })} />
          <SelectField label="Current industry" value={form.currentIndustry} onChange={(value) => setForm({ ...form, currentIndustry: value })} options={INDUSTRIES} />
          <SelectField label="Salary range" value={form.salaryRange} onChange={(value) => setForm({ ...form, salaryRange: value })} options={SALARY_RANGES} />
          <label className="wide-field">
            <span>Support needed</span>
            <textarea
              value={form.supportNeeded}
              onChange={(event) => setForm({ ...form, supportNeeded: event.target.value })}
              placeholder="Resume help, interview prep, application strategy, salary negotiation..."
            />
          </label>
          <label className="wide-field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
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
  placeholder = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const inputId = useId();
  return (
    <label htmlFor={inputId}>
      <span>{label}</span>
      <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} />
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
