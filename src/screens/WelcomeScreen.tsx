import { FormEvent, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { storeAccessCode, validateAccessCode } from "../services/access";

type Props = {
  onAccessGranted: () => void;
};

export default function WelcomeScreen({ onAccessGranted }: Props) {
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsChecking(true);

    try {
      const trimmed = code.trim();
      await validateAccessCode(trimmed);
      storeAccessCode(trimmed);
      onAccessGranted();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Access code was not accepted.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <main className="welcome-shell">
      <section className="welcome-panel">
        <div className="welcome-mark">
          <Sparkles size={28} />
        </div>
        <p className="eyebrow">Private Beta</p>
        <h1>FokalView Resume Readiness Lab</h1>
        <p>
          This beta is invite-only while we tune the resume analysis, keyword matching, and job tracker
          handoff. Enter your access code to continue.
        </p>

        <form className="access-form" onSubmit={submit}>
          <label>
            <span>
              <LockKeyhole size={16} />
              Access code
            </span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter beta code"
              autoComplete="off"
            />
          </label>

          <label className="terms-check">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              I agree to the beta Terms and Privacy Notice, including de-identified analysis use,
              no guarantee of job outcomes, and no upload of sensitive information I do not want processed.
            </span>
          </label>

          <details className="terms-panel">
            <summary>Beta Terms and Privacy Notice</summary>
            <div>
              <h2>Private Beta Terms</h2>
              <p>
                FokalView Resume Readiness Lab is a beta tool for resume review, ATS keyword matching,
                and job-fit feedback. It provides informational suggestions only and does not guarantee
                interviews, offers, employment, legal compliance, or applicant tracking system outcomes.
              </p>

              <h2>Data Use</h2>
              <p>
                Resume text, job context, and analysis inputs are processed to generate feedback. During
                the beta, FokalView may retain de-identified analysis data such as target roles,
                qualifications, skill keywords, matched/missing terms, score ranges, and improvement
                categories to improve the product.
              </p>

              <h2>Information We Avoid Keeping</h2>
              <p>
                FokalView does not intentionally retain names, email addresses, phone numbers, street
                addresses, uploaded resume files, or full raw resume text for analytics. Users should not
                upload Social Security numbers, financial information, health information, or other
                sensitive personal data.
              </p>

              <h2>De-Identification Limits</h2>
              <p>
                Direct identifiers are removed where practical, but career history, employers, education,
                rare skills, or project details may still be unique. Do not submit information you do not
                want processed.
              </p>

              <h2>User Rights and Requests</h2>
              <p>
                Beta users may request deletion of retained beta analysis records by contacting FokalView.
                Access may be limited, suspended, or revoked during the beta.
              </p>
            </div>
          </details>

          {error && <p className="error-message">{error}</p>}
          <button className="primary-button" disabled={!code.trim() || !acceptedTerms || isChecking}>
            {isChecking ? "Checking..." : "Enter beta"}
          </button>
        </form>
      </section>
    </main>
  );
}
