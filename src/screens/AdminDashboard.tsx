import { useState, type FormEvent } from "react";
import { BarChart3, LockKeyhole, RefreshCw } from "lucide-react";

type CountItem = { label: string; count: number };

type AdminSummary = {
  totals: {
    resumeRecords: number;
    applicationCaptures: number;
    rawResumeRecords: number;
    averageReadinessScore: number;
  };
  careerLevels: Record<string, number>;
  targetRoles: CountItem[];
  topSkills: CountItem[];
  topTools: CountItem[];
  commonSkillGaps: CountItem[];
  applicationStatuses: Record<string, number>;
  applicationSources: CountItem[];
  readinessBands: Record<string, number>;
  recentResumeRecords: Array<{
    targetRole: string;
    currentTitle: string;
    careerLevel: string;
    score: number;
    capturedAt: string;
    rawResumeRetained: boolean;
  }>;
};

export default function AdminDashboard() {
  const [code, setCode] = useState(sessionStorage.getItem("fokalview_admin_access_code") || "");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSummary(event?: FormEvent) {
    event?.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/summary", {
        headers: { "X-Admin-Access-Code": code.trim() }
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not load admin summary.");
      }

      sessionStorage.setItem("fokalview_admin_access_code", code.trim());
      setSummary(payload as AdminSummary);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load admin summary.");
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Administrator</p>
          <h1>Workforce data dashboard</h1>
        </div>
        <form className="admin-access-form" onSubmit={loadSummary}>
          <label>
            <LockKeyhole size={16} />
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              type="password"
              placeholder="Admin access code"
            />
          </label>
          <button className="primary-button" disabled={!code.trim() || isLoading}>
            {isLoading ? <RefreshCw className="spin" size={18} /> : <BarChart3 size={18} />}
            Load
          </button>
        </form>
      </header>

      {error && <p className="error-message">{error}</p>}

      {summary && (
        <>
          <section className="admin-metrics">
            <Metric label="Resume records" value={summary.totals.resumeRecords} />
            <Metric label="Applications" value={summary.totals.applicationCaptures} />
            <Metric label="Average readiness" value={`${summary.totals.averageReadinessScore}%`} />
            <Metric label="Raw resumes retained" value={summary.totals.rawResumeRecords} />
          </section>

          <section className="admin-grid">
            <ChartPanel title="Readiness Bands" items={toCountItems(summary.readinessBands)} />
            <ChartPanel title="Career Levels" items={toCountItems(summary.careerLevels)} />
            <ChartPanel title="Application Statuses" items={toCountItems(summary.applicationStatuses)} />
            <ChartPanel title="Common Skill Gaps" items={summary.commonSkillGaps} />
            <ChartPanel title="Top Skills" items={summary.topSkills} />
            <ChartPanel title="Top Tools" items={summary.topTools} />
            <ChartPanel title="Target Roles" items={summary.targetRoles} />
            <ChartPanel title="Application Sources" items={summary.applicationSources} />
          </section>

          <section className="admin-table-panel">
            <h2>Recent Resume Records</h2>
            <div className="admin-table">
              {summary.recentResumeRecords.map((record, index) => (
                <article key={`${record.capturedAt}-${index}`}>
                  <div>
                    <strong>{record.currentTitle || record.targetRole || "Untitled profile"}</strong>
                    <span>{record.targetRole || "No target role"} · {record.careerLevel || "Unknown"}</span>
                  </div>
                  <span>{record.score}%</span>
                  <span>{formatDate(record.capturedAt)}</span>
                  <span>{record.rawResumeRetained ? "Raw retained" : "Profile only"}</span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function ChartPanel({ title, items }: { title: string; items: CountItem[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <section className="chart-panel">
      <h2>{title}</h2>
      <div className="bar-list">
        {items.length ? (
          items.map((item) => (
            <div className="bar-row" key={item.label}>
              <div>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
              <meter min="0" max={max} value={item.count} />
            </div>
          ))
        ) : (
          <p>No data yet.</p>
        )}
      </div>
    </section>
  );
}

function toCountItems(record: Record<string, number>) {
  return Object.entries(record)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}
