import type { ResumeAnalysis } from "../types";

export async function analyzeResume(input: {
  resumeText: string;
  targetRole: string;
  jobContext: string;
}): Promise<ResumeAnalysis> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not analyze resume.");
  }

  return payload as ResumeAnalysis;
}
