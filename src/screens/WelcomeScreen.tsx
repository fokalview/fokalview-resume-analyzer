import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, FileSearch, LockKeyhole, Mail, Moon, Sun, Upload } from "lucide-react";
import { validateAccessCode, type BetaAccessResult } from "../services/access";
import { ProductBrand } from "../components/BrandFamily";
import PublicSiteMenu from "../components/PublicSiteMenu";

type Props = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export default function WelcomeScreen({ theme, onToggleTheme }: Props) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [userPin, setUserPin] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [accessResult, setAccessResult] = useState<BetaAccessResult | null>(null);
  const needsAccess = new URLSearchParams(location.search).get("access") === "required";
  const [accessOpen, setAccessOpen] = useState(needsAccess || location.hash === "#beta-access-form");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsChecking(true);

    try {
      const trimmed = code.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const result = await validateAccessCode(trimmed, normalizedEmail, userPin);
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
      <section className="welcome-panel landing-panel">
        <header className="landing-header">
          <ProductBrand product="career" inverse={theme === "dark"} />
          <a className="landing-sign-in" href="/api/auth/login">Sign in to SagittaIQ <ArrowRight size={16} aria-hidden="true" /></a>
        </header>
        <div className="welcome-intro">
        <p className="eyebrow">Private Beta</p>
        <h1>Compare your resume with the job you want.</h1>
        <p>
          Find your strengths, identify gaps, and track your next opportunity.
        </p>
        <a className="primary-button landing-cta" href="#beta-access-form" aria-expanded={accessOpen} aria-controls="beta-access-panel" onClick={() => setAccessOpen(true)}>Start your resume review <ArrowRight size={18} aria-hidden="true" /></a>
        <p className="landing-access-note">Private beta · An invitation code is required.</p>
        </div>
        <section className="example-report" aria-labelledby="example-report-title">
          <div className="example-report-top"><span className="example-label">Example report</span><span>Illustrative data</span></div>
          <h2 id="example-report-title">Your next move, made clearer.</h2>
          <p className="example-role">Data Analyst · Sample role</p>
          <div className="example-score"><strong>78<span>/100</span></strong><div><b>Resume alignment</b><p>A starting point for your next revision.</p></div></div>
          <h3>Skills already showing up</h3>
          <ul className="example-skills"><li>SQL</li><li>Python</li><li>Data visualization</li></ul>
          <h3>Two ways to strengthen this resume</h3>
          <ol className="example-improvements"><li><strong>Show the outcome.</strong><span>Add a measurable result to your reporting project.</span></li><li><strong>Make your experience specific.</strong><span>Name the dashboard tools you actually used.</span></li></ol>
          <p className="example-disclaimer">This example is not an assessment of your resume. Scores guide revision; they do not predict hiring outcomes.</p>
        </section>
        <section className="landing-steps" aria-labelledby="landing-steps-title">
          <h2 id="landing-steps-title">From resume to next steps.</h2>
          <ol><li><Upload size={22} aria-hidden="true" /><div><h3>1. Add your resume</h3><p>Start with your current experience and skills.</p></div></li><li><FileSearch size={22} aria-hidden="true" /><div><h3>2. Add a job</h3><p>Bring the role you want to work toward.</p></div></li><li><CheckCircle2 size={22} aria-hidden="true" /><div><h3>3. Review your match</h3><p>See strengths, gaps, and practical improvements.</p></div></li></ol>
        </section>
        <details className="welcome-access landing-access" id="beta-access-form" open={accessOpen} onToggle={event => setAccessOpen(event.currentTarget.open)}>
        <summary>Have a beta code? Set up your access</summary>
        <div id="beta-access-panel">
        {needsAccess && <p role="alert">Please confirm your beta code and PIN on this browser, then continue to secure sign-in.</p>}
        <h2>Join the private beta</h2><p>Enter your code to request a secure account invitation. Accept it by email, then return to sign in.</p>
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
            <p>Use the email invitation to create your verified account. After accepting it, return here to sign in.</p>
            <div className="beta-confirmation-actions">
              <a className="primary-button" href="/api/auth/login">Continue to verified sign in</a>
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
              required
              autoComplete="off"
            />
          </label>

          <label>
            <span>Email address</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              aria-describedby="beta-email-help"
              required
              placeholder="student@example.com"
              autoComplete="email"
            />
            <small id="beta-email-help">Used for your invitation and saved progress.</small>
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
              required
              aria-describedby="beta-pin-help"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="Choose or enter 4 digits"
              autoComplete="one-time-code"
            />
            <small id="beta-pin-help">First visit: choose any 4 digits. Future visits: use the same 4 digits.</small>
          </label>

          <p className="access-consent">By entering the beta, you accept the Beta Terms and Privacy Notice below.</p>
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

          {error && <p role="alert" className="error-message">{error}</p>}
          <button className="primary-button" disabled={!code.trim() || !email.trim() || userPin.length !== 4 || isChecking}>
            {isChecking ? "Checking..." : "Enter beta"}
          </button>
        </form>}
        </div>
        </details>
        <div className="welcome-trust-summary">
          <span><strong>Your progress returns with you.</strong> Resume analysis and opportunity activity are saved to your beta profile.</span>
          <span><strong>Your score is guidance.</strong> It estimates alignment and never predicts a hiring decision.</span>
          <a href="/data-and-privacy">Review data and privacy details</a>
        </div>
      </section>
    </main>
  );
}
