import { FormEvent, useState } from "react";
import { LockKeyhole, Moon, Sun } from "lucide-react";
import { storeAccessCode, validateAccessCode } from "../services/access";
import { ProductBrand } from "../components/BrandFamily";
import PublicSiteMenu from "../components/PublicSiteMenu";

type Props = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onAccessGranted: () => void;
};

export default function WelcomeScreen({ theme, onToggleTheme, onAccessGranted }: Props) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [userPin, setUserPin] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsChecking(true);

    try {
      const trimmed = code.trim();
      const normalizedEmail = email.trim().toLowerCase();
      await validateAccessCode(trimmed, normalizedEmail, userPin);
      storeAccessCode(trimmed, normalizedEmail);
      onAccessGranted();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Access code was not accepted.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <main className="welcome-shell" data-theme={theme}>
      <PublicSiteMenu />
      <button className="theme-toggle" type="button" onClick={onToggleTheme}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <section className="welcome-panel">
        <ProductBrand product="career" />
        <p className="eyebrow">Private Beta</p>
        <h1>Career intelligence that moves with you.</h1>
        <p>
          This private beta helps students and job seekers evaluate career readiness, compare career
          materials against target opportunities, and track progress from application to interview to
          offer. Entering your access code means you accept the beta Terms and Privacy Notice.
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

          <label>
            <span>Email address <small>required for your beta PIN and saved progress</small></span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="student@example.com"
              autoComplete="email"
            />
          </label>

          <label>
            <span>
              <LockKeyhole size={16} />
              4-digit security PIN
            </span>
            <input
              value={userPin}
              onChange={(event) => setUserPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="Choose or enter 4 digits"
              autoComplete="one-time-code"
            />
            <small>First visit: choose any 4 digits. Future visits: use the same 4 digits.</small>
          </label>

          <details className="terms-panel">
            <summary>Beta Terms and Privacy Notice</summary>
            <div>
              <h2>Private Beta Terms</h2>
              <p>
                SagittaIQ is a beta tool for career readiness review, opportunity matching,
                and job-fit feedback. It provides informational suggestions only and does not guarantee
                interviews, offers, employment, legal compliance, or applicant tracking system outcomes.
              </p>

              <h2>Data Use</h2>
              <p>
                Career material text, opportunity context, generated workforce profiles, and analysis outputs are
                processed and may be retained during the beta to provide the service, support future
                review, track workforce-development progress, and improve the product.
              </p>

              <h2>Sensitive Information</h2>
              <p>
                Users should not upload Social Security numbers, financial information, health
                information, government ID numbers, passwords, private credentials, or other sensitive
                information that is not needed for resume and workforce-development review.
              </p>

              <h2>De-Identification Limits</h2>
              <p>
                Direct identifiers are removed where practical, but career history, employers, education,
                rare skills, or project details may still be unique. Do not submit information you do not
                want processed.
              </p>

              <h2>User Rights and Requests</h2>
              <p>
                Beta users may request deletion of retained beta analysis records by contacting SagittaIQ.
                Access may be limited, suspended, or revoked during the beta.
              </p>
            </div>
          </details>

          {error && <p className="error-message">{error}</p>}
          <button className="primary-button" disabled={!code.trim() || !email.trim() || userPin.length !== 4 || isChecking}>
            {isChecking ? "Checking..." : "Enter beta"}
          </button>
        </form>
      </section>
    </main>
  );
}
