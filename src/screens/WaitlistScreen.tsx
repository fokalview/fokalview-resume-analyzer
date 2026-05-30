import { useState, type FormEvent } from "react";
import { ArrowRight, ClipboardList, UsersRound } from "lucide-react";

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
      <section className="waitlist-hero">
        <div>
          <p className="eyebrow">FokalView Early Access</p>
          <h1>Build better workforce readiness from real resume and application data.</h1>
          <p>
            Join the customer discovery list for pilots, advisor interviews, beta access, and institutional
            workflow feedback.
          </p>
        </div>
        <div className="waitlist-summary">
          <article>
            <UsersRound size={20} />
            <strong>For programs</strong>
            <span>Career services, workforce boards, mentors, and pilot partners.</span>
          </article>
          <article>
            <ClipboardList size={20} />
            <strong>Discovery ready</strong>
            <span>Capture challenges, current tools, requested features, and pilot interest.</span>
          </article>
        </div>
      </section>

      <form className="waitlist-form" onSubmit={submit}>
        <label>
          Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          Email
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
        <label className="wide-field">
          Biggest challenge
          <textarea
            value={form.biggestChallenge}
            onChange={(event) => setForm({ ...form, biggestChallenge: event.target.value })}
            placeholder="What is hardest about resume readiness, applications, or workforce reporting today?"
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

        <section className="waitlist-options">
          <Toggle
            label="Open to a customer discovery interview"
            checked={form.interviewInterest}
            onChange={(value) => setForm({ ...form, interviewInterest: value })}
          />
          <Toggle
            label="Interested in beta access"
            checked={form.betaInterest}
            onChange={(value) => setForm({ ...form, betaInterest: value })}
          />
          <Toggle
            label="Potential pilot partner"
            checked={form.pilotInterest}
            onChange={(value) => setForm({ ...form, pilotInterest: value })}
          />
          <Toggle
            label="Budget-qualified or buying influence"
            checked={form.budgetInterest}
            onChange={(value) => setForm({ ...form, budgetInterest: value })}
          />
        </section>

        {error && <p className="error-message">{error}</p>}
        {status && <p className="success-message">{status}</p>}

        <button className="primary-button waitlist-submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Join waitlist"}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
