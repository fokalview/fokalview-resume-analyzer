import { AlertCircle, CircleCheck } from "lucide-react";
import type { ResumeAnalysis } from "../types";

type Props = {
  analysis: ResumeAnalysis;
};

export default function FeedbackScreen({ analysis }: Props) {
  return (
    <div className="screen">
      <div className="screen-heading">
        <p className="eyebrow">Feedback</p>
        <h2>Prioritized edits for the next draft.</h2>
        <p>Work high priority items first, then tighten keyword coverage for the target role.</p>
      </div>

      <div className="feedback-layout">
        <section>
          <h3>Recommended improvements</h3>
          <div className="improvement-list">
            {analysis.improvements.map((item) => (
              <article className="improvement" key={item.title}>
                <span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h3>Keyword coverage</h3>
          <div className="keyword-groups">
            <div>
              <h4>Matched</h4>
              <div className="keyword-list">
                {analysis.keywordAnalysis.matched.map((term) => (
                  <div className="keyword" key={`matched-${term}`}>
                    <CircleCheck size={18} />
                    <span>{term}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4>Missing</h4>
              <div className="keyword-list">
                {analysis.keywordAnalysis.missing.map((term) => (
                  <div className="keyword missing" key={`missing-${term}`}>
                    <AlertCircle size={18} />
                    <span>{term}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
