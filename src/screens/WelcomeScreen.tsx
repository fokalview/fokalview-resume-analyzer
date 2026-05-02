import { FormEvent, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { storeAccessCode, validateAccessCode } from "../services/access";

type Props = {
  onAccessGranted: () => void;
};

export default function WelcomeScreen({ onAccessGranted }: Props) {
  const [code, setCode] = useState("");
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
          {error && <p className="error-message">{error}</p>}
          <button className="primary-button" disabled={!code.trim() || isChecking}>
            {isChecking ? "Checking..." : "Enter beta"}
          </button>
        </form>
      </section>
    </main>
  );
}
