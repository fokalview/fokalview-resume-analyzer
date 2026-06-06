import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, BarChart3, BriefcaseBusiness, CheckCircle2, Clock3, FileText, Target, type LucideIcon } from "lucide-react";
import {
  getApplications,
  getResumeRecords,
  type ApplicationRecord,
  type ResumeRecord
} from "../services/api";
import type { ResumeAnalysis, Screen } from "../types";
import { ScoreContext } from "../components/ScoreContext";

type Props = {
  analysis: ResumeAnalysis | null;
  targetRole: string;
  userIdentity: { userId: string; candidateId?: string; identifierType: string } | null;
  onNavigate: (screen: Screen) => void;
};

export default function CandidateDashboard({ analysis, targetRole, userIdentity, onNavigate }: Props) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [resumeRecords, setResumeRecords] = useState<ResumeRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    Promise.all([getApplications(), getResumeRecords()])
      .then(([nextApplications, nextRecords]) => {
        if (!isMounted) return;
        setApplications(nextApplications);
        setResumeRecords(nextRecords);
      })
      .catch((nextError) => {
        if (!isMounted) return;
        setError(nextError instanceof Error ? nextError.message : "Could not load dashboard data.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const latestRecord = resumeRecords[0];
  const currentAnalysis = analysis || latestRecord?.analysis || null;
  const previousScore = resumeRecords.find((record) => record.analysis?.score !== currentAnalysis?.score)?.analysis?.score;
  const score = currentAnalysis?.score || 0;
  const scoreDelta = typeof previousScore === "number" ? score - previousScore : 0;
  const profile = currentAnalysis?.profile || latestRecord?.profile;
  const nextSteps = useMemo(() => buildNextSteps(currentAnalysis, applications), [currentAnalysis, applications]);
  const stats = applicationStats(applications);
  const statusCounts = applicationStatusCounts(applications);
  const readinessDrivers = readinessDriverScores(currentAnalysis);
  const timeline = buildTimeline(resumeRecords, applications, userIdentity);

  return (
    <section className="screen dashboard-screen">
      <div className="dashboard-hero">
        <div>
          <p className="eyebrow">Candidate Dashboard</p>
          <h2>Your career readiness command center.</h2>
          <p>
            Track your resume score, role alignment, application activity, and the next moves that matter most.
          </p>
        </div>
        <div className="dashboard-score-card">
          <div className="score-ring compact" style={{ "--score": `${score}%` } as CSSProperties}>
            <strong>{currentAnalysis ? score : "--"}</strong>
            <span>readiness</span>
          </div>
          <small className={scoreDelta >= 0 ? "trend-up" : "trend-down"}>
            {previousScore === undefined ? "Baseline score" : `${scoreDelta >= 0 ? "+" : ""}${scoreDelta} pts from last saved score`}
          </small>
          {currentAnalysis && <ScoreContext score={score} compact />}
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      <section className="dashboard-grid">
        <article className="dashboard-panel profile-panel">
          <div className="panel-title">
            <Target size={18} />
            <h3>Profile Snapshot</h3>
          </div>
          <dl className="profile-list">
            <div>
              <dt>Candidate ID</dt>
              <dd>{userIdentity?.candidateId || userIdentity?.userId || "Loading..."}</dd>
            </div>
            <div>
              <dt>Target role</dt>
              <dd>{targetRole || latestRecord?.targetRole || "Add a target role"}</dd>
            </div>
            <div>
              <dt>Career level</dt>
              <dd>{profile?.careerLevel || "Unknown"}</dd>
            </div>
            <div>
              <dt>Current title</dt>
              <dd>{profile?.currentTitle || "Not detected yet"}</dd>
            </div>
          </dl>
          <button className="secondary-action" onClick={() => onNavigate("upload")}>
            Update resume
            <ArrowRight size={16} />
          </button>
        </article>

        <article className="dashboard-panel">
          <div className="panel-title">
            <BarChart3 size={18} />
            <h3>Score History</h3>
          </div>
          {resumeRecords.length ? (
            <div className="score-history-wrap">
              <div className="score-history-threshold" aria-hidden="true">
                <span>85 strong match</span>
              </div>
              <div className="score-history" role="img" aria-label="Resume score history with 85 percent strong match threshold">
              {resumeRecords.slice(0, 8).reverse().map((record) => (
                <span
                  key={record.id}
                  style={{ height: `${Math.max(8, record.analysis.score)}%` }}
                  title={`${formatDate(record.updatedAt)}: ${record.analysis.score}%`}
                />
              ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={FileText} title="No score history yet" detail="Analyze a resume to start tracking progress." />
          )}
        </article>

        <article className="dashboard-panel">
          <div className="panel-title">
            <BriefcaseBusiness size={18} />
            <h3>Application Activity</h3>
          </div>
          <div className="mini-metrics">
            <Metric label="Applications" value={applications.length} />
            <Metric label="Interviews" value={stats.interviews} />
            <Metric label="Offers" value={stats.offers} />
            <Metric label="Response rate" value={`${stats.responseRate}%`} />
          </div>
          <div className="status-mix-chart" aria-label="Opportunity status mix">
            {statusCounts.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <meter min="0" max={Math.max(...statusCounts.map((entry) => entry.count), 1)} value={item.count} />
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <button className="secondary-action" onClick={() => onNavigate("applications")}>
            Open tracker
            <ArrowRight size={16} />
          </button>
        </article>

        <article className="dashboard-panel next-steps-panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <h3>Next Steps</h3>
          </div>
          {nextSteps.length ? (
            <div className="next-step-list">
              {nextSteps.map((step) => (
                <label key={step}>
                  <input type="checkbox" />
                  <span>{step}</span>
                </label>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="Ready for your first action" detail="Analyze a resume and add an opportunity to unlock tailored next steps." />
          )}
        </article>

        <article className="dashboard-panel timeline-panel">
          <div className="panel-title">
            <Clock3 size={18} />
            <h3>Candidate Timeline</h3>
          </div>
          <div className="timeline-list">
            {timeline.map((item) => (
              <div key={`${item.label}-${item.date}`}>
                <strong>{item.label}</strong>
                <span>{item.date}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel alignment-panel">
          <div className="panel-title">
            <Target size={18} />
            <h3>Readiness Drivers</h3>
          </div>
          <div className="driver-chart" role="img" aria-label="Readiness driver scores by resume section">
            {readinessDrivers.map((driver) => (
              <div key={driver.label}>
                <span>{driver.label}</span>
                <meter min="0" max="100" value={driver.score} />
                <strong>{driver.score}%</strong>
              </div>
            ))}
          </div>
          <div className="alignment-groups">
            <div>
              <h4>Strengths</h4>
              {(currentAnalysis?.strengths || ["Analyze a resume to surface alignment strengths."]).slice(0, 3).map((item) => <span key={item}>{item}</span>)}
            </div>
            <div>
              <h4>Gaps</h4>
              {(currentAnalysis?.keywordAnalysis.missing || ["Add a target role and resume to detect gaps."]).slice(0, 3).map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}

function applicationStatusCounts(applications: ApplicationRecord[]) {
  const labels = ["Interested", "Applied", "Interviewing", "Offer", "Accepted"];
  const counts = applications.reduce<Record<string, number>>((nextCounts, item) => {
    const normalized = normalizeApplicationStatus(item.status);
    nextCounts[normalized] = (nextCounts[normalized] || 0) + 1;
    return nextCounts;
  }, {});

  return labels.map((label) => ({ label, count: counts[label] || 0 }));
}

function normalizeApplicationStatus(status: string) {
  const value = status.toLowerCase();
  if (value.includes("accept")) return "Accepted";
  if (value.includes("offer")) return "Offer";
  if (value.includes("interview") || value.includes("screen")) return "Interviewing";
  if (value.includes("applied")) return "Applied";
  return "Interested";
}

function readinessDriverScores(analysis: ResumeAnalysis | null) {
  if (!analysis) {
    return [
      { label: "Skills", score: 0 },
      { label: "Experience", score: 0 },
      { label: "Education", score: 0 },
      { label: "ATS Match", score: 0 }
    ];
  }

  const sectionScore = (name: string, fallback: number) =>
    analysis.sections.find((section) => section.name.toLowerCase().includes(name))?.score ?? fallback;

  return [
    { label: "Skills", score: sectionScore("skill", Math.min(100, analysis.keywordAnalysis.matched.length * 10)) },
    { label: "Experience", score: sectionScore("experience", analysis.score) },
    { label: "Education", score: sectionScore("education", analysis.score) },
    { label: "ATS Match", score: sectionScore("ats", analysis.score) }
  ].map((item) => ({ ...item, score: Math.max(0, Math.min(100, Math.round(item.score))) }));
}

function buildNextSteps(analysis: ResumeAnalysis | null, applications: ApplicationRecord[]) {
  const steps = (analysis?.improvements || []).slice(0, 3).map((item) => item.title);
  if (!applications.length) steps.push("Add the first opportunity you plan to apply to.");
  if (applications.length && !applications.some((item) => interviewStatuses().includes(item.status))) {
    steps.push("Follow up on one submitted application this week.");
  }
  return steps.slice(0, 4);
}

function applicationStats(applications: ApplicationRecord[]) {
  const interviews = applications.filter((item) => interviewStatuses().includes(item.status)).length;
  const offers = applications.filter((item) => ["Offer", "Accepted", "Offer Received", "Offer Accepted"].includes(item.status)).length;
  return {
    interviews,
    offers,
    responseRate: applications.length ? Math.round((interviews / applications.length) * 100) : 0
  };
}

function buildTimeline(
  resumeRecords: ResumeRecord[],
  applications: ApplicationRecord[],
  userIdentity: { userId: string; candidateId?: string; identifierType: string } | null
) {
  const items = [
    {
      label: userIdentity?.candidateId ? "Candidate profile created" : "Profile session started",
      date: "Active"
    },
    ...resumeRecords.slice(0, 3).map((record) => ({
      label: `${record.analysis.score}% resume score saved`,
      date: formatDate(record.updatedAt)
    })),
    ...applications.slice(0, 3).map((application) => ({
      label: `${application.status}: ${application.title || "Opportunity"}`,
      date: formatDate(application.updatedAt || application.createdAt)
    }))
  ];

  return items.slice(0, 7);
}

function interviewStatuses() {
  return ["Interviewing", "Final Interview", "Phone Screen Scheduled", "Interview Scheduled", "Interview Complete"];
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return (
    <div className="dashboard-empty">
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}
