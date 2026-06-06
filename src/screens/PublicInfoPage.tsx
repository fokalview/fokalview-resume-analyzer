import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ProductBrand, ProductFamilyGrid } from "../components/BrandFamily";
import PublicSiteMenu from "../components/PublicSiteMenu";

type PublicPage = "about" | "how-it-works" | "data-and-privacy" | "product-family";

export default function PublicInfoPage({ page }: { page: PublicPage }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme());

  useEffect(() => {
    localStorage.setItem("sagittaiq_theme", theme);
  }, [theme]);

  return (
    <main className="public-page-shell" data-theme={theme}>
      <PublicSiteMenu />
      <button className="theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <header className="public-page-header">
        <ProductBrand product="platform" />
        <a href="/"><ArrowLeft size={16} /> Return to beta access</a>
      </header>
      <article className="public-page-content">
        {page === "about" && <AboutPage />}
        {page === "how-it-works" && <HowItWorksPage />}
        {page === "data-and-privacy" && <DataPrivacyPage />}
        {page === "product-family" && <ProductFamilyPage />}
      </article>
    </main>
  );
}

function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div className="public-page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}

function AboutPage() {
  return (
    <>
      <PageIntro eyebrow="About SagittaIQ" title="Career progress becomes workforce intelligence.">
        SagittaIQ helps individuals make stronger career decisions while helping advisors and institutions understand readiness, progress, and outcomes.
      </PageIntro>
      <PublicSections items={[
        ["For participants", "Compare career materials against target opportunities, understand readiness gaps, track applications, and keep a record of progress."],
        ["For advisors", "Spend less time repeating basic resume edits and more time supporting the people who need meaningful intervention."],
        ["For institutions", "Turn participant activity and follow-up outcomes into clearer workforce-development reporting and program intelligence."],
        ["Why it exists", "SagittaIQ was created by Mikal Brown to connect individual career support with the data workforce programs need to improve outcomes."]
      ]} />
    </>
  );
}

function HowItWorksPage() {
  return (
    <>
      <PageIntro eyebrow="How It Works" title="From one resume review to a measurable career journey.">
        SagittaIQ connects candidate actions, advisor workflows, and institutional reporting without pretending a score can guarantee employment.
      </PageIntro>
      <ol className="public-process-list">
        <li><strong>Evaluate readiness</strong><span>Compare a resume against a target job description and identify strengths, gaps, and prioritized improvements.</span></li>
        <li><strong>Take action</strong><span>Apply recommendations, save reports, and track opportunities from interest through application, interview, offer, and acceptance.</span></li>
        <li><strong>Follow progress</strong><span>Update outcomes and support needs so candidates and advisors can see what happened after the initial review.</span></li>
        <li><strong>Understand the program</strong><span>Authorized administrators review aggregate patterns such as readiness, skill gaps, opportunity activity, and outcomes.</span></li>
      </ol>
    </>
  );
}

function DataPrivacyPage() {
  return (
    <>
      <PageIntro eyebrow="Data and Privacy" title="Clear data use should be part of the product.">
        SagittaIQ collects career and progress information to provide the service and produce useful workforce intelligence. It should not collect information merely because it can.
      </PageIntro>
      <PublicSections items={[
        ["What may be processed", "Career material text, target-opportunity context, analysis results, structured career profiles, application progress, follow-up outcomes, and limited product-usage events."],
        ["Why it is used", "To save progress, improve recommendations, support career-development workflows, understand product use, and produce aggregate program reporting."],
        ["What users should avoid", "Do not upload Social Security numbers, financial information, health information, government identifiers, passwords, or unrelated sensitive information."],
        ["Important limitations", "Readiness scores are informational estimates. They do not predict hiring decisions, guarantee outcomes, or replace professional career advice."],
        ["Privacy-conscious reporting", "Institutional reporting should use role-based access, clear metric definitions, aggregate views, and small-group suppression before external sharing."]
      ]} />
    </>
  );
}

function ProductFamilyPage() {
  return (
    <>
      <PageIntro eyebrow="Product Family" title="One platform, four connected experiences.">
        Each SagittaIQ experience serves a different part of the career and workforce journey while sharing a common identity and data foundation.
      </PageIntro>
      <ProductFamilyGrid />
      <PublicSections items={[
        ["SagittaIQ Career", "The candidate workspace for readiness, resume analysis, career profiles, opportunity tracking, and progress."],
        ["SagittaIQ Workforce", "The advisor and administrator workspace for participants, interventions, follow-ups, and operational work queues."],
        ["SagittaIQ Insights", "Institutional reporting for readiness patterns, outcomes, employers, roles, salary signals, and program intelligence."],
        ["SagittaIQ Connect", "The integration and follow-up layer for progress updates, verification, browser-extension workflows, and future employer connections."]
      ]} />
    </>
  );
}

function PublicSections({ items }: { items: Array<[string, string]> }) {
  return (
    <section className="public-section-grid">
      {items.map(([title, detail]) => (
        <article key={title}>
          <h2>{title}</h2>
          <p>{detail}</p>
        </article>
      ))}
    </section>
  );
}

function getStoredTheme() {
  const saved = localStorage.getItem("sagittaiq_theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
