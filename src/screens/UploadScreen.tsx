import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardPaste, Loader2, Search, Upload } from "lucide-react";
import { analyzeResume, getApplications, saveApplicationRecord, saveResumeRecord, type ApplicationRecord } from "../services/api";
import type { JobHandoff, ResumeAnalysis } from "../types";
import { InlineNotice, PageHeader } from "../components/ExperienceUI";

type Props = {
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
  const [resumeLabel, setResumeLabel] = useState("");
  const [savedOpportunities, setSavedOpportunities] = useState<ApplicationRecord[]>([]);
  const [opportunitySearch, setOpportunitySearch] = useState("");
  const [opportunitySearchOpen, setOpportunitySearchOpen] = useState(false);

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
    setResumeLabel("");
    setFileStatus("");
  }, [opportunity?.id]);

  const filteredOpportunities = useMemo(() => {
    const query = opportunity && opportunitySearch === opportunityLabel(opportunity)
      ? ""
      : opportunitySearch.trim().toLowerCase();
    if (!query) return savedOpportunities;
    return savedOpportunities.filter((item) =>
      [item.title, item.company, item.location, item.status].some((value) => value?.toLowerCase().includes(query))
    );
  }, [opportunity, opportunitySearch, savedOpportunities]);

  async function handleFile(file: File) {
    setError("");
    setFileStatus(`Reading ${file.name}...`);

    try {
      const extractedText = await extractTextFromFile(file);

      if (extractedText.trim().length < 50) {
        setError(
          "The file opened, but I could not find enough readable text. If it is scanned or image-based, paste the resume text or export it as a text-based PDF/DOCX."
        );
        setFileStatus(`Could not read enough text from ${file.name}`);
        return;
      }

      onResumeTextChange(extractedText);
      setResumeLabel(file.name);
      setFileStatus(`Loaded ${file.name}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "That file could not be read.");
      setFileStatus(`Could not load ${file.name}`);
    }
  }

  async function submit() {
    setIsLoading(true);setStage("Preparing your review…");
    setError("");
    setSaveStatus("");
    try {
      const existingOpportunity = opportunity || await findExistingOpportunity(jobHandoff, targetRole, jobContext);
      setStage("Comparing your resume…");
      const analysis = await analyzeResume({
        resumeText,
        targetRole,
        jobContext,
        jobQualifications: existingOpportunity?.jobQualifications,
        scoreHistory: existingOpportunity?.analysisHistory?.map(({ score, scoringVersion, analyzedAt }) => ({
          score,
          scoringVersion,
          analyzedAt
        }))
      });
      setStage("Saving your review…");
      try {
      const application = await saveApplicationFromHandoff(jobHandoff, targetRole, jobContext, analysis, opportunity);
      const saved = await saveResumeRecord({
        resumeText,
        targetRole,
        jobContext,
        analysis,
        retainRawResumeText: true,
        opportunityId: application?.id,
        resumeLabel: resumeLabel || defaultResumeLabel(targetRole)
      });
      setSaveStatus(application
        ? `Updated readiness history for ${application.title}.`
        : `Saved workforce profile ${saved.id.slice(0, 8)}.`);
      onAnalysisComplete(analysis, undefined, saved.id, application);
      } catch {
        onAnalysisComplete(analysis, "Your review is ready, but saving did not finish. Download this report now to keep a copy; it may not appear in your saved history.");
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit = resumeText.trim().length >= 200 && jobContext.trim().length >= 40 && !isLoading;

  return (
    <div className="screen upload-screen">
      <PageHeader
        eyebrow={opportunity ? "Rerun saved opportunity" : "New readiness review"}
        title={opportunity ? `Upload a revised resume for ${opportunity.title}.` : "Compare your resume with a job."}
        description={opportunity
          ? "The saved job description and qualification rubric will be reused. Upload the revised resume to create a separate dated review run."
          : "Add your resume and the job description. SagittaIQ will identify demonstrated strengths, important gaps, and the next improvements worth making."}
        meta={<span>PDF, DOCX, ODT, RTF, TXT, MD, and CSV supported</span>}
      />

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

      <div className="upload-grid review-input-panels">
        <section className="review-input-panel" aria-labelledby="resume-input-title"><h2 id="resume-input-title">1. Your resume</h2><p>Upload a file or paste your resume below.</p>
        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          role="button"
          aria-label="Upload career materials"
          onKeyDown={event => {if(event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {event.preventDefault();fileInputRef.current?.click();}}}
          tabIndex={0}
        >
          <Upload size={24} />
          <strong>Upload career materials</strong>
          <span>PDF, DOCX, ODT, RTF, TXT, MD, and CSV are supported.</span>
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
            Resume text
          </span>
          <textarea
            value={resumeText}
            onChange={(event) => onResumeTextChange(event.target.value)}
            placeholder="Paste the resume or career material content here..."
          />
        </label>

        </section>
        <section className="review-input-panel" aria-labelledby="job-input-title"><h2 id="job-input-title">2. Target job</h2><p>Add the role and posting you want to compare.</p>
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

        </section>
      </div>
        <InlineNotice title="How your review is stored">
          Your resume text, job details, and review are saved under the beta Terms and Privacy Notice.
        </InlineNotice>

      {error && <p role="alert" className="error-message">{error}</p>}
      {saveStatus && <p className="success-message">{saveStatus}</p>}

      <p role="status">{isLoading ? stage : "To compare: add at least 200 characters of resume text and 40 characters of job description."}</p>
      <div className="actions">
        <span>{resumeText.trim().length.toLocaleString()} characters ready</span>
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
  const parsedJob = parseJobContext(jobContext);
  const title = targetRole || parsedJob.title || jobHandoff.title;
  const company = parsedJob.company || jobHandoff.company || "Not specified";
  if (!title) return undefined;
  const id = stableApplicationId({ ...jobHandoff, company }, title);
  return (await getApplications().catch(() => [])).find((item) => item.id === id);
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
  const title = selectedOpportunity?.title || targetRole || jobHandoff.title || parsedJob.title || jobDetails?.title;
  const company = selectedOpportunity?.company || jobHandoff.company || parsedJob.company || jobDetails?.company || "Not specified";
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

function isTextLike(file: File) {
  return (
    file.type.startsWith("text/") ||
    [".txt", ".md", ".csv"].some((extension) => file.name.toLowerCase().endsWith(extension))
  );
}

async function extractTextFromFile(file: File) {
  const name = file.name.toLowerCase();

  if (isTextLike(file)) return file.text();
  if (isRtf(file)) return stripRtf(await file.text());
  if (name.endsWith(".pdf") || file.type === "application/pdf") return extractPdfText(file);
  if (name.endsWith(".docx")) return extractDocxText(file);
  if (name.endsWith(".odt")) return extractOdtText(file);

  if (name.endsWith(".doc")) {
    throw new Error(
      "Legacy .doc files are not browser-readable in this beta. Save the document as .docx, PDF, or RTF and upload again."
    );
  }

  if (name.endsWith(".pages")) {
    throw new Error(
      "Apple Pages files need to be exported as PDF, DOCX, or RTF before upload."
    );
  }

  throw new Error("Please upload a PDF, DOCX, ODT, RTF, TXT, MD, or CSV file.");
}

async function extractPdfText(file: File) {
  const data = await file.arrayBuffer();
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
    );
  }

  return pages.join("\n\n").trim();
}

async function extractDocxText(file: File) {
  const {default: JSZip} = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) throw new Error("This DOCX file did not contain readable document text.");
  return textFromXml(documentXml, "w:t");
}

async function extractOdtText(file: File) {
  const {default: JSZip} = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("content.xml")?.async("text");
  if (!documentXml) throw new Error("This ODT file did not contain readable document text.");
  return textFromXml(documentXml, "text:p");
}

function isRtf(file: File) {
  return (
    file.type === "application/rtf" ||
    file.type === "text/rtf" ||
    file.name.toLowerCase().endsWith(".rtf")
  );
}

function stripRtf(value: string) {
  return value
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textFromXml(xml: string, tagName: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml, "application/xml");
  const nodes = Array.from(document.getElementsByTagName(tagName));
  return nodes
    .map((node) => node.textContent || "")
    .join(tagName === "text:p" ? "\n" : " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
