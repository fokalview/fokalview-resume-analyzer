import type { ResumeDocument } from "../lib/resumeDocument";

export type ResumePosition = {
  title?: string; company?: string; location?: string; salary?: string;
  url?: string; source?: string; targetRole?: string; jobContext?: string;
};

export type ResumeSourceRecord = {
  id: string;
  resumeLabel: string;
  sourceKind: "original" | "snapshot";
  hasOriginal: boolean;
  hasText: boolean;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  targetRole?: string;
  position?: ResumePosition;
  opportunityId?: string;
  originalSourceId?: string;
  createdAt: string;
  savedAt?: string;
  extractionStatus?: string;
  warnings?: string[];
  userId?: string;
};

export type ResumeSnapshotInput = {
  requestId: string;
  originalSourceId?: string;
  resumeDocument: ResumeDocument;
  resumeText: string;
  targetRole: string;
  jobContext: string;
  position: ResumePosition;
  opportunityId?: string;
  resumeLabel: string;
};

const consent = { consent: true, consentVersion: "resume-source-v1" };

async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "The saved resume could not be accessed. Please retry.");
  return payload;
}

export async function saveOriginalResume(file: File, requestId: string): Promise<ResumeSourceRecord> {
  const body = new FormData();
  body.set("file", file);
  body.set("requestId", requestId);
  body.set("consent", "true");
  body.set("consentVersion", consent.consentVersion);
  return readResponse(await fetch("/api/resume-sources", { method: "POST", body }));
}

export async function saveResumeSnapshot(input: ResumeSnapshotInput): Promise<ResumeSourceRecord> {
  return readResponse(await fetch("/api/resume-sources", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, ...consent })
  }));
}

export async function getResumeSources(options: { adminCode?: string; opportunityId?: string; cursor?: string } = {}): Promise<{ records: ResumeSourceRecord[]; nextCursor?: string | null }> {
  const query = new URLSearchParams();
  if (options.opportunityId) query.set("opportunityId", options.opportunityId);
  if (options.cursor) query.set("cursor", options.cursor);
  const endpoint = options.adminCode ? "/api/admin/resume-sources" : "/api/resume-sources";
  return readResponse(await fetch(`${endpoint}${query.size ? `?${query}` : ""}`, {
    headers: options.adminCode ? { "X-Admin-Access-Code": options.adminCode } : undefined,
    cache: "no-store"
  }));
}

export async function downloadResumeSource(id: string, format: "json" | "text" | "original", adminCode?: string): Promise<void> {
  const endpoint = adminCode ? "/api/admin/resume-sources" : "/api/resume-sources";
  const response = await fetch(`${endpoint}?${new URLSearchParams({ id, format })}`, {
    headers: adminCode ? { "X-Admin-Access-Code": adminCode } : undefined, cache: "no-store"
  });
  if (!response.ok) { await readResponse(response); return; }
  const disposition = response.headers.get("Content-Disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let filename = disposition.match(/filename="([^"]+)"/i)?.[1] || `resume-${id}.${format === "json" ? "json" : format === "text" ? "txt" : "bin"}`;
  if (encoded) { try { filename = decodeURIComponent(encoded); } catch { /* Keep safe fallback. */ } }
  filename = filename.replace(/[\x00-\x1f\x7f\\/]/g, "_").slice(0, 180);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
