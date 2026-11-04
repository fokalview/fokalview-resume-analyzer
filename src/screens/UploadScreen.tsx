import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardPaste, Loader2, Search, Upload } from "lucide-react";
import { analyzeResume, getApplications, saveApplicationRecord, saveResumeRecord, type ApplicationRecord } from "../services/api";
import type { JobHandoff, ResumeAnalysis } from "../types";
import { InlineNotice, PageHeader } from "../components/ExperienceUI";
import { documentFromText, extractResumeDocument, RESUME_LIMITS, type ResumeDocument } from "../lib/resumeDocument";
import { saveOriginalResume, saveResumeSnapshot, type ResumeSourceRecord, type ResumeSnapshotInput, type ResumePosition } from "../services/resumeSources";

export type ResumeDraft = {
  document: ResumeDocument | null;
  originalSourceId: string;
  label: string;
  pendingFile: { file: File; requestId: string } | null;
};

type Props = {
  draft: ResumeDraft;
  onDraftChange: (update: (current: ResumeDraft) => ResumeDraft) => void;
  resumeText: string;
  targetRole: string;
  jobContext: string;
  jobHandoff: JobHandoff;
  opportunity?: ApplicationRecord | null;
  onOpportunitySelect: (opportunity: ApplicationRecord | null) => void;
  onResumeTextChange: (value: string) => void;
  onTargetRoleChange: (value: string) => void;
  onJobContextChange: (value: string) => void;
  onAnalysisComplete: (analysis: ResumeAnalysis, warning?: string, reportId?: string, opportunity?: ApplicationRecord | null) => void;
};

export default function UploadScreen({
  draft, onDraftChange,
  resumeText,
  targetRole,
  jobContext,
  jobHandoff,
  opportunity,
  onOpportunitySelect,
  onResumeTextChange,
  onTargetRoleChange,
  onJobContextChange,
  onAnalysisComplete
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [opportunityRetry, setOpportunityRetry] = useState(0);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  const [opportunityError, setOpportunityError] = useState("");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const resumeLabel = draft.label;
  const setResumeLabel = (label: string) => onDraftChange(current => ({ ...current, label }));
  const [savedOpportunities, setSavedOpportunities] = useState<ApplicationRecord[]>([]);
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [opportunitySearchOpen, setOpportunitySearchOpen] = useState(false);
  const sourceDocument = draft.document;
  const originalSourceId = draft.originalSourceId;
  const pendingFile = draft.pendingFile;
  const setSourceDocument = (document: ResumeDocument | null) => onDraftChange(current => ({ ...current, document }));
  const setOriginalSourceId = (id: string) => onDraftChange(current => ({ ...current, originalSourceId: id }));
  const setPendingFile = (value: ResumeDraft["pendingFile"]) => onDraftChange(current => ({ ...current, pendingFile: value }));
  const [sourceSaving, setSourceSaving] = useState(false);
  const [savedSource, setSavedSource] = useState<ResumeSourceRecord | null>(null);
  const snapshotAttempt = useRef<{ signature: string; input: ResumeSnapshotInput; record?: ResumeSourceRecord } | null>(null);
  const operation = useRef(0);
  useEffect(() => { operation.current++; return () => { operation.current++; }; }, [opportunity?.id]);

  useEffect(() => {
    let active = true;
    setOpportunitiesLoading(true);setOpportunityError("");
    void getApplications().then(items => {if(active)setSavedOpportunities(items);})
      .catch(() => {if(active)setOpportunityError("Saved opportunities could not load. Retry or enter a new job below.");})
      .finally(() => {if(active)setOpportunitiesLoading(false);});
    return () => {active=false;};
  }, [opportunityRetry]);

  useEffect(() => {
    setOpportunitySearch(opportunity ? opportunityLabel(opportunity) : "");
    setFileStatus("");
    setSavedSource(null); setSaveStatus("");
    snapshotAttempt.current = null;
  }, [opportunity?.id]);

  useEffect(() => { setSaveStatus(""); }, [resumeText, targetRole, jobContext, resumeLabel]);

  const filteredOpportunities = useMemo(() => {
    const query = opportunity && opportunitySearch === opportunityLabel(opportunity)
      ? ""
      : opportunitySearch.trim().toLowerCase();
    if (!query) return savedOpportunities;
    return savedOpportunities.filter((item) =>
      [item.title, item.company, item.location, item.status].some((value) => value?.toLowerCase().includes(query))
    );
  }, [opportunity, opportunitySearch, savedOpportunities]);

  async function preserveSource(options: { text?: string; document?: ResumeDocument | null; originalId?: string; label?: string; application?: ApplicationRecord | null } = {}) {
    const text = options.text ?? resumeText;
    const originalId = options.originalId ?? originalSourceId;
    const extracted = options.document === undefined ? sourceDocument : options.document;
    const application = options.application === undefined ? opportunity : options.application;
    const label = options.label ?? (resumeLabel || defaultResumeLabel(targetRole));
    const position = snapshotPosition(jobHandoff, targetRole, jobContext, application);
    const signature = JSON.stringify({ text, originalId, extracted, label, targetRole, jobContext, position, opportunityId: application?.id || "" });
    if (snapshotAttempt.current?.signature !== signature) {
      const document = extracted && extracted.text === text ? extracted : documentFromText(text);
      if (originalId && document !== extracted) {
        document.source.warnings = [...document.source.warnings, "The text was edited after extraction. This version retains the original file, but page positions are unavailable for the edited text."];
      }
      snapshotAttempt.current = { signature, input: {
        requestId: crypto.randomUUID(), originalSourceId: originalId || undefined,
        resumeDocument: document, resumeText: text, targetRole, jobContext,
        position, opportunityId: application?.id, resumeLabel: label
      } };
    }
    const attempt = snapshotAttempt.current;
    const record = attempt.record || await saveResumeSnapshot(attempt.input);
    attempt.record = record;
    setSavedSource(record);
    setSaveStatus("Resume version saved. Its text, available layout and job context can be downloaded from Saved resumes.");
    return record;
  }

  async function handleFile(file: File, requestId: string = crypto.randomUUID()) {
    if (sourceSaving || isLoading) return;
    const currentOperation = operation.current;
    setError("");
    setSaveStatus(""); setSourceSaving(true);
    setPendingFile({ file, requestId });
    setFileStatus(`Saving original ${file.name}…`);
    try {
      if (file.size > RESUME_LIMITS.maxFileBytes) throw new Error("Choose a resume file no larger than 10 MiB.");
      const original = await saveOriginalResume(file, requestId);
      if (operation.current !== currentOperation) return;
      setOriginalSourceId(original.id); setPendingFile(null); setSavedSource(original);
      setResumeLabel(file.name);
      setFileStatus(`Original ${file.name} saved. Reading document structure…`);
      setSourceDocument(null); onResumeTextChange(""); snapshotAttempt.current = null;
      const document = await extractResumeDocument(file);
      if (operation.current !== currentOperation) return;
      setSourceDocument(document); onResumeTextChange(document.text);
      await preserveSource({ text: document.text, document, originalId: original.id, label: file.name });
      setFileStatus(document.source.status === "needs_text"
        ? `Original ${file.name} saved. Add readable text to run an analysis.`
        : `Original and structured copy of ${file.name} saved.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The resume could not be saved. Please retry.");
      setFileStatus(current => current.startsWith("Original ") ? `${current.split(". Reading")[0]}. Extraction or structured saving did not finish; the original remains in Saved resumes.` : `Original ${file.name} has not been confirmed saved.`);
    } finally { setSourceSaving(false); }
  }

  async function saveSourceOnly() {
    if (sourceSaving || isLoading || pendingFile) return;
    setError(""); setSaveStatus(""); setSourceSaving(true);
    try { await preserveSource(); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "The resume could not be saved. Please retry."); }
    finally { setSourceSaving(false); }
  }

  async function submit() {
    if (sourceSaving || pendingFile) return;
    const currentOperation = operation.current;
    setIsLoading(true);setStage("Saving your resume source…");
    setError(""); setSaveStatus("");
    let source: ResumeSourceRecord | undefined;
    try {
      source = await preserveSource();
      if (operation.current !== currentOperation) return;
      const existingOpportunity = opportunity || await findExistingOpportunity(jobHandoff, targetRole, jobContext);
      if (operation.current !== currentOperation) return;
      source = await preserveSource({ application: existingOpportunity });
      if (operation.current !== currentOperation) return;
      const application = existingOpportunity || await saveOpportunityBeforeAnalysis(jobHandoff, targetRole, jobContext).catch(() => null);
      if (operation.current !== currentOperation) return;
      source = await preserveSource({ application });
      if (operation.current !== currentOperation) return;
      setStage("Resume saved. Comparing your resume…");
      const analysis = await analyzeResume({
        sourceId: source.id, resumeText, targetRole, jobContext,
        jobQualifications: existingOpportunity?.jobQualifications,
        scoreHistory: existingOpportunity?.analysisHistory?.map(({ score, scoringVersion, analyzedAt }) => ({ score, scoringVersion, analyzedAt }))
      });
      if (operation.current !== currentOperation) return;
      setStage("Saving your review…");
      let updatedApplication: ApplicationRecord | null = application || null;
      let applicationWarning = application ? "" : "Opportunity saving did not finish. Your resume version remains available in Saved resumes.";
      if (application) {
        try { updatedApplication = await saveApplicationFromHandoff(jobHandoff, targetRole, jobContext, analysis, application); }
        catch { applicationWarning = "Opportunity saving did not finish. Your resume version remains available in Saved resumes."; }
      }
      if (operation.current !== currentOperation) return;
      try {
        const saved = await saveResumeRecord({ sourceId: source.id, resumeText, targetRole, jobContext, analysis,
          retainRawResumeText: true, opportunityId: application?.id, resumeLabel: resumeLabel || defaultResumeLabel(targetRole) });
        if (operation.current === currentOperation) onAnalysisComplete(analysis, applicationWarning || undefined, saved.id, updatedApplication);
      } catch {
        if (operation.current === currentOperation) onAnalysisComplete(analysis, "Your resume source version is saved. Saving the analysis report did not finish; download this report to keep the feedback.", undefined, updatedApplication);
      }
    } catch (nextError) {
      const reason = nextError instanceof Error ? nextError.message : "Something went wrong.";
      setError(source ? `Your resume source is saved and remains available in Saved resumes. ${reason}` : reason);
    } finally {
      setIsLoading(false);
    }
  }

  const busy = isLoading || sourceSaving;
  const canSubmit = resumeText.trim().length >= 200 && jobContext.trim().length >= 40 && !busy && !pendingFile;

  return (
    <div className="screen upload-screen">
      <PageHeader
        eyebrow={opportunity ? "Rerun saved opportunity" : "New readiness review"}
        title={opportunity ? `Upload a revised resume for ${opportunity.title}.` : "Compare your career materials with one opportunity."}
        description={opportunity
          ? "The saved job description and qualification rubric will be reused. Upload the revised resume to create a separate dated review run."
          : "Add your resume and the job description. SagittaIQ will identify demonstrated strengths, important gaps, and the next improvements worth making."}
        meta={<span>PDF, DOCX, ODT, RTF, TXT, MD, and CSV supported</span>}
      />

      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-label="Resume and opportunity details">
      {opportunityError && <div><p role="alert">{opportunityError}</p><button className="secondary-action" onClick={()=>setOpportunityRetry(value=>value+1)}>Retry saved opportunities</button></div>}
      {opportunitiesLoading && <p role="status">Loading saved opportunities…</p>}
      <section className="saved-opportunity-search">
        <div>
          <span className="eyebrow">Saved opportunity search</span>
          <h3>Review or rerun a previous job</h3>
          <p>Search a job you already reviewed to reuse its description, qualification rubric, and prior metrics.</p>
        </div>
        <div className="opportunity-combobox">
          <label htmlFor="saved-opportunity-search">Saved opportunity</label>
          <div className="opportunity-search-input">
            <Search size={17} />
            <input
              id="saved-opportunity-search"
              aria-label="Search saved opportunities"
              aria-expanded={opportunitySearchOpen}
              aria-controls="saved-opportunity-options"
              onKeyDown={event => {if(event.key === "Escape") setOpportunitySearchOpen(false);}}
              value={opportunitySearch}
              onFocus={() => setOpportunitySearchOpen(true)}
              onChange={(event) => {
                setOpportunitySearch(event.target.value);
                setOpportunitySearchOpen(true);
              }}
              placeholder="Search by job title, company, location, or status..."
            />
            <button type="button" aria-label="Show saved opportunities" onClick={() => setOpportunitySearchOpen((open) => !open)}>
              <ChevronDown size={17} />
            </button>
          </div>
          {opportunitySearchOpen && (
            <div className="opportunity-search-options" id="saved-opportunity-options">
              <button
                type="button"

                aria-pressed={!opportunity}
                onClick={() => {
                  onOpportunitySelect(null);
                  setOpportunitySearch("");
                  setOpportunitySearchOpen(false);
                }}
              >
                <span><strong>Start a new opportunity</strong><small>Enter a new job description and create its baseline.</small></span>
                {!opportunity && <Check size={16} />}
              </button>
              {filteredOpportunities.map((item) => (
                <button
                  type="button"

                  aria-pressed={opportunity?.id === item.id}
                  key={item.id}
                  onClick={() => {
                    onOpportunitySelect(item);
                    setOpportunitySearch(opportunityLabel(item));
                    setOpportunitySearchOpen(false);
                    setResumeLabel("");
                    setFileStatus("");
                  }}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.company} - {item.status} - {item.analysisCount || 0} review{item.analysisCount === 1 ? "" : "s"}
                      {item.lastAnalyzedAt ? ` - last reviewed ${shortDate(item.lastAnalyzedAt)}` : ""}
                    </small>
                  </span>
                  <span className="opportunity-search-metric">
                    {typeof item.latestReadinessScore === "number" ? `${item.latestReadinessScore}%` : "Not scored"}
                  </span>
                </button>
              ))}
              {!filteredOpportunities.length && <p>No saved opportunities match this search.</p>}
            </div>
          )}
        </div>
      </section>

      <ol className="workflow-steps" aria-label="Readiness review steps">
        <li className={resumeText.trim().length >= 200 ? "complete" : "active"}><span>1</span><strong>Add career materials</strong></li>
        <li className={jobContext.trim() ? "complete" : resumeText.trim().length >= 200 ? "active" : ""}><span>2</span><strong>Add opportunity</strong></li>
        <li className={resumeText.trim().length >= 200 && jobContext.trim() ? "active" : ""}><span>3</span><strong>Run readiness review</strong></li>
      </ol>

      <div className="upload-grid">
        <label className="field">
          <span>Target opportunity</span>
          <input
            value={targetRole}
            onChange={(event) => onTargetRoleChange(event.target.value)}
            placeholder="Frontend Engineer, Product Manager, Data Analyst..."
          />
        </label>

        <label className="field">
          <span>Job description</span>
          <textarea
            className="job-context"
            value={jobContext}
            onChange={(event) => onJobContextChange(event.target.value)}
            placeholder="Paste the job description here or send one from the SagittaIQ Chrome extension..."
          />
        </label>

        <div
          className="dropzone"
          onClick={() => { if (!busy) fileInputRef.current?.click(); }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          role="button"
          aria-disabled={busy}
          aria-label="Upload career materials"
          onKeyDown={event => {if(!busy && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault();fileInputRef.current?.click();}}}
          tabIndex={busy ? -1 : 0}
        >
          <Upload size={24} />
          <strong>Upload career materials</strong>
          <span>PDF, DOCX, ODT, RTF, TXT, MD, and CSV. Maximum 10 MiB.</span>
          {fileStatus && <small role="status" className="file-status">{fileStatus}</small>}
          <input
            ref={fileInputRef}
            aria-label="Choose resume file"
            type="file"
            accept=".pdf,.docx,.odt,.rtf,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/rtf,text/plain,text/markdown,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
        </div>

        <label className="field">
          <span>Resume or run name</span>
          <input
            value={resumeLabel}
            onChange={(event) => setResumeLabel(event.target.value)}
            placeholder="Example: GE Vernova PM Resume v3"
          />
        </label>

        <label className="field textarea-field">
          <span>
            <ClipboardPaste size={16} />
            Career material text
          </span>
          <textarea
            value={resumeText}
            onChange={(event) => onResumeTextChange(event.target.value)}
            placeholder="Paste the resume or career material content here..."
          />
        </label>

        <InlineNotice title="Keep a saved resume copy">
          Uploading saves the original file. Save resume or Analyze career readiness saves a version of your text, available layout and job details before analysis starts. You and authorized admins can download saved copies. Editing this form does not save another version until you select Save resume or Analyze. Removing a review or opportunity does not remove its retained resume; you may request deletion under the Privacy Notice.
        </InlineNotice>
      </div>
      </fieldset>

      {error && <p role="alert" className="error-message">{error}</p>}
      {saveStatus && <p role="status" className="success-message" data-source-id={savedSource?.id}>{saveStatus}</p>}
      {pendingFile && !busy && <button className="secondary-action" onClick={() => void handleFile(pendingFile.file, pendingFile.requestId)}>Retry original upload</button>}
      {pendingFile && !busy && <button className="secondary-action" onClick={() => {
        setPendingFile(null); setOriginalSourceId(""); setSourceDocument(null); setSavedSource(null);
        setFileStatus(""); setError(""); setSaveStatus(""); snapshotAttempt.current = null;
      }}>Use pasted text instead</button>}

      <p role="status">{isLoading ? stage : sourceSaving ? "Saving your resume copy…" : "To compare: add at least 200 characters of resume text and 40 characters of job description. You can save a resume without running an analysis."}</p>
      <div className="actions">
        <span>{resumeText.trim().length.toLocaleString()} characters ready</span>
        <button className="secondary-action" disabled={busy || Boolean(pendingFile) || (!resumeText.trim() && !originalSourceId)} onClick={() => void saveSourceOnly()}>
          Save resume
        </button>
        <button className="primary-button" disabled={!canSubmit} onClick={submit}>
          {isLoading ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
          Analyze career readiness
        </button>
      </div>
    </div>
  );
}

function opportunityLabel(opportunity: ApplicationRecord) {
  return [opportunity.title, opportunity.company].filter(Boolean).join(" at ");
}

function defaultResumeLabel(targetRole: string) {
  return `${targetRole || "Career readiness"} - ${new Date().toLocaleDateString()}`;
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

async function findExistingOpportunity(jobHandoff: JobHandoff, targetRole: string, jobContext: string) {
  const position = snapshotPosition(jobHandoff, targetRole, jobContext);
  const title = position.title || "Untitled opportunity";
  const company = position.company || "Not specified";
  const id = stableApplicationId({ ...jobHandoff, url: position.url || "", company }, title);
  return (await getApplications()).find((item) => item.id === id);
}

function snapshotPosition(handoff: JobHandoff, targetRole: string, jobContext: string, application?: ApplicationRecord | null): ResumePosition {
  const parsed = parseJobContext(jobContext);
  return {
    title: targetRole || parsed.title || (application?.title !== "Untitled opportunity" ? application?.title : "") || handoff.title || "",
    company: parsed.company || (application?.company !== "Not specified" ? application?.company : "") || handoff.company || "",
    location: parsed.location || application?.location || handoff.location || "",
    salary: parsed.salary || application?.salary || handoff.salary || "",
    url: parsed.url || application?.url || handoff.url || "",
    source: parsed.source || application?.source || handoff.source || "",
    targetRole, jobContext
  };
}

async function saveOpportunityBeforeAnalysis(handoff: JobHandoff, targetRole: string, jobContext: string) {
  const position = snapshotPosition(handoff, targetRole, jobContext);
  const title = position.title || "Untitled opportunity";
  const company = position.company || "Not specified";
  return saveApplicationRecord({
    id: stableApplicationId({ ...handoff, url: position.url || "", company }, title),
    title, company, location: position.location || "", salary: position.salary || "",
    status: "Interested", jobDescription: jobContext, notes: handoff.notes || "",
    url: position.url || "", source: position.source || ""
  });
}

async function saveApplicationFromHandoff(
  jobHandoff: JobHandoff,
  targetRole: string,
  jobContext: string,
  analysis: ResumeAnalysis,
  selectedOpportunity?: ApplicationRecord | null
) {
  const parsedJob = parseJobContext(jobContext);
  const jobDetails = analysis.jobDetails;
  const title = (selectedOpportunity?.title !== "Untitled opportunity" ? selectedOpportunity?.title : "") || targetRole || jobHandoff.title || parsedJob.title || jobDetails?.title;
  const company = (selectedOpportunity?.company !== "Not specified" ? selectedOpportunity?.company : "") || jobHandoff.company || parsedJob.company || jobDetails?.company || "Not specified";
  const salary = selectedOpportunity?.salary || jobHandoff.salary || parsedJob.salary || jobDetails?.salary;
  if (!title) return null;
  const id = selectedOpportunity?.id || stableApplicationId({ ...jobHandoff, company }, title);
  const existing = selectedOpportunity || (await getApplications().catch(() => [])).find((item) => item.id === id);

  return saveApplicationRecord({
    id,
    title,
    company,
    location: existing?.location || jobHandoff.location || parsedJob.location || jobDetails?.location || "",
    salary: existing?.salary || salary || "",
    status: existing?.status || "Interested",
    jobDescription: jobContext,
    jobQualifications: existing?.jobQualifications || analysis.jobQualifications,
    notes: existing?.notes || jobHandoff.notes,
    url: existing?.url || jobHandoff.url || parsedJob.url || jobDetails?.sourceUrl || "",
    source: existing?.source || jobHandoff.source || parsedJob.source || sourceFromUrl(jobDetails?.sourceUrl),
    latestReadinessScore: analysis.score,
    latestAnalysis: analysis,
    analysisHistory: existing?.analysisHistory,
    analysisCount: existing?.analysisCount,
    lastAnalyzedAt: new Date().toISOString()
  });
}

function sourceFromUrl(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function parseJobContext(jobContext: string) {
  const lines = jobContext
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const valueFor = (label: string) => {
    const match = lines.find((line) => line.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    return match ? match.slice(match.indexOf(":") + 1).trim() : "";
  };

  return {
    title: valueFor("Job title") || valueFor("Title"),
    company: valueFor("Company"),
    location: valueFor("Location"),
    salary: valueFor("Salary") || valueFor("Compensation") || valueFor("Pay"),
    url: valueFor("Job URL") || valueFor("URL"),
    source: valueFor("Source")
  };
}

function stableApplicationId(jobHandoff: JobHandoff, title: string) {
  const seed = `${jobHandoff.url || ""}|${jobHandoff.company || ""}|${title}`.toLowerCase();
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `job-${hash.toString(16)}`;
}
