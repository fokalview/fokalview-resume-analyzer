import { FormEvent, useState } from "react";
import { CheckCircle2, LockKeyhole, Mail, Moon, Sun } from "lucide-react";
import { storeAccessCode, validateAccessCode, type BetaAccessResult } from "../services/access";
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
  const [accessResult, setAccessResult] = useState<BetaAccessResult | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsChecking(true);

    try {
      const trimmed = code.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const result = await validateAccessCode(trimmed, normalizedEmail, userPin);
      storeAccessCode(trimmed, normalizedEmail);
      if (result.invitation.status === "account_exists") {
        window.location.assign("/api/auth/login");
        return;
      }
      setAccessResult(result);
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
        <div className="welcome-trust-summary">
          <span><strong>Your progress returns with you.</strong> Resume analysis and opportunity activity are saved to your beta profile.</span>
          <span><strong>Your score is guidance.</strong> It estimates alignment and never predicts a hiring decision.</span>
          <a href="/data-and-privacy">Review data and privacy details</a>
        </div>

        <a className="authkit-signin-button" href="/api/auth/login">
          <LockKeyhole size={17} />
          Sign in with verified account
        </a>
        <div className="access-divider" role="separator">
          <span>or use the temporary beta access</span>
        </div>

        {accessResult ? (
          <section className="beta-invitation-confirmation" aria-live="polite">
            <CheckCircle2 size={28} />
            <h2>Beta access approved</h2>
            {accessResult.invitation.status === "invitation_sent" && (
              <p><Mail size={17} /> A verified-account invitation was sent to <strong>{email}</strong>.</p>
            )}
            {accessResult.invitation.status === "invitation_pending" && (
              <p><Mail size={17} /> Your verified-account invitation is already waiting in <strong>{email}</strong>.</p>
            )}
            {accessResult.invitation.status === "failed" && (
              <p>The beta is available now, but the verified-account invitation could not be sent yet.</p>
            )}
            {accessResult.invitation.status === "unavailable" && (
              <p>The beta is available now. Verified-account invitations are temporarily unavailable.</p>
            )}
            <p>Use the email invitation to create your verified account, or continue into the temporary beta now.</p>
            <div className="beta-confirmation-actions">
              <button className="primary-button" type="button" onClick={onAccessGranted}>Continue to beta</button>
              <a href="/api/auth/login">Sign in to verified account</a>
            </div>
          </section>
        ) : <form className="access-form" onSubmit={submit}>
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
        </form>}
      </section>
    </main>
  );
}
