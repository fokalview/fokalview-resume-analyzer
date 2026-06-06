import { useEffect, useState } from "react";
import { BriefcaseBusiness, FileText, Gauge, MessageSquareText, Moon, Sparkles, Sun } from "lucide-react";
import UploadScreen from "./screens/UploadScreen";
import ResultsScreen from "./screens/ResultsScreen";
import FeedbackScreen from "./screens/FeedbackScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import AdminDashboard from "./screens/AdminDashboard";
import ApplicationTracker from "./screens/ApplicationTracker";
import CandidateDashboard from "./screens/CandidateDashboard";
import FollowUpScreen from "./screens/FollowUpScreen";
import WaitlistScreen from "./screens/WaitlistScreen";
import { getStoredAccessCode } from "./services/access";
import { getCurrentUser, recordUserEvent } from "./services/api";
import type { ResumeAnalysis, Screen } from "./types";
import { ProductBrand } from "./components/BrandFamily";

export default function App() {
  useSessionTracking();

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

function ResumeApp() {
  const handoff = readJobHandoff();
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme());
  const [hasBetaAccess, setHasBetaAccess] = useState(Boolean(getStoredAccessCode()));
  const [userIdentity, setUserIdentity] = useState<{ userId: string; candidateId?: string; identifierType: string } | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState(handoff.targetRole);
  const [jobContext, setJobContext] = useState(handoff.jobContext);

  useEffect(() => {
    localStorage.setItem("sagittaiq_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!hasBetaAccess) return;
    void getCurrentUser()
      .then(setUserIdentity)
      .catch(() => setUserIdentity(null));
  }, [hasBetaAccess]);

  if (!hasBetaAccess) {
    return (
      <WelcomeScreen
        theme={theme}
        onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        onAccessGranted={() => setHasBetaAccess(true)}
      />
    );
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar" aria-label="Workflow">
        <ProductBrand product="career" inverse />

        <nav className="step-list">
          <button className={screen === "dashboard" ? "active" : ""} onClick={() => setScreen("dashboard")}>
            <Gauge size={18} />
            Dashboard
          </button>
          <button className={screen === "upload" ? "active" : ""} onClick={() => setScreen("upload")}>
            <FileText size={18} />
            Upload
          </button>
          <button
            className={screen === "results" ? "active" : ""}
            disabled={!analysis}
            onClick={() => setScreen("results")}
          >
            <Sparkles size={18} />
            Results
          </button>
          <button
            className={screen === "feedback" ? "active" : ""}
            disabled={!analysis}
            onClick={() => setScreen("feedback")}
          >
            <MessageSquareText size={18} />
            Feedback
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
            <small>{userIdentity?.identifierType === "email" ? "Email-linked profile" : "Device-linked profile"}</small>
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
        {screen === "upload" && (
          <UploadScreen
            resumeText={resumeText}
            targetRole={targetRole}
            jobContext={jobContext}
            jobHandoff={{ ...handoff, targetRole, jobContext }}
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
          <ResultsScreen analysis={analysis} jobHandoff={{ ...handoff, targetRole, jobContext }} onNext={() => setScreen("feedback")} />
        )}
        {screen === "feedback" && analysis && <FeedbackScreen analysis={analysis} jobHandoff={{ ...handoff, targetRole, jobContext }} />}
        {screen === "applications" && <ApplicationTracker />}
      </section>
    </main>
  );
}

function readJobHandoff() {
  const params = new URLSearchParams(window.location.search);
  const title = params.get("jobTitle") || "";
  const company = params.get("company") || "";
  const location = params.get("location") || "";
  const salary = params.get("salary") || "";
  const url = params.get("jobUrl") || "";
  const notes = params.get("notes") || "";
  const source = params.get("source") || "";

  const targetRole = title;
  const jobContext = [
    title && `Job title: ${title}`,
    company && `Company: ${company}`,
    location && `Location: ${location}`,
    salary && `Salary: ${salary}`,
    source && `Source: ${source}`,
    url && `Job URL: ${url}`,
    notes && `Tracker notes: ${notes}`
  ]
    .filter(Boolean)
    .join("\n");

  return { targetRole, jobContext, title, company, location, salary, url, notes, source };
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
