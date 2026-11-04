import { useEffect, useId, useRef, useState } from "react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { downloadResumeSource, getResumeSources, type ResumeSourceRecord } from "../services/resumeSources";
import "../resume-sources.css";

type Props = {
  adminCode?: string;
  opportunityId?: string;
  heading?: string;
  refreshKey?: number;
  collapsed?: boolean;
};
type DownloadFormat = "original" | "text" | "json";

/** Scope changes remount the list, so records never survive an account or opportunity change. */
export function ResumeSourceLibrary(props: Props) {
  return <ScopedLibrary key={`${props.adminCode || "owner"}:${props.opportunityId || "all"}`} {...props} />;
}

function ScopedLibrary({ collapsed, heading = "Saved resumes", ...props }: Props) {
  const [opened, setOpened] = useState(!collapsed);
  if (collapsed) return <details className="resume-source-disclosure" onToggle={(event) => {
    if (event.currentTarget.open) setOpened(true);
  }}>
    <summary><FileText size={17} aria-hidden="true" /><span>{heading}</span></summary>
    {opened && <SourceList {...props} heading={heading} collapsed />}
  </details>;
  return <SourceList {...props} heading={heading} />;
}

function SourceList({ adminCode, opportunityId, heading, refreshKey, collapsed }: Props) {
  const headingId = useId();
  const [records, setRecords] = useState<ResumeSourceRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadStatus, setDownloadStatus] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => {
    const version = ++requestVersion.current;
    setLoading(true); setLoadingMore(false); setError(""); setRecords([]); setNextCursor(null);
    setDownloading(""); setDownloadError(""); setDownloadStatus("");
    getResumeSources({ adminCode, opportunityId }).then((result) => {
      if (version !== requestVersion.current) return;
      setRecords(result.records); setNextCursor(result.nextCursor || null);
    }).catch((reason: unknown) => {
      if (version === requestVersion.current) setError(message(reason, "Saved resumes could not load."));
    }).finally(() => {
      if (version === requestVersion.current) setLoading(false);
    });
    return () => { requestVersion.current++; };
  }, [adminCode, opportunityId, refreshKey, refresh]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const version = requestVersion.current;
    setLoadingMore(true); setError("");
    try {
      const result = await getResumeSources({ adminCode, opportunityId, cursor: nextCursor });
      if (version !== requestVersion.current) return;
      setRecords((current) => {
        const seen = new Set(current.map((record) => record.id));
        return [...current, ...result.records.filter((record) => !seen.has(record.id))];
      });
      setNextCursor(result.nextCursor || null);
    } catch (reason) {
      if (version === requestVersion.current) setError(message(reason, "More saved resumes could not load."));
    } finally {
      if (version === requestVersion.current) setLoadingMore(false);
    }
  }

  async function download(record: ResumeSourceRecord, format: DownloadFormat) {
    const version = requestVersion.current;
    setDownloading(`${record.id}:${format}`); setDownloadError(""); setDownloadStatus("");
    try {
      await downloadResumeSource(record.id, format, adminCode);
      if (version === requestVersion.current) setDownloadStatus(`Download ready: ${record.resumeLabel || record.fileName || "Saved resume"}.`);
    } catch (reason) {
      if (version === requestVersion.current) setDownloadError(message(reason, "The download could not be prepared. Please try the download again."));
    } finally {
      if (version === requestVersion.current) setDownloading("");
    }
  }

  return <section className="resume-source-library" aria-labelledby={headingId}>
    <div className="resume-source-heading">
      <div>
        <h2 id={headingId} className={collapsed ? "sr-only" : undefined}>{heading}</h2>
        <p>{adminCode ? "All retained resume versions, including uploads without a completed review." : opportunityId ? "Resume versions saved for this opportunity, even if a review did not finish." : "Your saved resume versions remain available even if a review did not finish."} Download the original file, readable text, or an AI JSON package with saved layout and position details when available.</p>
      </div>
      <button type="button" className="secondary-action" disabled={loading || loadingMore || Boolean(downloading)} onClick={() => setRefresh((value) => value + 1)} aria-label={`Refresh ${heading?.toLowerCase()}`}><RefreshCw size={16} aria-hidden="true" />Refresh</button>
    </div>
    <div aria-busy={loading || loadingMore}>
      {loading && <p role="status">Loading saved resumes…</p>}
      {error && <div className="resume-source-error" role="alert"><p>{error}</p><button type="button" className="secondary-action" disabled={loadingMore} onClick={() => nextCursor ? void loadMore() : setRefresh((value) => value + 1)}>{nextCursor ? "Retry loading more" : "Retry saved resumes"}</button></div>}
      {!loading && !error && !records.length && <p className="resume-source-empty">{opportunityId ? "No saved resume versions are linked to this opportunity yet." : "No saved resume versions yet."} New uploads and review snapshots will appear here. Earlier reviews may only have a saved analysis.</p>}
      {records.length > 0 && <>
        <p className="resume-source-count">{records.length} saved version{records.length === 1 ? "" : "s"} loaded{nextCursor ? " · More available" : ""}</p>
        <div className="resume-source-list">{records.map((record) => <SourceCard key={record.id} record={record} admin={Boolean(adminCode)} downloading={downloading} onDownload={download} />)}</div>
      </>}
      {nextCursor && <button type="button" className="secondary-action resume-source-more" disabled={loadingMore || loading} onClick={() => void loadMore()}>{loadingMore ? "Loading more resumes…" : "Load more saved resumes"}</button>}
    </div>
    {downloadError && <p className="resume-source-error" role="alert">{downloadError}</p>}
    <p className="resume-source-download-status" role="status">{downloadStatus}</p>
  </section>;
}

function SourceCard({ record, admin, downloading, onDownload }: {
  record: ResumeSourceRecord;
  admin: boolean;
  downloading: string;
  onDownload: (record: ResumeSourceRecord, format: DownloadFormat) => Promise<void>;
}) {
  const label = record.resumeLabel || record.fileName || "Saved resume";
  const position = record.position;
  const role = position?.title ?? record.targetRole;
  const context = position?.jobContext;
  const savedAt = record.savedAt || record.createdAt;
  const date = new Date(savedAt);
  const formats: { format: DownloadFormat; label: string; available: boolean }[] = [
    { format: "original", label: "Original", available: record.hasOriginal },
    { format: "text", label: "Text", available: record.hasText },
    { format: "json", label: "AI JSON", available: true }
  ];
  return <article className="resume-source-card" aria-label={label}>
    <div className="resume-source-card-heading"><h3>{label}</h3><span className="resume-source-kind">{record.sourceKind === "original" ? "Original upload" : "Review snapshot"}</span></div>
    <p className="resume-source-role">{[role, position?.company].filter(Boolean).join(" · ") || "No target position saved"}</p>
    <p className="resume-source-file">{record.fileName || "Text snapshot"}{typeof record.fileSize === "number" ? ` · ${formatSize(record.fileSize)}` : ""}{record.mimeType ? ` · ${record.mimeType}` : ""}</p>
    <p className="resume-source-date">Saved {Number.isNaN(date.getTime()) ? "date unavailable" : <time dateTime={savedAt}>{date.toLocaleString()}</time>}</p>
    {!record.hasText && <p className="resume-source-notice">{record.hasOriginal ? "Original file saved. Readable text is not available for this version." : "Readable text is not available for this version."}</p>}
    {record.warnings?.length ? <ul className="resume-source-warnings" aria-label="Extraction notes">{record.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}
    <details className="resume-source-metadata"><summary>Saved position and version details</summary><dl>
      <Metadata label="Target role" value={record.targetRole} />
      <Metadata label="Position" value={position?.title} />
      <Metadata label="Company" value={position?.company} />
      <Metadata label="Location" value={position?.location} />
      <Metadata label="Salary" value={position?.salary} />
      <Metadata label="Job URL" value={position?.url} />
      <Metadata label="Job source" value={position?.source} />
      <Metadata label="Extraction status" value={record.extractionStatus?.replaceAll("_", " ")} />
      <Metadata label="Version ID" value={record.id} />
      <Metadata label="Original version ID" value={record.originalSourceId} />
      <Metadata label="Opportunity ID" value={record.opportunityId} />
      {admin && <Metadata label="Account ID" value={record.userId} />}
    </dl>{context !== undefined && <div className="resume-source-context"><strong>Saved job description</strong><p>{context || "No description saved"}</p></div>}</details>
    <div className="resume-source-downloads">{formats.filter(({ available }) => available).map(({ format, label: action }) => <button key={format} type="button" className="secondary-action" aria-label={`Download ${action} for ${label}`} disabled={Boolean(downloading)} onClick={() => void onDownload(record, format)}><Download size={15} aria-hidden="true" />{downloading === `${record.id}:${format}` ? "Preparing…" : action}</button>)}</div>
  </article>;
}

function Metadata({ label, value }: { label: string; value?: string }) {
  return value === undefined ? null : <div><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>;
}
function message(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
