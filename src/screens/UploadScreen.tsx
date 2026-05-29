import { useRef, useState } from "react";
import { ClipboardPaste, Loader2, Upload } from "lucide-react";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import { analyzeResume, saveApplicationRecord, saveResumeRecord } from "../services/api";
import type { JobHandoff, ResumeAnalysis } from "../types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

type Props = {
  resumeText: string;
  targetRole: string;
  jobContext: string;
  jobHandoff: JobHandoff;
  onResumeTextChange: (value: string) => void;
  onTargetRoleChange: (value: string) => void;
  onJobContextChange: (value: string) => void;
  onAnalysisComplete: (analysis: ResumeAnalysis) => void;
};

export default function UploadScreen({
  resumeText,
  targetRole,
  jobContext,
  jobHandoff,
  onResumeTextChange,
  onTargetRoleChange,
  onJobContextChange,
  onAnalysisComplete
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileStatus, setFileStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

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
      setFileStatus(`Loaded ${file.name}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "That file could not be read.");
      setFileStatus(`Could not load ${file.name}`);
    }
  }

  async function submit() {
    setIsLoading(true);
    setError("");
    setSaveStatus("");
    try {
      const analysis = await analyzeResume({ resumeText, targetRole, jobContext });
      const saved = await saveResumeRecord({
        resumeText,
        targetRole,
        jobContext,
        analysis,
        retainRawResumeText: true
      });
      setSaveStatus(`Saved workforce profile ${saved.id.slice(0, 8)}.`);
      await saveApplicationFromHandoff(jobHandoff, targetRole, jobContext);
      onAnalysisComplete(analysis);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit = resumeText.trim().length >= 200 && !isLoading;

  return (
    <div className="screen upload-screen">
      <div className="screen-heading">
        <p className="eyebrow">Upload</p>
        <h2>Review a resume against a target role.</h2>
        <p>
          Paste resume text or upload a text-based resume. Jobs sent from the tracker are loaded here
          automatically and included in the artificial intelligence review.
        </p>
        <p className="format-note">
          Supported uploads: PDF, DOCX, ODT, RTF, TXT, MD, and CSV. Scanned/image PDFs may not parse correctly.
          Legacy DOC and Apple Pages files should be saved as DOCX, PDF, or RTF first.
        </p>
      </div>

      <div className="upload-grid">
        <label className="field">
          <span>Target role</span>
          <input
            value={targetRole}
            onChange={(event) => onTargetRoleChange(event.target.value)}
            placeholder="Frontend Engineer, Product Manager, Data Analyst..."
          />
        </label>

        <label className="field">
          <span>Job tracker handoff</span>
          <textarea
            className="job-context"
            value={jobContext}
            onChange={(event) => onJobContextChange(event.target.value)}
            placeholder="Send a job from the Edge extension or paste the job description here..."
          />
        </label>

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
          tabIndex={0}
        >
          <Upload size={24} />
          <strong>Drop a resume file here</strong>
          <span>PDF, DOCX, ODT, RTF, TXT, MD, and CSV are supported.</span>
          {fileStatus && <small className="file-status">{fileStatus}</small>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.odt,.rtf,.txt,.md,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/rtf,text/plain,text/markdown,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />
        </div>

        <label className="field textarea-field">
          <span>
            <ClipboardPaste size={16} />
            Resume text
          </span>
          <textarea
            value={resumeText}
            onChange={(event) => onResumeTextChange(event.target.value)}
            placeholder="Paste the resume content here..."
          />
        </label>

        <section className="storage-panel">
          <strong>Beta data use</strong>
          <p>
            Resume text, job context, generated workforce profile, and analysis results are saved
            under the beta Terms and Privacy Notice after analysis.
          </p>
        </section>
      </div>

      {error && <p className="error-message">{error}</p>}
      {saveStatus && <p className="success-message">{saveStatus}</p>}

      <div className="actions">
        <span>{resumeText.trim().length.toLocaleString()} characters ready</span>
        <button className="primary-button" disabled={!canSubmit} onClick={submit}>
          {isLoading ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
          Analyze resume
        </button>
      </div>
    </div>
  );
}

async function saveApplicationFromHandoff(jobHandoff: JobHandoff, targetRole: string, jobContext: string) {
  const title = jobHandoff.title || targetRole;
  if (!title || !jobHandoff.company) return;

  await saveApplicationRecord({
    id: stableApplicationId(jobHandoff, title),
    title,
    company: jobHandoff.company,
    location: jobHandoff.location,
    status: "Interested",
    notes: jobHandoff.notes || jobContext,
    url: jobHandoff.url,
    source: jobHandoff.source
  });
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
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) throw new Error("This DOCX file did not contain readable document text.");
  return textFromXml(documentXml, "w:t");
}

async function extractOdtText(file: File) {
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
