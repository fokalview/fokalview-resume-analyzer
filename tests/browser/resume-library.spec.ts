import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/ui-audit.json', import.meta.url), 'utf8'));
const original = {
  id: 'source-original', resumeLabel: 'Jordan resume.pdf', sourceKind: 'original', hasOriginal: true,
  hasText: false, fileName: 'Jordan resume.pdf', fileSize: 1024, mimeType: 'application/pdf',
  createdAt: '2026-11-04T12:00:00Z', userId: 'fixture', extractionStatus: 'needs_text',
  warnings: ['This original was saved before the review completed.']
};
const snapshot = {
  id: 'source-snapshot', resumeLabel: 'Jordan · Analyst review', sourceKind: 'snapshot', hasOriginal: true,
  hasText: true, originalSourceId: original.id, fileName: 'Jordan resume.pdf', fileSize: 1024,
  mimeType: 'application/pdf', targetRole: 'Data Analyst', opportunityId: 'job1', userId: 'fixture',
  position: { title: 'Data Analyst', company: 'Saved Example Company', location: 'Boston', salary: '$70,000', url: 'https://example.test/saved-job', source: 'Careers page', jobContext: 'Saved job description, exactly as reviewed.' },
  createdAt: '2026-11-04T12:01:00Z', extractionStatus: 'complete', warnings: []
};
const packageBody = JSON.stringify({ sourceId: snapshot.id, document: { text: 'Jordan\nData analyst', blocks: [{ id: 'page1-block1', text: 'Jordan', page: 1, bbox: [10, 20, 90, 30] }] }, position: snapshot.position });

async function student(page: Page, applications: unknown[] = [], records: unknown[] = []) {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { authenticated: true, user: { id: 'fixture', email: 'fixture@example.test', emailVerified: true }, userId: 'fixture', candidateId: 'TEST' } }));
  await page.route('**/api/resume-records', route => route.fulfill({ json: { records } }));
  await page.route('**/api/applications', route => route.fulfill({ json: { applications } }));
}

async function serveDownload(route: Route) {
  const format = new URL(route.request().url()).searchParams.get('format');
  const body = format === 'json' ? packageBody : format === 'text' ? 'Jordan\nData analyst' : '%PDF-1.7\nOriginal saved bytes';
  const extension = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'pdf';
  await route.fulfill({ body, contentType: format === 'json' ? 'application/json' : format === 'text' ? 'text/plain' : 'application/pdf', headers: { 'Content-Disposition': `attachment; filename="Jordan-resume.${extension}"` } });
  return body;
}

test('saved sources remain downloadable with no completed reviews or applications', async ({ page }) => {
  await student(page);
  let listRequests = 0;
  const downloadedFormats: string[] = [];
  await page.route('**/api/resume-sources*', async route => {
    expect(route.request().headers()['x-admin-access-code']).toBeUndefined();
    const format = new URL(route.request().url()).searchParams.get('format');
    if (format) { downloadedFormats.push(format); await serveDownload(route); }
    else { listRequests++; await route.fulfill({ json: { records: [snapshot, original], nextCursor: null } }); }
  });
  await page.goto('/?view=dashboard');
  await expect(page.getByRole('heading', { name: 'Start with one resume and one job.' })).toBeVisible();
  const library = page.getByRole('region', { name: 'Saved resumes', exact: true });
  await expect(library.getByRole('article')).toHaveCount(2);
  const initialListRequests = listRequests;
  const card = library.getByRole('article', { name: snapshot.resumeLabel, exact: true });
  await card.getByText('Saved position and version details', { exact: true }).click();
  await expect(card).toContainText(snapshot.position.jobContext);
  await expect(card).toContainText(snapshot.position.salary);
  for (const [label, extension, body] of [['Original', 'pdf', '%PDF-1.7\nOriginal saved bytes'], ['Text', 'txt', 'Jordan\nData analyst'], ['AI JSON', 'json', packageBody]]) {
    const ready = page.waitForEvent('download');
    await card.getByRole('button', { name: `Download ${label} for ${snapshot.resumeLabel}`, exact: true }).click();
    const download = await ready;
    expect(download.suggestedFilename()).toBe(`Jordan-resume.${extension}`);
    expect(readFileSync((await download.path())!, 'utf8')).toBe(body);
    await expect(card.getByRole('button').first()).toBeEnabled();
  }
  expect(downloadedFormats).toEqual(['original', 'text', 'json']);
  expect(listRequests).toBe(initialListRequests);
  const unparsed = library.getByRole('article', { name: original.resumeLabel, exact: true });
  await expect(unparsed.getByRole('button', { name: /Download Original/ })).toBeVisible();
  await expect(unparsed.getByRole('button', { name: /Download Text/ })).toHaveCount(0);
  await expect(unparsed).toContainText('Readable text is not available');
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('resume library explains empty results and recovers from failed lists and downloads', async ({ page }) => {
  await student(page);
  let phase = 'empty';
  let failDownload = true;
  await page.route('**/api/resume-sources*', async route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.has('format')) {
      if (failDownload) await route.fulfill({ status: 503, json: { error: 'Download unavailable. Try again.' } });
      else await serveDownload(route);
    } else if (phase === 'failed') await route.fulfill({ status: 503, json: { error: 'Resume storage is temporarily unavailable.' } });
    else if (phase === 'empty') await route.fulfill({ json: { records: [], nextCursor: null } });
    else await route.fulfill({ json: params.get('cursor') === 'page-two' ? { records: [snapshot], nextCursor: null } : { records: [original], nextCursor: 'page-two' } });
  });
  await page.goto('/?view=dashboard');
  const library = page.getByRole('region', { name: 'Saved resumes', exact: true });
  await expect(library).toContainText('No saved resume versions yet.');
  phase = 'failed';
  await library.getByRole('button', { name: 'Refresh saved resumes', exact: true }).click();
  await expect(library.getByRole('alert')).toContainText('temporarily unavailable');
  phase = 'paged';
  await library.getByRole('button', { name: 'Retry saved resumes', exact: true }).click();
  await expect(library.getByRole('article')).toHaveCount(1);
  await library.getByRole('button', { name: 'Load more saved resumes', exact: true }).click();
  await expect(library.getByRole('article')).toHaveCount(2);
  await expect(library.getByRole('button', { name: 'Load more saved resumes', exact: true })).toHaveCount(0);
  const downloadButton = library.getByRole('article', { name: original.resumeLabel, exact: true }).getByRole('button', { name: /Download Original/ });
  await downloadButton.click();
  await expect(library.getByRole('alert')).toContainText('Download unavailable');
  failDownload = false;
  const ready = page.waitForEvent('download');
  await downloadButton.click(); await ready;
  await expect(library.getByRole('alert')).toHaveCount(0);
});

test('an opportunity loads only its linked source versions without needing a successful review', async ({ page }) => {
  await student(page, fixture.applications, []);
  const queries: string[] = [];
  await page.route('**/api/resume-sources*', async route => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params.get('opportunityId') || '');
    await route.fulfill({ json: { records: [snapshot], nextCursor: null } });
  });
  await page.goto('/?view=applications');
  const opportunity = page.locator('#opportunity-job1');
  await expect(opportunity).toBeVisible(); expect(queries).toEqual([]);
  const disclosure = opportunity.locator('.resume-source-disclosure');
  await disclosure.locator(':scope > summary').click();
  await expect(disclosure.getByRole('article', { name: snapshot.resumeLabel, exact: true })).toBeVisible();
  await expect(disclosure.getByRole('button', { name: /Download AI JSON/ })).toBeVisible();
  const loadedQueries = [...queries]; expect(loadedQueries.length).toBeGreaterThan(0);
  expect(loadedQueries.every(query => query === 'job1')).toBe(true);
  await disclosure.locator(':scope > summary').click();
  await disclosure.locator(':scope > summary').click();
  await expect(disclosure.getByRole('article')).toBeVisible(); expect(queries).toEqual(loadedQueries);
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('admin library uses admin authorization for list and download and clears on sign out', async ({ page }) => {
  const code = 'synthetic-resume-library-admin';
  const requests: Array<{ format: string | null; code?: string }> = [];
  const summary = {
    meta: { readinessThreshold: 75, lastLoadedAt: '2026-11-04T12:00:00Z' },
    totals: { resumeRecords: 0, applicationCaptures: 0, waitlistSignups: 0, interviewVolunteers: 0, pilotProspects: 0, budgetQualified: 0, uniqueUsers: 0, rawResumeRecords: 0, averageReadinessScore: 0, readinessDelta: 0 },
    systemInfo: { rawResumeRecords: 0, rawResumeRetentionRate: 0 },
    recentWaitlistSignups: [], recentResumeRecords: [], recentFollowUps: [], usageByDay: []
  };
  await page.route('**/api/admin/summary*', route => route.fulfill({ json: summary }));
  await page.route('**/api/admin/outreach', route => route.fulfill({ json: { records: [] } }));
  await page.route('**/api/admin/resume-sources*', async route => {
    const format = new URL(route.request().url()).searchParams.get('format');
    requests.push({ format, code: route.request().headers()['x-admin-access-code'] });
    if (format) await serveDownload(route);
    else await route.fulfill({ json: { records: [snapshot, original], nextCursor: null } });
  });
  await page.goto('/admin?view=applications');
  await page.getByLabel('Admin access code', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Unlock workspace', exact: true }).click();
  const library = page.getByRole('region', { name: 'Retained resumes', exact: true });
  await expect(library.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'System metadata', exact: true })).toBeVisible();
  const ready = page.waitForEvent('download');
  await library.getByRole('article', { name: snapshot.resumeLabel, exact: true }).getByRole('button', { name: /Download AI JSON/ }).click();
  expect(readFileSync((await (await ready).path())!, 'utf8')).toBe(packageBody);
  expect(requests.some(request => request.format === null)).toBe(true);
  expect(requests.some(request => request.format === 'json')).toBe(true);
  expect(requests.every(request => request.code === code)).toBe(true);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unlock workspace', exact: true })).toBeVisible();
  await expect(page.getByText(snapshot.resumeLabel, { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('fokalview_admin_access_code'))).toBeNull();
});

test('historical reports use the saved position even after the opportunity changes', async ({ page }) => {
  const run = { ...fixture.records[1], targetRole: 'Original Analyst Role', position: { title: 'Original Analyst Role', company: 'Original Company', location: '', salary: '', source: 'Saved career page' }, jobContext: 'Original job description' };
  await student(page, [{ ...fixture.applications[0], title: 'Changed Position', company: 'Changed Company', location: 'Changed Location' }], [run]);
  await page.addInitScript(() => {
    window.open = (() => ({ document: { write: (html: string) => { (window as unknown as { printedReport: string }).printedReport = html; }, close() {} }, focus() {}, print() {} })) as unknown as typeof window.open;
  });
  await page.goto('/?view=applications');
  const opportunity = page.locator('#opportunity-job1');
  await opportunity.locator('.opportunity-review-runs > summary').click();
  await opportunity.getByRole('button', { name: 'Report', exact: true }).click();
  const report = await page.evaluate(() => (window as unknown as { printedReport: string }).printedReport);
  expect(report).toContain('Original Analyst Role'); expect(report).toContain('Original Company');
  expect(report).not.toContain('Changed Position'); expect(report).not.toContain('Changed Company'); expect(report).not.toContain('Changed Location');
});
