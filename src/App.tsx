import { useEffect, useState } from "react";
import { BriefcaseBusiness, FileText, Gauge, LogOut, Moon, Sparkles, Sun } from "lucide-react";
import UploadScreen from "./screens/UploadScreen";
import ResultsScreen from "./screens/ResultsScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import AdminDashboard from "./screens/AdminDashboard";
import ApplicationTracker from "./screens/ApplicationTracker";
import CandidateDashboard from "./screens/CandidateDashboard";
import FollowUpScreen from "./screens/FollowUpScreen";
import WaitlistScreen from "./screens/WaitlistScreen";
import PublicInfoPage from "./screens/PublicInfoPage";
import { clearStoredAccess, getVerifiedAuthSession, type VerifiedAuthSession } from "./services/access";
import { recordUserEvent, type ApplicationRecord } from "./services/api";
import type { ResumeAnalysis, Screen } from "./types";
import { ProductBrand } from "./components/BrandFamily";
import JobImportScreen from "./screens/JobImportScreen";
import {readJobHandoff,clearPendingJob} from "./services/jobHandoff";

export default function App() {
  useSessionTracking();
  const publicPage = publicPageForPath(window.location.pathname);

  if (publicPage) {
    return <PublicInfoPage page={publicPage} />;
  }

  if (window.location.pathname === "/admin") {
    return <AdminDashboard />;
  }

  if (window.location.pathname === "/waitlist") {
    return <WaitlistScreen />;
  }

  if (window.location.pathname === "/follow-up") {
    return <FollowUpScreen />;
  }

  return <ResumeApp />;
}

function publicPageForPath(pathname: string) {
  if (pathname === "/about") return "about" as const;
  if (pathname === "/how-it-works") return "how-it-works" as const;
  if (pathname === "/data-and-privacy") return "data-and-privacy" as const;
  if (pathname === "/product-family") return "product-family" as const;
  return null;
}

function ResumeApp() {
  const [handoff,setHandoff] = useState(readJobHandoff);
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme());
  const [hasBetaAccess, setHasBetaAccess] = useState(false);
  const [verifiedSession, setVerifiedSession] = useState<VerifiedAuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userIdentity, setUserIdentity] = useState<{ userId: string; candidateId?: string; identifierType: string } | null>(null);
  const [screen, setScreen] = useState<Screen>(handoff.capturedJob ? "import" : "dashboard");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState(handoff.targetRole);
  const [jobContext, setJobContext] = useState(handoff.jobContext);
  const [reviewOpportunity, setReviewOpportunity] = useState<ApplicationRecord | null>(null);

  useEffect(() => {
    localStorage.setItem("sagittaiq_theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getVerifiedAuthSession()
        .then((session) => {
          if (!active) return;
          setVerifiedSession(session);
          setHasBetaAccess(Boolean(session));
          if (!session) { clearStoredAccess(); setUserIdentity(null); }
          if (session) {
            setUserIdentity({
              userId: session.userId,
              candidateId: session.candidateId,
              identifierType: "verified_email"
            });
          }
        })
        .catch(() => {
          if (!active) return;
          clearStoredAccess();
          setVerifiedSession(null);
          setUserIdentity(null);
          setHasBetaAccess(false);
        })
        .finally(() => {
          if (active) setAuthChecked(true);
        });
    };

    refresh();
    const interval = window.setInterval(refresh, 4 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!authChecked && !hasBetaAccess) {
    return <main className="welcome-shell" data-theme={theme} aria-busy="true" />;
  }

  if (!hasBetaAccess) {
    return (
      <>
      {handoff.capturedJob && <p role="status" className="capture-signin-notice">Your captured job is ready. Sign in to review and save it.</p>}
      {handoff.importError && <p role="alert" className="capture-signin-notice">{handoff.importError}</p>}
      <WelcomeScreen
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      </>
    );
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar" aria-label="Workflow">
        <ProductBrand product="career" inverse />

        <nav className="step-list">
          {handoff.capturedJob && <button className={screen === "import" ? "active" : ""} onClick={()=>setScreen("import")}>Review captured job</button>}
          <button className={screen === "dashboard" ? "active" : ""} onClick={() => setScreen("dashboard")}>
            <Gauge size={18} />
            Dashboard
          </button>
          <button
            className={screen === "upload" ? "active" : ""}
            onClick={() => {
              setReviewOpportunity(null);
              setScreen("upload");
            }}
          >
            <FileText size={18} />
            Upload
          </button>
          <button
            className={screen === "results" ? "active" : ""}
            disabled={!analysis}
            onClick={() => setScreen("results")}
            title={analysis ? "Open career readiness report" : "Analyze career materials to unlock your report"}
          >
            <Sparkles size={18} />
            Readiness report
          </button>
          <button
            className={screen === "applications" ? "active" : ""}
            onClick={() => setScreen("applications")}
          >
            <BriefcaseBusiness size={18} />
            Opportunities
          </button>
        </nav>

        <button className="mode-toggle sidebar-mode-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>

        {verifiedSession && (
          <a className="sidebar-signout" href="/api/auth/logout">
            <LogOut size={16} />
            Sign out
          </a>
        )}

        <div className="api-status">
          <span />
          <div>
            <strong>Candidate ID</strong>
            <button
              className="candidate-id-button"
              onClick={() => {
                const identifier = userIdentity?.candidateId || userIdentity?.userId || "";
                if (identifier) void navigator.clipboard?.writeText(identifier);
              }}
              title="Copy candidate ID"
            >
              {userIdentity?.candidateId || userIdentity?.userId || "Loading..."}
            </button>
            <small>
              {userIdentity?.identifierType === "verified_email"
                ? "Verified account"
                : userIdentity?.identifierType === "email"
                  ? "Email-linked profile"
                  : "Device-linked profile"}
            </small>
          </div>
        </div>
      </aside>

      <section className="workspace">
        {screen === "dashboard" && (
          <CandidateDashboard
            analysis={analysis}
            targetRole={targetRole}
            userIdentity={userIdentity}
            onNavigate={setScreen}
          />
        )}
        {handoff.importError && <p role="alert">{handoff.importError}</p>}
        {screen === "import" && handoff.capturedJob && <JobImportScreen job={handoff.capturedJob}
          onDiscard={()=>{clearPendingJob();setHandoff({targetRole:'',jobContext:'',title:'',company:'',location:'',salary:'',url:'',notes:'',source:''});setTargetRole('');setJobContext('');setScreen("dashboard");}}
          onSaved={opportunity=>{clearPendingJob();setHandoff({...handoff,capturedJob:undefined});setReviewOpportunity(opportunity);setTargetRole(opportunity.title);setJobContext(opportunity.jobDescription);setScreen("upload");}}/>}
        {screen === "upload" && (
          <UploadScreen
            resumeText={resumeText}
            targetRole={targetRole}
            jobContext={jobContext}
            jobHandoff={{ ...handoff, targetRole, jobContext }}
            opportunity={reviewOpportunity}
            onOpportunitySelect={(opportunity) => {
              setReviewOpportunity(opportunity);
              setResumeText("");
              setAnalysis(null);
              setTargetRole(opportunity?.title || "");
              setJobContext(opportunity?.jobDescription || "");
            }}
            onResumeTextChange={setResumeText}
            onTargetRoleChange={setTargetRole}
            onJobContextChange={setJobContext}
            onAnalysisComplete={(nextAnalysis) => {
              setAnalysis(nextAnalysis);
              setScreen("results");
            }}
          />
        )}
        {screen === "results" && analysis && (
          <ResultsScreen analysis={analysis} jobHandoff={{ ...handoff, targetRole, jobContext }} onOpenTracker={() => setScreen("applications")} />
        )}
        {screen === "applications" && (
          <ApplicationTracker
            onRerun={(opportunity) => {
              setReviewOpportunity(opportunity);
              setResumeText("");
              setAnalysis(null);
              setTargetRole(opportunity.title);
              setJobContext(opportunity.jobDescription);
              setScreen("upload");
            }}
          />
        )}
      </section>
    </main>
  );
}

function getStoredTheme() {
  const saved = localStorage.getItem("sagittaiq_theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useSessionTracking() {
  useEffect(() => {
    if (window.location.pathname === "/admin") return;

    const sessionId = crypto.randomUUID();
    const startedAt = Date.now();
    const eventSource = eventSourceForPath(window.location.pathname);
    const campaign = campaignFromUrl();
    let completed = false;

    const durationSeconds = () => Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const send = (eventType: "session_started" | "session_heartbeat" | "session_completed") => {
      void recordUserEvent({
        eventType,
        eventSource,
        pagePath: window.location.pathname,
        sessionId,
        durationSeconds: durationSeconds(),
        campaign,
        metadata: {
          utmSource: new URLSearchParams(window.location.search).get("utm_source") || "",
          utmMedium: new URLSearchParams(window.location.search).get("utm_medium") || "",
          referrer: document.referrer,
          userAgent: navigator.userAgent.slice(0, 180)
        }
      }).catch(() => undefined);
    };

    send("session_started");
    const heartbeat = window.setInterval(() => send("session_heartbeat"), 30000);

    const complete = () => {
      if (completed) return;
      completed = true;
      send("session_completed");
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") send("session_heartbeat");
    };

    window.addEventListener("pagehide", complete);
    window.addEventListener("beforeunload", complete);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", complete);
      window.removeEventListener("beforeunload", complete);
      document.removeEventListener("visibilitychange", handleVisibility);
      complete();
    };
  }, []);
}

function eventSourceForPath(pathname: string) {
  if (pathname === "/waitlist") return "waitlist";
  if (pathname === "/follow-up") return "follow_up";
  return "main_app";
}

function campaignFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("utm_campaign") || params.get("campaign") || params.get("source") || "";
}
