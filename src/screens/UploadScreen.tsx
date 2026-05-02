import { useRef, useState } from "react";
import { ClipboardPaste, Loader2, Upload } from "lucide-react";
import { analyzeResume } from "../services/api";
import type { ResumeAnalysis } from "../types";

type Props = {
  resumeText: string;
  targetRole: string;
  jobContext: string;
  onResumeTextChange: (value: string) => void;
  onTargetRoleChange: (value: string) => void;
  onJobContextChange: (value: string) => void;
  onAnalysisComplete: (analysis: ResumeAnalysis) => void;
};

export default function UploadScreen({
  resumeText,
  targetRole,
  jobContext,
  onResumeTextChange,
  onTargetRoleChange,
  onJobContextChange,
  onAnalysisComplete
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    if (!isTextLike(file)) {
      setError(
        "This build can read pasted text and plain-text files. Standard document uploads are planned next; for now, open the document and paste the resume text here."
      );
      return;
    }
    onResumeTextChange(await file.text());
  }

  async function submit() {
    setIsLoading(true);
    setError("");
    try {
      const analysis = await analyzeResume({ resumeText, targetRole, jobContext });
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
          Best resume formats are Pages, Word documents, RTF, or other standard document files. Text-based PDFs
          are acceptable, but scanned/image PDFs may not parse correctly. This local test build currently reads
          pasted text and plain-text uploads.
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
          <strong>Drop a text resume here</strong>
          <span>Best: Pages, Word, RTF, or standard document files. PDF is okay if text-based.</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pages,.doc,.docx,.rtf,.odt,.pdf,.txt,.md,.csv,application/pdf,application/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
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
      </div>

      {error && <p className="error-message">{error}</p>}

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

function isTextLike(file: File) {
  return (
    file.type.startsWith("text/") ||
    [".txt", ".md", ".csv"].some((extension) => file.name.toLowerCase().endsWith(extension))
  );
}
