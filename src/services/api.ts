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

  return payload as { ok: boolean; id: string; reportId?: string; savedAt: string };
}

export type ApplicationRecord = {
  id: string;
  applicationId?: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  status: string;
  notes: string;
  url: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
};

export type ResumeRecord = {
  id: string;
  reportId?: string;
  userId: string;
  targetRole: string;
  profile: ResumeAnalysis["profile"];
  analysis: ResumeAnalysis;
  rawResumeRetained: boolean;
  dataCategory: string;
  consentVersion: string;
  capturedAt: string;
  updatedAt: string;
};

export async function getResumeRecords() {
  const clientId = getClientId();
  const response = await fetch("/api/resume-records", {
    headers: {
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail(),
      "X-FokalView-Client-ID": clientId
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load resume history.");
  }

  return payload.records as ResumeRecord[];
}

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

export async function saveApplicationRecord(input: Omit<ApplicationRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
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

  return { ...application, applicationId: payload.applicationId, syncedAt: payload.syncedAt } as ApplicationRecord;
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

export async function deleteApplicationRecord(id: string) {
  const clientId = getClientId();
  const params = new URLSearchParams({ id });
  const response = await fetch(`/api/applications?${params}`, {
    method: "DELETE",
    headers: {
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail(),
      "X-FokalView-Client-ID": clientId
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not delete application.");
  }

  return payload as { ok: boolean };
}

export async function getCurrentUser() {
  const clientId = getClientId();
  const response = await fetch("/api/me", {
    headers: {
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail(),
      "X-FokalView-Client-ID": clientId
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not load user profile.");
  }

  return payload as { userId: string; candidateId?: string; identifierType: "email" | "client" };
}

export async function recordUserEvent(input: {
  eventType: string;
  eventSource?: string;
  pagePath?: string;
  sessionId?: string;
  durationSeconds?: number;
  campaign?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}) {
  const clientId = getClientId();
  const response = await fetch("/api/events", {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Access-Code": getStoredAccessCode(),
      "X-FokalView-User-Email": getStoredUserEmail(),
      "X-FokalView-Client-ID": clientId
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not save event.");
  }
}

export function getClientId() {
  const storageKey = "fokalview_client_id";
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;

  const next = crypto.randomUUID();
  localStorage.setItem(storageKey, next);
  return next;
}
