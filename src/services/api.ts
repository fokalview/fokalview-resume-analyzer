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

export async function saveResumeRecord(input: {
  resumeText: string;
  targetRole: string;
  jobContext: string;
  analysis: ResumeAnalysis;
  retainRawResumeText: boolean;
}) {
  const clientId = getClientId();
  const response = await fetch("/api/resume-records", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-Client-ID": clientId
    },
    body: JSON.stringify({
      consent: true,
      consentVersion: "workforce-resume-profile-v1",
      resumeText: input.resumeText,
      targetRole: input.targetRole,
      jobContext: input.jobContext,
      profile: input.analysis.profile,
      analysis: input.analysis,
      retainRawResumeText: input.retainRawResumeText
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Could not save resume record.");
  }

  return payload as { ok: boolean; id: string; savedAt: string };
}

function getClientId() {
  const storageKey = "fokalview_client_id";
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const next = crypto.randomUUID();
  localStorage.setItem(storageKey, next);
  return next;
}
