import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Download,
  LockKeyhole,
  LogOut,
  MessageSquare,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Users,
  Info,
  X
} from "lucide-react";
import { csvForRecords, displayValue, flattenRecord } from "../lib/waitlistExport.js";
import { OutreachEditor } from "../components/OutreachEditor";

type CountItem = { label: string; count: number; percentAffected?: number };
type UsageDay = { date: string; resumes: number; applications: number; uniqueUsers: number };
type FunnelItem = { label: string; count: number; rate: number };
type ConversionMetric = { label: string; value: number; detail: string };
type ContactDetails = {
  email?: string;
  emailStatus?: string;
  phone?: string;
  linkedinUrl?: string;
  preferredContactMethod?: string;
};
type FollowUpRecord = ContactDetails & {
  id?: string;
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
  salaryAmount?: number | null;
  salaryPeriod?: string;
  outcomeDate?: string;
  jobLocation?: string;
  dataSource?: string;
  verificationStatus?: string;
  supportNeeded?: string;
  notes?: string;
  source?: string;
  responseDetails?: Record<string, unknown>;
  submittedAt?: string;
  matchedContactName?: string;
  matchedSignupIds?: string[];
};
type DecisionSignal = {
  label: string;
  value: number;
  unit: string;
  severity: "positive" | "attention" | "neutral";
  detail: string;
  action: string;
};
type AdminSummary = {
  meta: { readinessThreshold: number; lastLoadedAt: string; query?: string; recordScope?: string; reportingMethod?: string; recordLimit?: number; waitlistRecordsReturned?: number; followupRecordsReturned?: number; sources?: Record<string, { status: string; count: number }> };
  globalTotals?: { resumeRecords: number; applicationCaptures: number; waitlistSignups: number; followUpSurveys: number; followUpRespondents: number; uniqueWaitlistContacts: number };
  salaryByPeriod?: Array<{ period: string; currency?: string; count: number; median: number | null; average: number | null }>;
  totals: {
    resumeRecords: number;
    applicationCaptures: number;
    waitlistSignups: number;
    interviewVolunteers: number;
    pilotProspects: number;
    budgetQualified: number;
    averageLeadScore?: number;
    followUpSurveys?: number;
    followUpRespondents?: number;
    unlinkedFollowUpResponses?: number;
    uniqueWaitlistContacts?: number;
    waitlistContactsWithFollowUp?: number;
    pendingIntakeFollowUps?: number;
    completedFollowUps?: number;
    followUpApplications?: number;
    followUpInterviews?: number;
    followUpOffers?: number;
    followUpPlacements?: number;
    salaryResponses?: number;
    medianSalary?: number;
    averageSalary?: number;
    sessions?: number;
    averageSessionSeconds?: number;
    totalSessionMinutes?: number;
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
  sessionSources?: CountItem[];
  sessionPages?: CountItem[];
  sessionCampaigns?: CountItem[];
  userEventTypes?: Record<string, number>;
  waitlistPrograms?: CountItem[];
  waitlistMajors?: CountItem[];
  waitlistSchools?: CountItem[];
  waitlistGpaBands?: Record<string, number>;
  waitlistCertifications?: CountItem[];
  waitlistDegreeLevels?: CountItem[];
  waitlistClassYears?: CountItem[];
  waitlistStudentStatuses?: CountItem[];
  waitlistSeekingStatuses?: CountItem[];
  waitlistDomesticInternational?: CountItem[];
  waitlistLeadScoreBands?: Record<string, number>;
  waitlistFunnel?: FunnelItem[];
  followUpFunnel?: FunnelItem[];
  conversionMetrics?: ConversionMetric[];
  decisionSignals?: DecisionSignal[];
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
    analysis?: Record<string, unknown>;
    profile?: Record<string, unknown>;
  }>;
  recentWaitlistSignups: Array<ContactDetails & {
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
    city?: string;
    state?: string;
    zipPostal?: string;
    county?: string;
    metroArea?: string;
    biggestChallenge?: string;
    currentTools?: string;
    desiredFeatures?: string;
    experienceLevel?: string;
    source?: string;
    intakeDetails?: Record<string, unknown>;
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
    schoolName?: string;
    gpa?: number;
    certifications?: string;
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
    linkedFollowUpIds?: string[];
    linkedFollowUps?: FollowUpRecord[];
  }>;
  pendingIntakeFollowUps?: Array<ContactDetails & {
    id?: string;
    leadId?: string;
    candidateId?: string;
    contactId?: string;
    name?: string;
    userType?: string;
    organization?: string;
    role?: string;
    emailDomain?: string;
    emailDomainType?: string;
    targetRole?: string;
    targetIndustry?: string;
    schoolName?: string;
    majorField?: string;
    classYear?: string;
    preferredContactMethod?: string;
    leadScore?: number;
    leadPriority?: string;
    recommendedAction?: string;
    createdAt?: string;
  }>;
  completedFollowUps?: FollowUpRecord[];
  recentFollowUps?: FollowUpRecord[];
};

export default function AdminDashboard() {
  const [accessCode, setAccessCode] = useState(() => sessionStorage.getItem("fokalview_admin_access_code") || "");
  const [codeDraft, setCodeDraft] = useState(accessCode);
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme());
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<WorkspaceView>(() => readWorkspaceView());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [outreachError, setOutreachError] = useState("");
  const [outreach, setOutreach] = useState<Record<string, OutreachState>>({});
  const [outreachReady, setOutreachReady] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [emailFilter, setEmailFilter] = useState("All contacts");
  const [ownerFilter, setOwnerFilter] = useState("All owners");
  const [dueFilter, setDueFilter] = useState("Any follow-up date");
  const [followupMode, setFollowupMode] = useState<"responses" | "pending">("responses");
  const [page, setPage] = useState(1);
  const [selectedWaitlist, setSelectedWaitlist] = useState<AdminSummary["recentWaitlistSignups"][number] | null>(null);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpRecord | null>(null);
  const [contactDetailTab, setContactDetailTab] = useState<"answers" | "plan" | "responses">("answers");
  const requestNumber = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => { localStorage.setItem("sagittaiq_admin_theme", theme); }, [theme]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const onPop = () => { setView(readWorkspaceView()); setQuery(""); setSearchQuery(""); setPage(1); };
    window.addEventListener("popstate", onPop);
    const url = new URL(window.location.href);
    if (!url.searchParams.has("view")) { url.searchParams.set("view", "waitlist"); history.replaceState(null, "", url); }
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!accessCode) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const request = ++requestNumber.current;
    const current = () => request === requestNumber.current && !controller.signal.aborted;
    setIsLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    fetch(`/api/admin/summary${params.size ? `?${params}` : ""}`, {
      headers: { "X-Admin-Access-Code": accessCode }, signal: controller.signal
    }).then(async (response) => {
      const payload = await response.json();
      if (!current()) return;
      if (response.status === 401 || response.status === 403) {
        ++requestNumber.current;
        controller.abort();
        sessionStorage.removeItem("fokalview_admin_access_code");
        setAccessCode(""); setCodeDraft(""); setSummary(null); setSelectedWaitlist(null); setSelectedFollowUp(null);
        setOutreach({}); setOutreachReady(false);
        setIsLoading(false);
        setError(payload.error || "Your admin session could not be verified. Enter your access code again.");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "We couldn't refresh the workspace. Please try again.");
      sessionStorage.setItem("fokalview_admin_access_code", accessCode);
      setSummary(payload as AdminSummary);
      setPage(1);
    }).catch((failure) => {
      if (current()) setError(failure instanceof Error ? failure.message : "We couldn't refresh the workspace.");
    }).finally(() => { if (current()) setIsLoading(false); });

    fetch("/api/admin/outreach", { headers: { "X-Admin-Access-Code": accessCode }, signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!current()) return;
        if (!response.ok) throw new Error(payload.error || "Outreach status could not be loaded.");
        setOutreach(Object.fromEntries((payload.records || []).map((item: OutreachState) => [item.leadId, item])));
        setOutreachReady(true); setOutreachError("");
      }).catch((failure) => { if (current()) setOutreachError(failure instanceof Error ? failure.message : "Outreach status could not be loaded."); });
    return () => controller.abort();
  }, [accessCode, searchQuery, refreshVersion]);

  function signOut() {
    ++requestNumber.current; activeRequest.current?.abort();
    sessionStorage.removeItem("fokalview_admin_access_code");
    setAccessCode(""); setCodeDraft(""); setSummary(null); setQuery(""); setSearchQuery("");
    setSelectedWaitlist(null); setSelectedFollowUp(null); setOutreach({}); setOutreachReady(false);
    setError(""); setOutreachError(""); setIsLoading(false); setPage(1);
    setStatusFilter("All statuses"); setEmailFilter("All contacts"); setOwnerFilter("All owners"); setDueFilter("Any follow-up date");
  }
  function navigate(next: WorkspaceView) {
    const url = new URL(window.location.href); url.searchParams.set("view", next); history.pushState(null, "", url);
    setView(next); setQuery(""); setSearchQuery(""); setStatusFilter("All statuses"); setEmailFilter("All contacts"); setOwnerFilter("All owners"); setDueFilter("Any follow-up date"); setPage(1);
  }
  function unlock(event: FormEvent) { event.preventDefault(); if (codeDraft.trim()) { setError(""); setAccessCode(codeDraft.trim()); setRefreshVersion((value) => value + 1); } }
  function openContact(record: AdminSummary["recentWaitlistSignups"][number]) { setContactDetailTab("answers"); setSelectedWaitlist(record); }

  const themeButton = <button type="button" className="workspace-icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>;
  if (!accessCode) return (
    <main className="admin-shell contact-admin admin-locked" data-theme={theme}>
      <section className="admin-signin" aria-labelledby="admin-signin-title">
        <div className="signin-brand"><span className="workspace-brand-mark">S</span><strong>SagittaIQ</strong>{themeButton}</div>
        <h1 id="admin-signin-title">Your admin workspace</h1>
        <p className="signin-description">Sign in to review contacts, follow up, and track progress.</p>
        <form onSubmit={unlock} className="workspace-signin-form">
          <label htmlFor="admin-access-code">Admin access code</label>
          <div className="signin-input"><LockKeyhole size={17} aria-hidden="true" /><input id="admin-access-code" value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} type="password" autoComplete="current-password" required /></div>
          {error && <p className="workspace-alert" role="alert">{error}</p>}
          <button className="workspace-primary" type="submit" disabled={!codeDraft.trim()}>Unlock workspace <ArrowRight size={17} /></button>
        </form>
        <small className="workspace-release">Admin workspace · 2026.11.04 · {import.meta.env.VITE_APP_BUILD || "local-preview"}</small>
      </section>
    </main>
  );

  const records = summary?.recentWaitlistSignups || [];
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const owners = [...new Set(Object.values(outreach).map((item) => item.owner).filter((owner): owner is string => typeof owner === "string" && Boolean(owner)))].sort();
  const filteredContacts = records.filter((item) => {
    const plan = outreach[item.id];
    return (emailFilter !== "Email available" || Boolean(item.email)) && (emailFilter !== "Email missing" || !item.email)
      && (statusFilter === "All statuses" || (plan?.status || (outreachReady ? "New" : "")) === statusFilter)
      && (ownerFilter === "All owners" || (ownerFilter === "Unassigned" ? !plan?.owner : plan?.owner === ownerFilter))
      && (dueFilter === "Any follow-up date" || dueFilter === "Due or overdue" && Boolean(plan?.nextFollowUpDate && plan.nextFollowUpDate <= todayKey && plan.status !== "Closed") || dueFilter === "Scheduled" && Boolean(plan?.nextFollowUpDate) || dueFilter === "Not scheduled" && !plan?.nextFollowUpDate);
  });
  const followups = summary?.recentFollowUps || [];
  const pending = summary?.pendingIntakeFollowUps || [];
  const listRecords = view === "waitlist" ? filteredContacts : followupMode === "pending" ? pending : followups;
  const exportRows = view === "waitlist" ? filteredContacts.map((item) => ({ ...item, outreach: outreachReady ? { ...(outreach[item.id] || { status: "New" }), dataStatus: outreachError ? "Previously loaded; refresh failed" : "Current" } : { dataStatus: "Unavailable" } })) : listRecords;
  const pages = Math.max(1, Math.ceil(listRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleContacts = filteredContacts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleFollowups = followups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePending = pending.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const emailCount = filteredContacts.filter((record) => record.email).length;
  const hasFilters = Boolean(query || emailFilter !== "All contacts" || statusFilter !== "All statuses" || ownerFilter !== "All owners" || dueFilter !== "Any follow-up date");
  const totalContacts = summary?.globalTotals?.waitlistSignups ?? summary?.totals.waitlistSignups ?? 0;
  const totalFollowups = summary?.globalTotals?.followUpSurveys ?? summary?.totals.followUpSurveys ?? 0;
  const dataIsStale = Boolean(summary && (isLoading || error || query.trim() !== (summary.meta.query || "")));

  return (
    <main className="admin-shell contact-admin" data-theme={theme}>
      <a className="skip-link" href="#admin-workspace-content">Skip to workspace</a>
      <header className="workspace-topbar">
        <div className="workspace-brand"><span className="workspace-brand-mark">S</span><div><strong>SagittaIQ <span>Admin</span></strong><small className="workspace-release">Admin workspace · 2026.11.04 · {import.meta.env.VITE_APP_BUILD || "local-preview"}</small></div></div>
        <div className="workspace-session"><span className="session-dot" /><span>Admin session unlocked</span></div>
        <div className="workspace-toolbar">{themeButton}<button type="button" className="workspace-quiet" onClick={() => setRefreshVersion((value) => value + 1)} disabled={isLoading}><RefreshCw size={16} className={isLoading ? "spin" : ""} /> Refresh</button><button type="button" className="workspace-quiet" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
      </header>
      <div className="workspace-frame">
        <nav className="workspace-nav" aria-label="Admin workspace sections">
          {WORKSPACE_VIEWS.map((item) => <a key={item.id} aria-label={item.label} href={`?view=${item.id}`} aria-current={view === item.id ? "page" : undefined} onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item.id); }}>{item.icon}<span>{item.label}</span>{summary && item.id !== "reports" && <small>{item.id === "waitlist" ? totalContacts : totalFollowups}</small>}</a>)}
        </nav>
        <div id="admin-workspace-content" className="workspace-body">
          {error && <div className="workspace-alert" role="alert"><strong>{summary ? "Refresh failed. Your previous results are still shown." : "The workspace could not be loaded."}</strong><span>{error}</span><button type="button" onClick={() => setRefreshVersion((value) => value + 1)}>Try again</button></div>}
          {outreachError && summary && <div className="workspace-alert" role="alert">{outreachError} {outreachReady ? "Previously loaded outreach statuses are shown." : "Outreach statuses are unavailable."}</div>}
          {!summary && !error && <div className="workspace-loading" role="status"><RefreshCw size={20} className="spin" /><h1>Opening your workspace</h1><p>Loading contacts and reports…</p></div>}
          {summary && <>
            <div className="workspace-heading">
              <div><p className="workspace-eyebrow">{view === "reports" ? "Understand your pipeline" : "People, context, next steps"}</p><h1>{view === "waitlist" ? "Waitlist contacts" : view === "followups" ? "Follow-ups" : "Reports"}</h1><p>{view === "waitlist" ? "Everything you need for a thoughtful follow-up, in one place." : view === "followups" ? "Review progress updates and the people waiting for an intake conversation." : "Clear summaries of signups, career progress, and application activity."}</p></div>
              <div className="workspace-sync" role="status">{isLoading ? "Refreshing…" : dataIsStale ? "Showing previous results" : `Updated ${formatDateTime(summary.meta.lastLoadedAt)}`}</div>
            </div>
            {view !== "reports" && <>
              {view === "followups" && <div className="workspace-segment" aria-label="Follow-up list"><button type="button" aria-pressed={followupMode === "responses"} onClick={() => { setFollowupMode("responses"); setPage(1); }}>Progress responses <span>{followups.length}</span></button><button type="button" aria-pressed={followupMode === "pending"} onClick={() => { setFollowupMode("pending"); setPage(1); }}>Needs intake <span>{pending.length}</span></button></div>}
              <section className="workspace-records" aria-label={view === "waitlist" ? "Waitlist contact list" : "Follow-up list"}>
                <div className="workspace-record-tools">
                  <label className="workspace-search"><Search size={17} aria-hidden="true" /><span className="sr-only">{view === "waitlist" ? "Search contacts" : "Search follow-ups"}</span><input aria-label={view === "waitlist" ? "Search contacts" : "Search follow-ups"} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={view === "waitlist" ? "Name, email, organization, or goal" : "Email, lead ID, employer, or outcome"} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
                  {view === "waitlist" && <div className="workspace-filters"><label><span className="sr-only">Contact availability</span><select value={emailFilter} onChange={(event) => { setEmailFilter(event.target.value); setPage(1); }}>{["All contacts", "Email available", "Email missing"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="sr-only">Outreach status</span><select value={statusFilter} disabled={!outreachReady} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>{["All statuses", ...OUTREACH_STATUSES].map((value) => <option key={value}>{value}</option>)}</select></label></div>}
                  <div className="workspace-export"><button type="button" className="workspace-quiet" disabled={dataIsStale || !listRecords.length} onClick={() => exportCsv(view === "waitlist" ? "waitlist-contacts" : `followups-${followupMode}`, exportRows)}><Download size={15} />Export CSV</button><button type="button" className="workspace-quiet" disabled={dataIsStale || !listRecords.length} onClick={() => exportDataset(view === "waitlist" ? "waitlist-contacts" : `followups-${followupMode}`, exportRows)}>Export JSON</button></div>
                  {view === "waitlist" && <details className="workspace-more-filters"><summary>More filters{ownerFilter !== "All owners" || dueFilter !== "Any follow-up date" ? " · active" : ""}</summary><div className="workspace-filters"><label><span>Owner</span><select aria-label="Outreach owner" value={ownerFilter} disabled={!outreachReady} onChange={(event) => { setOwnerFilter(event.target.value); setPage(1); }}>{["All owners", "Unassigned", ...owners].map((owner) => <option key={owner}>{owner}</option>)}</select></label><label><span>Follow-up date</span><select aria-label="Follow-up date" value={dueFilter} disabled={!outreachReady} onChange={(event) => { setDueFilter(event.target.value); setPage(1); }}>{["Any follow-up date", "Due or overdue", "Scheduled", "Not scheduled"].map((date) => <option key={date}>{date}</option>)}</select></label></div></details>}
                </div>
                <div className="workspace-list-summary"><span><strong>{listRecords.length}</strong> {hasFilters ? "matching" : "total"} {view === "waitlist" ? "contacts" : followupMode === "pending" ? "intake contacts" : "responses"}{view === "waitlist" && <span className="list-summary-extra"> · {emailCount} with an email address</span>}</span><span>Exports include every matching record</span></div>
                {view === "waitlist" && records.some((record) => !record.email) && <div className="workspace-legacy-note"><Info size={15} /><span>Some older signups have no saved email address. Their available details are still here; a hash cannot restore an address.</span></div>}
                <div className="workspace-contact-list" aria-busy={isLoading}>
                  {view === "waitlist" && visibleContacts.map((signup) => <article className="workspace-contact" key={signup.id} aria-label={signup.name || "Unnamed contact"}>
                    <div className="contact-identity"><span className="contact-avatar">{initials(signup.name)}</span><div><h2>{signup.name || "Unnamed contact"}</h2><p>{[signup.userType, signup.organization || signup.schoolName].filter(Boolean).join(" · ") || "Profile not provided"}</p><ContactLinks contact={signup} /></div></div>
                    <div className="contact-context"><span className="workspace-label">Their goal</span><p>{signup.biggestChallenge || signup.targetRole || signup.role || "No goal provided"}</p><small>{signup.preferredContactMethod ? `Prefers ${signup.preferredContactMethod}` : "Contact preference not provided"}</small></div>
                    <div className="contact-next-step"><span className={`workspace-status ${outreach[signup.id]?.status === "Closed" ? "closed" : ""}`}>{outreach[signup.id]?.status || (outreachReady ? "New" : "Status unavailable")}</span><small>Joined {formatDate(signup.createdAt)}</small>{outreach[signup.id]?.nextFollowUpDate && <small>Next follow-up {outreach[signup.id].nextFollowUpDate}</small>}<button type="button" className="workspace-view-button" onClick={() => openContact(signup)}>View contact <ArrowUpRight size={15} /></button></div>
                  </article>)}
                  {view === "followups" && followupMode === "responses" && visibleFollowups.map((item, index) => <article className="workspace-contact" key={item.id || `${item.leadId}-${index}`} aria-label={item.email || item.leadId || "Follow-up response"}><div className="contact-identity"><span className="contact-avatar"><MessageSquare size={19} /></span><div><h2>{item.matchedContactName || item.email || item.leadId || item.candidateId || "Follow-up response"}</h2><p>{[item.employer, item.jobTitle || item.currentRole].filter(Boolean).join(" · ") || "Employer not provided"}</p><ContactLinks contact={item} /></div></div><div className="contact-context"><span className="workspace-label">Progress</span><p>{item.currentStatus || "Status not provided"} · {item.placementStatus || "Outcome not provided"}</p><small>{item.applicationCount} applications · {item.interviewCount} interviews · {item.offerCount} offers</small></div><div className="contact-next-step"><small>{formatDate(item.submittedAt || "")}</small><button type="button" className="workspace-view-button" onClick={() => setSelectedFollowUp(item)}>View response <ArrowUpRight size={15} /></button></div></article>)}
                  {view === "followups" && followupMode === "pending" && visiblePending.map((item, index) => <article className="workspace-contact" key={item.id || index} aria-label={item.name || "Intake contact"}><div className="contact-identity"><span className="contact-avatar">{initials(item.name || "")}</span><div><h2>{item.name || "Unnamed contact"}</h2><p>{item.organization || item.schoolName || item.userType || "Intake requested"}</p><ContactLinks contact={item} /></div></div><div className="contact-context"><span className="workspace-label">Intake requested</span><p>{item.targetRole || item.role || "No target role provided"}</p><small>{item.preferredContactMethod || "Contact preference not provided"}</small></div><div className="contact-next-step"><small>Joined {formatDate(item.createdAt || "")}</small><button type="button" className="workspace-view-button" onClick={() => openContact(records.find((record) => record.id === item.id) || item as AdminSummary["recentWaitlistSignups"][number])}>View contact <ArrowUpRight size={15} /></button></div></article>)}
                  {!listRecords.length && <div className="workspace-empty"><Search size={24} /><h2>{hasFilters ? "No matching records" : "Nothing here yet"}</h2><p>{hasFilters ? "Try a different search or clear your filters." : view === "waitlist" ? "New signups will appear here with their contact details and answers." : "Follow-up responses and intake requests will appear here."}</p>{hasFilters && <button type="button" className="workspace-quiet" onClick={() => { setQuery(""); setStatusFilter("All statuses"); setEmailFilter("All contacts"); setOwnerFilter("All owners"); setDueFilter("Any follow-up date"); }}>Clear filters</button>}</div>}
                </div>
                <RecordPager page={currentPage} pages={pages} total={listRecords.length} onPage={setPage} />
              </section>
            </>}
            {view === "reports" && <WorkspaceReports summary={summary} onNavigate={navigate} outreach={outreach} outreachReady={outreachReady} outreachError={outreachError} />}
          </>}
        </div>
        <footer className="workspace-footer"><span>SagittaIQ · Private admin workspace</span><a href="/waitlist" target="_blank" rel="noreferrer">Open signup page <ArrowUpRight size={13} /></a></footer>
      </div>
      {selectedWaitlist && <RecordDrawer title={selectedWaitlist.name || "Contact"} label="Contact details" onClose={() => setSelectedWaitlist(null)}>
        <div className="drawer-contact-summary"><ContactLinks contact={selectedWaitlist} /><span>Prefers {selectedWaitlist.preferredContactMethod || "a contact method not yet specified"}</span></div>
        <div className="workspace-segment" aria-label="Contact detail view"><button type="button" aria-pressed={contactDetailTab === "answers"} onClick={() => setContactDetailTab("answers")}>Signup answers</button><button type="button" aria-pressed={contactDetailTab === "plan"} onClick={() => setContactDetailTab("plan")}>Follow-up plan</button><button type="button" aria-pressed={contactDetailTab === "responses"} onClick={() => setContactDetailTab("responses")}>Survey responses ({selectedWaitlist.linkedFollowUps?.length || 0})</button></div>
        {contactDetailTab === "answers" && <GroupedRecordDetails record={selectedWaitlist} />}
        {contactDetailTab === "plan" && <OutreachEditor leadId={selectedWaitlist.id} adminCode={accessCode} onSaved={(current) => { setOutreach((value) => ({ ...value, [selectedWaitlist.id]: { ...current, leadId: selectedWaitlist.id } })); }} />}
        {contactDetailTab === "responses" && <section className="linked-survey-responses"><h3>Survey response history</h3>{selectedWaitlist.linkedFollowUps?.length ? selectedWaitlist.linkedFollowUps.map((response, index) => <details className="workspace-reference" key={response.id || index}><summary>{formatDateTime(response.submittedAt || "")} · {response.currentStatus || "Progress update"}</summary><GroupedRecordDetails record={response} followup /></details>) : <p>No progress surveys are linked to this contact yet.</p>}</section>}
      </RecordDrawer>}
      {selectedFollowUp && <RecordDrawer title={selectedFollowUp.matchedContactName || selectedFollowUp.email || selectedFollowUp.leadId || "Career progress update"} label="Follow-up details" onClose={() => setSelectedFollowUp(null)}><div className="drawer-contact-summary"><ContactLinks contact={selectedFollowUp} /></div><GroupedRecordDetails record={selectedFollowUp} followup /></RecordDrawer>}
    </main>
  );
}

type WorkspaceView = "waitlist" | "followups" | "reports";
type OutreachState = { leadId: string; status: string; nextFollowUpDate?: string; [key: string]: unknown };
const PAGE_SIZE = 20;
const OUTREACH_STATUSES = ["New", "Contacted", "Awaiting reply", "Meeting scheduled", "Pilot discussion", "Closed"];
const WORKSPACE_VIEWS: Array<{ id: WorkspaceView; label: string; icon: ReactNode }> = [
  { id: "waitlist", label: "Waitlist", icon: <Users size={17} /> },
  { id: "followups", label: "Follow-ups", icon: <MessageSquare size={17} /> },
  { id: "reports", label: "Reports", icon: <BarChart3 size={17} /> }
];
function readWorkspaceView(): WorkspaceView {
  const requested = new URLSearchParams(window.location.search).get("view");
  if (requested === "followups") return "followups";
  if (["reports", "all", "institutional", "applications"].includes(requested || "")) return "reports";
  return "waitlist";
}
function RecordPager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (!total) return null;
  return <div className="workspace-pagination"><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span><div><button type="button" className="workspace-quiet" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="workspace-quiet" disabled={page === pages} onClick={() => onPage(page + 1)}>Next</button></div></div>;
}
function RecordDrawer({ title, label, onClose, children }: { title: string; label: string; onClose: () => void; children: ReactNode }) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () => Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]') || []).filter((item) => item.getClientRects().length > 0);
    elements()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") { const items = elements(); const first = items[0]; const last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  return <div className="workspace-drawer-backdrop" onClick={onClose}><aside ref={drawerRef} className="workspace-drawer" role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}><header className="workspace-drawer-header"><div><p className="workspace-eyebrow">{label}</p><h2>{title}</h2></div><button type="button" className="workspace-icon-button" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}><X size={20} /></button></header><div className="workspace-drawer-body">{children}</div></aside></div>;
}
function GroupedRecordDetails({ record, followup = false }: { record: Record<string, unknown>; followup?: boolean }) {
  const internalKeys = new Set(["id", "leadId", "candidateId", "contactId", "organizationId", "emailDomain", "emailDomainType", "source", "scoreBreakdown", "linkedFollowUpIds", "matchedSignupIds"]);
  const contactKeys = new Set(["name", "matchedContactName", "email", "emailStatus", "phone", "linkedinUrl", "preferredContactMethod", "city", "state", "zipPostal", "country", "county", "metroArea", "workforceRegion"]);
  const goalKeys = new Set(["biggestChallenge", "currentTools", "desiredFeatures", "interviewInterest", "betaInterest", "pilotInterest", "budgetInterest", "reportingWish", "recommendedAction", "targetRole", "targetIndustry", "timeline", "buyingAuthority", "leadScore", "leadPriority"]);
  const profileKeys = new Set(["userType", "organization", "organizationType", "role", "schoolName", "programName", "majorField", "gpa", "certifications", "degreeLevel", "classYear", "studentStatus", "seekingStatus", "domesticInternational", "experienceLevel", "populationServed", "currentProcess"]);
  const { branchProfile, intakeDetails, responseDetails, linkedFollowUps: _linkedFollowUps, ...answers } = record;
  const snapshots = { branchProfile, intakeDetails, responseDetails };
  const aliases: Record<string, string> = { degreeProgram: "programName", expectedGraduationYear: "classYear", beta: "betaInterest", interview: "interviewInterest", pilot: "pilotInterest", budget: "budgetInterest", resumeAnalysis: "resumeAnalysisInterest", applicationTracker: "applicationTrackerInterest", productUpdates: "productUpdatesInterest", feedback: "feedbackInterest" };
  function addAnswers(value: unknown, source: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [originalKey, entry] of Object.entries(value)) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) { addAnswers(entry, source); continue; }
      const key = aliases[originalKey] || originalKey;
      const existing = answers[key];
      if (existing === null || existing === undefined || existing === "") answers[key] = entry;
      else if (displayValue(existing) !== displayValue(entry) && entry !== null && entry !== undefined && entry !== "") answers[`${originalKey} (${source})`] = entry;
    }
  }
  addAnswers(branchProfile, "profile answer"); addAnswers(intakeDetails, "signup answer"); addAnswers(responseDetails, "follow-up answer");
  const groups: Array<[string, Record<string, unknown>]> = [["Contact information", {}], [followup ? "Progress and outcomes" : "Goals and interests", {}], ["Profile and organization", {}], ["Additional answers", {}], ["Internal references", {}]];
  for (const [key, value] of Object.entries(answers)) {
    const group = internalKeys.has(key) ? 4 : contactKeys.has(key) ? 0 : goalKeys.has(key) || followup && !["responseDetails", "submittedAt"].includes(key) ? 1 : profileKeys.has(key) ? 2 : 3;
    groups[group][1][key] = value;
  }
  return <div className="grouped-record-details">{groups.map(([title, values], index) => {
    if (!Object.keys(values).length) return null;
    const fields = <dl className="workspace-fields">{Object.entries(flattenRecord(values)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl>;
    return index === 4 ? <details key={title} className="workspace-reference"><summary>{title}</summary>{fields}</details> : <section key={title} aria-label={title}><h3>{title}</h3>{fields}</section>;
  })}{Object.values(snapshots).some((value) => value && typeof value === "object") && <details className="workspace-reference"><summary>Original saved answers</summary><p className="report-source-note">Complete saved submissions, including repeated fields, for reference.</p><dl className="workspace-fields">{Object.entries(flattenRecord(Object.fromEntries(Object.entries(snapshots).filter(([, value]) => value && typeof value === "object")))).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>}</div>;
}

function WorkspaceReports({ summary, onNavigate, outreach, outreachReady, outreachError }: { summary: AdminSummary; onNavigate: (view: WorkspaceView) => void; outreach: Record<string, OutreachState>; outreachReady: boolean; outreachError: string }) {
  const [report, setReport] = useState<"waitlist" | "outcomes" | "activity">("waitlist");
  const [reportError, setReportError] = useState("");
  const sections: Array<{ id: typeof report; label: string }> = [{ id: "waitlist", label: "Waitlist insights" }, { id: "outcomes", label: "Career outcomes" }, { id: "activity", label: "Application activity" }];
  const exportSummary = { ...summary, recentWaitlistSignups: summary.recentWaitlistSignups.map((item) => ({ ...item, outreach: outreach[item.id] || (outreachReady ? { status: "New" } : { dataStatus: "Unavailable" }), outreachDataStatus: outreachError ? "Previously loaded; refresh failed" : outreachReady ? "Current" : "Unavailable" })) };
  return <div className="workspace-reports">
    <div className="workspace-report-tools">
      <div className="workspace-segment" aria-label="Report category">{sections.map((item) => <button type="button" key={item.id} aria-pressed={report === item.id} onClick={() => setReport(item.id)}>{item.label}</button>)}</div>
      <button type="button" className="workspace-quiet" onClick={() => { try { exportResearchBundle(exportSummary); } catch { setReportError("The report download could not be created. Please try again."); } }}><Download size={15} />Export report data</button>
    </div>
    {reportError && <p role="alert" className="workspace-alert">{reportError}</p>}
    <p className="report-source-note">{summary.meta.query ? `Records matching “${summary.meta.query}”` : "All available records"}, refreshed {formatDateTime(summary.meta.lastLoadedAt)}. Outcomes and verification labels are respondent-supplied; independent verification is not established here.</p>
    <details className="workspace-report-sources"><summary>Report sources and counting method</summary><p>{summary.meta.reportingMethod || "Outcome totals use the latest response per saved contact identity. Full response history is retained."}</p><dl>{Object.entries(summary.meta.sources || {}).map(([name, source]) => <div key={name}><dt>{name}</dt><dd>{source.status} · {source.count} records</dd></div>)}</dl></details>
    {report === "waitlist" && <>
      <div className="workspace-report-metrics">
        <Metric label="Waitlist signups" value={summary.totals.waitlistSignups} note="Signup records, including repeat signups" />
        <Metric label="Discovery call interest" value={summary.totals.interviewVolunteers} note="Signups that requested an introduction" />
        <Metric label="Pilot interest" value={summary.totals.pilotProspects} note="Signups interested in a pilot" />
        <Metric label="Email addresses available" value={summary.recentWaitlistSignups.filter((item) => item.email).length} note="Records with readable contact information" />
      </div>
      <div className="workspace-report-link"><p>Ready to turn these signals into conversations?</p><button type="button" onClick={() => onNavigate("waitlist")}>Open waitlist contacts <ArrowRight size={16} /></button></div>
      <div className="workspace-report-grid">
        <ChartPanel title="Who is joining" items={summary.waitlistUserTypes || []} /><ChartPanel title="Referral sources" items={summary.waitlistReferralSources || []} />
        <ChartPanel title="Requested interests" items={toCountItems(summary.waitlistInterest || {})} /><ChartPanel title="Target industries" items={summary.waitlistTargetIndustries || []} />
        <ChartPanel title="Organizations" items={summary.waitlistOrganizationTypes || []} /><ChartPanel title="Workforce regions" items={summary.waitlistWorkforceRegions || []} />
        <ChartPanel title="Schools" items={summary.waitlistSchools || []} /><ChartPanel title="Programs" items={summary.waitlistPrograms || []} />
        <ChartPanel title="Fields of study" items={summary.waitlistMajors || []} /><ChartPanel title="Current processes" items={summary.waitlistCurrentProcesses || []} />
        <ChartPanel title="Lead priority" items={toCountItems(summary.waitlistLeadPriorities || {})} /><ChartPanel title="Profile status" items={summary.waitlistBranchStatuses || []} />
      </div>
    </>}
    {report === "outcomes" && <>
      <div className="workspace-report-metrics">
        <Metric label="Follow-up responses" value={summary.totals.followUpSurveys || 0} note="All submitted progress updates" />
        <Metric label="Distinct respondents" value={summary.totals.followUpRespondents || 0} note="Saved contact identities with an update" />
        <Metric label="Contacts with a follow-up" value={`${summary.totals.waitlistContactsWithFollowUp || 0} / ${summary.totals.uniqueWaitlistContacts || 0}`} note="Matched waitlist identities / all unique waitlist identities" />
        <Metric label="Reported placements" value={summary.totals.followUpPlacements || 0} note="Latest update per identifiable respondent" />
        <Metric label="Applications reported" value={summary.totals.followUpApplications || 0} note="Latest update per identifiable respondent" />
        <Metric label="Interviews reported" value={summary.totals.followUpInterviews || 0} note="Latest update per identifiable respondent" />
        <Metric label="Offers reported" value={summary.totals.followUpOffers || 0} note="Latest update per identifiable respondent" />
        <Metric label="Unlinked responses" value={summary.totals.unlinkedFollowUpResponses || 0} note="Excluded from respondent-level totals and rates" />
      </div>
      <div className="workspace-report-link"><p>Read the full responses and support requests behind these numbers.</p><button type="button" onClick={() => onNavigate("followups")}>Open follow-ups <ArrowRight size={16} /></button></div>
      <div className="workspace-report-grid">
        <ChartPanel title="Career outcomes" items={toCountItems(summary.followUpOutcomes || {})} /><ChartPanel title="Current search status" items={toCountItems(summary.followUpStatuses || {})} />
        <ChartPanel title="Employers" items={summary.followUpEmployers || []} /><ChartPanel title="Job titles" items={summary.followUpJobTitles || []} />
        <ChartPanel title="Industries" items={summary.followUpIndustries || []} /><ChartPanel title="Salary ranges" items={summary.followUpSalaryRanges || []} />
        <ChartPanel title="Reported verification status" items={summary.followUpVerificationStatuses || []} />
        {summary.salaryByPeriod?.map((item) => <section className="workspace-salary-report" key={`${item.period}-${item.currency || "unknown"}`}><h2>{item.period || "Unspecified period"} compensation · {item.currency || "Currency not recorded"}</h2><dl><div><dt>Responses</dt><dd>{item.count}</dd></div><div><dt>Median amount</dt><dd>{item.median?.toLocaleString() ?? "Not comparable"}</dd></div><div><dt>Average amount</dt><dd>{item.average?.toLocaleString() ?? "Not comparable"}</dd></div></dl><p>Grouped by currency and pay period. Missing currency or period prevents averaging; no currency conversion or annualization is applied.</p></section>)}
      </div>
    </>}
    {report === "activity" && <>
      <div className="workspace-report-metrics">
        <Metric label="Resume analyses" value={summary.totals.resumeRecords} note="Saved analysis records" /><Metric label="Applications captured" value={summary.totals.applicationCaptures} note="Saved opportunity records" />
        <Metric label="Tracked users" value={summary.totals.uniqueUsers} note="Distinct users in saved activity" /><Metric label="Average readiness" value={summary.totals.resumeRecords ? `${summary.totals.averageReadinessScore}%` : "Not available"} note="Across saved resume analyses" />
      </div>
      <AnalysisRecords records={summary.recentResumeRecords} />
      <div className="workspace-report-grid">
        <ChartPanel title="Readiness bands" items={toCountItems(summary.readinessBands || {})} /><ChartPanel title="Application status" items={toCountItems(summary.applicationStatuses || {})} />
        <ChartPanel title="Application sources" items={summary.applicationSources || []} /><ChartPanel title="Opportunity employers" items={summary.applicationEmployers || []} />
        <ChartPanel title="Top skills" items={summary.topSkills || []} /><ChartPanel title="Top tools" items={summary.topTools || []} />
      </div>
    </>}
  </div>;
}
function AnalysisRecords({ records }: { records: AdminSummary["recentResumeRecords"] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminSummary["recentResumeRecords"][number] | null>(null);
  const matching = records.filter((record) => [record.candidateId, record.targetRole, record.currentTitle, record.careerLevel, record.country].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  return <section className="workspace-records analysis-records" aria-labelledby="saved-analyses-title">
    <div className="workspace-analysis-heading"><div><h2 id="saved-analyses-title">Saved analyses</h2><p>Every saved report, with its original analysis and profile details.</p></div><button type="button" className="workspace-quiet" onClick={() => exportDataset("saved-analyses", matching)} disabled={!matching.length}><Download size={15} />Export analyses JSON</button></div>
    <div className="workspace-record-tools"><label className="workspace-search"><Search size={17} /><input aria-label="Search analyses" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Candidate, target role, or title" /></label><span className="report-source-note">{matching.length} matching reports · {records.length} total</span></div>
    {matching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((record, index) => <article className="workspace-contact analysis-record" key={record.id || `${record.candidateId}-${index}`}><div className="contact-identity"><span className="contact-avatar"><BarChart3 size={18} /></span><div><h3>{record.targetRole || record.currentTitle || "Resume analysis"}</h3><p>{record.candidateId || "Candidate ID not provided"}</p><small>{formatDateTime(record.capturedAt)}</small></div></div><div className="contact-context"><span className="workspace-label">Readiness score</span><p>{record.score}%</p><small>{record.careerLevel || "Career level not provided"}</small></div><div className="contact-next-step"><button type="button" className="workspace-view-button" onClick={() => setSelected(record)}>View analysis <ArrowUpRight size={15} /></button></div></article>)}
    {!matching.length && <div className="workspace-empty"><h3>No matching analyses</h3><p>Try another candidate or role.</p></div>}
    <RecordPager page={currentPage} pages={pages} total={matching.length} onPage={setPage} />
    {selected && <RecordDrawer title={selected.targetRole || selected.currentTitle || "Resume analysis"} label="Analysis details" onClose={() => setSelected(null)}><p className="report-source-note">Saved {formatDateTime(selected.capturedAt)}. This is the stored report; it has not been regenerated.</p><dl className="workspace-fields">{Object.entries(flattenRecord(selected)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl></RecordDrawer>}
  </section>;
}

function ContactLinks({ contact }: { contact: ContactDetails }) {
  let linkedIn = "";
  try { const parsed = new URL(contact.linkedinUrl || ""); if (parsed.protocol === "https:" || parsed.protocol === "http:") linkedIn = parsed.href; } catch { /* Legacy values remain visible in the full record. */ }
  const phoneTarget = contact.phone?.replace(/[^\d+]/g, "") || "";
  return <div className="contact-links" onClick={(event) => event.stopPropagation()}>
    {contact.email ? <a href={`mailto:${encodeURIComponent(contact.email)}`}>{contact.email}</a> : <span>{contact.emailStatus || "Email address not available"}</span>}
    {contact.phone && (phoneTarget ? <a href={`tel:${phoneTarget}`}>{contact.phone}</a> : <span>{contact.phone}</span>)}
    {linkedIn && <a href={linkedIn} target="_blank" rel="noreferrer">Open LinkedIn profile</a>}
  </div>;
}
function Metric({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return <article><strong>{value}</strong><span>{label}</span>{note && <small>{note}</small>}</article>;
}
function ChartPanel({ title, items }: { title: string; items: CountItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const records = items.filter((item) => item.count > 0);
  const visible = expanded ? records : records.slice(0, 10);
  const max = Math.max(...records.map((item) => item.count), 1);
  return <section className="chart-panel">
    <div className="panel-heading"><h2>{title}</h2><button className="download-chart-button" type="button" disabled={!records.length} onClick={() => exportCsv(title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), records)} aria-label={`Export ${title} data`}><Download size={13} />Export data</button></div>
    {records.length ? <dl className="workspace-chart" aria-label={title}>{visible.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.count}</dd><span aria-hidden="true"><i style={{ width: `${Math.max(2, item.count / max * 100)}%` }} /></span></div>)}</dl> : <p className="report-source-note">No data available for this category.</p>}
    {records.length > 10 && <button type="button" className="workspace-view-button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show top 10" : `Show all ${records.length}`}</button>}
  </section>;
}
function toCountItems(record: Record<string, number>) { return Object.entries(record).map(([label, count]) => ({ label, count })); }
function exportResearchBundle(summary: AdminSummary) {
  const payload = { exportedAt: new Date().toISOString(), recordScope: summary.meta.recordScope || "All matching records", ...summary };
  downloadFile(`sagittaiq-report-data-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), "application/json");
}
function exportDataset(name: string, rows: unknown[]) { downloadFile(`sagittaiq-${name}-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(rows, null, 2), "application/json"); }
function exportCsv(name: string, rows: Record<string, unknown>[]) { downloadFile(`sagittaiq-${name}-${new Date().toISOString().slice(0,10)}.csv`, "\uFEFF" + csvForRecords(rows), "text/csv;charset=utf-8"); }
function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
function initials(value: string) { return value.trim().split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join("").toUpperCase() || "?"; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString(); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleString([], { dateStyle: "short", timeStyle: "short" }); }
function getStoredTheme() { const saved = localStorage.getItem("sagittaiq_admin_theme"); return saved === "dark" ? "dark" : "light"; }
