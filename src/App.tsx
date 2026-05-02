import { useState } from "react";
import { FileText, MessageSquareText, Sparkles } from "lucide-react";
import UploadScreen from "./screens/UploadScreen";
import ResultsScreen from "./screens/ResultsScreen";
import FeedbackScreen from "./screens/FeedbackScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import { getStoredAccessCode } from "./services/access";
import type { ResumeAnalysis, Screen } from "./types";

export default function App() {
  const handoff = readJobHandoff();
  const [hasBetaAccess, setHasBetaAccess] = useState(Boolean(getStoredAccessCode()));
  const [screen, setScreen] = useState<Screen>("upload");
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState(handoff.targetRole);
  const [jobContext, setJobContext] = useState(handoff.jobContext);

  if (!hasBetaAccess) {
    return <WelcomeScreen onAccessGranted={() => setHasBetaAccess(true)} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Workflow">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="eyebrow">AI Resume Analyzer</p>
            <h1>Resume readiness review</h1>
          </div>
        </div>

        <nav className="step-list">
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
        </nav>

        <div className="api-status">
          <span />
          Artificial intelligence API key stays server-side in <code>.env</code>
        </div>
      </aside>

      <section className="workspace">
        {screen === "upload" && (
          <UploadScreen
            resumeText={resumeText}
            targetRole={targetRole}
            jobContext={jobContext}
            onResumeTextChange={setResumeText}
            onTargetRoleChange={setTargetRole}
            onJobContextChange={setJobContext}
            onAnalysisComplete={(nextAnalysis) => {
              setAnalysis(nextAnalysis);
              setScreen("results");
            }}
          />
        )}
        {screen === "results" && analysis && <ResultsScreen analysis={analysis} onNext={() => setScreen("feedback")} />}
        {screen === "feedback" && analysis && <FeedbackScreen analysis={analysis} />}
      </section>
    </main>
  );
}

function readJobHandoff() {
  const params = new URLSearchParams(window.location.search);
  const title = params.get("jobTitle") || "";
  const company = params.get("company") || "";
  const location = params.get("location") || "";
  const url = params.get("jobUrl") || "";
  const notes = params.get("notes") || "";
  const source = params.get("source") || "";

  const targetRole = title;
  const jobContext = [
    title && `Job title: ${title}`,
    company && `Company: ${company}`,
    location && `Location: ${location}`,
    source && `Source: ${source}`,
    url && `Job URL: ${url}`,
    notes && `Tracker notes: ${notes}`
  ]
    .filter(Boolean)
    .join("\n");

  return { targetRole, jobContext };
}
