import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductBrand, ProductFamilyGrid } from "./BrandFamily";

export default function PublicInfoDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button className="public-menu-button" type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="public-info-drawer">
        <Menu size={19} />
        About
      </button>
      {open && (
        <div className="public-drawer-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <aside id="public-info-drawer" className="public-info-drawer" role="dialog" aria-modal="true" aria-label="About SagittaIQ" onClick={(event) => event.stopPropagation()}>
            <header>
              <ProductBrand product="platform" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close about menu"><X size={20} /></button>
            </header>

            <nav aria-label="About SagittaIQ sections">
              <a href="#about-sagittaiq">About</a>
              <a href="#how-sagittaiq-works">How it works</a>
              <a href="#sagittaiq-data-use">Data use</a>
              <a href="#sagittaiq-products">Product family</a>
            </nav>

            <section id="about-sagittaiq">
              <p className="eyebrow">About SagittaIQ</p>
              <h2>Career progress becomes workforce intelligence.</h2>
              <p>SagittaIQ helps individuals improve career materials and track opportunities while helping advisors and institutions understand readiness, progress, and outcomes.</p>
            </section>

            <section id="how-sagittaiq-works">
              <h3>How it works</h3>
              <ol>
                <li>Participants compare a resume against a target opportunity.</li>
                <li>SagittaIQ identifies strengths, gaps, and prioritized improvements.</li>
                <li>Participants track applications, interviews, offers, and follow-ups.</li>
                <li>Authorized teams review aggregate readiness and outcome patterns.</li>
              </ol>
            </section>

            <section id="sagittaiq-data-use">
              <h3>What we collect and why</h3>
              <p>Career material, opportunity context, analysis results, progress updates, and limited usage events may be retained to provide saved progress, improve recommendations, and produce workforce-development reporting.</p>
              <p>SagittaIQ does not guarantee employment and is designed to support, not replace, career advisors. Users should not submit unnecessary sensitive information.</p>
            </section>

            <section id="sagittaiq-products">
              <h3>One platform, four connected experiences</h3>
              <ProductFamilyGrid />
            </section>

            <section>
              <h3>Built with a clear purpose</h3>
              <p>SagittaIQ was created by Mikal Brown to reduce repetitive resume-review work, give job seekers clearer next steps, and help workforce programs produce more useful outcome intelligence.</p>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
