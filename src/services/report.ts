import type { ApplicationRecord } from "./api";
import type { JobHandoff, ResumeAnalysis } from "../types";

type ReportInput = {
  analysis?: ResumeAnalysis | null;
  job?: Partial<JobHandoff>;
  applications?: ApplicationRecord[];
  title?: string;
};

type ReportData = {
  analysis: ResumeAnalysis | null;
  job: Partial<JobHandoff>;
  applications: ApplicationRecord[];
  title: string;
};

export function downloadResumeReport({ analysis, job = {}, applications = [], title = "SagittaIQ report" }: ReportInput) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return;

  reportWindow.document.write(reportHtml({ analysis: analysis ?? null, job, applications, title }));
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function reportHtml({ analysis, job, applications, title }: ReportData) {
  const currentAnalysis = analysis || null;
  const matched = currentAnalysis?.keywordAnalysis?.matched || [];
  const missing = currentAnalysis?.keywordAnalysis?.missing || [];
  const improvements = currentAnalysis?.improvements || [];
  const strengths = currentAnalysis?.strengths || [];
  const sections = currentAnalysis?.sections || [];
  const reportSections = currentAnalysis ? `
    <section class="report-section">
      <div class="section-kicker">Section 1</div>
      <h2>Readiness Overview</h2>
      <p class="section-intro">A summary of the evidence supporting the candidate's fit and the readiness of each resume category.</p>
      <div class="grid">
        <article class="card">
          <h3>Evidence Supporting Fit</h3>
          <ul>${strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No strengths recorded.</li>"}</ul>
        </article>
        <article class="card">
          <h3>Readiness by Category</h3>
          <div class="category-list">
            ${sections.map((item) => `
              <div class="category">
                <div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.score)}%</span></div>
                <p>${escapeHtml(item.note)}</p>
              </div>
            `).join("") || "<p>No category scores recorded.</p>"}
          </div>
        </article>
      </div>
    </section>

    <section class="report-section page-break">
      <div class="section-kicker">Section 2</div>
      <h2>Priority Actions</h2>
      <p class="section-intro">Recommended improvements ordered by impact. Changes should always truthfully reflect the candidate's experience.</p>
      <div class="recommendations">
        ${improvements.map((item, index) => `
          <article class="recommendation">
            <span>${index + 1}</span>
            <div>
              <small class="priority ${item.priority.toLowerCase()}">${escapeHtml(item.priority)} priority</small>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.detail)}</p>
            </div>
          </article>
        `).join("") || "<p>No improvements recorded.</p>"}
      </div>
    </section>

    <section class="report-section page-break">
      <div class="section-kicker">Section 3</div>
      <h2>Opportunity Alignment</h2>
      <p class="section-intro">Terms demonstrated in the career materials and gaps the candidate should evaluate honestly against the target opportunity.</p>
      <div class="grid">
        <article class="card aligned">
          <h3>Demonstrated Alignment</h3>
          <ul>${matched.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No matched terms recorded.</li>"}</ul>
        </article>
        <article class="card gaps">
          <h3>Gaps to Evaluate</h3>
          <ul>${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No missing terms recorded.</li>"}</ul>
        </article>
      </div>
    </section>
  ` : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Inter, Arial, sans-serif; color: #18202a; margin: 36px; }
      h1 { font-size: 32px; line-height: 1.08; margin: 0 0 8px; }
      h2 { margin: 5px 0 8px; font-size: 22px; }
      h3 { margin: 0 0 8px; font-size: 14px; }
      p, li, td, th { line-height: 1.45; font-size: 13px; }
      .summary { color: #50606f; font-size: 15px; }
      .score { display: inline-block; margin: 18px 0; padding: 10px 14px; border-radius: 8px; background: #e6f4f1; color: #0f766e; font-size: 24px; font-weight: 800; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      .card { border: 1px solid #d8e0e8; border-radius: 8px; padding: 14px; }
      .report-section { margin-top: 30px; }
      .section-kicker { color: #0f766e; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
      .section-intro { max-width: 720px; margin: 0 0 15px; color: #50606f; }
      .category-list { display: grid; gap: 11px; }
      .category { padding-bottom: 9px; border-bottom: 1px solid #d8e0e8; }
      .category:last-child { border-bottom: 0; }
      .category > div { display: flex; justify-content: space-between; gap: 12px; }
      .category span { color: #0f766e; font-size: 12px; font-weight: 800; }
      .category p { margin: 4px 0 0; color: #50606f; font-size: 11px; }
      .recommendations { display: grid; gap: 10px; }
      .recommendation { display: grid; grid-template-columns: 28px 1fr; gap: 10px; break-inside: avoid; padding: 13px; border: 1px solid #d8e0e8; border-radius: 8px; }
      .recommendation > span { display: grid; width: 25px; height: 25px; place-items: center; border-radius: 50%; background: #e6f4f1; color: #0f766e; font-size: 11px; font-weight: 800; }
      .recommendation h3 { margin: 5px 0 3px; }
      .recommendation p { margin: 0; color: #50606f; }
      .priority { color: #50606f; font-size: 9px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
      .priority.high { color: #b42318; }
      .priority.medium { color: #8a5d00; }
      .aligned { border-top: 4px solid #0f766e; }
      .gaps { border-top: 4px solid #b7791f; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #d8e0e8; padding: 8px; text-align: left; }
      th { background: #eef2f5; }
      .tracker-section { margin-top: 30px; }
      @media print {
        button { display: none; }
        body { margin: 24px; }
        .page-break { break-before: page; }
        .card, .category, .recommendation { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Print or save as PDF</button>
    <h1>${escapeHtml(title)}</h1>
    <p class="summary">${escapeHtml(jobSummary(job))}</p>
    ${currentAnalysis ? `<div class="score">${currentAnalysis.score}% career readiness</div><p>${escapeHtml(currentAnalysis.summary)}</p>` : ""}
    ${reportSections}
    ${applications.length ? `
      <section class="tracker-section page-break">
        <div class="section-kicker">Opportunity tracker</div>
        <h2>Tracked Opportunities</h2>
        <table>
          <thead><tr><th>Role</th><th>Company</th><th>Salary</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${applications.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.company)}</td><td>${escapeHtml(item.salary)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(formatDate(item.createdAt))}</td></tr>`).join("")}
          </tbody>
        </table>
      </section>
    ` : ""}
  </body>
</html>`;
}

function jobSummary(job: Partial<JobHandoff>) {
  return [job.title || job.targetRole, job.company, job.location, job.salary, job.source].filter(Boolean).join(" | ");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}
