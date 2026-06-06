import { AlertCircle, BriefcaseBusiness, CheckCircle2, CircleCheck, Download, ListChecks, Target } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { InlineNotice, PageHeader } from "../components/ExperienceUI";
import { ScoreContext } from "../components/ScoreContext";
import { downloadResumeReport } from "../services/report";
import type { JobHandoff, ResumeAnalysis } from "../types";

type ReportTab = "overview" | "recommendations" | "alignment";

export default function ResultsScreen({
  analysis,
  jobHandoff,
  onOpenTracker
}: {
  analysis: ResumeAnalysis;
  jobHandoff: JobHandoff;
  onOpenTracker: () => void;
}) {
  const [tab, setTab] = useState<ReportTab>("overview");
  const highPriority = analysis.improvements.filter((item) => item.priority === "High").length;
  const target = jobHandoff.title || jobHandoff.targetRole || "your target opportunity";

  return (
    <section className="screen analysis-workspace">
      <PageHeader
        eyebrow="Career readiness report"
        title={`${analysis.score}% alignment with ${target}`}
        description="Use this report to understand the strongest evidence in your career materials, close the most important gaps, and prepare your next application."
        meta={<ScoreContext score={analysis.score} compact />}
        actions={
          <>
            <button
              className="secondary-action"
              onClick={() => downloadResumeReport({ analysis, job: jobHandoff, title: "SagittaIQ Career Readiness Report" })}
            >
              <Download size={17} />
              Download report
            </button>
            <button className="primary-button" onClick={onOpenTracker}>
              <BriefcaseBusiness size={17} />
              Open opportunity
            </button>
          </>
        }
      />

      <div className="analysis-summary-strip">
        <div className="score-ring compact" style={{ "--score": `${analysis.score}%` } as CSSProperties}>
          <strong>{analysis.score}</strong>
          <span>readiness</span>
        </div>
        <div>
          <span>Priority actions</span>
          <strong>{highPriority}</strong>
          <small>High-impact improvements</small>
        </div>
        <div>
          <span>Strength evidence</span>
          <strong>{analysis.strengths.length}</strong>
          <small>Signals supporting alignment</small>
        </div>
        <div>
          <span>Keyword gaps</span>
          <strong>{analysis.keywordAnalysis.missing.length}</strong>
          <small>Terms to evaluate honestly</small>
        </div>
      </div>

      <nav className="report-tabs" aria-label="Career readiness report sections">
        <ReportTabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={<Target size={17} />} label="Overview" />
        <ReportTabButton active={tab === "recommendations"} onClick={() => setTab("recommendations")} icon={<ListChecks size={17} />} label="Priority actions" />
        <ReportTabButton active={tab === "alignment"} onClick={() => setTab("alignment")} icon={<CircleCheck size={17} />} label="Opportunity alignment" />
      </nav>

      {tab === "overview" && (
        <div className="report-view">
          <InlineNotice title="What this score means">{analysis.summary}</InlineNotice>
          <section className="split-panel">
            <div>
              <h3>Evidence supporting your fit</h3>
              <ul className="clean-list">
                {analysis.strengths.map((strength) => (
                  <li key={strength}><CheckCircle2 size={18} />{strength}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Readiness by category</h3>
              <div className="section-list">
                {analysis.sections.map((section) => (
                  <div className="section-row" key={section.name}>
                    <div><strong>{section.name}</strong><span>{section.note}</span></div>
                    <meter min="0" max="100" value={section.score} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "recommendations" && (
        <div className="report-view">
          <InlineNotice tone="warning" title="Work from highest impact to lowest">
            Make only changes that truthfully reflect your experience. Stronger evidence matters more than simply adding keywords.
          </InlineNotice>
          <section className="recommendation-board">
            {analysis.improvements.map((item, index) => (
              <article className="recommendation-item" key={item.title}>
                <span className="recommendation-number">{index + 1}</span>
                <div>
                  <span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </section>
        </div>
      )}

      {tab === "alignment" && (
        <div className="report-view">
          <InlineNotice title="Use gaps as prompts, not instructions">
            Missing terms may indicate an important qualification, or they may be irrelevant to your real experience. Never claim skills you do not have.
          </InlineNotice>
          <div className="alignment-workspace">
            <section>
              <h3>Demonstrated alignment</h3>
              <div className="keyword-list">
                {analysis.keywordAnalysis.matched.map((term) => (
                  <div className="keyword" key={`matched-${term}`}><CircleCheck size={18} /><span>{term}</span></div>
                ))}
              </div>
            </section>
            <section>
              <h3>Gaps to evaluate</h3>
              <div className="keyword-list">
                {analysis.keywordAnalysis.missing.map((term) => (
                  <div className="keyword missing" key={`missing-${term}`}><AlertCircle size={18} /><span>{term}</span></div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

function ReportTabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return <button type="button" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}{label}</button>;
}
