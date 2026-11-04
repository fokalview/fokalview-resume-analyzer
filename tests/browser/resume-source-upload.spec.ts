import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ResumeSnapshotInput, ResumeSourceRecord } from '../../src/services/resumeSources';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/ui-audit.json', import.meta.url), 'utf8'));
const resumeText = ['Jordan Example', 'Data analyst with five years of SQL and Python experience.', 'Built reliable reporting pipelines for operations and finance.', 'Collaborated with product teams to improve data quality.', 'Documented dashboards and trained colleagues to use reports.', 'Delivered clear analysis and measurable reporting improvements.'].join('\n');
const jobContext = 'Title: Data Analyst\nCompany: Northstar Synthetic\nLocation: Boston\nSalary: $70,000\nSource: Careers page\nJob URL: https://example.test/analyst\nBuild reliable reporting using SQL and Python, and explain findings to partners.';

async function uploadHarness(page: Page) {
  const state = {
    failOriginal: false, failSnapshot: false, failAnalysis: false,
    waitForOriginal: undefined as Promise<void> | undefined,
    originalRequests: [] as Array<{ requestId: string; bytes: Buffer }>,
    snapshots: [] as ResumeSnapshotInput[],
    analysisRequests: [] as Array<{ sourceId: string; resumeText: string }>,
    reportRequests: [] as Array<{ sourceId: string }>,
    records: new Map<string, ResumeSourceRecord>(),
    packages: new Map<string, ResumeSnapshotInput>(),
    originals: new Map<string, Buffer>(),
    requestIds: new Map<string, string>(),
    applications: [] as Array<Record<string, unknown>>,
    events: [] as string[]
  };
  await page.route('**/api/auth/session', route => route.fulfill({ json: { authenticated: true, user: { id: 'fixture', email: 'fixture@example.test', emailVerified: true }, userId: 'fixture', candidateId: 'TEST' } }));
  await page.route('**/api/applications', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { applications: state.applications } });
    const application = route.request().postDataJSON().application;
    state.applications = [...state.applications.filter(item => item.id !== application.id), application];
    state.events.push('application-saved');
    await route.fulfill({ json: { id: application.id, applicationId: 'APP-SYNTHETIC', syncedAt: new Date().toISOString() } });
  });
  await page.route('**/api/resume-records', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { records: [] } });
    const input = route.request().postDataJSON();
    state.reportRequests.push(input); state.events.push('analysis-report-saved');
    await route.fulfill({ json: { ok: true, id: 'review-synthetic', savedAt: new Date().toISOString() } });
  });
  await page.route('**/api/analyze', async route => {
    const input = route.request().postDataJSON();
    state.analysisRequests.push(input); state.events.push('analysis-started');
    expect(state.records.has(input.sourceId), 'AI analysis must reference a successfully saved source').toBe(true);
    expect(state.packages.get(input.sourceId)?.resumeText).toBe(input.resumeText);
    await route.fulfill(state.failAnalysis ? { status: 503, json: { error: 'Synthetic analysis service is unavailable.' } } : { json: fixture.records[1].analysis });
  });
  await page.route('**/api/resume-sources*', async route => {
    const request = route.request();
    expect(request.headers()['x-admin-access-code']).toBeUndefined();
    if (request.method() === 'POST') {
      if (request.headers()['content-type'].startsWith('multipart/form-data')) {
        const body = request.postDataBuffer()!;
        const text = body.toString('utf8');
        const requestId = text.match(/name="requestId"\r\n\r\n([^\r]+)/)![1];
        const boundary = request.headers()['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/)!;
        const fileHeader = body.indexOf(Buffer.from('name="file"; filename="'));
        const start = body.indexOf(Buffer.from('\r\n\r\n'), fileHeader) + 4;
        const end = body.indexOf(Buffer.from(`\r\n--${boundary[1] || boundary[2]}`), start);
        const bytes = body.subarray(start, end);
        const fileName = text.match(/name="file"; filename="([^"]+)"/)![1];
        state.originalRequests.push({ requestId, bytes });
        if (state.waitForOriginal) await state.waitForOriginal;
        if (state.failOriginal) return route.fulfill({ status: 503, json: { error: 'Original storage unavailable. Retry the upload.' } });
        const id = state.requestIds.get(requestId) || `original-${state.originals.size + 1}`;
        const record: ResumeSourceRecord = { id, sourceKind: 'original', hasOriginal: true, hasText: false, resumeLabel: fileName, fileName, fileSize: bytes.length, mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain', createdAt: new Date().toISOString() };
        state.originals.set(id, bytes); state.records.set(id, record); state.requestIds.set(requestId, id);
        state.events.push('original-saved');
        return route.fulfill({ json: record });
      }
      const input: ResumeSnapshotInput = request.postDataJSON();
      state.snapshots.push(input);
      if (state.failSnapshot) return route.fulfill({ status: 503, json: { error: 'Structured resume storage unavailable. Retry saving.' } });
      const id = state.requestIds.get(input.requestId) || `snapshot-${state.packages.size + 1}`;
      const original = input.originalSourceId ? state.records.get(input.originalSourceId) : undefined;
      const record: ResumeSourceRecord = { id, sourceKind: 'snapshot', hasOriginal: Boolean(original), hasText: Boolean(input.resumeText), resumeLabel: input.resumeLabel, originalSourceId: input.originalSourceId, fileName: original?.fileName, fileSize: original?.fileSize, mimeType: original?.mimeType, targetRole: input.targetRole, position: input.position, opportunityId: input.opportunityId, createdAt: new Date().toISOString(), extractionStatus: input.resumeDocument.source.status, warnings: input.resumeDocument.source.warnings };
      state.packages.set(id, input); state.records.set(id, record); state.requestIds.set(input.requestId, id);
      state.events.push(`snapshot-saved:${id}`);
      return route.fulfill({ json: record });
    }
    const params = new URL(request.url()).searchParams;
    const id = params.get('id'); const format = params.get('format');
    if (!id || !format) return route.fulfill({ json: { records: [...state.records.values()].reverse().filter(record => !params.get('opportunityId') || record.opportunityId === params.get('opportunityId')), nextCursor: null } });
    const record = state.records.get(id)!;
    const input = state.packages.get(id);
    const body = format === 'original' ? state.originals.get(record.originalSourceId || id)! : format === 'text' ? input!.resumeText : JSON.stringify({ schemaVersion: 'sagittaiq-resume-archive-v1', ...record, ...input });
    const extension = format === 'original' ? record.fileName!.split('.').at(-1) : format === 'text' ? 'txt' : 'json';
    await route.fulfill({ body, contentType: format === 'original' ? record.mimeType : format === 'json' ? 'application/json' : 'text/plain', headers: { 'Content-Disposition': `attachment; filename="saved-resume.${extension}"` } });
  });
  return state;
}

async function enterJob(page: Page) {
  await page.goto('/?view=upload');
  await page.getByLabel('Target opportunity', { exact: true }).fill('Data Analyst');
  await page.getByLabel('Job description', { exact: true }).fill(jobContext);
}

test('upload saves original bytes and a position snapshot before AI analysis starts', async ({ page }) => {
  const state = await uploadHarness(page);
  await enterJob(page);
  await page.getByLabel('Choose resume file', { exact: true }).setInputFiles({ name: 'Jordan.txt', mimeType: 'text/plain', buffer: Buffer.from(resumeText) });
  await expect(page.getByLabel('Career material text')).toHaveValue(resumeText);
  await expect(page.getByText('Original and structured copy of Jordan.txt saved.', { exact: true })).toBeVisible();
  expect(state.originalRequests[0].bytes.toString('utf8')).toBe(resumeText);
  expect(state.analysisRequests).toHaveLength(0);
  expect(state.snapshots[0].resumeDocument.text).toBe(resumeText);
  expect(state.snapshots[0].position).toMatchObject({ title: 'Data Analyst', company: 'Northstar Synthetic', location: 'Boston', salary: '$70,000' });
  await page.getByRole('button', { name: 'Analyze career readiness', exact: true }).click();
  await expect(page.getByRole('heading', { name: '72% alignment with Data Analyst', exact: true })).toBeVisible();
  const input = state.analysisRequests[0];
  expect(state.events.indexOf('original-saved')).toBeLessThan(state.events.indexOf(`snapshot-saved:${input.sourceId}`));
  expect(state.events.indexOf(`snapshot-saved:${input.sourceId}`)).toBeLessThan(state.events.indexOf('analysis-started'));
  expect(state.events.indexOf('application-saved')).toBeLessThan(state.events.indexOf('analysis-started'));
  expect(state.reportRequests[0].sourceId).toBe(input.sourceId);
  expect(state.packages.get(input.sourceId)?.opportunityId).toBe(state.applications[0].id);
});

test('an unconfirmed original blocks analysis and retry reuses the upload request ID', async ({ page }) => {
  const state = await uploadHarness(page); state.failOriginal = true;
  await enterJob(page);
  await page.getByLabel('Career material text').fill(resumeText);
  await page.getByLabel('Choose resume file', { exact: true }).setInputFiles({ name: 'Jordan.txt', mimeType: 'text/plain', buffer: Buffer.from(resumeText) });
  await expect(page.getByRole('alert')).toContainText('Original storage unavailable');
  await expect(page.getByRole('button', { name: 'Analyze career readiness', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save resume', exact: true })).toBeDisabled();
  expect(state.analysisRequests).toHaveLength(0); expect(state.records.size).toBe(0);
  state.failOriginal = false;
  await page.getByRole('button', { name: 'Retry original upload', exact: true }).click();
  await expect(page.getByText('Original and structured copy of Jordan.txt saved.', { exact: true })).toBeVisible();
  expect(state.originalRequests).toHaveLength(2);
  expect(state.originalRequests[1].requestId).toBe(state.originalRequests[0].requestId);
  expect(state.originalRequests[1].bytes.equals(state.originalRequests[0].bytes)).toBe(true);
  await expect(page.getByRole('button', { name: 'Analyze career readiness', exact: true })).toBeEnabled();
});

test('a failed structured save blocks analysis while the original remains downloadable', async ({ page }) => {
  const state = await uploadHarness(page); state.failSnapshot = true;
  await enterJob(page);
  await page.getByLabel('Choose resume file', { exact: true }).setInputFiles({ name: 'Jordan.txt', mimeType: 'text/plain', buffer: Buffer.from(resumeText) });
  await expect(page.getByRole('alert')).toContainText('Structured resume storage unavailable');
  await page.getByRole('button', { name: 'Analyze career readiness', exact: true }).click();
  await expect.poll(() => state.snapshots.length).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: 'Analyze career readiness', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toContainText('Structured resume storage unavailable');
  expect(state.analysisRequests).toHaveLength(0); expect(state.packages.size).toBe(0);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  const library = page.getByRole('region', { name: 'Saved resumes', exact: true });
  await expect(library.getByRole('article')).toHaveCount(1);
  const ready = page.waitForEvent('download');
  await library.getByRole('button', { name: 'Download Original for Jordan.txt', exact: true }).click();
  expect(readFileSync((await (await ready).path())!, 'utf8')).toBe(resumeText);
});

test('edited PDF text drops old geometry and stays downloadable after analysis failure', async ({ page }) => {
  const state = await uploadHarness(page); state.failAnalysis = true;
  const originalPdf = makePdfResume();
  await enterJob(page);
  await page.getByLabel('Choose resume file', { exact: true }).setInputFiles({ name: 'Jordan.pdf', mimeType: 'application/pdf', buffer: originalPdf });
  await expect(page.getByText('Original and structured copy of Jordan.pdf saved.', { exact: true })).toBeVisible({ timeout: 15000 });
  const firstDocument = state.snapshots[0].resumeDocument;
  expect(firstDocument.pages).toHaveLength(1);
  expect(firstDocument.blocks.some(block => block.geometry !== null)).toBe(true);
  const editedText = `${firstDocument.text}\nNew verified achievement: reduced monthly reporting time by two hours.`;
  await page.getByLabel('Career material text').fill(editedText);
  await page.getByLabel('Resume or run name').fill('Edited analyst resume');
  const previousSnapshots = state.snapshots.length;
  await page.getByRole('button', { name: 'Save resume', exact: true }).click();
  await expect.poll(() => state.snapshots.length).toBeGreaterThan(previousSnapshots);
  await expect(page.locator('.success-message[data-source-id]')).toContainText('Resume version saved.');
  const edited = state.snapshots.at(-1)!;
  expect(edited.resumeText).toBe(editedText); expect(edited.originalSourceId).toBe('original-1');
  expect(edited.resumeDocument.pages).toEqual([]);
  expect(edited.resumeDocument.blocks.every(block => block.geometry === null && block.page === null)).toBe(true);
  expect(edited.resumeDocument.source.warnings.join(' ')).toContain('edited after extraction');
  expect(state.analysisRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Analyze career readiness', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your resume source is saved');
  await expect(page.getByRole('alert')).toContainText('Synthetic analysis service is unavailable');
  const savedId = state.analysisRequests[0].sourceId;
  expect(state.packages.get(savedId)?.resumeText).toBe(editedText);
  expect(state.reportRequests).toHaveLength(0);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  const card = page.getByRole('region', { name: 'Saved resumes', exact: true }).getByRole('article', { name: 'Edited analyst resume', exact: true }).first();
  await card.getByText('Saved position and version details', { exact: true }).click();
  await expect(card.getByText(savedId, { exact: true })).toBeVisible();
  let ready = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Download AI JSON for Edited analyst resume', exact: true }).click();
  const packageDownload = await ready;
  const stored = JSON.parse(readFileSync((await packageDownload.path())!, 'utf8'));
  expect(stored.resumeText).toBe(editedText); expect(stored.resumeDocument.pages).toEqual([]);
  expect(stored.position.company).toBe('Northstar Synthetic'); expect(stored.opportunityId).toBe(state.applications[0].id);
  ready = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Download Original for Edited analyst resume', exact: true }).click();
  expect(readFileSync((await (await ready).path())!).equals(originalPdf)).toBe(true);
});

test('returning from Dashboard preserves the uploaded PDF source and layout for analysis', async ({ page }) => {
  const state = await uploadHarness(page);
  await enterJob(page);
  await page.getByLabel('Choose resume file', { exact: true }).setInputFiles({ name: 'Jordan.pdf', mimeType: 'application/pdf', buffer: makePdfResume() });
  await expect(page.getByText('Original and structured copy of Jordan.pdf saved.', { exact: true })).toBeVisible({ timeout: 15000 });
  const initial = state.snapshots[0];
  expect(initial.resumeDocument.blocks.some(block => block.geometry !== null)).toBe(true);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved resumes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume review', exact: true }).click();
  await expect(page.getByLabel('Career material text')).toHaveValue(initial.resumeText);
  await page.getByRole('button', { name: 'Analyze career readiness', exact: true }).click();
  await expect(page.getByRole('heading', { name: '72% alignment with Data Analyst', exact: true })).toBeVisible();
  const reviewed = state.packages.get(state.analysisRequests[0].sourceId)!;
  expect(reviewed.originalSourceId).toBe(initial.originalSourceId);
  expect(reviewed.resumeDocument.pages).toEqual(initial.resumeDocument.pages);
  expect(reviewed.resumeDocument.blocks).toEqual(initial.resumeDocument.blocks);
  expect(state.originalRequests).toHaveLength(1);
});

test('a delayed upload cannot overwrite a different opportunity draft after navigation', async ({ page }) => {
  const state = await uploadHarness(page);
  let releaseOriginal!: () => void;
  state.waitForOriginal = new Promise<void>(resolve => { releaseOriginal = resolve; });
  state.applications = [{ ...fixture.applications[1], title: 'Second Opportunity', company: 'Second Synthetic Company' }];
  await enterJob(page);
  await page.getByLabel('Choose resume file', { exact: true }).setInputFiles({ name: 'Old-draft.txt', mimeType: 'text/plain', buffer: Buffer.from(resumeText) });
  await expect.poll(() => state.originalRequests.length).toBe(1);
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'Opportunities', exact: true }).click();
  const opportunity = page.locator('#opportunity-job2');
  await opportunity.locator('.opportunity-review-runs > summary').click();
  await opportunity.getByRole('button', { name: 'Rerun with revised resume', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Upload a revised resume for Second Opportunity.', exact: true })).toBeVisible();
  const replacement = `${resumeText}\nThis newer draft belongs only to the second opportunity.`;
  await page.getByLabel('Career material text').fill(replacement);
  releaseOriginal();
  await expect.poll(() => state.originals.size).toBe(1);
  // Settle the delayed fetch and any parser continuation before checking for stale writes.
  await page.waitForLoadState('networkidle');
  await expect(page.getByLabel('Career material text')).toHaveValue(replacement);
  await expect(page.getByLabel('Target opportunity', { exact: true })).toHaveValue('Second Opportunity');
  await page.getByRole('button', { name: 'Save resume', exact: true }).click();
  await expect.poll(() => state.snapshots.some(input => input.resumeText === replacement)).toBe(true);
  const current = state.snapshots.findLast(input => input.resumeText === replacement)!;
  expect(current.opportunityId).toBe('job2');
  expect(current.originalSourceId).toBeUndefined();
  expect(current.position.company).toBe('Second Synthetic Company');
  expect(current.resumeDocument.pages).toEqual([]);
});

test('a manually entered new job does not inherit metadata from an earlier imported job', async ({ page }) => {
  const state = await uploadHarness(page);
  const previous = new URLSearchParams({ view: 'upload', jobTitle: 'Imported Job A', company: 'Old Imported Company', location: 'Old Imported City', salary: '$222,000', jobUrl: 'https://old.example.test/position-a', source: 'Old imported board' });
  await page.goto(`/?${previous}`);
  await expect(page.getByLabel('Target opportunity', { exact: true })).toHaveValue('Imported Job A');
  await page.getByLabel('Target opportunity', { exact: true }).fill('New Manual Job B');
  await page.getByRole('textbox', { name: 'Job description', exact: true }).fill('This new role needs SQL analysis, clear communication, and reliable reporting. No employer, location, salary or posting URL is supplied.');
  await page.getByLabel('Career material text').fill(resumeText);
  await page.getByRole('button', { name: 'Save resume', exact: true }).click();
  await expect.poll(() => state.snapshots.length).toBeGreaterThan(0);
  expect(state.snapshots.at(-1)!.position).toMatchObject({ title: 'New Manual Job B', company: '', location: '', salary: '', url: '', source: '' });
  await page.getByRole('button', { name: 'Analyze career readiness', exact: true }).click();
  await expect(page.getByRole('heading', { name: '72% alignment with New Manual Job B', exact: true })).toBeVisible();
  const reviewed = state.packages.get(state.analysisRequests[0].sourceId)!;
  expect(reviewed.position).toMatchObject({ title: 'New Manual Job B', location: '', salary: '', url: '', source: '' });
  expect(JSON.stringify(reviewed.position)).not.toContain('Old Imported');
  expect(JSON.stringify(state.applications)).not.toContain('Old Imported');
  expect(JSON.stringify(state.applications)).not.toContain('old.example.test');
});

/** Small real PDF exercises browser extraction rather than mocking page geometry. */
function makePdfResume() {
  const lines = resumeText.split('\n');
  const stream = `BT\n/F1 12 Tf\n50 750 Td\n18 TL\n${lines.map((line, index) => `${index ? 'T*\n' : ''}(${line.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj`).join('\n')}\nET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const startXref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
