import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BriefcaseBusiness, CalendarClock, ExternalLink, Plus, RefreshCw } from "lucide-react";
import {
  getApplications,
  saveApplicationRecord,
  type ApplicationRecord
} from "../services/api";
import { getStoredUserEmail } from "../services/access";

const STATUSES = ["Interested", "Applied", "Interviewing", "Offer", "Rejected"];

export default function ApplicationTracker() {
  const userEmail = getStoredUserEmail();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    status: "Applied",
    url: "",
    notes: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (userEmail) void loadApplications();
  }, [userEmail]);

  async function loadApplications() {
    setIsLoading(true);
    setError("");
    try {
      setApplications(await getApplications());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load applications.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const saved = await saveApplicationRecord({
        title: form.title,
        company: form.company,
        location: form.location,
        status: form.status,
        url: form.url,
        notes: form.notes,
        source: sourceFromUrl(form.url)
      });
      setApplications((current) => [saved, ...current]);
      setForm({ title: "", company: "", location: "", status: "Applied", url: "", notes: "" });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save application.");
    }
  }

  const counts = useMemo(
    () =>
      STATUSES.reduce<Record<string, number>>((nextCounts, status) => {
        nextCounts[status] = applications.filter((item) => item.status === status).length;
        return nextCounts;
      }, {}),
    [applications]
  );

  if (!userEmail) {
    return (
      <section className="screen applications-screen">
        <div className="screen-heading">
          <p className="eyebrow">Applications</p>
          <h2>Add an email to unlock your application tracker.</h2>
          <p>
            The tracker uses your email as a private hashed identifier so your applications can follow
            you across devices. Sign out by closing the session, then enter the beta code with email.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen applications-screen">
      <div className="screen-heading">
        <p className="eyebrow">Applications</p>
        <h2>Your application tracker.</h2>
        <p>Track recent applications, status, timing, and follow-up notes tied to your beta profile.</p>
      </div>

      <section className="application-stats">
        <Metric label="Total" value={applications.length} />
        {STATUSES.map((status) => (
          <Metric key={status} label={status} value={counts[status] || 0} />
        ))}
      </section>

      <form className="application-form" onSubmit={submit}>
        <label>
          Role
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Product analyst"
            required
          />
        </label>
        <label>
          Company
          <input
            value={form.company}
            onChange={(event) => setForm({ ...form, company: event.target.value })}
            placeholder="Company"
            required
          />
        </label>
        <label>
          Status
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Location
          <input
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
            placeholder="Remote, Rochester, NY"
          />
        </label>
        <label>
          Job URL
          <input
            value={form.url}
            onChange={(event) => setForm({ ...form, url: event.target.value })}
            placeholder="https://..."
          />
        </label>
        <label className="application-notes">
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Follow-up date, referral, resume version, contact..."
          />
        </label>
        <button className="primary-button">
          <Plus size={18} />
          Add application
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}

      <div className="application-toolbar">
        <h3>Recent applications</h3>
        <button className="secondary-action" onClick={loadApplications} disabled={isLoading}>
          <RefreshCw className={isLoading ? "spin" : ""} size={16} />
          Refresh
        </button>
      </div>

      <section className="application-list">
        {applications.length ? (
          applications.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.company} - {item.location || "Location not saved"}</span>
                {item.notes && <p>{item.notes}</p>}
              </div>
              <span className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</span>
              <span className="age-label">
                <CalendarClock size={15} />
                {ageLabel(item.createdAt)}
              </span>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                </a>
              )}
            </article>
          ))
        ) : (
          <div className="empty-panel">
            <BriefcaseBusiness size={24} />
            <strong>No applications yet.</strong>
            <span>Add your first application above.</span>
          </div>
        )}
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function sourceFromUrl(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function ageLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
