import type { ResumeAnalysis } from "../types";
import { getStoredAccessCode } from "./access";

export async function analyzeResume(input: {
  resumeText: string;
  targetRole: string;
  jobContext: string;
}): Promise<ResumeAnalysis> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Access-Code": getStoredAccessCode()
    },
    body: JSON.stringify(input)
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not analyze resume.");
  }

  return payload as ResumeAnalysis;
}
