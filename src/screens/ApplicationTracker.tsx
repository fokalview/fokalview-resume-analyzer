import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BriefcaseBusiness, CalendarClock, Edit3, ExternalLink, Plus, RefreshCw, X } from "lucide-react";
import {
  getApplications,
  saveApplicationRecord,
  updateApplicationStatus,
  type ApplicationRecord
} from "../services/api";
import { downloadResumeReport } from "../services/report";

const STATUSES = ["Interested", "Applied", "Interviewing", "Offer", "Rejected"];

export default function ApplicationTracker() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    salary: "",
    status: "Applied",
    url: "",
    notes: ""
  });
  const [editingId, setEditingId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadApplications();
  }, []);

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
        salary: form.salary,
        status: form.status,
        url: form.url,
        notes: form.notes,
        source: sourceFromUrl(form.url),
        ...(editingId ? { id: editingId } : {})
      });
      setApplications((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? { ...saved, createdAt: item.createdAt } : item))
          : [saved, ...current]
      );
      resetForm();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save application.");
    }
  }

  function editApplication(item: ApplicationRecord) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      company: item.company,
      location: item.location,
      salary: item.salary || "",
      status: item.status,
      url: item.url,
      notes: item.notes
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId("");
    setForm({ title: "", company: "", location: "", salary: "", status: "Applied", url: "", notes: "" });
  }

  async function changeStatus(id: string, status: string) {
    setError("");
    try {
      const result = await updateApplicationStatus(id, status);
      setApplications((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: result.status, updatedAt: result.updatedAt } : item
        )
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update status.");
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

  return (
    <section className="screen applications-screen">
      <div className="screen-heading">
        <p className="eyebrow">Applications</p>
        <h2>Your application tracker.</h2>
        <p>Applications are created when you run a resume against a job. Update milestones as they happen.</p>
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
          Salary
          <input
            value={form.salary}
            onChange={(event) => setForm({ ...form, salary: event.target.value })}
            placeholder="$65,000 - $80,000"
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
          {editingId ? "Save changes" : "Add application"}
        </button>
        {editingId && (
          <button type="button" className="secondary-action" onClick={resetForm}>
            <X size={16} />
            Cancel edit
          </button>
        )}
      </form>

      {error && <p className="error-message">{error}</p>}

      <div className="application-toolbar">
        <h3>Recent applications</h3>
        <div className="toolbar-actions">
          <button
            className="secondary-action"
            onClick={() => downloadResumeReport({ applications, title: "FokalView Application Tracker" })}
          >
            Download PDF
          </button>
          <button className="secondary-action" onClick={loadApplications} disabled={isLoading}>
            <RefreshCw className={isLoading ? "spin" : ""} size={16} />
            Refresh
          </button>
        </div>
      </div>

      <section className="application-list">
        {applications.length ? (
          applications.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.company} - {item.location || "Location not saved"}</span>
                {item.salary && <span>Salary: {item.salary}</span>}
                {item.notes && <p>{item.notes}</p>}
              </div>
              <select
                className={`status-select ${item.status.toLowerCase()}`}
                value={item.status}
                onChange={(event) => void changeStatus(item.id, event.target.value)}
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <span className="age-label">
                <CalendarClock size={15} />
                {ageLabel(item.createdAt)}
              </span>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                </a>
              )}
              <button className="secondary-action compact-action" onClick={() => editApplication(item)}>
                <Edit3 size={15} />
                Edit
              </button>
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
