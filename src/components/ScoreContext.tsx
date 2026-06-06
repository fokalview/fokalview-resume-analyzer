import { Info } from "lucide-react";

export function scoreBand(score: number) {
  if (score < 50) return { label: "Early alignment", tone: "low" as const };
  if (score < 65) return { label: "Needs focused improvement", tone: "low" as const };
  if (score < 85) return { label: "Developing match", tone: "mid" as const };
  return { label: "Strong match", tone: "high" as const };
}

export function scoreExplanation(score: number, threshold = 85) {
  const band = scoreBand(score);
  const distance = score - threshold;
  const thresholdText = distance >= 0
    ? `${distance} points above the strong-match threshold`
    : `${Math.abs(distance)} points below the strong-match threshold`;

  return `${band.label}. ${thresholdText}. The score uses SagittaIQ's fixed readiness rubric, so identical resume and job inputs receive the same score. It does not predict hiring decisions.`;
}

export function ScoreContext({
  score,
  threshold = 85,
  compact = false
}: {
  score: number;
  threshold?: number;
  compact?: boolean;
}) {
  const band = scoreBand(score);

  return (
    <div className={`score-context ${band.tone}${compact ? " compact" : ""}`}>
      <Info size={15} aria-hidden="true" />
      <div>
        <strong>{band.label}</strong>
        <span>{scoreExplanation(score, threshold)}</span>
      </div>
    </div>
  );
}
