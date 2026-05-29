import type { ResumeAnalysis } from "../types";
import { getStoredAccessCode, getStoredUserEmail } from "./access";

export async function analyzeResume(input: {
  resumeText: string;
  targetRole: string;
  jobContext: string;
}): Promise<ResumeAnalysis> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail()
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
      "X-FokalView-User-Email": getStoredUserEmail(),
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

export type ApplicationRecord = {
  id: string;
  title: string;
  company: string;
  location: string;
  status: string;
  notes: string;
  url: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
};

export async function getApplications() {
  const clientId = getClientId();
  const response = await fetch("/api/applications", {
    headers: {
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail(),
      "X-FokalView-Client-ID": clientId
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load applications.");
  }

  return payload.applications as ApplicationRecord[];
}

export async function saveApplicationRecord(input: Omit<ApplicationRecord, "createdAt" | "updatedAt"> & { id?: string }) {
  const now = new Date().toISOString();
  const application = {
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  };
  const clientId = getClientId();
  const response = await fetch("/api/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail(),
      "X-FokalView-Client-ID": clientId
    },
    body: JSON.stringify({
      consent: true,
      consentVersion: "ferpa-minimum-necessary-v1",
      application
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not save application.");
  }

  return { ...application, syncedAt: payload.syncedAt } as ApplicationRecord;
}

export async function updateApplicationStatus(id: string, status: string) {
  const clientId = getClientId();
  const response = await fetch("/api/applications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail(),
      "X-FokalView-Client-ID": clientId
    },
    body: JSON.stringify({ id, status })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not update application.");
  }

  return payload as { ok: boolean; id: string; status: string; updatedAt: string };
}

function getClientId() {
  const storageKey = "fokalview_client_id";
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const next = crypto.randomUUID();
  localStorage.setItem(storageKey, next);
  return next;
}
