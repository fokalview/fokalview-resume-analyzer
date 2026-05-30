import { useState, type FormEvent } from "react";
import { ArrowRight, BarChart3, ClipboardList, ShieldCheck, UsersRound } from "lucide-react";

const ORGANIZATION_TYPES = [
  "Higher education",
  "Workforce board",
  "Career services",
  "Employer",
  "Student / job seeker",
  "Advisor / mentor",
  "Other"
];

export default function WaitlistScreen() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    organizationType: "",
    role: "",
    city: "",
    state: "",
    country: "",
    linkedinUrl: "",
    biggestChallenge: "",
    currentTools: "",
    desiredFeatures: "",
    interviewInterest: true,
    betaInterest: true,
    pilotInterest: false,
    budgetInterest: false
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
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "public_waitlist" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not join waitlist.");
      setStatus("You're on the list. If you opted into discovery, we'll use this to prioritize outreach.");
      setForm({
        name: "",
        email: "",
        organization: "",
        organizationType: "",
        role: "",
        city: "",
        state: "",
        country: "",
        linkedinUrl: "",
        biggestChallenge: "",
        currentTools: "",
        desiredFeatures: "",
        interviewInterest: true,
        betaInterest: true,
        pilotInterest: false,
        budgetInterest: false
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not join waitlist.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="waitlist-shell">
      <section className="waitlist-card">
        <div className="waitlist-hero">
          <div className="waitlist-copy">
            <p className="eyebrow">SagittaIQ - Institutional Early Access</p>
            <h1>Workforce readiness, built on real data.</h1>
            <p>
              Analytics powered by actual resume and application data, not assumptions. Built for
              career centers, workforce boards, and institutional partners who need actionable insight.
            </p>
            <div className="waitlist-tags">
              <span>Resume scoring</span>
              <span>Cohort analytics</span>
              <span>Advisor workflows</span>
              <span>Institutional reporting</span>
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

      <form className="waitlist-form" onSubmit={submit}>
        <div className="form-section-title">
          <span>Your information</span>
        </div>
        <label>
          Full name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          Work email
          <input
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            type="email"
            required
          />
        </label>
        <label>
          Organization
          <input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} />
        </label>
        <label>
          Organization type
          <select
            value={form.organizationType}
            onChange={(event) => setForm({ ...form, organizationType: event.target.value })}
          >
            <option value="">Select type</option>
            {ORGANIZATION_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Role
          <input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />
        </label>
        <label>
          City
          <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
        </label>
        <label>
          State
          <input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
        </label>
        <label>
          Country
          <input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
        </label>
        <label className="wide-field">
          LinkedIn
          <input
            value={form.linkedinUrl}
            onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })}
            placeholder="https://linkedin.com/in/..."
          />
        </label>
        <div className="form-section-title">
          <span>Context and challenges</span>
        </div>
        <label className="wide-field">
          Biggest challenge
          <textarea
            value={form.biggestChallenge}
            onChange={(event) => setForm({ ...form, biggestChallenge: event.target.value })}
            placeholder="What is hardest about career readiness, applications, or workforce reporting today?"
          />
        </label>
        <label>
          Current tools
          <textarea
            value={form.currentTools}
            onChange={(event) => setForm({ ...form, currentTools: event.target.value })}
            placeholder="Spreadsheets, Handshake, advising notes, ATS, email..."
          />
        </label>
        <label>
          Desired features
          <textarea
            value={form.desiredFeatures}
            onChange={(event) => setForm({ ...form, desiredFeatures: event.target.value })}
            placeholder="Dashboards, resume scoring, advisor workflows, exports..."
          />
        </label>

        <div className="form-section-title">
          <span>Engagement interest</span>
        </div>
        <section className="waitlist-options">
          <Toggle
            label="Discovery interview"
            help="30 min call with the SagittaIQ team"
            checked={form.interviewInterest}
            onChange={(value) => setForm({ ...form, interviewInterest: value })}
          />
          <Toggle
            label="Beta access"
            help="Early platform access before public launch"
            checked={form.betaInterest}
            onChange={(value) => setForm({ ...form, betaInterest: value })}
          />
          <Toggle
            label="Institutional pilot"
            help="Formal pilot with onboarding support"
            checked={form.pilotInterest}
            onChange={(value) => setForm({ ...form, pilotInterest: value })}
          />
          <Toggle
            label="Procurement involvement"
            help="Influence or hold budget decisions"
            checked={form.budgetInterest}
            onChange={(value) => setForm({ ...form, budgetInterest: value })}
          />
        </section>

        {error && <p className="error-message">{error}</p>}
        {status && <p className="success-message">{status}</p>}

        <button className="primary-button waitlist-submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Request access"}
          <ArrowRight size={18} />
        </button>
      </form>
      </section>
    </main>
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
