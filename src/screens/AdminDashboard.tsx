import { useEffect, useState, type FormEvent } from "react";
import { BarChart3, Download, LockKeyhole, RefreshCw, Search, Settings2 } from "lucide-react";

type CountItem = { label: string; count: number; percentAffected?: number };
type UsageDay = { date: string; resumes: number; applications: number; uniqueUsers: number };

type AdminSummary = {
  meta: { readinessThreshold: number; lastLoadedAt: string; query?: string };
  totals: {
    resumeRecords: number;
    applicationCaptures: number;
    waitlistSignups: number;
    interviewVolunteers: number;
    pilotProspects: number;
    budgetQualified: number;
    uniqueUsers: number;
    rawResumeRecords: number;
    averageReadinessScore: number;
    readinessDelta: number;
  };
  systemInfo: { rawResumeRecords: number; rawResumeRetentionRate: number };
  usageByDay: UsageDay[];
  careerLevels: Record<string, number>;
  topSkills: CountItem[];
  topTools: CountItem[];
  commonSkillGaps: Record<string, CountItem[]>;
  applicationStatuses: Record<string, number>;
  applicationSources: CountItem[];
  waitlistOrganizationTypes: CountItem[];
  waitlistSources: CountItem[];
  waitlistInterest: Record<string, number>;
  emailDomains: CountItem[];
  emailDomainTypes: Record<string, number>;
  countries: CountItem[];
  readinessBands: Record<string, number>;
  recentResumeRecords: Array<{
    candidateId: string;
    targetRole: string;
    currentTitle: string;
    careerLevel: string;
    score: number;
    searchableText?: string;
    emailDomain?: string;
    emailDomainType?: string;
    country?: string;
    capturedAt: string;
    rawResumeRetained: boolean;
  }>;
  recentWaitlistSignups: Array<{
    id: string;
    name: string;
    organization: string;
    organizationType: string;
    role: string;
    country: string;
    emailDomain: string;
    emailDomainType: string;
    interviewInterest: boolean;
    betaInterest: boolean;
    pilotInterest: boolean;
    budgetInterest: boolean;
    status: string;
    createdAt: string;
  }>;
};

export default function AdminDashboard() {
  const [code, setCode] = useState(sessionStorage.getItem("fokalview_admin_access_code") || "");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!summary) return;
    const timeout = window.setTimeout(() => {
      void loadSummary(undefined, query);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [query]);

  async function loadSummary(event?: FormEvent, searchQuery = query) {
    event?.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      const response = await fetch(`/api/admin/summary${params.toString() ? `?${params}` : ""}`, {
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
          {summary && <span className="connected-pill">Connected - Last synced {formatDateTime(summary.meta.lastLoadedAt)}</span>}
        </div>
        <form className="admin-access-form" onSubmit={loadSummary}>
          {!summary && (
            <label>
              <LockKeyhole size={16} />
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                type="password"
                placeholder="Admin access code"
              />
            </label>
          )}
          <button className="primary-button" disabled={!code.trim() || isLoading}>
            {isLoading ? <RefreshCw className="spin" size={18} /> : <BarChart3 size={18} />}
            {summary ? "Refresh" : "Load"}
          </button>
          <button className="secondary-action" type="button" disabled={!summary}>
            <Download size={16} />
            Export all
          </button>
        </form>
      </header>

      {summary && (
        <div className="admin-filter-bar">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidate, role, company, skill, score, country, domain..."
          />
          {summary.meta.query && <span>Filtering: {summary.meta.query}</span>}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      {summary && (
        <>
          <section className="admin-metrics three">
            <Metric label="Resume records" value={summary.totals.resumeRecords} note="Active pool" />
            <Metric label="Applications" value={summary.totals.applicationCaptures} note="Linked records" />
            <ReadinessMetric summary={summary} />
          </section>

          <section className="admin-metrics four">
            <Metric label="Waitlist signups" value={summary.totals.waitlistSignups || 0} note="Discovery pipeline" />
            <Metric label="Interview volunteers" value={summary.totals.interviewVolunteers || 0} note="Customer discovery" />
            <Metric label="Pilot prospects" value={summary.totals.pilotProspects || 0} note="Institutional leads" />
            <Metric label="Budget signals" value={summary.totals.budgetQualified || 0} note="Buying influence" />
          </section>

          <section className="admin-grid">
            <UsagePanel days={summary.usageByDay} />
            <ReadinessBands bands={summary.readinessBands} total={summary.totals.resumeRecords} />
            <ChartPanel title="Career Levels" items={toCountItems(summary.careerLevels)} showZeroRows />
            <SkillGapPanel groups={summary.commonSkillGaps} total={summary.totals.resumeRecords} />
            <ApplicationStatusPanel statuses={summary.applicationStatuses} />
            <SortablePanel title="Top Skills" items={summary.topSkills} />
            <SortablePanel title="Top Tools" items={summary.topTools} />
            <ChartPanel title="Application Sources" items={summary.applicationSources} />
            <ChartPanel title="Waitlist Organization Types" items={summary.waitlistOrganizationTypes || []} />
            <ChartPanel title="Waitlist Sources" items={summary.waitlistSources || []} />
            <ChartPanel title="Waitlist Interest" items={toCountItems(summary.waitlistInterest || {})} />
            <ChartPanel title="Email Domains" items={summary.emailDomains} />
            <ChartPanel title="Countries" items={summary.countries} />
            <ChartPanel title="Email Domain Types" items={toCountItems(summary.emailDomainTypes)} />
          </section>

          <section className="admin-table-panel">
            <div className="panel-heading">
              <h2>Resume Records</h2>
              <button className="panel-menu" aria-label="Resume record options">...</button>
            </div>
            <div className="admin-table record-table">
              {summary.recentResumeRecords.map((record) => (
                <article key={`${record.candidateId}-${record.capturedAt}`}>
                  <div className="candidate-cell">
                    <span className="avatar">{initials(record.candidateId)}</span>
                    <div>
                      <strong>{record.currentTitle || record.candidateId}</strong>
                      <span>{record.candidateId}</span>
                      {(record.emailDomain || record.country) && (
                        <small>{[record.emailDomain, record.country].filter(Boolean).join(" - ")}</small>
                      )}
                    </div>
                  </div>
                  <span>{record.targetRole || "No target role"}</span>
                  <span className={`score-pill ${scoreClass(record.score)}`}>{record.score}%</span>
                  <span>{formatDate(record.capturedAt)}</span>
                  <span className="status-pill applied">Active</span>
                  <button className="panel-menu" aria-label="Record actions">...</button>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-table-panel">
            <div className="panel-heading">
              <h2>Waitlist Discovery</h2>
              <button className="panel-menu" aria-label="Waitlist options">...</button>
            </div>
            <div className="admin-table waitlist-table">
              {summary.recentWaitlistSignups?.length ? (
                summary.recentWaitlistSignups.map((signup) => (
                  <article key={signup.id}>
                    <div className="candidate-cell">
                      <span className="avatar">{initials(signup.name)}</span>
                      <div>
                        <strong>{signup.name}</strong>
                        <span>{[signup.organization, signup.organizationType].filter(Boolean).join(" - ") || "No organization"}</span>
                        <small>{[signup.emailDomain, signup.country].filter(Boolean).join(" - ")}</small>
                      </div>
                    </div>
                    <span>{signup.role || "Role not saved"}</span>
                    <span>{interestLabels(signup).join(", ") || "No interest flags"}</span>
                    <span>{formatDate(signup.createdAt)}</span>
                    <span className="status-pill applied">{signup.status || "New"}</span>
                  </article>
                ))
              ) : (
                <div className="empty-panel compact">
                  <strong>No waitlist signups yet.</strong>
                  <span>Share /waitlist to start collecting discovery data.</span>
                </div>
              )}
            </div>
          </section>

          <details className="system-drawer">
            <summary>
              <Settings2 size={16} />
              System info
            </summary>
            <p>Raw resumes retained: {summary.systemInfo.rawResumeRecords}</p>
            <p>Raw retention rate: {summary.systemInfo.rawResumeRetentionRate}%</p>
            <p>Unique tracked users: {summary.totals.uniqueUsers}</p>
          </details>
        </>
      )}
    </main>
  );
}

function Metric({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </article>
  );
}

function ReadinessMetric({ summary }: { summary: AdminSummary }) {
  const score = summary.totals.averageReadinessScore;
  const delta = summary.totals.readinessDelta;
  const threshold = summary.meta.readinessThreshold;
  return (
    <article className="readiness-metric">
      <strong className={scoreClass(score)}>{score}%</strong>
      <span>Average readiness</span>
      <small>{delta >= 0 ? "+" : ""}{delta} pts from strong match threshold</small>
      <div className="threshold-track" title="Readiness = weighted match across skills, tools, and role fit">
        <span style={{ width: `${Math.min(100, score)}%` }} />
        <i style={{ left: `${threshold}%` }} />
      </div>
    </article>
  );
}

function UsagePanel({ days }: { days: UsageDay[] }) {
  const max = Math.max(...days.map((day) => day.resumes + day.applications), 1);
  return (
    <section className="chart-panel">
      <PanelHeading title="Usage" />
      <div className="usage-chart">
        {days.map((day) => (
          <div key={day.date}>
            <span
              style={{
                height: `${Math.max(6, ((day.resumes + day.applications) / max) * 100)}%`
              }}
              title={`${day.date}: ${day.resumes} resumes, ${day.applications} applications`}
            />
            <small>{new Date(`${day.date}T00:00:00`).getDate()}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadinessBands({ bands, total }: { bands: Record<string, number>; total: number }) {
  const ordered = ["0-49", "50-69", "70-84", "85-100"].map((label) => ({
    label,
    count: bands[label] || 0
  }));
  return (
    <section className="chart-panel">
      <PanelHeading title="Readiness Bands" />
      <div className="band-list">
        {ordered.map((item) => (
          <div className={`band-row band-${item.label.replace("-", "")}`} key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </div>
            <span className="fill"><i style={{ width: `${total ? (item.count / total) * 100 : 0}%` }} /></span>
          </div>
        ))}
      </div>
      <small>{total} of {total} records scored</small>
    </section>
  );
}

function SkillGapPanel({ groups, total }: { groups: Record<string, CountItem[]>; total: number }) {
  return (
    <section className="chart-panel">
      <PanelHeading title="Skill Gaps" />
      <div className="skill-gap-groups">
        {Object.entries(groups).map(([group, items]) => (
          <details key={group} open>
            <summary>{group}</summary>
            {items.length ? (
              items.map((item) => (
                <div className="gap-row" key={`${group}-${item.label}`}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                  <small>{item.percentAffected ?? percent(item.count, total)}%</small>
                </div>
              ))
            ) : (
              <p>No gaps in this category.</p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}

function ApplicationStatusPanel({ statuses }: { statuses: Record<string, number> }) {
  const items = toCountItems(statuses);
  return (
    <section className="chart-panel">
      <PanelHeading title="Application Statuses" />
      {items.length ? (
        <div className="bar-list">
          {items.map((item) => (
            <BarRow key={item.label} item={item} max={Math.max(...items.map((entry) => entry.count), 1)} />
          ))}
        </div>
      ) : (
        <div className="empty-panel compact">
          <strong>No applications linked.</strong>
          <span>Application tracking appears once users add applications with email enabled.</span>
          <button className="secondary-action">Add manually</button>
        </div>
      )}
    </section>
  );
}

function SortablePanel({ title, items }: { title: string; items: CountItem[] }) {
  const [sort, setSort] = useState<"count" | "az">("count");
  const sorted = [...items].sort((left, right) =>
    sort === "count" ? right.count - left.count || left.label.localeCompare(right.label) : left.label.localeCompare(right.label)
  );
  return (
    <section className="chart-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <select value={sort} onChange={(event) => setSort(event.target.value as "count" | "az")}>
          <option value="count">Sort: Count</option>
          <option value="az">Sort: A-Z</option>
        </select>
      </div>
      <BarList items={sorted} />
    </section>
  );
}

function ChartPanel({ title, items, showZeroRows = false }: { title: string; items: CountItem[]; showZeroRows?: boolean }) {
  return (
    <section className="chart-panel">
      <PanelHeading title={title} />
      <BarList items={items} showZeroRows={showZeroRows} />
    </section>
  );
}

function BarList({ items, showZeroRows = false }: { items: CountItem[]; showZeroRows?: boolean }) {
  const visibleItems = showZeroRows ? items : items.filter((item) => item.count > 0);
  const max = Math.max(...visibleItems.map((item) => item.count), 1);
  return (
    <div className="bar-list">
      {visibleItems.length ? visibleItems.map((item) => <BarRow key={item.label} item={item} max={max} />) : <p>No data yet.</p>}
    </div>
  );
}

function BarRow({ item, max }: { item: CountItem; max: number }) {
  return (
    <div className={item.count ? "bar-row" : "bar-row muted"}>
      <div>
        <span>{item.label}</span>
        <strong>{item.count}</strong>
      </div>
      <meter min="0" max={max} value={item.count} />
    </div>
  );
}

function PanelHeading({ title }: { title: string }) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <button className="panel-menu" aria-label={`${title} options`}>...</button>
    </div>
  );
}

function toCountItems(record: Record<string, number>) {
  return Object.entries(record).map(([label, count]) => ({ label, count }));
}

function scoreClass(score: number) {
  if (score < 65) return "score-low";
  if (score < 85) return "score-mid";
  return "score-high";
}

function percent(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0;
}

function initials(value: string) {
  return value.replace(/^Candidate\s+/i, "").slice(0, 2).toUpperCase() || "FV";
}

function interestLabels(signup: {
  interviewInterest?: boolean;
  betaInterest?: boolean;
  pilotInterest?: boolean;
  budgetInterest?: boolean;
}) {
  return [
    signup.interviewInterest && "Interview",
    signup.betaInterest && "Beta",
    signup.pilotInterest && "Pilot",
    signup.budgetInterest && "Budget"
  ].filter(Boolean) as string[];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}
