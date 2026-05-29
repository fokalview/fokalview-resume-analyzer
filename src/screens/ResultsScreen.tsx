import { ArrowRight, CheckCircle2, Download } from "lucide-react";
import type { CSSProperties } from "react";
import { downloadResumeReport } from "../services/report";
import type { JobHandoff, ResumeAnalysis } from "../types";

type Props = {
  analysis: ResumeAnalysis;
  jobHandoff: JobHandoff;
  onNext: () => void;
};

export default function ResultsScreen({ analysis, jobHandoff, onNext }: Props) {
  return (
    <div className="screen">
      <div className="result-hero">
        <div>
          <p className="eyebrow">Results</p>
          <h2>{analysis.score}% resume readiness</h2>
          <p>{analysis.summary}</p>
        </div>
        <div className="score-ring" style={{ "--score": `${analysis.score}%` } as CSSProperties}>
          <strong>{analysis.score}</strong>
          <span>score</span>
        </div>
      </div>

      <section className="split-panel">
        <div>
          <h3>Strengths</h3>
          <ul className="clean-list">
            {analysis.strengths.map((strength) => (
              <li key={strength}>
                <CheckCircle2 size={18} />
                {strength}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Section health</h3>
          <div className="section-list">
            {analysis.sections.map((section) => (
              <div className="section-row" key={section.name}>
                <div>
                  <strong>{section.name}</strong>
                  <span>{section.note}</span>
                </div>
                <meter min="0" max="100" value={section.score} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="actions">
        <span>Next: prioritize fixes and missing keywords</span>
        <div className="toolbar-actions">
          <button
            className="secondary-action"
            onClick={() => downloadResumeReport({ analysis, job: jobHandoff, title: "FokalView Resume Readiness Report" })}
          >
            <Download size={18} />
            Download PDF
          </button>
          <button className="primary-button" onClick={onNext}>
            View feedback
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
