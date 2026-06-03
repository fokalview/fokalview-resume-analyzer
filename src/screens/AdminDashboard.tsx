import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BarChart3, Download, ImageDown, LockKeyhole, Moon, RefreshCw, Search, Settings2, Sun } from "lucide-react";

type CountItem = { label: string; count: number; percentAffected?: number };
type UsageDay = { date: string; resumes: number; applications: number; uniqueUsers: number };
type FunnelItem = { label: string; count: number; rate: number };
type ConversionMetric = { label: string; value: number; detail: string };
type ActionQueueItem = {
  type: "lead" | "candidate" | "outcome" | "product";
  priority: "High" | "Medium" | "Low";
  title: string;
  detail: string;
  nextAction: string;
};
type ProductSignal = { label: string; value: string; detail: string };
type AdminView = "all" | "institutional" | "applications" | "waitlist";

const DEFAULT_ADMIN_VIEW: AdminView = "waitlist";
const ADMIN_VIEW_ITEMS: Array<{ id: AdminView; label: string; count: (summary: AdminSummary) => string }> = [
  {
    id: "all",
    label: "All",
    count: (summary) => `${summary.totals.resumeRecords + summary.totals.waitlistSignups} records`
  },
  {
    id: "institutional",
    label: "Institutional reporting",
    count: (summary) => `${summary.totals.followUpSurveys || 0} outcomes`
  },
  {
    id: "applications",
    label: "Main application",
    count: (summary) => `${summary.totals.resumeRecords} analyses`
  },
  {
    id: "waitlist",
    label: "Waitlist",
    count: (summary) => `${summary.totals.waitlistSignups} leads`
  }
];

type AdminSummary = {
  meta: { readinessThreshold: number; lastLoadedAt: string; query?: string };
  totals: {
    resumeRecords: number;
    applicationCaptures: number;
    waitlistSignups: number;
    interviewVolunteers: number;
    pilotProspects: number;
    budgetQualified: number;
    averageLeadScore?: number;
    followUpSurveys?: number;
    followUpApplications?: number;
    followUpInterviews?: number;
    followUpOffers?: number;
    followUpPlacements?: number;
    salaryResponses?: number;
    medianSalary?: number;
    averageSalary?: number;
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
  applicationEmployers?: CountItem[];
  applicationTitles?: CountItem[];
  waitlistOrganizationTypes: CountItem[];
  waitlistSources: CountItem[];
  waitlistUserTypes?: CountItem[];
  waitlistReferralSources?: CountItem[];
  waitlistLeadPriorities?: Record<string, number>;
  waitlistBranchStatuses?: CountItem[];
  waitlistTargetIndustries?: CountItem[];
  waitlistCurrentProcesses?: CountItem[];
  waitlistWorkforceRegions?: CountItem[];
  followUpOutcomes?: Record<string, number>;
  followUpStatuses?: Record<string, number>;
  followUpIndustries?: CountItem[];
  followUpSalaryRanges?: CountItem[];
  followUpEmployers?: CountItem[];
  followUpJobTitles?: CountItem[];
  followUpVerificationStatuses?: CountItem[];
  waitlistPrograms?: CountItem[];
  waitlistMajors?: CountItem[];
  waitlistDegreeLevels?: CountItem[];
  waitlistClassYears?: CountItem[];
  waitlistStudentStatuses?: CountItem[];
  waitlistSeekingStatuses?: CountItem[];
  waitlistDomesticInternational?: CountItem[];
  waitlistLeadScoreBands?: Record<string, number>;
  waitlistFunnel?: FunnelItem[];
  followUpFunnel?: FunnelItem[];
  conversionMetrics?: ConversionMetric[];
  waitlistInterest: Record<string, number>;
  emailDomains: CountItem[];
  emailDomainTypes: Record<string, number>;
  countries: CountItem[];
  readinessBands: Record<string, number>;
  recentResumeRecords: Array<{
    id?: string;
    reportId?: string;
    systemUserId?: string;
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
    leadId?: string;
    contactId?: string;
    organizationId?: string;
    candidateId?: string;
    name: string;
    userType?: string;
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
    referralSource?: string;
    buyingAuthority?: string;
    timeline?: string;
    branchStatus?: string;
    targetRole?: string;
    targetIndustry?: string;
    programName?: string;
    majorField?: string;
    degreeLevel?: string;
    classYear?: string;
    studentStatus?: string;
    seekingStatus?: string;
    domesticInternational?: string;
    workforceRegion?: string;
    currentProcess?: string;
    populationServed?: string;
    reportingWish?: string;
    branchProfile?: Record<string, unknown>;
    scoreBreakdown?: Record<string, unknown>;
    leadScore?: number;
    leadPriority?: string;
    recommendedAction?: string;
    status: string;
    createdAt: string;
  }>;
  recentFollowUps?: Array<{
    leadId?: string;
    candidateId?: string;
    contactId?: string;
    emailDomain?: string;
    emailDomainType?: string;
    currentStatus?: string;
    applicationCount: number;
    interviewCount: number;
    offerCount: number;
    placementStatus?: string;
    currentRole?: string;
    currentIndustry?: string;
    salaryRange?: string;
    employer?: string;
    jobTitle?: string;
    salaryAmount?: number;
    salaryPeriod?: string;
    outcomeDate?: string;
    jobLocation?: string;
    dataSource?: string;
    verificationStatus?: string;
    supportNeeded?: string;
    submittedAt?: string;
  }>;
};

export default function AdminDashboard() {
  const [code, setCode] = useState(sessionStorage.getItem("fokalview_admin_access_code") || "");
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme());
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [query, setQuery] = useState("");
  const [adminView, setAdminView] = useState<AdminView>(DEFAULT_ADMIN_VIEW);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedWaitlist, setSelectedWaitlist] = useState<AdminSummary["recentWaitlistSignups"][number] | null>(null);

  useEffect(() => {
    if (!summary) return;
    const timeout = window.setTimeout(() => {
      void loadSummary(undefined, query);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    localStorage.setItem("sagittaiq_admin_theme", theme);
  }, [theme]);

  const briefing = useMemo(() => (summary ? buildAdminBriefing(summary) : []), [summary]);
  const actionQueue = useMemo(() => (summary ? buildActionQueue(summary) : []), [summary]);
  const productSignals = useMemo(() => (summary ? buildProductSignals(summary) : []), [summary]);

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
    <main className="admin-shell" data-theme={theme}>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Administrator</p>
          <h1>SagittaIQ Workforce Intelligence Dashboard</h1>
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
          <button className="secondary-action" type="button" disabled={!summary} onClick={() => summary && exportResearchBundle(summary)}>
            <Download size={16} />
            Export all
          </button>
          <button className="secondary-action" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </form>
      </header>

      {!summary && error && <p className="error-message">{error}</p>}

      {summary && (
        <div className="admin-dashboard-layout">
          <aside className="admin-view-sidebar" aria-label="Admin dashboard sections">
            <p className="eyebrow">Dashboard view</p>
            <div className="admin-view-toggle" role="tablist" aria-label="Admin dashboard view">
              {ADMIN_VIEW_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={adminView === item.id}
                  className={adminView === item.id ? "active" : ""}
                  onClick={() => setAdminView(item.id)}
                >
                  {item.label}
                  <span>{item.count(summary)}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="admin-dashboard-content">
          <div className="admin-filter-bar">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search candidate, role, company, skill, score, country, domain..."
            />
            {summary.meta.query && <span>Filtering: {summary.meta.query}</span>}
          </div>

          {error && <p className="error-message">{error}</p>}

          {adminView === "all" && (
            <>
              <section className="admin-briefing" aria-label="Executive briefing">
                {briefing.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </section>

              <section className="admin-operating-layer" aria-label="Admin action queue and product discovery">
                <ActionQueuePanel items={actionQueue} />
                <ProductSignalsPanel items={productSignals} />
              </section>

              <SectionHeader
                eyebrow="Executive overview"
                title="Platform health"
                detail="Candidate activity, workforce readiness, opportunity movement, and beta discovery signals."
              />

              <section className="admin-metrics four">
                <Metric label="Tracked users" value={summary.totals.uniqueUsers} note="Profiles with saved activity" />
                <Metric label="Career records" value={summary.totals.resumeRecords} note="Resume analyses retained" />
                <Metric label="Opportunities tracked" value={summary.totals.applicationCaptures} note="Applications and opportunities" />
                <ReadinessMetric summary={summary} />
              </section>
            </>
          )}

          {(adminView === "all" || adminView === "institutional") && (
            <>
              <SectionHeader
                eyebrow="Institutional reporting"
                title="Outcome reporting snapshot"
                detail="Program-style aggregate reporting for employers, roles, outcomes, salary signals, geography, and demand. Small-group suppression should be added before external sharing."
              />

              <section className="admin-metrics four">
                <Metric label="Knowledge proxy" value={`${percent(summary.totals.followUpSurveys || 0, Math.max(summary.totals.waitlistSignups, 1))}%`} note="Follow-ups collected vs waitlist leads" />
                <Metric label="Outcome proxy" value={`${percent((summary.totals.followUpPlacements || 0) + (summary.totals.followUpOffers || 0), Math.max(summary.totals.followUpSurveys || 0, 1))}%`} note="Offers or placements per follow-up" />
                <Metric label="Median salary" value={formatCurrency(summary.totals.medianSalary || 0)} note={`${summary.totals.salaryResponses || 0} salary responses`} />
                <Metric label="Average salary" value={formatCurrency(summary.totals.averageSalary || 0)} note={`${summary.totals.salaryResponses || 0} salary responses`} />
              </section>

              <section className="admin-grid">
                <ChartPanel title="Sample Employers" items={mergeCountItems(summary.followUpEmployers || [], summary.applicationEmployers || [])} />
                <ChartPanel title="Sample Job Positions" items={mergeCountItems(summary.followUpJobTitles || [], summary.applicationTitles || [])} />
                <ChartPanel title="Programs" items={summary.waitlistPrograms || []} />
                <ChartPanel title="Majors / Fields" items={summary.waitlistMajors || []} />
                <ChartPanel title="Degree Levels" items={summary.waitlistDegreeLevels || []} />
                <ChartPanel title="Class Years" items={summary.waitlistClassYears || []} />
                <ChartPanel title="Domestic / International" items={summary.waitlistDomesticInternational || []} />
                <ChartPanel title="Verification Status" items={summary.followUpVerificationStatuses || []} />
                <ChartPanel title="Target Industries" items={summary.waitlistTargetIndustries || []} />
                <ChartPanel title="Follow-up Salary Ranges" items={summary.followUpSalaryRanges || []} />
                <ChartPanel title="Countries" items={summary.countries} />
                <ChartPanel title="Email Domain Types" items={toCountItems(summary.emailDomainTypes)} />
              </section>
            </>
          )}

          {(adminView === "all" || adminView === "applications") && (
            <>
              <SectionHeader
                eyebrow="Application metrics"
                title="Candidate readiness and opportunity activity"
                detail="Resume analyses, readiness bands, skill gaps, usage, application status, and career profile signals."
              />

              <section className="admin-grid">
                <UsagePanel days={summary.usageByDay} />
                <ReadinessBands bands={summary.readinessBands} total={summary.totals.resumeRecords} />
                <ChartPanel title="Career Levels" items={toCountItems(summary.careerLevels)} showZeroRows />
                <SkillGapPanel groups={summary.commonSkillGaps} total={summary.totals.resumeRecords} />
                <ApplicationStatusPanel statuses={summary.applicationStatuses} />
                <SortablePanel title="Top Skills" items={summary.topSkills} />
                <SortablePanel title="Top Tools" items={summary.topTools} />
                <ChartPanel title="Opportunity Sources" items={summary.applicationSources} />
              </section>

              <section className="admin-table-panel">
            <div className="panel-heading">
              <h2>Recent Candidate Activity</h2>
              <button className="download-chart-button" type="button" onClick={() => exportDataset("candidate-activity", summary.recentResumeRecords)}>
                <Download size={15} />
                Export JSON
              </button>
            </div>
            <div className="admin-table record-table">
              {summary.recentResumeRecords.map((record) => (
                <article key={`${record.candidateId}-${record.capturedAt}`}>
                  <div className="candidate-cell">
                    <span className="avatar">{initials(record.candidateId)}</span>
                    <div>
                      <strong>{record.currentTitle || record.candidateId}</strong>
                      <span>{record.candidateId}</span>
                      {record.reportId && <small>{record.reportId}</small>}
                      {(record.emailDomain || record.country) && (
                        <small>{[record.emailDomain, record.country].filter(Boolean).join(" - ")}</small>
                      )}
                    </div>
                  </div>
                  <span>{record.targetRole || "No target opportunity"}</span>
                  <span className={`score-pill ${scoreClass(record.score)}`}>{record.score}%</span>
                  <span>{formatDate(record.capturedAt)}</span>
                  <span className="status-pill applied">Active</span>
                  <span className="record-action-label">Saved</span>
                </article>
              ))}
            </div>
              </section>
            </>
          )}

          {(adminView === "all" || adminView === "waitlist") && (
            <>
              <SectionHeader
                eyebrow="Waitlist intelligence"
                title="Discovery pipeline, lead quality, and market demand"
                detail="Waitlist, lead scoring, follow-up, geography, source attribution, and organization signals are separated from application metrics."
              />

              <section className="admin-metrics four">
                <Metric label="Waitlist signups" value={summary.totals.waitlistSignups || 0} note="Discovery pipeline" />
                <Metric label="Interview volunteers" value={summary.totals.interviewVolunteers || 0} note="Customer discovery" />
                <Metric label="Pilot prospects" value={summary.totals.pilotProspects || 0} note="Institutional leads" />
                <Metric label="Avg lead score" value={summary.totals.averageLeadScore || 0} note="Rules-based priority" />
                <Metric label="Follow-ups" value={summary.totals.followUpSurveys || 0} note="Outcome signals" />
                <Metric label="Applications reported" value={summary.totals.followUpApplications || 0} note="From follow-up surveys" />
                <Metric label="Interviews reported" value={summary.totals.followUpInterviews || 0} note="Outcome momentum" />
                <Metric label="Offers / placements" value={`${summary.totals.followUpOffers || 0} / ${summary.totals.followUpPlacements || 0}`} note="Career outcomes" />
              </section>

              <section className="admin-grid">
                <FunnelPanel title="Waitlist Pipeline" items={summary.waitlistFunnel || []} />
                <FunnelPanel title="Follow-up Outcome Funnel" items={summary.followUpFunnel || []} />
                <ConversionPanel items={summary.conversionMetrics || []} />
                <ChartPanel title="Lead Score Bands" items={toCountItems(summary.waitlistLeadScoreBands || {})} />
                <ChartPanel title="Waitlist Organization Types" items={summary.waitlistOrganizationTypes || []} />
                <ChartPanel title="Waitlist User Types" items={summary.waitlistUserTypes || []} />
                <ChartPanel title="Lead Priorities" items={toCountItems(summary.waitlistLeadPriorities || {})} />
                <ChartPanel title="Referral Sources" items={summary.waitlistReferralSources || []} />
                <ChartPanel title="Branch Statuses" items={summary.waitlistBranchStatuses || []} />
                <ChartPanel title="Target Industries" items={summary.waitlistTargetIndustries || []} />
                <ChartPanel title="Current Processes" items={summary.waitlistCurrentProcesses || []} />
                <ChartPanel title="Workforce Regions" items={summary.waitlistWorkforceRegions || []} />
                <ChartPanel title="Follow-up Outcomes" items={toCountItems(summary.followUpOutcomes || {})} />
                <ChartPanel title="Follow-up Statuses" items={toCountItems(summary.followUpStatuses || {})} />
                <ChartPanel title="Follow-up Industries" items={summary.followUpIndustries || []} />
                <ChartPanel title="Follow-up Salary Ranges" items={summary.followUpSalaryRanges || []} />
                <ChartPanel title="Waitlist Sources" items={summary.waitlistSources || []} />
                <ChartPanel title="Waitlist Interest" items={toCountItems(summary.waitlistInterest || {})} />
                <ChartPanel title="Email Domains" items={summary.emailDomains} />
                <ChartPanel title="Countries" items={summary.countries} />
                <ChartPanel title="Email Domain Types" items={toCountItems(summary.emailDomainTypes)} />
              </section>

              <section className="admin-table-panel">
            <div className="panel-heading">
              <h2>Waitlist Discovery</h2>
              <button className="download-chart-button" type="button" onClick={() => exportDataset("waitlist-discovery", summary.recentWaitlistSignups)}>
                <Download size={15} />
                Export JSON
              </button>
            </div>
            <div className="admin-table waitlist-table">
              {summary.recentWaitlistSignups?.length ? (
                summary.recentWaitlistSignups.map((signup) => (
                  <article key={signup.id} className="clickable-row" onClick={() => setSelectedWaitlist(signup)}>
                    <div className="candidate-cell">
                      <span className="avatar">{initials(signup.name)}</span>
                      <div>
                        <strong>{signup.name}</strong>
                        {signup.leadId && <span>{signup.leadId}</span>}
                        <span>{[signup.organization, signup.organizationType].filter(Boolean).join(" - ") || "No organization"}</span>
                        <small>{[signup.userType, signup.emailDomain, signup.country].filter(Boolean).join(" - ")}</small>
                      </div>
                    </div>
                    <span>{signup.targetRole || signup.role || "Role not saved"}</span>
                    <span>
                      {signup.leadScore ? `${signup.leadScore} - ${signup.leadPriority || "Scored"}` : interestLabels(signup).join(", ") || "No interest flags"}
                    </span>
                    <span>{formatDate(signup.createdAt)}</span>
                    <span className="status-pill applied">{signup.branchStatus || signup.status || "New"}</span>
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

              <section className="admin-table-panel">
            <div className="panel-heading">
              <h2>Recent Follow-ups</h2>
              <button className="download-chart-button" type="button" onClick={() => exportDataset("recent-follow-ups", summary.recentFollowUps || [])}>
                <Download size={15} />
                Export JSON
              </button>
            </div>
            <div className="admin-table followup-table">
              {summary.recentFollowUps?.length ? (
                summary.recentFollowUps.map((item, index) => (
                  <article key={`${item.leadId || item.candidateId || index}-${item.submittedAt}`}>
                    <div>
                      <strong>{item.candidateId || item.leadId || "Unlinked follow-up"}</strong>
                      <span>{[item.emailDomain, item.emailDomainType].filter(Boolean).join(" - ")}</span>
                    </div>
                    <span>{item.currentStatus || "Status not saved"}</span>
                    <span>{item.placementStatus || "No outcome"}</span>
                    <span>{`${item.applicationCount} apps / ${item.interviewCount} interviews / ${item.offerCount} offers`}</span>
                    <span>{formatDate(item.submittedAt || "")}</span>
                  </article>
                ))
              ) : (
                <div className="empty-panel compact">
                  <strong>No follow-ups yet.</strong>
                  <span>Share /follow-up with a lead or candidate ID to collect outcome updates.</span>
                </div>
              )}
            </div>
              </section>
            </>
          )}

          <details className="system-drawer">
            <summary>
              <Settings2 size={16} />
              System info
            </summary>
            <p>Raw resumes retained: {summary.systemInfo.rawResumeRecords}</p>
            <p>Raw retention rate: {summary.systemInfo.rawResumeRetentionRate}%</p>
            <p>Unique tracked users: {summary.totals.uniqueUsers}</p>
          </details>

          {selectedWaitlist && (
            <div className="detail-backdrop" role="presentation" onClick={() => setSelectedWaitlist(null)}>
              <aside
                className="detail-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Waitlist record detail"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Waitlist detail</p>
                    <h2>{selectedWaitlist.name}</h2>
                  </div>
                  <button className="panel-menu" onClick={() => setSelectedWaitlist(null)} aria-label="Close detail">x</button>
                </div>
                <dl className="detail-list">
                  <Detail label="Lead ID" value={selectedWaitlist.leadId} />
                  <Detail label="Candidate ID" value={selectedWaitlist.candidateId} />
                  <Detail label="Contact ID" value={selectedWaitlist.contactId} />
                  <Detail label="Organization ID" value={selectedWaitlist.organizationId} />
                  <Detail label="User type" value={selectedWaitlist.userType} />
                  <Detail label="Organization" value={selectedWaitlist.organization} />
                  <Detail label="Role / target" value={selectedWaitlist.targetRole || selectedWaitlist.role} />
                  <Detail label="Lead score" value={selectedWaitlist.leadScore ? `${selectedWaitlist.leadScore} - ${selectedWaitlist.leadPriority || "Scored"}` : ""} />
                  <Detail label="Recommended action" value={selectedWaitlist.recommendedAction} />
                  <Detail label="Branch status" value={selectedWaitlist.branchStatus} />
                  <Detail label="Target industry" value={selectedWaitlist.targetIndustry} />
                  <Detail label="Program" value={selectedWaitlist.programName} />
                  <Detail label="Major / field" value={selectedWaitlist.majorField} />
                  <Detail label="Degree level" value={selectedWaitlist.degreeLevel} />
                  <Detail label="Class year" value={selectedWaitlist.classYear} />
                  <Detail label="Student status" value={selectedWaitlist.studentStatus} />
                  <Detail label="Seeking status" value={selectedWaitlist.seekingStatus} />
                  <Detail label="Domestic / international" value={selectedWaitlist.domesticInternational} />
                  <Detail label="Workforce region" value={selectedWaitlist.workforceRegion} />
                  <Detail label="Current process" value={selectedWaitlist.currentProcess} />
                  <Detail label="Population served" value={selectedWaitlist.populationServed} />
                  <Detail label="Reporting wish" value={selectedWaitlist.reportingWish} />
                </dl>
                <ScoreBreakdown breakdown={selectedWaitlist.scoreBreakdown} />
                <div className="detail-json">
                  <strong>Branch profile</strong>
                  <pre>{JSON.stringify(selectedWaitlist.branchProfile || {}, null, 2)}</pre>
                </div>
              </aside>
            </div>
          )}
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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

function ActionQueuePanel({ items }: { items: ActionQueueItem[] }) {
  return (
    <section className="admin-action-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Admin action queue</p>
          <h2>What needs attention</h2>
        </div>
        <span className="queue-count">{items.length} actions</span>
      </div>
      <div className="action-list">
        {items.map((item) => (
          <article key={`${item.type}-${item.title}-${item.detail}`}>
            <span className={`priority-dot ${item.priority.toLowerCase()}`} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <small>{item.nextAction}</small>
            </div>
            <span className={`priority-pill ${item.priority.toLowerCase()}`}>{item.priority}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductSignalsPanel({ items }: { items: ProductSignal[] }) {
  return (
    <section className="admin-action-panel product-signal-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Product discovery</p>
          <h2>Signals from users</h2>
        </div>
      </div>
      <div className="product-signal-list">
        {items.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScoreBreakdown({ breakdown }: { breakdown?: Record<string, unknown> }) {
  const entries = Object.entries(breakdown || {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!entries.length) return null;

  return (
    <div className="score-breakdown">
      <strong>Lead score reasoning</strong>
      {entries.map(([key, value]) => (
        <div key={key}>
          <span>{humanizeKey(key)}</span>
          <small>{String(value)}</small>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <div className="admin-section-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

function ReadinessMetric({ summary }: { summary: AdminSummary }) {
  const score = summary.totals.averageReadinessScore;
  const delta = summary.totals.readinessDelta;
  const threshold = summary.meta.readinessThreshold;
  return (
    <article className="readiness-metric">
      <strong className={scoreClass(score)}>{score}%</strong>
      <span>Average career readiness</span>
      <small>{delta >= 0 ? "+" : ""}{delta} pts from strong match threshold</small>
      <div className="threshold-track" title="Readiness = weighted match across skills, tools, and role fit">
        <span style={{ width: `${Math.min(100, score)}%` }} />
        <i style={{ left: `${threshold}%` }} />
      </div>
    </article>
  );
}

function UsagePanel({ days }: { days: UsageDay[] }) {
  const title = "Usage";
  const panelId = panelIdFor(title);
  const max = Math.max(...days.map((day) => day.resumes + day.applications), 1);
  const points = days.map((day, index) => {
    const x = days.length <= 1 ? 0 : (index / (days.length - 1)) * 100;
    const y = 100 - ((day.resumes + day.applications) / max) * 88;
    return `${x},${Math.max(8, y)}`;
  }).join(" ");
  return (
    <section className="chart-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <PanelHeading title={title} panelId={panelId} />
      <svg className="line-chart" viewBox="0 0 100 100" role="img" aria-label="Usage trend line for the last fourteen days" preserveAspectRatio="none">
        <polyline points={points} />
      </svg>
      <div className="usage-chart" role="img" aria-label="Fourteen day usage chart showing resume analyses and tracked applications">
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
  const title = "Readiness Bands";
  const panelId = panelIdFor(title);
  const ordered = ["0-49", "50-69", "70-84", "85-100"].map((label) => ({
    label,
    count: bands[label] || 0
  }));
  return (
    <section className="chart-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <PanelHeading title={title} panelId={panelId} />
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
  const [expanded, setExpanded] = useState(false);
  const title = "Skill Gaps";
  const panelId = panelIdFor(title);
  const rankedItems = Object.entries(groups)
    .flatMap(([group, items]) => items.map((item) => ({ group, item })))
    .sort((left, right) => right.item.count - left.item.count || left.item.label.localeCompare(right.item.label));
  const visibleItems = expanded ? rankedItems : rankedItems.slice(0, 10);
  const visibleGroups = visibleItems.reduce<Record<string, CountItem[]>>((nextGroups, { group, item }) => {
    nextGroups[group] = [...(nextGroups[group] || []), item];
    return nextGroups;
  }, {});
  const hiddenCount = Math.max(0, rankedItems.length - visibleItems.length);

  return (
    <section className="chart-panel skill-gap-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <PanelHeading title={title} panelId={panelId} />
      <div className="skill-gap-groups">
        {Object.entries(visibleGroups).map(([group, items]) => (
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
        {!rankedItems.length && <p>No keyword gaps yet.</p>}
      </div>
      <ListLimitToggle
        expanded={expanded}
        hiddenCount={hiddenCount}
        itemName="keyword gaps"
        onToggle={() => setExpanded((current) => !current)}
      />
    </section>
  );
}

function ApplicationStatusPanel({ statuses }: { statuses: Record<string, number> }) {
  const title = "Application Status Funnel";
  const panelId = panelIdFor(title);
  const items = toCountItems(statuses);
  return (
    <section className="chart-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <PanelHeading title={title} panelId={panelId} />
      {items.length ? (
        <VisualBarChart items={items} />
      ) : (
        <div className="empty-panel compact">
          <strong>No applications linked.</strong>
          <span>Opportunity tracking appears once users add opportunities with email enabled.</span>
          <button className="secondary-action">Add manually</button>
        </div>
      )}
    </section>
  );
}

function FunnelPanel({ title, items }: { title: string; items: FunnelItem[] }) {
  const panelId = panelIdFor(title);
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <section className="chart-panel funnel-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <PanelHeading title={title} panelId={panelId} />
      {items.length ? (
        <div className="funnel-list">
          {items.map((item) => (
            <div key={item.label} className="funnel-row">
              <div>
                <strong>{item.count}</strong>
                <span>{item.label}</span>
                <small>{item.rate}% conversion</small>
              </div>
              <span className="funnel-fill">
                <i style={{ width: item.count ? `${Math.max(4, (item.count / max) * 100)}%` : "0%" }} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p>No pipeline data yet.</p>
      )}
    </section>
  );
}

function ConversionPanel({ items }: { items: ConversionMetric[] }) {
  const title = "Conversion Signals";
  const panelId = panelIdFor(title);
  return (
    <section className="chart-panel conversion-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <PanelHeading title={title} panelId={panelId} />
      {items.length ? (
        <div className="conversion-grid">
          {items.map((item) => (
            <article key={item.label}>
              <strong>{item.value}%</strong>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      ) : (
        <p>No conversion data yet.</p>
      )}
    </section>
  );
}

function SortablePanel({ title, items }: { title: string; items: CountItem[] }) {
  const [sort, setSort] = useState<"count" | "az">("count");
  const [expanded, setExpanded] = useState(false);
  const panelId = panelIdFor(title);
  const sorted = [...items].sort((left, right) =>
    sort === "count" ? right.count - left.count || left.label.localeCompare(right.label) : left.label.localeCompare(right.label)
  );
  const visibleItems = expanded ? sorted : sorted.slice(0, 10);
  const hiddenCount = Math.max(0, sorted.length - visibleItems.length);

  return (
    <section className="chart-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <div className="panel-heading">
        <h2 id={`${panelId}-title`}>{title}</h2>
        <div className="panel-actions">
          <label>
            <span className="sr-only">Sort {title}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as "count" | "az")}>
              <option value="count">Sort: Count</option>
              <option value="az">Sort: A-Z</option>
            </select>
          </label>
          <button className="download-chart-button no-export" type="button" onClick={() => void downloadElementPng(panelId, title)} aria-label={`Download ${title} chart as PNG`}>
            <ImageDown size={15} />
            Download PNG
          </button>
        </div>
      </div>
      <VisualBarChart items={visibleItems} />
      <ListLimitToggle
        expanded={expanded}
        hiddenCount={hiddenCount}
        itemName={title.toLowerCase()}
        onToggle={() => setExpanded((current) => !current)}
      />
    </section>
  );
}

function ListLimitToggle({
  expanded,
  hiddenCount,
  itemName,
  onToggle
}: {
  expanded: boolean;
  hiddenCount: number;
  itemName: string;
  onToggle: () => void;
}) {
  if (!expanded && hiddenCount <= 0) return null;
  return (
    <button className="list-limit-toggle" type="button" onClick={onToggle}>
      {expanded ? "Show top 10" : `Show ${hiddenCount} more ${itemName}`}
    </button>
  );
}

function ChartPanel({ title, items, showZeroRows = false }: { title: string; items: CountItem[]; showZeroRows?: boolean }) {
  const panelId = panelIdFor(title);
  return (
    <section className="chart-panel" id={panelId} aria-labelledby={`${panelId}-title`}>
      <PanelHeading title={title} panelId={panelId} />
      <VisualBarChart items={items} showZeroRows={showZeroRows} />
    </section>
  );
}

function VisualBarChart({ items, showZeroRows = false }: { items: CountItem[]; showZeroRows?: boolean }) {
  const visibleItems = showZeroRows ? items : items.filter((item) => item.count > 0);
  const max = Math.max(...visibleItems.map((item) => item.count), 1);
  return (
    <div className="visual-bar-chart" role="img" aria-label="Horizontal bar chart">
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
      <span className="bar-track" aria-hidden="true">
        <i style={{ width: `${max ? Math.max(item.count ? 4 : 0, (item.count / max) * 100) : 0}%` }} />
      </span>
    </div>
  );
}

function PanelHeading({ title, panelId }: { title: string; panelId: string }) {
  return (
    <div className="panel-heading">
      <h2 id={`${panelId}-title`}>{title}</h2>
      <button className="download-chart-button no-export" type="button" onClick={() => void downloadElementPng(panelId, title)} aria-label={`Download ${title} chart as PNG`}>
        <ImageDown size={15} />
        Download PNG
      </button>
    </div>
  );
}

function toCountItems(record: Record<string, number>) {
  return Object.entries(record).map(([label, count]) => ({ label, count }));
}

function exportResearchBundle(summary: AdminSummary) {
  const payload = {
    exportedAt: new Date().toISOString(),
    totals: summary.totals,
    waitlist: summary.recentWaitlistSignups.map((item) => ({
      leadId: item.leadId,
      candidateId: item.candidateId,
      contactId: item.contactId,
      organizationId: item.organizationId,
      userType: item.userType,
      organizationType: item.organizationType,
      country: item.country,
      emailDomain: item.emailDomain,
      emailDomainType: item.emailDomainType,
      referralSource: item.referralSource,
      branchStatus: item.branchStatus,
      targetRole: item.targetRole,
      targetIndustry: item.targetIndustry,
      workforceRegion: item.workforceRegion,
      currentProcess: item.currentProcess,
      populationServed: item.populationServed,
      leadScore: item.leadScore,
      leadPriority: item.leadPriority,
      scoreBreakdown: item.scoreBreakdown,
      branchProfile: item.branchProfile,
      createdAt: item.createdAt
    })),
    followUps: summary.recentFollowUps || [],
    aggregatePanels: {
      waitlistUserTypes: summary.waitlistUserTypes,
      waitlistReferralSources: summary.waitlistReferralSources,
      waitlistLeadPriorities: summary.waitlistLeadPriorities,
      waitlistBranchStatuses: summary.waitlistBranchStatuses,
      waitlistTargetIndustries: summary.waitlistTargetIndustries,
      waitlistCurrentProcesses: summary.waitlistCurrentProcesses,
      waitlistWorkforceRegions: summary.waitlistWorkforceRegions,
      waitlistLeadScoreBands: summary.waitlistLeadScoreBands,
      waitlistFunnel: summary.waitlistFunnel,
      followUpFunnel: summary.followUpFunnel,
      conversionMetrics: summary.conversionMetrics,
      followUpOutcomes: summary.followUpOutcomes,
      followUpStatuses: summary.followUpStatuses,
      followUpIndustries: summary.followUpIndustries,
      followUpSalaryRanges: summary.followUpSalaryRanges
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sagittaiq-research-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportDataset(name: string, rows: unknown[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sagittaiq-${name}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildActionQueue(summary: AdminSummary): ActionQueueItem[] {
  const items: ActionQueueItem[] = [];
  const hotLead = [...summary.recentWaitlistSignups]
    .filter((lead) => Number(lead.leadScore || 0) >= 75 || lead.pilotInterest || lead.budgetInterest)
    .sort((left, right) => Number(right.leadScore || 0) - Number(left.leadScore || 0))[0];

  if (hotLead) {
    items.push({
      type: "lead",
      priority: Number(hotLead.leadScore || 0) >= 75 ? "High" : "Medium",
      title: `Contact ${hotLead.name || hotLead.leadId || "high-signal lead"}`,
      detail: [
        hotLead.leadId,
        hotLead.organization || hotLead.organizationType,
        hotLead.leadScore ? `${hotLead.leadScore}/100 lead score` : "",
        hotLead.leadPriority
      ].filter(Boolean).join(" - "),
      nextAction: hotLead.recommendedAction || "Schedule discovery outreach and confirm pilot/budget interest."
    });
  }

  const lowReadiness = [...summary.recentResumeRecords]
    .filter((record) => Number(record.score || 0) < 65)
    .sort((left, right) => left.score - right.score)[0];

  if (lowReadiness) {
    items.push({
      type: "candidate",
      priority: "High",
      title: `Review low-readiness candidate ${lowReadiness.candidateId}`,
      detail: `${lowReadiness.score}% readiness for ${lowReadiness.targetRole || "target opportunity"}`,
      nextAction: "Check skill gaps, feedback quality, and whether the user needs advisor support."
    });
  }

  const followUpNeed = summary.totals.waitlistSignups - (summary.totals.followUpSurveys || 0);
  if (followUpNeed > 0) {
    items.push({
      type: "outcome",
      priority: followUpNeed >= 5 ? "High" : "Medium",
      title: "Collect outcome follow-ups",
      detail: `${followUpNeed} waitlist lead(s) do not yet have follow-up outcome data.`,
      nextAction: "Send follow-up form to improve application, interview, offer, and placement reporting."
    });
  }

  const productSignal = topLabel(summary.waitlistCurrentProcesses || []) || topLabel(summary.waitlistTargetIndustries || []);
  if (productSignal) {
    items.push({
      type: "product",
      priority: "Medium",
      title: `Investigate ${productSignal}`,
      detail: "This theme is surfacing in waitlist discovery data.",
      nextAction: "Open recent waitlist records and tag repeated pain points or report requests."
    });
  }

  if (!items.length) {
    items.push({
      type: "lead",
      priority: "Low",
      title: "No urgent admin actions",
      detail: "The current dataset has no high-risk candidate or high-signal lead triggers.",
      nextAction: "Refresh after new waitlist, resume, or follow-up activity."
    });
  }

  return items.slice(0, 5);
}

function buildProductSignals(summary: AdminSummary): ProductSignal[] {
  const mostCommonGap = Object.values(summary.commonSkillGaps || {})
    .flat()
    .sort((left, right) => right.count - left.count)[0];
  const topIndustry = topLabel(summary.waitlistTargetIndustries || []);
  const topProcess = topLabel(summary.waitlistCurrentProcesses || []);
  const topRegion = topLabel(summary.waitlistWorkforceRegions || []);
  const followUps = summary.totals.followUpSurveys || 0;
  const offerRate = followUps ? Math.round(((summary.totals.followUpOffers || 0) / followUps) * 100) : 0;

  return [
    {
      label: "Top readiness gap",
      value: mostCommonGap?.label || "Building",
      detail: mostCommonGap ? `${mostCommonGap.count} candidate record(s) show this gap.` : "More resume analyses will sharpen gap intelligence."
    },
    {
      label: "Demand segment",
      value: topIndustry || topProcess || "Building",
      detail: topIndustry ? "Target industry demand is clustering here." : topProcess ? "Workflow/process demand is clustering here." : "Waitlist volume is still early."
    },
    {
      label: "Regional signal",
      value: topRegion || "Unknown",
      detail: topRegion ? "Useful for local workforce-development outreach." : "Collect more city/state/region data for market targeting."
    },
    {
      label: "Outcome quality",
      value: `${offerRate}%`,
      detail: "Offer rate across follow-up responses; improves as more users report outcomes."
    }
  ];
}

function buildAdminBriefing(summary: AdminSummary) {
  const followUps = summary.totals.followUpSurveys || 0;
  const waitlist = summary.totals.waitlistSignups || 0;
  const interviews = summary.totals.followUpInterviews || 0;
  const offers = summary.totals.followUpOffers || 0;
  const strongestLeadGroup = topLabel(toCountItems(summary.waitlistLeadPriorities || {}));
  const strongestIndustry = topLabel(summary.waitlistTargetIndustries || []);
  const biggestGap = Object.values(summary.commonSkillGaps || {})
    .flat()
    .sort((left, right) => right.count - left.count)[0];

  return [
    {
      label: "Pipeline pulse",
      value: `${waitlist} leads`,
      detail: strongestLeadGroup ? `${strongestLeadGroup} is the strongest lead priority signal.` : "Waitlist volume is the current top-of-funnel baseline."
    },
    {
      label: "Outcome signal",
      value: `${interviews}/${offers}`,
      detail: `${interviews} interviews and ${offers} offers reported from ${followUps} follow-up responses.`
    },
    {
      label: "Market signal",
      value: strongestIndustry || "Building",
      detail: strongestIndustry ? `${strongestIndustry} is leading current waitlist demand.` : "Target industry demand will sharpen as more leads sign up."
    },
    {
      label: "Product focus",
      value: biggestGap?.label || "Skills",
      detail: biggestGap ? `${biggestGap.count} record(s) show this as a readiness gap.` : "Skill-gap intelligence will grow with resume volume."
    }
  ];
}

function topLabel(items: CountItem[]) {
  return [...items].sort((left, right) => right.count - left.count)[0]?.label || "";
}

function humanizeKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function panelIdFor(title: string) {
  return `admin-panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

async function downloadElementPng(elementId: string, title: string) {
  const source = document.getElementById(elementId);
  if (!source) return;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".no-export").forEach((node) => node.remove());
  clone.style.margin = "0";
  clone.style.width = `${source.getBoundingClientRect().width}px`;

  const width = Math.ceil(source.getBoundingClientRect().width);
  const height = Math.ceil(source.getBoundingClientRect().height);
  const styles = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${styles}</style>
          ${markup}
        </div>
      </foreignObject>
    </svg>`;

  const image = new Image();
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not render chart image."));
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(2, 2);
  context.drawImage(image, 0, 0);
  URL.revokeObjectURL(svgUrl);

  const pngUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = pngUrl;
  link.download = `${panelIdFor(title)}-${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
}

function scoreClass(score: number) {
  if (score < 65) return "score-low";
  if (score < 85) return "score-mid";
  return "score-high";
}

function percent(count: number, total: number) {
  return total ? Math.round((count / total) * 100) : 0;
}

function formatCurrency(value: number) {
  if (!value) return "Pending";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function mergeCountItems(...groups: CountItem[][]) {
  const counts = new Map<string, number>();
  groups.flat().forEach((item) => {
    if (!item.label) return;
    counts.set(item.label, (counts.get(item.label) || 0) + item.count);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 12);
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

function getStoredTheme() {
  const saved = localStorage.getItem("sagittaiq_admin_theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
