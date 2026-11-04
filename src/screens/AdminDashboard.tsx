import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
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
import "../admin-clarity.css";

type CountItem = { label: string; count: number; percentAffected?: number };
type UsageDay = { date: string; resumes: number; applications: number; uniqueUsers: number };
type FunnelItem = { label: string; count: number; rate: number; denominator?: number };
type ConversionMetric = { label: string; value: number; detail: string; denominator?: number; dataStatus?: "available" | "no-data" };
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
  applicationCount: number | null;
  interviewCount: number | null;
  offerCount: number | null;
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
  identityMatchStatus?: "matched" | "unmatched" | "needs_review";
  verificationClaim?: string;
  verificationEvidenceStatus?: string;
  retainedFields?: Record<string, unknown>;
};
type DecisionSignal = {
  label: string;
  value: number;
  unit: string;
  severity: "positive" | "attention" | "neutral";
  detail: string;
  action: string;
  denominator?: number;
  dataStatus?: "available" | "no-data";
};
type AdminSummary = {
  meta: { readinessThreshold: number; lastLoadedAt: string; query?: string; recordScope?: string; reportingMethod?: string; recordLimit?: number; waitlistRecordsReturned?: number; followupRecordsReturned?: number; sources?: Record<string, { status: string; count: number }>; categoryScope?: string; dataQuality?: { ambiguousFollowUpResponses?: number; missingSignupEmail?: number; missingSignupSnapshots?: number; publicVerificationClaims?: number }; sessionMeasurement?: { measuredSessions: number; unmeasuredSessions: number; definition: string } };
  globalTotals?: { resumeRecords: number; applicationCaptures: number; waitlistSignups: number; followUpSurveys: number; followUpRespondents: number; uniqueWaitlistContacts: number };
  salaryByPeriod?: Array<{ period: string; currency?: string; count: number; median: number | null; average: number | null }>;
  applicationRecords?: Array<Record<string, unknown> & { id: string; title?: string; company?: string; status?: string; source?: string; capturedAt?: string; candidateId?: string }>;
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
    measuredSessions?: number;
    unmeasuredSessions?: number;
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
  targetRoles?: CountItem[];
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
    scoreBreakdown?: Record<string, unknown> | unknown[];
    retainedFields?: Record<string, unknown>;
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

const ReportContext = createContext<{ summary: AdminSummary | null; stale: boolean; navigate?: (view: WorkspaceView) => void }>({ summary: null, stale: false });

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
  const [followupMode, setFollowupMode] = useState<"responses" | "pending" | "queue">("responses");
  const [responseFilter, setResponseFilter] = useState("All responses");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("due");
  const [contactSort, setContactSort] = useState("Newest signup");
  const [contactLayout, setContactLayout] = useState<"list" | "table">("list");
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
    setFollowupMode("responses"); setResponseFilter("All responses"); setQueueFilter("due"); setContactSort("Newest signup"); setContactLayout("list");
    setError(""); setOutreachError(""); setIsLoading(false); setPage(1);
    setStatusFilter("All statuses"); setEmailFilter("All contacts"); setOwnerFilter("All owners"); setDueFilter("Any follow-up date");
  }
  function navigate(next: WorkspaceView) {
    const url = new URL(window.location.href); url.searchParams.set("view", next); history.pushState(null, "", url);
    setView(next); setQuery(""); setSearchQuery(""); setStatusFilter("All statuses"); setEmailFilter("All contacts"); setOwnerFilter("All owners"); setDueFilter("Any follow-up date"); setPage(1);
    if (next === "followups") { setFollowupMode("responses"); setResponseFilter("All responses"); }
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
  }).sort((left, right) => contactSort === "Name" ? left.name.localeCompare(right.name) : contactSort === "Next follow-up" ? (outreach[left.id]?.nextFollowUpDate || "9999").localeCompare(outreach[right.id]?.nextFollowUpDate || "9999") : (contactSort === "Oldest signup" ? 1 : -1) * ((Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0)));
  const followups = (summary?.recentFollowUps || []).filter((record) => responseFilter === "All responses" || responseFilter === "Needs identity review" && record.identityMatchStatus === "needs_review" || responseFilter === "Unmatched responses" && record.identityMatchStatus === "unmatched" || responseFilter === "Matched responses" && record.identityMatchStatus === "matched");
  const pending = summary?.pendingIntakeFollowUps || [];
  const queueRecords = outreachReady ? filteredContacts.filter((item) => inOutreachQueue(outreach[item.id], queueFilter, todayKey)).sort((left, right) => (outreach[left.id]?.nextFollowUpDate || "9999").localeCompare(outreach[right.id]?.nextFollowUpDate || "9999") || (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0)) : [];
  const showContactRecords = view === "waitlist" || view === "followups" && followupMode === "queue";
  const contactRecords = view === "waitlist" ? filteredContacts : queueRecords;
  const listRecords = showContactRecords ? contactRecords : followupMode === "pending" ? pending : followups;
  const exportRows = showContactRecords ? contactRecords.map((item) => ({ ...item, outreach: outreachReady ? { ...(outreach[item.id] || { status: "New" }), dataStatus: outreachError ? "Previously loaded; refresh failed" : "Current" } : { dataStatus: "Unavailable" }, exportContext: { loadedAt: summary?.meta.lastLoadedAt, search: summary?.meta.query || "", outreachStatus: statusFilter, owner: ownerFilter, followUpDate: dueFilter, queue: view === "followups" ? queueFilter : undefined } })) : listRecords;
  const pages = Math.max(1, Math.ceil(listRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleContacts = contactRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleFollowups = followups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePending = pending.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const emailCount = filteredContacts.filter((record) => record.email).length;
  const hasFilters = Boolean(view === "followups" && followupMode === "responses" && responseFilter !== "All responses" || query || emailFilter !== "All contacts" || statusFilter !== "All statuses" || ownerFilter !== "All owners" || dueFilter !== "Any follow-up date");
  const totalContacts = summary?.globalTotals?.waitlistSignups ?? summary?.totals.waitlistSignups ?? 0;
  const totalFollowups = summary?.globalTotals?.followUpSurveys ?? summary?.totals.followUpSurveys ?? 0;
  const dataIsStale = Boolean(summary && (isLoading || error || query.trim() !== (summary.meta.query || "")));

  return (
    <ReportContext.Provider value={{ summary, stale: dataIsStale, navigate }}><main className="admin-shell contact-admin" data-theme={theme}>
      <a className="skip-link" href="#admin-workspace-content">Skip to workspace</a>
      <header className="workspace-topbar">
        <div className="workspace-brand"><span className="workspace-brand-mark">S</span><div><strong>SagittaIQ <span>Admin</span></strong><small className="workspace-release">Admin workspace · 2026.11.04 · {import.meta.env.VITE_APP_BUILD || "local-preview"}</small></div></div>
        <div className="workspace-session"><span className="session-dot" /><span>Admin session unlocked</span></div>
        <div className="workspace-toolbar">{themeButton}<button type="button" className="workspace-quiet" onClick={() => setRefreshVersion((value) => value + 1)} disabled={isLoading}><RefreshCw size={16} className={isLoading ? "spin" : ""} /> Refresh</button><button type="button" className="workspace-quiet" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
      </header>
      <div className="workspace-frame">
        <nav className="workspace-nav" aria-label="Admin workspace sections">
          {WORKSPACE_VIEWS.map((item) => <a key={item.id} aria-label={item.label} href={`?view=${item.id}`} aria-current={view === item.id ? "page" : undefined} onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(item.id); }}>{item.icon}<span>{item.label}</span>{summary && (item.id === "waitlist" || item.id === "followups") && <small>{item.id === "waitlist" ? totalContacts : totalFollowups}</small>}</a>)}
        </nav>
        <div id="admin-workspace-content" className="workspace-body">
          {error && <div className="workspace-alert" role="alert"><strong>{summary ? "Refresh failed. Your previous results are still shown." : "The workspace could not be loaded."}</strong><span>{error}</span><button type="button" onClick={() => setRefreshVersion((value) => value + 1)}>Try again</button></div>}
          {outreachError && summary && <div className="workspace-alert" role="alert">{outreachError} {outreachReady ? "Previously loaded outreach statuses are shown." : "Outreach statuses are unavailable."}</div>}
          {!summary && !error && <div className="workspace-loading" role="status"><RefreshCw size={20} className="spin" /><h1>Opening your workspace</h1><p>Loading contacts and reports…</p></div>}
          {summary && <>
            <div className="workspace-heading">
              <div><p className="workspace-eyebrow">{view === "waitlist" || view === "followups" ? "People, context, next steps" : "Your complete workforce intelligence"}</p><h1>{WORKSPACE_HEADINGS[view].title}</h1><p>{WORKSPACE_HEADINGS[view].description}</p></div>
              <div className="workspace-sync" role="status">{isLoading ? "Refreshing…" : dataIsStale ? "Showing previous results" : `Updated ${formatDateTime(summary.meta.lastLoadedAt)}`}</div>
            </div>
            {(view === "waitlist" || view === "followups") && <>
              {view === "followups" && <div className="workspace-segment" aria-label="Follow-up list"><button type="button" aria-pressed={followupMode === "queue"} onClick={() => { setFollowupMode("queue"); setPage(1); }}>Outreach queue</button><button type="button" aria-pressed={followupMode === "responses"} onClick={() => { setFollowupMode("responses"); setPage(1); }}>Progress responses <span>{followups.length}</span></button><button type="button" aria-pressed={followupMode === "pending"} onClick={() => { setFollowupMode("pending"); setPage(1); }}>Needs intake <span>{pending.length}</span></button></div>}
              {view === "followups" && followupMode === "queue" && <section className="clarity-queue" aria-label="Outreach queue filters"><div className="clarity-queue-filters">{QUEUE_FILTERS.map((filter) => <button key={filter.id} type="button" aria-pressed={queueFilter === filter.id} disabled={!outreachReady} onClick={() => { setQueueFilter(filter.id); setPage(1); }}>{filter.label}<strong>{outreachReady ? filteredContacts.filter((record) => inOutreachQueue(outreach[record.id], filter.id, todayKey)).length : "—"}</strong></button>)}</div><p>Open outreach plans · dates use your local calendar ({Intl.DateTimeFormat().resolvedOptions().timeZone}) · Closed contacts are excluded. A saved date does not send a reminder.</p>{!outreachReady && <p role="status">The outreach queue is unavailable until plans load.</p>}</section>}
              <section className="workspace-records" aria-label={view === "waitlist" ? "Waitlist contact list" : "Follow-up list"}>
                <div className="workspace-record-tools">
                  <label className="workspace-search"><Search size={17} aria-hidden="true" /><span className="sr-only">{view === "waitlist" ? "Search contacts" : "Search follow-ups"}</span><input aria-label={view === "waitlist" ? "Search contacts" : "Search follow-ups"} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={view === "waitlist" ? "Name, email, organization, or goal" : "Email, lead ID, employer, or outcome"} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
                  {showContactRecords && <div className="workspace-filters"><label><span className="sr-only">Contact availability</span><select value={emailFilter} onChange={(event) => { setEmailFilter(event.target.value); setPage(1); }}>{["All contacts", "Email available", "Email missing"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="sr-only">Outreach status</span><select value={statusFilter} disabled={!outreachReady} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>{["All statuses", ...OUTREACH_STATUSES].map((value) => <option key={value}>{value}</option>)}</select></label></div>}
                  {view === "followups" && followupMode === "responses" && <label className="clarity-response-filter">Response linkage<select value={responseFilter} onChange={(event) => { setResponseFilter(event.target.value); setPage(1); }}>{["All responses", "Needs identity review", "Unmatched responses", "Matched responses"].map((value) => <option key={value}>{value}</option>)}</select></label>}
                  <div className="workspace-export"><button type="button" className="workspace-quiet" disabled={dataIsStale || showContactRecords && (!outreachReady || Boolean(outreachError)) || !listRecords.length} onClick={() => exportCsv(view === "waitlist" ? "waitlist-contacts" : `followups-${followupMode}`, exportRows)}><Download size={15} />Export CSV</button><button type="button" className="workspace-quiet" disabled={dataIsStale || showContactRecords && (!outreachReady || Boolean(outreachError)) || !listRecords.length} onClick={() => exportDataset(view === "waitlist" ? "waitlist-contacts" : `followups-${followupMode}`, exportRows)}>Export JSON</button></div>
                  {showContactRecords && <details open className="workspace-more-filters"><summary>Owner and date filters{ownerFilter !== "All owners" || dueFilter !== "Any follow-up date" ? " · active" : ""}</summary><div className="workspace-filters"><label><span>Owner</span><select aria-label="Outreach owner" value={ownerFilter} disabled={!outreachReady} onChange={(event) => { setOwnerFilter(event.target.value); setPage(1); }}>{["All owners", "Unassigned", ...owners].map((owner) => <option key={owner}>{owner}</option>)}</select></label><label><span>Follow-up date</span><select aria-label="Follow-up date" value={dueFilter} disabled={!outreachReady} onChange={(event) => { setDueFilter(event.target.value); setPage(1); }}>{["Any follow-up date", "Due or overdue", "Scheduled", "Not scheduled"].map((date) => <option key={date}>{date}</option>)}</select></label></div></details>}
                </div>
                {showContactRecords && <div className="clarity-list-controls"><label>Sort contacts<select aria-label="Sort contacts" value={view === "followups" ? "Next follow-up" : contactSort} disabled={view === "followups"} onChange={(event) => { setContactSort(event.target.value); setPage(1); }}>{["Newest signup", "Oldest signup", "Next follow-up", "Name"].map((value) => <option key={value}>{value}</option>)}</select></label><div className="workspace-segment" aria-label="Contact layout"><button type="button" aria-pressed={contactLayout === "list"} onClick={() => setContactLayout("list")}>Comfortable list</button><button type="button" aria-pressed={contactLayout === "table"} onClick={() => setContactLayout("table")}>Compact table</button></div></div>}
                <div className="workspace-list-summary"><span><strong>{listRecords.length}</strong> {hasFilters ? "matching" : "total"} {showContactRecords ? "contacts" : followupMode === "pending" ? "intake contacts" : "responses"}{view === "waitlist" && <span className="list-summary-extra"> · {emailCount} with an email address</span>}</span><span>Exports include every matching record</span></div>
                {view === "waitlist" && records.some((record) => !record.email) && <div className="workspace-legacy-note"><Info size={15} /><span>Some older signups have no saved email address. Their available details are still here; a hash cannot restore an address.</span></div>}
                <div className="workspace-contact-list" aria-busy={isLoading}>
                  {showContactRecords && contactLayout === "list" && visibleContacts.map((signup) => <article className="workspace-contact" key={signup.id} aria-label={signup.name || "Unnamed contact"}>
                    <div className="contact-identity"><span className="contact-avatar">{initials(signup.name)}</span><div><h2>{signup.name || "Unnamed contact"}</h2><p>{[signup.userType, signup.organization || signup.schoolName].filter(Boolean).join(" · ") || "Profile not provided"}</p><ContactLinks contact={signup} /></div></div>
                    <div className="contact-context"><span className="workspace-label">Their goal</span><p>{signup.biggestChallenge || signup.targetRole || signup.role || "No goal provided"}</p><small>{signup.preferredContactMethod ? `Prefers ${signup.preferredContactMethod}` : "Contact preference not provided"}</small></div>
                    <div className="contact-next-step"><span className={`workspace-status ${outreach[signup.id]?.status === "Closed" ? "closed" : ""}`}>{outreach[signup.id]?.status || (outreachReady ? "New" : "Status unavailable")}</span><small>Owner: {outreachReady ? outreach[signup.id]?.owner || "Unassigned" : "Unavailable"}</small><small>Joined {formatDate(signup.createdAt)}</small>{outreach[signup.id]?.nextFollowUpDate && <small>Next follow-up {outreach[signup.id].nextFollowUpDate}</small>}<button type="button" className="workspace-view-button" onClick={() => openContact(signup)}>View contact <ArrowUpRight size={15} /></button></div>
                  </article>)}
                  {showContactRecords && contactLayout === "table" && <ContactTable records={visibleContacts} outreach={outreach} outreachReady={outreachReady} onContact={openContact} />}
                  {view === "followups" && followupMode === "responses" && visibleFollowups.map((item, index) => <article className="workspace-contact" key={item.id || `${item.leadId}-${index}`} aria-label={item.email || item.leadId || "Follow-up response"}><div className="contact-identity"><span className="contact-avatar"><MessageSquare size={19} /></span><div><h2>{item.matchedContactName || item.email || item.leadId || item.candidateId || "Follow-up response"}</h2><p>{[item.employer, item.jobTitle || item.currentRole].filter(Boolean).join(" · ") || "Employer not provided"}</p><ContactLinks contact={item} /></div></div><div className="contact-context"><span className="workspace-label">Progress</span><p>{item.currentStatus || "Status not provided"} · {item.placementStatus || "Outcome not provided"}</p><small>{item.applicationCount ?? "Not provided"} applications · {item.interviewCount ?? "Not provided"} interviews · {item.offerCount ?? "Not provided"} offers</small><span className="clarity-evidence">{item.identityMatchStatus === "needs_review" ? "Identity needs review · excluded from contact totals" : item.verificationEvidenceStatus || "Respondent-supplied; not independently verified"}</span></div><div className="contact-next-step"><small>{formatDate(item.submittedAt || "")}</small><button type="button" className="workspace-view-button" onClick={() => setSelectedFollowUp(item)}>View response <ArrowUpRight size={15} /></button></div></article>)}
                  {view === "followups" && followupMode === "pending" && visiblePending.map((item, index) => <article className="workspace-contact" key={item.id || index} aria-label={item.name || "Intake contact"}><div className="contact-identity"><span className="contact-avatar">{initials(item.name || "")}</span><div><h2>{item.name || "Unnamed contact"}</h2><p>{item.organization || item.schoolName || item.userType || "Intake requested"}</p><ContactLinks contact={item} /></div></div><div className="contact-context"><span className="workspace-label">Intake requested</span><p>{item.targetRole || item.role || "No target role provided"}</p><small>{item.preferredContactMethod || "Contact preference not provided"}</small></div><div className="contact-next-step"><small>Joined {formatDate(item.createdAt || "")}</small><button type="button" className="workspace-view-button" onClick={() => openContact(records.find((record) => record.id === item.id) || item as AdminSummary["recentWaitlistSignups"][number])}>View contact <ArrowUpRight size={15} /></button></div></article>)}
                  {!listRecords.length && <div className="workspace-empty"><Search size={24} /><h2>{hasFilters ? "No matching records" : "Nothing here yet"}</h2><p>{hasFilters ? "Try a different search or clear your filters." : view === "waitlist" ? "New signups will appear here with their contact details and answers." : "Follow-up responses and intake requests will appear here."}</p>{hasFilters && <button type="button" className="workspace-quiet" onClick={() => { setQuery(""); setResponseFilter("All responses"); setStatusFilter("All statuses"); setEmailFilter("All contacts"); setOwnerFilter("All owners"); setDueFilter("Any follow-up date"); }}>Clear filters</button>}</div>}
                </div>
                <RecordPager page={currentPage} pages={pages} total={listRecords.length} onPage={setPage} />
              </section>
            </>}
            {view === "reports" && <WorkspaceReports summary={summary} onNavigate={navigate} outreach={outreach} outreachReady={outreachReady} outreachError={outreachError} />}
            {view === "overview" && <OperationsOverview summary={summary} onNavigate={navigate} onContact={openContact} onFollowUp={setSelectedFollowUp} outreach={outreach} outreachReady={outreachReady} />}
            {view === "institutional" && <>
              <InstitutionalProfile summary={summary} />
              <WorkspaceReports summary={summary} onNavigate={navigate} outreach={outreach} outreachReady={outreachReady} outreachError={outreachError} fixedReport="outcomes" />
            </>}
            {view === "applications" && <>
              <WorkspaceReports summary={summary} onNavigate={navigate} outreach={outreach} outreachReady={outreachReady} outreachError={outreachError} fixedReport="activity" />
              <OpportunityRecords records={summary.applicationRecords || []} />
              <EngagementReports summary={summary} />
              <SystemMetadata summary={summary} />
            </>}
          </>}
        </div>
        <footer className="workspace-footer"><span>SagittaIQ · Private admin workspace</span><a href="/waitlist" target="_blank" rel="noreferrer">Open signup page <ArrowUpRight size={13} /></a></footer>
      </div>
      {selectedWaitlist && <RecordDrawer title={selectedWaitlist.name || "Contact"} label="Contact details" onClose={() => setSelectedWaitlist(null)}>
        <div className="drawer-contact-summary"><ContactLinks contact={selectedWaitlist} /><span>Prefers {selectedWaitlist.preferredContactMethod || "a contact method not yet specified"}</span></div>
        <div className="workspace-segment" aria-label="Contact detail view"><button type="button" aria-pressed={contactDetailTab === "answers"} onClick={() => setContactDetailTab("answers")}>Signup answers</button><button type="button" aria-pressed={contactDetailTab === "plan"} onClick={() => setContactDetailTab("plan")}>Follow-up plan</button><button type="button" aria-pressed={contactDetailTab === "responses"} onClick={() => setContactDetailTab("responses")}>Survey responses ({selectedWaitlist.linkedFollowUps?.length || 0})</button></div>
        {contactDetailTab === "answers" && <GroupedRecordDetails record={selectedWaitlist} />}
        {contactDetailTab === "plan" && <OutreachEditor leadId={selectedWaitlist.id} adminCode={accessCode} ownerSuggestions={owners} onSaved={(current) => { setOutreach((value) => ({ ...value, [selectedWaitlist.id]: { ...current, leadId: selectedWaitlist.id } })); }} />}
        {contactDetailTab === "responses" && <section className="linked-survey-responses"><h3>Survey response history</h3>{selectedWaitlist.linkedFollowUps?.length ? selectedWaitlist.linkedFollowUps.map((response, index) => <details className="workspace-reference" key={response.id || index}><summary>{formatDateTime(response.submittedAt || "")} · {response.currentStatus || "Progress update"}</summary><GroupedRecordDetails record={response} followup /></details>) : <p>No progress surveys are linked to this contact yet.</p>}</section>}
      </RecordDrawer>}
      {selectedFollowUp && <RecordDrawer title={selectedFollowUp.matchedContactName || selectedFollowUp.email || selectedFollowUp.leadId || "Career progress update"} label="Follow-up details" onClose={() => setSelectedFollowUp(null)}><div className="drawer-contact-summary"><ContactLinks contact={selectedFollowUp} /></div><GroupedRecordDetails record={selectedFollowUp} followup /></RecordDrawer>}
    </main></ReportContext.Provider>
  );
}

type WorkspaceView = "waitlist" | "followups" | "reports" | "overview" | "institutional" | "applications";
type OutreachState = { leadId: string; status: string; owner?: string; nextFollowUpDate?: string; [key: string]: unknown };
type QueueFilter = "due" | "overdue" | "scheduled" | "unassigned" | "all";
const QUEUE_FILTERS: Array<{ id: QueueFilter; label: string }> = [{ id: "due", label: "Due today" }, { id: "overdue", label: "Overdue" }, { id: "scheduled", label: "Scheduled" }, { id: "unassigned", label: "Unassigned" }, { id: "all", label: "All open" }];
function inOutreachQueue(plan: OutreachState | undefined, filter: QueueFilter, today: string) {
  if (plan?.status === "Closed") return false;
  if (filter === "due") return plan?.nextFollowUpDate === today;
  if (filter === "overdue") return Boolean(plan?.nextFollowUpDate && plan.nextFollowUpDate < today);
  if (filter === "scheduled") return Boolean(plan?.nextFollowUpDate && plan.nextFollowUpDate > today);
  if (filter === "unassigned") return !plan?.owner;
  return true;
}
const PAGE_SIZE = 20;
const OUTREACH_STATUSES = ["New", "Contacted", "Awaiting reply", "Meeting scheduled", "Pilot discussion", "Closed"];
const WORKSPACE_VIEWS: Array<{ id: WorkspaceView; label: string; icon: ReactNode }> = [
  { id: "waitlist", label: "Waitlist", icon: <Users size={17} /> },
  { id: "followups", label: "Follow-ups", icon: <MessageSquare size={17} /> },
  { id: "overview", label: "Overview", icon: <Activity size={17} /> },
  { id: "institutional", label: "Institutional reporting", icon: <Building2 size={17} /> },
  { id: "applications", label: "Main application", icon: <BriefcaseBusiness size={17} /> },
  { id: "reports", label: "Reports", icon: <BarChart3 size={17} /> }
];
const WORKSPACE_HEADINGS: Record<WorkspaceView, { title: string; description: string }> = {
  waitlist: { title: "Waitlist contacts", description: "Everything you need for a thoughtful follow-up, in one place." },
  followups: { title: "Follow-ups", description: "Plan your next conversations, then review submitted progress and intake requests." },
  overview: { title: "Overview", description: "Platform health, advisor actions, recent activity, and the signals behind your next decision." },
  institutional: { title: "Institutional reporting", description: "Student and program profiles, reporting coverage, and respondent-supplied career outcomes." },
  applications: { title: "Main application", description: "Every saved analysis, workforce readiness, skill gaps, opportunities, and product engagement." },
  reports: { title: "Reports", description: "Clear summaries of signups, career progress, and application activity." }
};
function readWorkspaceView(): WorkspaceView {
  const requested = new URLSearchParams(window.location.search).get("view");
  if (requested === "all") return "overview";
  if (WORKSPACE_VIEWS.some((item) => item.id === requested)) return requested as WorkspaceView;
  return "waitlist";
}
function RecordPager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  if (!total) return null;
  return <div className="workspace-pagination"><span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span><div><button type="button" className="workspace-quiet" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" className="workspace-quiet" disabled={page === pages} onClick={() => onPage(page + 1)}>Next</button></div></div>;
}
function ContactTable({ records, outreach, outreachReady, onContact }: { records: AdminSummary["recentWaitlistSignups"]; outreach: Record<string, OutreachState>; outreachReady: boolean; onContact: (record: AdminSummary["recentWaitlistSignups"][number]) => void }) {
  return <div className="clarity-contact-table restored-table-scroll" tabIndex={0} role="region" aria-label="Contact table"><table><caption>Contacts and next steps. Open a contact for every answer and its history.</caption><thead><tr>{["Contact", "Audience / organization", "Goal", "Outreach status", "Owner", "Next follow-up", "Details"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{records.map((record) => <tr key={record.id}><th scope="row"><strong>{record.name || "Unnamed contact"}</strong><ContactLinks contact={record} /></th><td>{record.userType || "Not provided"}<small>{record.organization || record.schoolName || "Organization not provided"}</small></td><td>{record.biggestChallenge || record.targetRole || record.role || "Not provided"}</td><td>{outreachReady ? outreach[record.id]?.status || "New" : "Unavailable"}</td><td>{outreachReady ? outreach[record.id]?.owner || "Unassigned" : "Unavailable"}</td><td>{outreachReady ? outreach[record.id]?.nextFollowUpDate || "Not scheduled" : "Unavailable"}</td><td><button type="button" className="workspace-view-button" aria-label={`View contact ${record.name || "Unnamed contact"}`} onClick={() => onContact(record)}>View contact <ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div>;
}

function DataQualitySummary({ summary, onNavigate }: { summary: AdminSummary; onNavigate: (view: WorkspaceView) => void }) {
  const quality = summary.meta.dataQuality;
  const missingEmail = quality?.missingSignupEmail ?? summary.recentWaitlistSignups.filter((record) => !record.email).length;
  const withEmail = Math.max(0, summary.recentWaitlistSignups.length - missingEmail);
  return <section className="clarity-quality" aria-labelledby="data-quality-title"><div><p className="workspace-eyebrow">Know what supports each number</p><h2 id="data-quality-title">Data quality and coverage</h2><p>Current report cohort · all saved dates · loaded {formatDateTime(summary.meta.lastLoadedAt)}. Availability does not establish permission to contact someone.</p></div><div className="workspace-report-metrics">
    <Metric label="Readable email coverage" value={`${withEmail} / ${summary.recentWaitlistSignups.length}`} note={`${missingEmail} signup records have no saved email address.`} onOpen={() => onNavigate("waitlist")} />
    <Metric label="Identity review needed" value={quality?.ambiguousFollowUpResponses ?? "Not assessed"} note="Conflicting response identifiers are preserved and excluded from linked-contact outcomes." onOpen={() => onNavigate("followups")} />
    <Metric label="Original signup snapshots missing" value={quality?.missingSignupSnapshots ?? "Not assessed"} note="Available historical columns remain visible; missing originals cannot be reconstructed." onOpen={() => onNavigate("waitlist")} />
    <Metric label="Verification claims to review" value={quality?.publicVerificationClaims ?? "Not assessed"} note="Respondent-selected labels do not establish an advisor or employer attestation." onOpen={() => onNavigate("followups")} />
  </div><details className="workspace-report-sources"><summary>Sources, scope and counting method</summary><p>{summary.meta.reportingMethod || "Outcome totals use the latest identifiable response; full response history stays available."}</p><dl>{Object.entries(summary.meta.sources || {}).map(([name, source]) => <div key={name}><dt>{humanize(name)}</dt><dd>{source.status} · {source.count} source records</dd></div>)}</dl><p>Source counts describe the loaded sources; report values describe the stated cohort. Missing values remain distinct from zero and from a negative answer.</p></details></section>;
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
  const internalKeys = new Set(["id", "leadId", "candidateId", "contactId", "organizationId", "emailDomain", "emailDomainType", "source", "linkedFollowUpIds", "matchedSignupIds"]);
  const contactKeys = new Set(["name", "matchedContactName", "email", "emailStatus", "phone", "linkedinUrl", "preferredContactMethod", "city", "state", "zipPostal", "country", "county", "metroArea", "workforceRegion"]);
  const goalKeys = new Set(["biggestChallenge", "currentTools", "desiredFeatures", "interviewInterest", "betaInterest", "pilotInterest", "budgetInterest", "reportingWish", "recommendedAction", "targetRole", "targetIndustry", "timeline", "buyingAuthority", "leadScore", "leadPriority", "scoreBreakdown"]);
  const profileKeys = new Set(["userType", "organization", "organizationType", "role", "schoolName", "programName", "majorField", "gpa", "certifications", "degreeLevel", "classYear", "studentStatus", "seekingStatus", "domesticInternational", "experienceLevel", "populationServed", "currentProcess"]);
  const { branchProfile, intakeDetails, responseDetails, retainedFields, linkedFollowUps: _linkedFollowUps, ...answers } = record;
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
  return <div className="grouped-record-details">{followup && <p className="clarity-evidence">{record.identityMatchStatus === "needs_review" ? "Identity review required. Conflicting references are preserved; this response is excluded from linked-contact outcomes." : "Outcome details are respondent-supplied. A reported verification label is not independent evidence."}</p>}{retainedFields && typeof retainedFields === "object" ? <details className="workspace-reference"><summary>Additional retained database fields</summary><p className="report-source-note">Preserved storage values. Their historical purpose has not been established; they are not used as verified reporting facts.</p><dl className="workspace-fields">{Object.entries(flattenRecord(retainedFields as Record<string, unknown>)).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details> : null}{groups.map(([title, values], index) => {
    if (!Object.keys(values).length) return null;
    const fields = <dl className="workspace-fields">{Object.entries(flattenRecord(values)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl>;
    return index === 4 ? <details key={title} className="workspace-reference"><summary>{title}</summary>{fields}</details> : <section key={title} aria-label={title}><h3>{title}</h3>{fields}</section>;
  })}{Object.values(snapshots).some((value) => value && typeof value === "object") && <details className="workspace-reference"><summary>Original saved answers</summary><p className="report-source-note">Complete saved submissions, including repeated fields, for reference.</p><dl className="workspace-fields">{Object.entries(flattenRecord(Object.fromEntries(Object.entries(snapshots).filter(([, value]) => value && typeof value === "object")))).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>}</div>;
}

function WorkspaceReports({ summary, onNavigate, outreach, outreachReady, outreachError, fixedReport }: { summary: AdminSummary; onNavigate: (view: WorkspaceView) => void; outreach: Record<string, OutreachState>; outreachReady: boolean; outreachError: string; fixedReport?: "outcomes" | "activity" }) {
  const [selectedReport, setReport] = useState<"waitlist" | "outcomes" | "activity">("waitlist");
  const report = fixedReport || selectedReport;
  const { stale } = useContext(ReportContext);
  const [reportError, setReportError] = useState("");
  const sections: Array<{ id: typeof report; label: string }> = [{ id: "waitlist", label: "Waitlist insights" }, { id: "outcomes", label: "Career outcomes" }, { id: "activity", label: "Application activity" }];
  const exportSummary = { ...summary, recentWaitlistSignups: summary.recentWaitlistSignups.map((item) => ({ ...item, outreach: outreach[item.id] || (outreachReady ? { status: "New" } : { dataStatus: "Unavailable" }), outreachDataStatus: outreachError ? "Previously loaded; refresh failed" : outreachReady ? "Current" : "Unavailable" })) };
  return <div className="workspace-reports">
    <div className="workspace-report-tools">
      {fixedReport ? <h2 className="restored-section-heading">{fixedReport === "outcomes" ? "Career outcomes" : "Candidate readiness and opportunity activity"}</h2> : <div className="workspace-segment" aria-label="Report category">{sections.map((item) => <button type="button" key={item.id} aria-pressed={report === item.id} onClick={() => setReport(item.id)}>{item.label}</button>)}</div>}
      <button type="button" className="workspace-quiet" disabled={stale || Boolean(outreachError)} onClick={() => { try { exportResearchBundle(exportSummary); } catch { setReportError("The report download could not be created. Please try again."); } }}><Download size={15} />Export report data</button>
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
        <Metric label="Average lead score" value={summary.totals.waitlistSignups ? summary.totals.averageLeadScore ?? 0 : "Not available"} note="Rules-based prioritization across signup records, out of 100" />
        <Metric label="Budget/procurement interest" value={summary.totals.budgetQualified} note="Self-reported interest, not validated budget qualification" />
      </div>
      <div className="workspace-report-link"><p>Ready to turn these signals into conversations?</p><button type="button" onClick={() => onNavigate("waitlist")}>Open waitlist contacts <ArrowRight size={16} /></button></div>
      <div className="workspace-report-grid">
        <ChartPanel title="Who is joining" items={summary.waitlistUserTypes || []} /><ChartPanel title="Referral sources" items={summary.waitlistReferralSources || []} />
        <ChartPanel title="Requested interests" items={toCountItems(summary.waitlistInterest || {})} /><ChartPanel title="Target industries" items={summary.waitlistTargetIndustries || []} />
        <ChartPanel title="Organizations" items={summary.waitlistOrganizationTypes || []} /><ChartPanel title="Workforce regions" items={summary.waitlistWorkforceRegions || []} />
        <ChartPanel title="Schools" items={summary.waitlistSchools || []} /><ChartPanel title="Programs" items={summary.waitlistPrograms || []} />
        <ChartPanel title="Fields of study" items={summary.waitlistMajors || []} /><ChartPanel title="Current processes" items={summary.waitlistCurrentProcesses || []} />
        <ChartPanel title="Lead priority" items={toCountItems(summary.waitlistLeadPriorities || {})} /><ChartPanel title="Profile status" items={summary.waitlistBranchStatuses || []} />
        <ChartPanel title="Lead score bands" items={toCountItems(summary.waitlistLeadScoreBands || {})} showZeroRows /><ChartPanel title="Signup sources" items={summary.waitlistSources || []} />
        <FunnelReport title="Waitlist pipeline" items={summary.waitlistFunnel || []} note="Each count is a signup attribute; rates use all signup records. Categories can overlap and are not sequential conversion steps." />
        <FunnelReport title="Follow-up outcome funnel" items={summary.followUpFunnel || []} note="Latest response per identifiable respondent. Rates use all respondents; applications, interviews, offers, and placements can overlap." />
        <ConversionReport items={summary.conversionMetrics || []} />
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
        <Metric label="Pending intake interviews" value={summary.totals.pendingIntakeFollowUps || 0} note="Intake volunteers without a linked survey response" />
        <Metric label="Completed follow-ups" value={summary.totals.completedFollowUps || 0} note="Saved response history, including repeated updates" />
        <Metric label="Salary responses" value={summary.totals.salaryResponses || 0} note="Latest identifiable respondent records with a supplied amount, including zero" />
      </div>
      <div className="workspace-report-link"><p>Read the full responses and support requests behind these numbers.</p><button type="button" onClick={() => onNavigate("followups")}>Open follow-ups <ArrowRight size={16} /></button></div>
      <div className="workspace-report-grid">
        <ChartPanel title="Career outcomes" items={toCountItems(summary.followUpOutcomes || {})} /><ChartPanel title="Current search status" items={toCountItems(summary.followUpStatuses || {})} />
        <ChartPanel title="Employers" items={summary.followUpEmployers || []} /><ChartPanel title="Job titles" items={summary.followUpJobTitles || []} />
        <ChartPanel title="Industries" items={summary.followUpIndustries || []} /><ChartPanel title="Salary ranges" items={summary.followUpSalaryRanges || []} />
        <ChartPanel title="Reported verification status" items={summary.followUpVerificationStatuses || []} />
        <FunnelReport title="Follow-up outcome funnel" items={summary.followUpFunnel || []} note="Latest response per identifiable respondent. Rates use all respondents; these are overlapping outcome groups." />
        <ConversionReport items={summary.conversionMetrics || []} />
        {summary.salaryByPeriod?.map((item) => <section className="workspace-salary-report" key={`${item.period}-${item.currency || "unknown"}`}><h2>{item.period || "Unspecified period"} compensation · {item.currency || "Currency not recorded"}</h2><dl><div><dt>Responses</dt><dd>{item.count}</dd></div><div><dt>Median amount</dt><dd>{item.median?.toLocaleString() ?? "Not comparable"}</dd></div><div><dt>Average amount</dt><dd>{item.average?.toLocaleString() ?? "Not comparable"}</dd></div></dl><p>Grouped by currency and pay period. Missing currency or period prevents averaging; no currency conversion or annualization is applied.</p></section>)}
      </div>
    </>}
    {report === "activity" && <>
      <div className="workspace-report-metrics">
        <Metric label="Resume analyses" value={summary.totals.resumeRecords} note="Saved analysis records" /><Metric label="Applications captured" value={summary.totals.applicationCaptures} note="Saved opportunity records" />
        <Metric label="Tracked users" value={summary.totals.uniqueUsers} note="Distinct users in saved activity" /><Metric label="Average readiness" value={summary.totals.resumeRecords ? `${summary.totals.averageReadinessScore}%` : "Not available"} note="Across saved resume analyses" />
        <Metric label="Strong-match threshold" value={`${summary.meta.readinessThreshold}%`} note="Configured readiness reference, not a hiring guarantee" /><Metric label="Readiness distance" value={summary.totals.resumeRecords ? `${summary.totals.readinessDelta > 0 ? "+" : ""}${summary.totals.readinessDelta} pts` : "Not available"} note="Average readiness minus the strong-match threshold" />
      </div>
      <AnalysisRecords records={summary.recentResumeRecords} />
      <div className="workspace-report-grid">
        <ChartPanel title="Readiness bands" items={toCountItems(summary.readinessBands || {})} /><ChartPanel title="Application status" items={toCountItems(summary.applicationStatuses || {})} />
        <ChartPanel title="Application sources" items={summary.applicationSources || []} /><ChartPanel title="Opportunity employers" items={summary.applicationEmployers || []} />
        <ChartPanel title="Top skills" items={summary.topSkills || []} sortable /><ChartPanel title="Top tools" items={summary.topTools || []} sortable />
        <ChartPanel title="Career levels" items={toCountItems(summary.careerLevels || {})} showZeroRows /><ChartPanel title="Target roles" items={summary.targetRoles || []} />
        <ChartPanel title="Opportunity job titles" items={summary.applicationTitles || []} /><ChartPanel title="Resume cohort countries" items={summary.countries || []} />
        <ChartPanel title="Resume cohort email domains" items={summary.emailDomains || []} /><ChartPanel title="Resume cohort email domain types" items={toCountItems(summary.emailDomainTypes || {})} />
        {Object.entries(summary.commonSkillGaps || {}).map(([group, items]) => <ChartPanel key={group} title={`Skill gaps: ${humanize(group)}`} items={items} sortable />)}
      </div>
      <p className="report-source-note">Skills, readiness, countries, and email domains describe saved resume analyses. Skill-gap percentages use {summary.totals.resumeRecords} saved analyses as their denominator. Category exports include all returned values. Use each chart’s complete data table to inspect every category; individual saved reports remain available above.</p>
    </>}
  </div>;
}
function OperationsOverview({ summary, onNavigate, onContact, onFollowUp, outreach, outreachReady }: {
  summary: AdminSummary;
  onNavigate: (view: WorkspaceView) => void;
  onContact: (record: AdminSummary["recentWaitlistSignups"][number]) => void;
  onFollowUp: (record: FollowUpRecord) => void;
  outreach: Record<string, OutreachState>;
  outreachReady: boolean;
}) {
  const [analysis, setAnalysis] = useState<AdminSummary["recentResumeRecords"][number] | null>(null);
  const leading = (items: CountItem[] = []) => [...items].sort((left, right) => right.count - left.count)[0];
  const gap = leading(Object.values(summary.commonSkillGaps || {}).flat());
  const industry = leading(summary.waitlistTargetIndustries);
  const process = leading(summary.waitlistCurrentProcesses);
  const region = leading(summary.waitlistWorkforceRegions);
  const priority = leading(toCountItems(summary.waitlistLeadPriorities || {}));
  const missingFollowUps = Math.max(0, (summary.totals.uniqueWaitlistContacts || 0) - (summary.totals.waitlistContactsWithFollowUp || 0));
  const lead = [...summary.recentWaitlistSignups]
    .filter((record) => (record.leadScore || 0) >= 75 || record.pilotInterest || record.budgetInterest)
    .filter((record) => !outreachReady || outreach[record.id]?.status !== "Closed")
    .sort((left, right) => (right.leadScore || 0) - (left.leadScore || 0))[0];
  const candidate = [...summary.recentResumeRecords].filter((record) => record.score < summary.meta.readinessThreshold).sort((left, right) => left.score - right.score)[0];
  const queue: Array<{ title: string; detail: string; action: string; open: () => void }> = [];
  if (lead) queue.push({ title: `Review ${lead.name || "priority contact"}`, detail: `${lead.leadScore ?? 0}/100 lead score · ${lead.recommendedAction || "Confirm their goals and pilot or procurement interest."}`, action: "View contact", open: () => onContact(lead) });
  if (candidate) queue.push({ title: "Review readiness support", detail: `${candidate.candidateId}: ${candidate.score}% for ${candidate.targetRole || "their target role"}. Review the saved gaps and feedback.`, action: "View analysis", open: () => setAnalysis(candidate) });
  if ((summary.totals.pendingIntakeFollowUps || 0) > 0) queue.push({ title: `${summary.totals.pendingIntakeFollowUps} pending intake interviews`, detail: "These contacts volunteered for an introduction and have no linked response yet.", action: "Open follow-ups", open: () => onNavigate("followups") });
  if (missingFollowUps) queue.push({ title: `${missingFollowUps} contacts without outcome updates`, detail: "Distinct waitlist identities without a matched response. Review their contact details and follow-up plan.", action: "Review contacts", open: () => onNavigate("waitlist") });
  if (process) queue.push({ title: `Explore ${process.label}`, detail: `${process.count} signup records report this current process. Review their goals and reporting requests.`, action: "Open pipeline report", open: () => onNavigate("reports") });
  const activity = [
    ...summary.recentResumeRecords.map((record) => ({ title: `${record.currentTitle || record.candidateId || "Candidate"} saved an analysis`, detail: `${record.score}% readiness · ${record.targetRole || "Target role not provided"}`, date: record.capturedAt, action: "View analysis", open: () => setAnalysis(record) })),
    ...summary.recentWaitlistSignups.map((record) => ({ title: `${record.name || "Contact"} joined the waitlist`, detail: [record.userType, record.organization, record.targetIndustry].filter(Boolean).join(" · "), date: record.createdAt, action: "View contact", open: () => onContact(record) })),
    ...(summary.recentFollowUps || []).map((record) => ({ title: `${record.matchedContactName || record.email || "Contact"} submitted a follow-up`, detail: [record.currentStatus, record.placementStatus, record.employer].filter(Boolean).join(" · "), date: record.submittedAt || "", action: "View response", open: () => onFollowUp(record) }))
  ].sort((left, right) => (Date.parse(right.date) || 0) - (Date.parse(left.date) || 0)).slice(0, 8);
  return <div className="restored-reports">
    <DataQualitySummary summary={summary} onNavigate={onNavigate} />
    <section aria-labelledby="platform-health-title"><h2 id="platform-health-title" className="restored-section-heading">Platform health</h2><div className="workspace-report-metrics">
      <Metric label="Tracked users" value={summary.totals.uniqueUsers} note="Distinct users in saved activity" />
      <Metric label="Career records" value={summary.totals.resumeRecords} note="Saved resume analyses" onOpen={() => onNavigate("applications")} />
      <Metric label="Opportunities tracked" value={summary.totals.applicationCaptures} note="Saved applications and opportunities" onOpen={() => onNavigate("applications")} />
      <Metric label="Discovery pipeline" value={summary.totals.waitlistSignups} note="Signup records, including repeat signups" onOpen={() => onNavigate("waitlist")} />
      <Metric label="Average readiness" value={summary.totals.resumeRecords ? `${summary.totals.averageReadinessScore}%` : "Not available"} note={`Strong-match reference: ${summary.meta.readinessThreshold}%`} />
      <Metric label="Readiness distance" value={summary.totals.resumeRecords ? `${summary.totals.readinessDelta > 0 ? "+" : ""}${summary.totals.readinessDelta} pts` : "Not available"} note="Average readiness minus the configured threshold" />
      <Metric label="Offers / placements" value={`${summary.totals.followUpOffers || 0} / ${summary.totals.followUpPlacements || 0}`} note="Reported offer count / distinct placed respondents; latest response each" />
      <Metric label="Follow-up coverage" value={`${summary.totals.waitlistContactsWithFollowUp || 0} / ${summary.totals.uniqueWaitlistContacts || 0}`} note="Distinct waitlist contacts with matched responses / all waitlist contacts" onOpen={() => onNavigate("followups")} />
    </div></section>
    <div className="workspace-report-grid">
      <section className="restored-panel"><h2>Advisor action queue</h2><p className="report-source-note">Suggestions from the saved data. Review context before taking action.</p><div className="restored-action-list">{queue.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p><button type="button" className="workspace-view-button" onClick={item.open}>{item.action} <ArrowRight size={14} /></button></article>)}{!queue.length && <p>No priority suggestions in the current data.</p>}</div></section>
      <section className="restored-panel"><h2>Recent user activity</h2><p className="report-source-note">Latest eight saved analyses, signups, and progress updates. Full histories remain in their sections.</p><div className="restored-action-list">{activity.map((item, index) => <article key={`${item.title}-${index}`}><h3>{item.title}</h3><p>{item.detail || "Saved record"}</p><time dateTime={item.date || undefined}>{formatDateTime(item.date)}</time><button type="button" className="workspace-view-button" onClick={item.open}>{item.action} <ArrowUpRight size={14} /></button></article>)}{!activity.length && <p>No saved activity yet.</p>}</div></section>
      <section className="restored-panel"><h2>Reporting shortcuts</h2><div className="restored-shortcuts">
        <button type="button" onClick={() => onNavigate("applications")}><strong>Readiness report</strong><span>{summary.totals.resumeRecords} analyses · {summary.totals.resumeRecords ? `${summary.totals.averageReadinessScore}% average readiness` : "Readiness not available"}</span><ArrowRight size={16} /></button>
        <button type="button" onClick={() => onNavigate("reports")}><strong>Pipeline report</strong><span>{summary.totals.waitlistSignups} signups · {summary.totals.interviewVolunteers} discovery volunteers</span><ArrowRight size={16} /></button>
        <button type="button" onClick={() => onNavigate("institutional")}><strong>Outcome report</strong><span>{summary.totals.followUpRespondents || 0} respondents · {summary.totals.followUpPlacements || 0} reported placements</span><ArrowRight size={16} /></button>
        <button type="button" onClick={() => onNavigate("institutional")}><strong>Market report</strong><span>Programs, employers, job titles, and regional demand</span><ArrowRight size={16} /></button>
      </div></section>
      <section className="restored-panel"><h2>User signals</h2><dl className="restored-signal-list">
        <div><dt>Leading lead priority</dt><dd>{priority ? `${priority.label} · ${priority.count} signup records` : "Not available"}</dd></div>
        <div><dt>Top readiness gap</dt><dd>{gap ? `${gap.label} · ${gap.count} analysis records` : "Not available"}</dd></div>
        <div><dt>Demand segment</dt><dd>{industry ? `${industry.label} · ${industry.count} signup records` : "Not available"}</dd></div>
        <div><dt>Current process</dt><dd>{process ? `${process.label} · ${process.count} signup records` : "Not available"}</dd></div>
        <div><dt>Regional signal</dt><dd>{region ? `${region.label} · ${region.count} signup records` : "Not available"}</dd></div>
        <div><dt>Outcome activity</dt><dd>{summary.totals.followUpInterviews || 0} interviews and {summary.totals.followUpOffers || 0} offers reported across {summary.totals.followUpRespondents || 0} identifiable respondents, using their latest updates.</dd></div>
      </dl></section>
    </div>
    <section className="restored-panel"><h2>Decision signals</h2><p className="report-source-note">Rules-based suggestions from current records. Outcome and verification labels are respondent-supplied.</p><div className="restored-decision-grid">{(summary.decisionSignals || []).map((item) => <article key={item.label} data-severity={item.severity}><h3>{item.label}</h3><strong>{item.dataStatus === "no-data" ? "Not available" : `${item.value} ${item.unit}`}</strong><p>{item.detail}</p><p>{item.action}</p><button type="button" className="workspace-view-button" onClick={() => onNavigate(/readiness|skill|resume/i.test(item.label) ? "applications" : /outcome|salary|follow|placement/i.test(item.label) ? "institutional" : "reports")}>Review supporting report <ArrowRight size={14} /></button></article>)}</div>{!summary.decisionSignals?.length && <p>No decision signals available yet.</p>}</section>
    <EngagementReports summary={summary} />
    <SystemMetadata summary={summary} />
    {analysis && <RecordDrawer title={analysis.targetRole || analysis.currentTitle || "Resume analysis"} label="Analysis details" onClose={() => setAnalysis(null)}><dl className="workspace-fields">{Object.entries(flattenRecord(analysis)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl></RecordDrawer>}
  </div>;
}

function InstitutionalProfile({ summary }: { summary: AdminSummary }) {
  return <section className="restored-reports" aria-labelledby="student-program-profile-title">
    <div><h2 className="restored-section-heading" id="student-program-profile-title">Student and program profile</h2><p className="report-source-note">Submitted signup details. Missing values stay separate from zero GPA or a negative answer; these are not verified academic records.</p></div>
    <div className="workspace-report-grid">
      <ChartPanel title="Schools" items={summary.waitlistSchools || []} /><ChartPanel title="Programs" items={summary.waitlistPrograms || []} />
      <ChartPanel title="Majors / fields" items={summary.waitlistMajors || []} /><ChartPanel title="GPA bands" items={toCountItems(summary.waitlistGpaBands || {})} showZeroRows />
      <ChartPanel title="Certifications" items={summary.waitlistCertifications || []} /><ChartPanel title="Degree levels" items={summary.waitlistDegreeLevels || []} />
      <ChartPanel title="Class years" items={summary.waitlistClassYears || []} /><ChartPanel title="Domestic / international" items={summary.waitlistDomesticInternational || []} />
      <ChartPanel title="Student statuses" items={summary.waitlistStudentStatuses || []} /><ChartPanel title="Seeking statuses" items={summary.waitlistSeekingStatuses || []} />
      <ChartPanel title="Target industries" items={summary.waitlistTargetIndustries || []} /><ChartPanel title="Workforce regions" items={summary.waitlistWorkforceRegions || []} />
      <ChartPanel title="Captured opportunity employers" items={summary.applicationEmployers || []} /><ChartPanel title="Captured opportunity job titles" items={summary.applicationTitles || []} />
      <ChartPanel title="Resume cohort countries" items={summary.countries || []} /><ChartPanel title="Resume cohort email domain types" items={toCountItems(summary.emailDomainTypes || {})} />
    </div>
    <p className="report-source-note">Opportunity counts describe saved applications. Countries and email domains describe the resume-analysis cohort. Career outcomes below describe identifiable follow-up respondents; these cohorts are not combined.</p>
  </section>;
}

function EngagementReports({ summary }: { summary: AdminSummary }) {
  const { stale } = useContext(ReportContext);
  const days = summary.usageByDay || [];
  const max = Math.max(1, ...days.flatMap((day) => [day.resumes, day.applications]));
  return <section className="restored-reports" aria-labelledby="session-engagement-title">
    <h2 id="session-engagement-title" className="restored-section-heading">Session engagement</h2><div className="workspace-report-metrics">
      <Metric label="Sessions" value={summary.totals.sessions || 0} note="Tracked user visits" />
      <Metric label="Average session duration" value={(summary.totals.measuredSessions ?? summary.meta.sessionMeasurement?.measuredSessions ?? 0) > 0 ? formatDuration(summary.totals.averageSessionSeconds || 0) : "Not available"} note={`Positive recorded duration only: ${summary.totals.measuredSessions ?? summary.meta.sessionMeasurement?.measuredSessions ?? 0} measured sessions; ${summary.totals.unmeasuredSessions ?? summary.meta.sessionMeasurement?.unmeasuredSessions ?? 0} without positive duration.`} />
      <Metric label="Engaged minutes" value={summary.totals.totalSessionMinutes || 0} note="Total tracked session time" />
      <Metric label="Event types" value={Object.keys(summary.userEventTypes || {}).length} note="Distinct behavior signals captured" />
    </div>
    <section className="restored-panel"><div className="panel-heading"><h2>Usage trends</h2><div className="restored-chart-controls"><button type="button" className="workspace-quiet" disabled={stale || !days.length} onClick={() => exportCsv("usage-trends", days)}><Download size={14} />Export usage data</button><ChartImageButton title="Usage trends" items={days.flatMap((day) => [{ label: `${day.date} · Analyses`, count: day.resumes }, { label: `${day.date} · Applications`, count: day.applications }, { label: `${day.date} · Unique users`, count: day.uniqueUsers }])} /></div></div><p className="report-source-note">{days.length ? `${days.length} reported daily buckets · ${days[0].date} to ${days[days.length - 1].date}.` : "No daily usage available."} Counts represent saved analyses, application captures, and distinct saved identities with either activity on each date.</p>
      {days.length > 0 && <><div className="restored-usage-chart" aria-hidden="true">{days.map((day) => <div key={day.date} title={`${day.date}: ${day.resumes} analyses, ${day.applications} applications`}><div><i style={{ height: `${day.resumes / max * 100}%` }} /><b style={{ height: `${day.applications / max * 100}%` }} /></div><span>{day.date.slice(5)}</span></div>)}</div><p className="restored-chart-legend"><span>Analyses</span><span>Applications</span></p><div className="restored-table-scroll" tabIndex={0} role="region" aria-label="Daily usage data"><table><caption>Daily usage counts</caption><thead><tr><th scope="col">Date</th><th scope="col">Analyses</th><th scope="col">Applications</th><th scope="col">Unique users</th></tr></thead><tbody>{days.map((day) => <tr key={day.date}><th scope="row">{day.date}</th><td>{day.resumes}</td><td>{day.applications}</td><td>{day.uniqueUsers}</td></tr>)}</tbody></table></div></>}
    </section>
    <div className="workspace-report-grid"><ChartPanel title="Session sources" items={summary.sessionSources || []} /><ChartPanel title="Session pages" items={summary.sessionPages || []} /><ChartPanel title="Session campaigns" items={summary.sessionCampaigns || []} /><ChartPanel title="User event types" items={toCountItems(summary.userEventTypes || {})} /></div>
  </section>;
}

function SystemMetadata({ summary }: { summary: AdminSummary }) {
  const metadata = {
    scope: summary.meta.recordScope || "All matching records",
    searchQuery: summary.meta.query || "No search filter",
    refreshedAt: formatDateTime(summary.meta.lastLoadedAt),
    reportingMethod: summary.meta.reportingMethod,
    readinessThreshold: summary.meta.readinessThreshold,
    waitlistRecordsReturned: summary.meta.waitlistRecordsReturned ?? summary.recentWaitlistSignups.length,
    followupRecordsReturned: summary.meta.followupRecordsReturned ?? summary.recentFollowUps?.length ?? 0,
    dataSources: summary.meta.sources || {},
    dataQuality: summary.meta.dataQuality || {},
    categoryScope: summary.meta.categoryScope || "Source-defined categories",
    sessionMeasurement: summary.meta.sessionMeasurement || {},
    allRecordsAcrossSearch: summary.globalTotals || {},
    build: import.meta.env.VITE_APP_BUILD || "local-preview"
  };
  return <section className="restored-panel"><h2>System metadata</h2><p className="report-source-note">Source status and retention details for the loaded data. The retained count describes stored raw resumes; it does not specify a retention duration.</p><div className="workspace-report-metrics">
    <Metric label="Raw resumes retained" value={summary.systemInfo.rawResumeRecords} note={`${summary.totals.rawResumeRecords} retained records in the current matching cohort`} /><Metric label="Raw resume retention rate" value={summary.totals.resumeRecords ? `${summary.systemInfo.rawResumeRetentionRate}%` : "Not available"} note={summary.totals.resumeRecords ? `Retained raw resumes / ${summary.totals.resumeRecords} saved analyses` : "No saved analyses in the current matching cohort."} />
  </div><dl className="workspace-fields restored-metadata">{Object.entries(flattenRecord(metadata)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl></section>;
}

function FunnelReport({ title, items, note }: { title: string; items: FunnelItem[]; note: string }) {
  const { stale } = useContext(ReportContext);
  const denominator = items[0]?.denominator ?? items[0]?.count ?? 0;
  const hasBase = denominator > 0;
  const rateLabel = (item: FunnelItem) => hasBase ? `${item.rate}% of base` : "Not available";
  const exportRows = items.map(item => ({ ...item, rate: hasBase ? item.rate : null, denominator, dataStatus: hasBase ? "available" : "no-data" }));
  return <section className="restored-panel"><div className="panel-heading"><h2>{title}</h2><div className="restored-chart-controls"><button type="button" className="workspace-quiet" disabled={stale || !items.length} onClick={() => exportCsv(title.toLowerCase().replaceAll(" ", "-"), exportRows)}><Download size={14} />Export data</button><ChartImageButton title={title} items={items.map((item) => ({ ...item, label: `${item.label} (${rateLabel(item)})` }))} /></div></div><p className="report-source-note">{note}</p>{!hasBase && <p className="report-source-note">Not available: no records in the base population.</p>}<dl className="restored-funnel">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd><strong>{item.count}</strong><span>{rateLabel(item)}</span></dd><span aria-hidden="true"><i style={{ width: `${hasBase ? Math.max(0, Math.min(100, item.rate)) : 0}%` }} /></span></div>)}</dl>{!items.length && <p>No funnel data available.</p>}</section>;
}

function ConversionReport({ items }: { items: ConversionMetric[] }) {
  return <section className="restored-panel"><div className="panel-heading"><h2>Conversion metrics</h2><ChartImageButton title="Conversion metrics (percent)" items={items.filter(item => item.dataStatus !== "no-data").map((item) => ({ label: `${item.label}: ${item.detail}`, count: item.value }))} /></div><p className="report-source-note">Interest percentages use signup records. Coverage uses distinct waitlist contacts; outcome percentages use identifiable respondents and their latest response. No-data rates remain unavailable.</p><dl className="restored-conversions">{items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd><strong>{item.dataStatus === "no-data" ? "Not available" : `${item.value}%`}</strong><span>{item.detail}</span></dd></div>)}</dl>{!items.length && <p>No conversion data available.</p>}</section>;
}

function humanize(value: string) { return value.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDuration(seconds: number) { return seconds < 60 ? `${Math.round(seconds)} sec` : `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} sec`; }

function OpportunityRecords({ records }: { records: NonNullable<AdminSummary["applicationRecords"]> }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<typeof records[number] | null>(null);
  const [page, setPage] = useState(1);
  const { stale } = useContext(ReportContext);
  const matching = records.filter(record => [record.title,record.company,record.status,record.source,record.candidateId].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page,pages);
  return <section className="workspace-records analysis-records" aria-labelledby="saved-opportunities-title"><div className="workspace-analysis-heading"><div><h2 id="saved-opportunities-title">Saved opportunities</h2><p>Original captured applications and retained details behind the reports.</p></div><div className="workspace-export"><button type="button" className="workspace-quiet" disabled={stale || !matching.length} onClick={() => exportDataset("saved-opportunities",matching)}>Export opportunities JSON</button><button type="button" className="workspace-quiet" disabled={stale || !matching.length} onClick={() => exportCsv("saved-opportunities",matching)}>Export opportunities CSV</button></div></div><div className="workspace-record-tools"><label className="workspace-search"><Search size={17} /><input aria-label="Search opportunities" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Title, employer, status or candidate" /></label><span className="report-source-note">{matching.length} matching opportunities · {records.length} total</span></div>{matching.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE).map(record => <article className="workspace-contact" key={record.id}><div className="contact-identity"><span className="contact-avatar"><BriefcaseBusiness size={18} /></span><div><h3>{record.title || "Title not provided"}</h3><p>{record.company || "Employer not provided"}</p><small>Captured {formatDateTime(record.capturedAt || "")}</small></div></div><div className="contact-context"><span className="workspace-label">Status and source</span><p>{record.status || "Not provided"}</p><small>{record.source || "Source not provided"}</small></div><div className="contact-next-step"><button type="button" className="workspace-view-button" onClick={() => setSelected(record)}>View opportunity <ArrowUpRight size={15} /></button></div></article>)}{!matching.length && <p className="workspace-empty">No matching opportunities.</p>}<RecordPager page={currentPage} pages={pages} total={matching.length} onPage={setPage} />{selected && <RecordDrawer title={selected.title || "Saved opportunity"} label="Opportunity details" onClose={() => setSelected(null)}><p className="report-source-note">Stored capture values are preserved. Retained fields have not been assigned new reporting meaning.</p><dl className="workspace-fields">{Object.entries(flattenRecord(selected)).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl></RecordDrawer>}</section>;
}

function AnalysisRecords({ records }: { records: AdminSummary["recentResumeRecords"] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const { stale } = useContext(ReportContext);
  const [selected, setSelected] = useState<AdminSummary["recentResumeRecords"][number] | null>(null);
  const matching = records.filter((record) => [record.candidateId, record.targetRole, record.currentTitle, record.careerLevel, record.country].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  return <section className="workspace-records analysis-records" aria-labelledby="saved-analyses-title">
    <div className="workspace-analysis-heading"><div><h2 id="saved-analyses-title">Saved analyses</h2><p>Every saved report, with its original analysis and profile details.</p></div><button type="button" className="workspace-quiet" onClick={() => exportDataset("saved-analyses", matching)} disabled={stale || !matching.length}><Download size={15} />Export analyses JSON</button></div>
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
function Metric({ label, value, note, onOpen }: { label: string; value: number | string; note?: string; onOpen?: () => void }) {
  return <article><strong>{typeof value === "number" ? value.toLocaleString() : value}</strong><span>{label}</span>{note && <small>{note}</small>}{onOpen && <button type="button" className="workspace-view-button" aria-label={`Review ${label.toLowerCase()}`} onClick={onOpen}>Review records <ArrowRight size={14} /></button>}</article>;
}
function ChartPanel({ title, items, sortable = false, showZeroRows = false }: { title: string; items: CountItem[]; sortable?: boolean; showZeroRows?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState("Most common");
  const [imageError, setImageError] = useState("");
  const { summary, stale, navigate } = useContext(ReportContext);
  const records = [...items].sort((left, right) => sort === "Alphabetical" ? left.label.localeCompare(right.label) : sort === "Least common" ? left.count - right.count : right.count - left.count);
  const visible = expanded ? records : records.slice(0, 10);
  const max = Math.max(...records.map((item) => item.count), 1);
  const population = chartPopulation(title, summary);
  const represented = records.reduce((total,item) => total + item.count,0);
  const scope = summary?.meta.query ? `Search: ${summary.meta.query}` : "All records";
  const context = `${population.source} · ${population.count} ${population.unit} · all saved dates · ${scope} · loaded ${formatDateTime(summary?.meta.lastLoadedAt || "")}`;
  const exportRows = records.map((item) => ({ ...item, source: population.source, population: population.count, populationUnit: population.unit, dateScope: "All saved dates", scope, loadedAt: summary?.meta.lastLoadedAt, categoryScope: summary?.meta.categoryScope || "Source-defined categories" }));
  return <section className="chart-panel">
    <div className="panel-heading"><h2>{title}</h2><div className="restored-chart-controls"><select aria-label={`Sort ${title}`} value={sort} onChange={(event) => setSort(event.target.value)}>{["Most common", "Least common", "Alphabetical"].map((value) => <option key={value}>{value}</option>)}</select><button className="download-chart-button" type="button" disabled={stale || !records.length} onClick={() => exportCsv(title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), exportRows)} aria-label={`Export ${title} data`}><Download size={13} />CSV</button><button className="download-chart-button" type="button" disabled={stale || !records.length} onClick={() => { setImageError(""); try { downloadChartPng(title, records, context); } catch { setImageError("The chart image could not be created. Please try the CSV export."); } }} aria-label={`Download ${title} PNG`}>PNG</button></div></div>
    <p className="clarity-chart-context">{context}</p>
    <p className="clarity-chart-method">{population.count === 0 ? "No records in this report population. Rates and coverage are not available." : population.multiple ? "Multiple values can apply to one record; counts are not a sequential funnel or a share of a single whole." : `${Math.max(0,population.count - represented)} population records are not represented in these categories (missing or not applicable).`}{stale ? " Previous results are shown; refresh before exporting." : ""}</p>
    {records.length > 10 && <p className="clarity-chart-scope">{expanded ? `All ${records.length} categories shown` : `Top 10 of ${records.length} categories shown`}. The data table and exports include every category.</p>}
    {imageError && <p role="alert" className="workspace-alert">{imageError}</p>}
    {records.length ? <dl className="workspace-chart" aria-label={title}>{visible.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.count.toLocaleString()}{item.percentAffected !== undefined && <small> · {item.percentAffected}% affected</small>}</dd><span aria-hidden="true"><i style={{ width: `${item.count > 0 ? item.count / max * 100 : 0}%` }} /></span></div>)}</dl> : <p className="report-source-note">No data available for this category.</p>}
    {records.length > 10 && <button type="button" className="workspace-view-button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show top 10" : `Show all ${records.length}`}</button>}
    <details className="clarity-chart-table"><summary>Complete data table ({records.length} categories)</summary><div className="restored-table-scroll" tabIndex={0} role="region" aria-label={`${title} complete data`}><table><caption>{title} — all {records.length} categories</caption><thead><tr><th scope="col">Category</th><th scope="col">Count</th>{items.some(item => item.percentAffected !== undefined) && <th scope="col">Percent of analyses affected</th>}</tr></thead><tbody>{records.map(item => <tr key={item.label}><th scope="row">{item.label}</th><td>{item.count}</td>{items.some(value => value.percentAffected !== undefined) && <td>{item.percentAffected === undefined ? "Not available" : `${item.percentAffected}%`}</td>}</tr>)}</tbody></table></div></details>
    {navigate && population.view && <button type="button" className="workspace-view-button" onClick={() => navigate(population.view!)}>Open {population.source.toLowerCase()} <ArrowRight size={14} /></button>}
  </section>;
}
function chartPopulation(title: string, summary: AdminSummary | null): { source: string; count: number; unit: string; multiple: boolean; view?: WorkspaceView } {
  const multiple = /interests|certifications|top skills|top tools|skill gaps/i.test(title);
  if (/^User event/.test(title)) return { source: "Activity events", count: Object.values(summary?.userEventTypes || {}).reduce((total,value) => total + value,0), unit: "events", multiple: false };
  if (/^Session/.test(title)) return { source: "Tracked sessions", count: summary?.totals.sessions || 0, unit: "sessions", multiple: false };
  if (/^(Career outcomes|Current search status|Employers$|Job titles$|Industries$|Salary ranges$|Reported verification status)/.test(title)) return { source: "Follow-up responses", count: summary?.totals.followUpRespondents || 0, unit: "identifiable respondents (latest update each)", multiple, view: "followups" };
  if (/^(Captured opportunity|Opportunity |Application (status|sources))/.test(title)) return { source: "Saved opportunities", count: summary?.totals.applicationCaptures || 0, unit: "opportunity records", multiple: false, view: "applications" };
  if (/^(Career levels|Readiness|Target roles|Top |Skill gaps|Resume cohort)/.test(title)) return { source: "Saved analyses", count: summary?.totals.resumeRecords || 0, unit: "analysis records", multiple, view: "applications" };
  return { source: "Waitlist contacts", count: summary?.totals.waitlistSignups || 0, unit: "signup records", multiple, view: "waitlist" };
}
function ChartImageButton({ title, items }: { title: string; items: CountItem[] }) {
  const [error, setError] = useState("");
  const { summary, stale } = useContext(ReportContext);
  return <><button type="button" className="workspace-quiet" disabled={stale || !items.length} aria-label={`Download ${title} PNG`} onClick={() => { setError(""); try { downloadChartPng(title, items, `${summary?.meta.query ? "Matching records" : "All records"} · all saved dates · loaded ${formatDateTime(summary?.meta.lastLoadedAt || "")}`); } catch { setError("The chart image could not be created. Please try again."); } }}>PNG</button>{error && <p role="alert" className="workspace-alert">{error}</p>}</>;
}
function downloadChartPng(title: string, items: CountItem[], scope = "") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image export unavailable");
  canvas.width = 1200;
  const wrap = (value: string, width: number) => {
    const lines: string[] = [];
    let line = "";
    for (const character of value) {
      if (context.measureText(line + character).width > width && line) { lines.push(line); line = ""; }
      line += character;
    }
    if (line) lines.push(line);
    return lines;
  };
  context.font = "22px Arial";
  const rows = items.map((item) => ({ ...item, lines: wrap(item.label, 850) }));
  context.font = "bold 28px Arial";
  const titleLines = wrap(title, 1080);
  context.font = "16px Arial";
  const scopeLines = wrap(scope, 1080);
  canvas.height = 140 + titleLines.length * 32 + scopeLines.length * 22 + rows.reduce((height, row) => height + row.lines.length * 28 + 44, 0);
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#173d35"; context.font = "bold 28px Arial";
  titleLines.forEach((line, index) => context.fillText(line, 48, 55 + index * 32));
  let y = 70 + titleLines.length * 32;
  context.fillStyle = "#52665f"; context.font = "16px Arial";
  context.fillText(`SagittaIQ · ${items.length} categories · Exported ${new Date().toLocaleString()}`, 48, y); y += 42;
  scopeLines.forEach(line => { context.fillText(line, 48, y); y += 22; });
  const max = Math.max(1, ...items.map((item) => item.count));
  for (const row of rows) {
    context.fillStyle = "#243b34"; context.font = "22px Arial";
    row.lines.forEach((line) => { context.fillText(line, 48, y); y += 28; });
    context.textAlign = "right"; context.font = "bold 22px Arial";
    context.fillText(`${row.count}${row.percentAffected !== undefined ? ` · ${row.percentAffected}%` : ""}`, 1152, y - 28); context.textAlign = "left";
    context.fillStyle = "#e5eee9"; context.fillRect(48, y - 7, 1104, 12);
    context.fillStyle = "#12675d"; context.fillRect(48, y - 7, row.count / max * 1104, 12); y += 44;
  }
  const link = document.createElement("a");
  link.download = `sagittaiq-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png"); link.click();
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
