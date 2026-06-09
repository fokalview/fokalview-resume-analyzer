import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BriefcaseBusiness, CalendarClock, Download, Edit3, ExternalLink, Plus, RefreshCw, RotateCcw, X } from "lucide-react";
import {
  deleteApplicationRecord,
  getApplications,
  getResumeRecords,
  saveApplicationRecord,
  updateApplicationStatus,
  type ApplicationRecord,
  type ResumeRecord
} from "../services/api";
import { downloadResumeReport } from "../services/report";
import { PageHeader, Toast } from "../components/ExperienceUI";

const STATUSES = [
  "Interested",
  "Researching",
  "Applying",
  "Applied",
  "Recruiter Contact",
  "Interviewing",
  "Final Interview",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn"
];

type Props = {
  onRerun: (opportunity: ApplicationRecord) => void;
};

export default function ApplicationTracker({ onRerun }: Props) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [resumeRecords, setResumeRecords] = useState<ResumeRecord[]>([]);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    salary: "",
    status: "Applied",
    url: "",
    jobDescription: "",
    notes: "",
    followUpDate: "",
    nextAction: "",
    priority: "Medium",
    resumeVersion: "",
    interviewDate: "",
    offerAmount: "",
    outcomeNotes: ""
  });
  const [editingId, setEditingId] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void loadApplications();
  }, []);

  async function loadApplications() {
    setIsLoading(true);
    setError("");
    try {
      const [nextApplications, nextResumeRecords] = await Promise.all([
        getApplications(),
        getResumeRecords().catch(() => [])
      ]);
      setApplications(nextApplications);
      setResumeRecords(nextResumeRecords);
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
        jobDescription: form.jobDescription,
        notes: combinedNotes(form),
        source: sourceFromUrl(form.url),
        ...(editingId ? { id: editingId } : {})
      });
      setApplications((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? { ...saved, createdAt: item.createdAt } : item))
          : [saved, ...current]
      );
      resetForm();
      setNotice(editingId ? "Opportunity updated." : "Opportunity added to your tracker.");
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
      jobDescription: item.jobDescription || "",
      ...notesToForm(item.notes)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId("");
    setForm({
      title: "",
      company: "",
      location: "",
      salary: "",
      status: "Applied",
      url: "",
      jobDescription: "",
      notes: "",
      followUpDate: "",
      nextAction: "",
      priority: "Medium",
      resumeVersion: "",
      interviewDate: "",
      offerAmount: "",
      outcomeNotes: ""
    });
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
      setNotice(`Status updated to ${result.status}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update status.");
    }
  }

  async function deleteApplication(item: ApplicationRecord) {
    const label = [item.title, item.company].filter(Boolean).join(" at ");
    const confirmed = window.confirm(`Delete ${label || "this opportunity"}? This removes it from your tracker.`);
    if (!confirmed) return;

    setError("");
    try {
      await deleteApplicationRecord(item.id);
      setApplications((current) => current.filter((entry) => entry.id !== item.id));
      setExpandedNotes((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      if (editingId === item.id) resetForm();
      setNotice("Opportunity deleted.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete application.");
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
      <PageHeader
        eyebrow="Opportunities"
        title="Manage your active career opportunities."
        description="Keep the next action, milestone, and outcome for every opportunity in one place."
        actions={<button className="secondary-action" onClick={loadApplications} disabled={isLoading}><RefreshCw className={isLoading ? "spin" : ""} size={16} />Refresh</button>}
      />
      <Toast message={notice} onDismiss={() => setNotice("")} />

      <section className="application-stats">
        <Metric label="Total" value={applications.length} />
        {["Applied", "Interviewing", "Offer", "Accepted"].map((status) => (
          <Metric key={status} label={status} value={counts[status] || 0} />
        ))}
      </section>

      <form className="application-form" onSubmit={submit}>
        <div className="form-intro">
          <div>
            <span className="eyebrow">{editingId ? "Editing opportunity" : "Add opportunity"}</span>
            <h3>{editingId ? "Update the next milestone." : "Capture what you are pursuing."}</h3>
          </div>
          {editingId && <button type="button" className="secondary-action" onClick={resetForm}><X size={16} />Cancel edit</button>}
        </div>
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
        <section className="application-job-description" aria-labelledby="job-description-heading">
          <div>
            <h3 id="job-description-heading">Job description</h3>
            <p>Keep the original posting here so every review uses the same opportunity requirements.</p>
          </div>
          <textarea
            aria-label="Job description"
            value={form.jobDescription}
            onChange={(event) => setForm({ ...form, jobDescription: event.target.value })}
            placeholder="Paste the original job description. SagittaIQ uses this as the stable source for readiness scoring."
          />
        </section>
        <label className="application-notes">
          Notes
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Follow-up date, referral, resume version, contact..."
          />
        </label>
        <label>
          Follow-up date
          <input
            value={form.followUpDate}
            onChange={(event) => setForm({ ...form, followUpDate: event.target.value })}
            type="date"
          />
        </label>
        <label>
          Next action
          <input
            value={form.nextAction}
            onChange={(event) => setForm({ ...form, nextAction: event.target.value })}
            placeholder="Email recruiter, tailor resume, schedule prep..."
          />
        </label>
        <label>
          Priority
          <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label>
          Resume version used
          <input
            value={form.resumeVersion}
            onChange={(event) => setForm({ ...form, resumeVersion: event.target.value })}
            placeholder="Data analyst v2, product resume..."
          />
        </label>
        <label>
          Interview date
          <input
            value={form.interviewDate}
            onChange={(event) => setForm({ ...form, interviewDate: event.target.value })}
            type="date"
          />
        </label>
        <label>
          Offer amount
          <input
            value={form.offerAmount}
            onChange={(event) => setForm({ ...form, offerAmount: event.target.value })}
            placeholder="$85,000 or $35/hr"
          />
        </label>
        <label className="application-notes">
          Outcome notes
          <textarea
            value={form.outcomeNotes}
            onChange={(event) => setForm({ ...form, outcomeNotes: event.target.value })}
            placeholder="Outcome, lessons learned, advisor notes, follow-up context..."
          />
        </label>
        <button className="primary-button">
          <Plus size={18} />
          {editingId ? "Save changes" : "Add application"}
        </button>
      </form>

      {error && <p className="error-message">{error}</p>}

      <div className="application-toolbar">
        <h3>Recent applications</h3>
        <div className="toolbar-actions">
          <button
            className="secondary-action"
            onClick={() => downloadResumeReport({ applications, title: "SagittaIQ Opportunity Tracker" })}
          >
            Download PDF
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
                {item.applicationId && <small>{item.applicationId}</small>}
                {item.salary && <span>Salary: {item.salary}</span>}
                {typeof item.latestReadinessScore === "number" && (
                  <div className="opportunity-readiness">
                    <div>
                      <span className={`score-pill ${scoreTone(item.latestReadinessScore)}`}>{item.latestReadinessScore}%</span>
                      <div>
                        <strong>Latest readiness</strong>
                        <small>
                          {readinessChangeLabel(item)}
                          {" - "}
                          {item.analysisCount || 1} review{item.analysisCount === 1 ? "" : "s"}
                          {item.lastAnalyzedAt ? ` - updated ${ageLabel(item.lastAnalyzedAt)}` : ""}
                        </small>
                      </div>
                    </div>
                    {item.analysisHistory && item.analysisHistory.length > 1 && (
                      <div className="opportunity-score-history" aria-label="Readiness score history">
                        {item.analysisHistory.slice(0, 8).reverse().map((entry, index) => (
                          <span
                            key={`${entry.analyzedAt}-${index}`}
                            style={{ height: `${Math.max(12, entry.score)}%` }}
                            title={`${entry.score}% - ${entry.scoringVersion || "legacy rubric"} - ${formatShortDate(entry.analyzedAt)}`}
                          />
                        ))}
                      </div>
                    )}
                    {item.latestAnalysis?.improvements?.length ? (
                      <details>
                        <summary>Latest priority improvements</summary>
                        <ul>
                          {item.latestAnalysis.improvements.slice(0, 3).map((improvement) => (
                            <li key={improvement.title}><strong>{improvement.priority}</strong>{improvement.title}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                )}
                <ReviewRuns
                  opportunity={item}
                  runs={resumeRecords.filter((record) => record.opportunityId === item.id)}
                  onRerun={onRerun}
                />
                {item.jobDescription && (
                  <details className="opportunity-job-description">
                    <summary>Job description</summary>
                    <p>{item.jobDescription}</p>
                  </details>
                )}
                {item.jobQualifications && (
                  <details className="opportunity-job-description">
                    <summary>AI-extracted qualifications</summary>
                    <div className="opportunity-qualification-grid">
                      <QualificationList label="Required skills" values={item.jobQualifications.requiredSkills} />
                      <QualificationList label="Preferred skills" values={item.jobQualifications.preferredSkills} />
                      <QualificationList label="Tools" values={item.jobQualifications.tools} />
                      <QualificationList label="Responsibilities" values={item.jobQualifications.responsibilities} />
                      <QualificationList label="Education" values={item.jobQualifications.education} />
                      <QualificationList label="Certifications" values={item.jobQualifications.certifications} />
                    </div>
                    <p className="qualification-signals">
                      {[item.jobQualifications.experienceLevel, item.jobQualifications.yearsExperience, item.jobQualifications.employmentType, item.jobQualifications.location, item.jobQualifications.salary].filter(Boolean).join(" · ")}
                    </p>
                  </details>
                )}
                {item.notes && (
                  <div className="application-note-preview">
                    <p className={expandedNotes[item.id] ? "expanded" : ""}>{item.notes}</p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setExpandedNotes((current) => ({ ...current, [item.id]: !current[item.id] }))}
                    >
                      {expandedNotes[item.id] ? "Collapse notes" : "Expand notes"}
                    </button>
                  </div>
                )}
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
              <button className="secondary-action compact-action danger-action" onClick={() => void deleteApplication(item)}>
                <X size={15} />
                Delete
              </button>
            </article>
          ))
        ) : (
          <div className="empty-panel">
            <BriefcaseBusiness size={24} />
            <strong>No applications yet.</strong>
            <span>Add your first opportunity above.</span>
          </div>
        )}
      </section>
    </section>
  );
}

function ReviewRuns({
  opportunity,
  runs,
  onRerun
}: {
  opportunity: ApplicationRecord;
  runs: ResumeRecord[];
  onRerun: (opportunity: ApplicationRecord) => void;
}) {
  return (
    <details className="opportunity-review-runs">
      <summary>
        <span>Review runs</span>
        <strong>{runs.length}</strong>
      </summary>
      <div className="review-runs-header">
        <p>Each run preserves its resume profile, analysis, score, rubric version, and timestamp.</p>
        <button className="secondary-action compact-action" type="button" onClick={() => onRerun(opportunity)}>
          <RotateCcw size={15} />
          Rerun with revised resume
        </button>
      </div>
      {runs.length ? (
        <ol className="review-run-list">
          {runs.map((run, index) => (
            <li key={run.id}>
              <span className={`score-pill ${scoreTone(run.analysis.score)}`}>{run.analysis.score}%</span>
              <div>
                <strong>{run.resumeLabel || (index === 0 ? "Latest run" : `Run ${runs.length - index}`)}</strong>
                <small>{formatShortDate(run.updatedAt)} · {run.analysis.scoringVersion || "legacy rubric"} · {run.reportId || run.id.slice(0, 8)}</small>
              </div>
              <button
                className="secondary-action compact-action"
                type="button"
                onClick={() => downloadResumeReport({
                  analysis: run.analysis,
                  job: {
                    targetRole: opportunity.title,
                    title: opportunity.title,
                    company: opportunity.company,
                    location: opportunity.location,
                    salary: opportunity.salary,
                    url: opportunity.url,
                    notes: opportunity.notes,
                    source: opportunity.source,
                    jobContext: opportunity.jobDescription
                  },
                  title: `${opportunity.title} readiness review`
                })}
              >
                <Download size={15} />
                Report
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="review-runs-empty">No preserved review runs yet. The next rerun will appear here.</p>
      )}
    </details>
  );
}

function readinessChangeLabel(item: ApplicationRecord) {
  const history = item.analysisHistory || [];
  const currentVersion = item.latestAnalysis?.scoringVersion;
  if (typeof item.latestReadinessScore !== "number") return "Baseline established";
  const comparableHistory = currentVersion
    ? history.filter((entry) => entry.scoringVersion === currentVersion)
    : history.filter((entry) => !entry.scoringVersion);
  if (comparableHistory.length < 2) return currentVersion ? `Baseline established under ${currentVersion}` : "Baseline established";
  const baseline = comparableHistory[comparableHistory.length - 1]?.score;
  if (typeof baseline !== "number") return "Baseline established";
  const change = item.latestReadinessScore - baseline;
  if (change > 0) return `Improved ${change} point${change === 1 ? "" : "s"} from ${baseline}%`;
  if (change < 0) return `Changed ${change} points from ${baseline}%`;
  return `No score change from ${baseline}%`;
}

function combinedNotes(form: {
  notes: string;
  followUpDate: string;
  nextAction: string;
  priority: string;
  resumeVersion: string;
  interviewDate: string;
  offerAmount: string;
  outcomeNotes: string;
}) {
  const metadata = [
    form.followUpDate && `Follow-up date: ${form.followUpDate}`,
    form.nextAction && `Next action: ${form.nextAction}`,
    form.priority && `Priority: ${form.priority}`,
    form.resumeVersion && `Resume version used: ${form.resumeVersion}`,
    form.interviewDate && `Interview date: ${form.interviewDate}`,
    form.offerAmount && `Offer amount: ${form.offerAmount}`,
    form.outcomeNotes && `Outcome notes: ${form.outcomeNotes}`
  ].filter(Boolean);
  return [form.notes, ...metadata].filter(Boolean).join("\n");
}

function notesToForm(notes: string) {
  const valueFor = (label: string) => {
    const match = notes.split(/\r?\n/).find((line) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    return match ? match.slice(match.indexOf(":") + 1).trim() : "";
  };
  const plainNotes = notes
    .split(/\r?\n/)
    .filter((line) =>
      ![
        "Follow-up date",
        "Next action",
        "Priority",
        "Resume version used",
        "Interview date",
        "Offer amount",
        "Outcome notes"
      ].some((label) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`))
    )
    .join("\n");

  return {
    notes: plainNotes,
    followUpDate: valueFor("Follow-up date"),
    nextAction: valueFor("Next action"),
    priority: valueFor("Priority") || "Medium",
    resumeVersion: valueFor("Resume version used"),
    interviewDate: valueFor("Interview date"),
    offerAmount: valueFor("Offer amount"),
    outcomeNotes: valueFor("Outcome notes")
  };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function QualificationList({ label, values }: { label: string; values: string[] }) {
  if (!values?.length) return null;
  return (
    <section>
      <strong>{label}</strong>
      <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul>
    </section>
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

function scoreTone(score: number) {
  if (score < 65) return "score-low";
  if (score < 85) return "score-mid";
  return "score-high";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}
