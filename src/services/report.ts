import type { ApplicationRecord } from "./api";
import type { JobHandoff, ResumeAnalysis } from "../types";

type ReportInput = {
  analysis?: ResumeAnalysis | null;
  job?: Partial<JobHandoff>;
  applications?: ApplicationRecord[];
  title?: string;
};

export function downloadResumeReport({ analysis, job = {}, applications = [], title = "FokalView report" }: ReportInput) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return;

  reportWindow.document.write(reportHtml({ analysis, job, applications, title }));
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function reportHtml({ analysis, job, applications, title }: Required<ReportInput>) {
  const matched = analysis?.keywordAnalysis?.matched || [];
  const missing = analysis?.keywordAnalysis?.missing || [];
  const improvements = analysis?.improvements || [];
  const strengths = analysis?.strengths || [];

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #18202a; margin: 36px; }
      h1 { font-size: 34px; margin: 0 0 8px; }
      h2 { margin: 28px 0 10px; font-size: 18px; }
      p, li, td, th { line-height: 1.45; font-size: 13px; }
      .summary { color: #50606f; font-size: 15px; }
      .score { display: inline-block; margin: 18px 0; padding: 10px 14px; border-radius: 8px; background: #e6f4f1; color: #0f766e; font-size: 24px; font-weight: 800; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      .card { border: 1px solid #d8e0e8; border-radius: 8px; padding: 14px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #d8e0e8; padding: 8px; text-align: left; }
      th { background: #eef2f5; }
      @media print { button { display: none; } body { margin: 24px; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Print or save as PDF</button>
    <h1>${escapeHtml(title)}</h1>
    <p class="summary">${escapeHtml(jobSummary(job))}</p>
    ${analysis ? `<div class="score">${analysis.score}% resume readiness</div><p>${escapeHtml(analysis.summary)}</p>` : ""}
    <div class="grid">
      <section class="card">
        <h2>Strengths</h2>
        <ul>${strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No strengths recorded.</li>"}</ul>
      </section>
      <section class="card">
        <h2>Recommended Improvements</h2>
        <ul>${improvements.map((item) => `<li><strong>${escapeHtml(item.priority)}:</strong> ${escapeHtml(item.title)} - ${escapeHtml(item.detail)}</li>`).join("") || "<li>No improvements recorded.</li>"}</ul>
      </section>
      <section class="card">
        <h2>Matched Keywords</h2>
        <ul>${matched.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No matched keywords recorded.</li>"}</ul>
      </section>
      <section class="card">
        <h2>Missing Keywords</h2>
        <ul>${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No missing keywords recorded.</li>"}</ul>
      </section>
    </div>
    <h2>Applications</h2>
    <table>
      <thead><tr><th>Role</th><th>Company</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>
        ${applications.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.company)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(formatDate(item.createdAt))}</td></tr>`).join("") || "<tr><td colspan='4'>No applications recorded.</td></tr>"}
      </tbody>
    </table>
  </body>
</html>`;
}

function jobSummary(job: Partial<JobHandoff>) {
  return [job.title || job.targetRole, job.company, job.location, job.source].filter(Boolean).join(" | ");
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
