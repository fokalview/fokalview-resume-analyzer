import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { adminCode, requireLocal, unlockWorkspace, seedContact, assertNoHorizontalOverflow } from './support/admin-workspace';

// Deterministic UI edge cases layered onto a real local API schema. Backend
// correctness is exercised separately by SQLite-backed regression tests.
async function mockWorkspace(page: Page, request: APIRequestContext) {
  const contact = await seedContact(request, { name: 'Clarity fixture · Synthetic', email: `clarity.${Date.now()}@example.test` });
  const response = await request.get('/api/admin/summary', { headers: { 'X-Admin-Access-Code': adminCode! } });
  expect(response.status()).toBe(200);
  const summary = await response.json();
  const original = summary.recentWaitlistSignups.find((record: { id: string }) => record.id === contact.id);
  const today = new Date();
  const day = (offset: number) => { const date = new Date(today); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
  const contacts = ['Due', 'Overdue', 'Scheduled', 'Unassigned', 'Closed'].map((name, index) => ({ ...original, id: `clarity-${name}`, name: `${name} · Synthetic`, email: `${name.toLowerCase()}@example.test`, scoreBreakdown: [{ reason: 'Original score factor', points: 0 }], retainedFields: { campaign: 'Preserved historical campaign', applications_tracked_count: 0 }, createdAt: `${day(-index)}T12:00:00Z` }));
  const outreach = contacts.map((record, index) => ({ leadId: record.id, revision: 1, status: index === 4 ? 'Closed' : 'New', owner: index === 3 ? '' : 'Synthetic Advisor', notes: '', lastContactDate: '', nextFollowUpDate: index === 0 ? day(0) : index === 1 || index === 4 ? day(-2) : index === 2 ? day(3) : '', updatedAt: today.toISOString() }));
  Object.assign(summary, { recentWaitlistSignups: contacts, recentFollowUps: [], pendingIntakeFollowUps: [], waitlistSchools: Array.from({ length: 13 }, (_, index) => ({ label: `School ${String(index+1).padStart(2,'0')}`, count: index === 12 ? 0 : 1 })), applicationRecords: [{ id: 'clarity-application', title: 'Synthetic reporting role', company: 'Synthetic organization', status: 'Interviewing', source: 'Synthetic source', capturedAt: today.toISOString(), retainedFields: { offer_amount: 0 } }] });
  Object.assign(summary.totals, { waitlistSignups: 5, followUpSurveys: 0, measuredSessions: 0, unmeasuredSessions: 2 });
  summary.meta = { ...summary.meta, categoryScope: 'All categories', dataQuality: { missingSignupEmail: 0, ambiguousFollowUpResponses: 2, missingSignupSnapshots: 1, publicVerificationClaims: 1 }, sessionMeasurement: { measuredSessions: 0, unmeasuredSessions: 2, definition: 'Positive recorded duration only' } };
  let fail = false;
  await page.route('**/api/admin/summary*', route => route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'Synthetic refresh failure' } : { ...summary, meta: { ...summary.meta, query: new URL(route.request().url()).searchParams.get('q') || '' } }) }));
  await page.route('**/api/admin/outreach*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ records: outreach }) }));
  return { contacts, summary, failRefresh: () => { fail = true; } };
}
const panel = (page: Page, title: string) => page.getByRole('heading', { name: title, exact: true }).locator('xpath=ancestor::section[1]');

test.describe('admin clarity and reporting scope', () => {
  test.skip(!adminCode, 'Requires explicit local synthetic admin credentials.');
  test.beforeEach(async ({ baseURL }) => requireLocal(baseURL));

  test('chart top-N presentation retains all categories in table and contextual CSV', async ({ page, request }) => {
    await mockWorkspace(page, request);
    await unlockWorkspace(page, '/admin?view=reports');
    const schools = panel(page, 'Schools');
    await expect(schools).toContainText('Top 10 of 13 categories shown');
    await schools.getByText('Complete data table (13 categories)', { exact: true }).click();
    const table = schools.getByRole('table');
    await expect(table.getByRole('row')).toHaveCount(14);
    await expect(table.getByRole('rowheader', { name: 'School 13', exact: true })).toBeVisible();
    await expect(table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'School 13', exact: true }) }).getByRole('cell')).toHaveText('0');
    await schools.getByRole('button', { name: 'Show all 13', exact: true }).click();
    await expect(schools.getByRole('definition')).toHaveCount(13);
    const downloadPromise = page.waitForEvent('download');
    await schools.getByRole('button', { name: 'Export Schools data', exact: true }).click();
    const download = await downloadPromise;
    const csv = await readFile((await download.path())!, 'utf8');
    expect(csv).toContain('School 13');
    expect(csv).toContain('Population');
    expect(csv).toContain('Loaded at');
  });

  test('operational queue separates due, overdue, scheduled and unassigned contacts from closed plans', async ({ page, request }) => {
    await mockWorkspace(page, request);
    await unlockWorkspace(page, '/admin?view=followups');
    await page.getByRole('button', { name: 'Outreach queue', exact: true }).click();
    const queue = page.getByRole('region', { name: 'Outreach queue filters', exact: true });
    await expect(page.getByRole('article', { name: 'Due · Synthetic', exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Closed · Synthetic', exact: true })).toHaveCount(0);
    for (const label of ['Overdue', 'Scheduled', 'Unassigned']) {
      await queue.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await expect(page.getByRole('article', { name: `${label} · Synthetic`, exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Follow-up list', exact: true }).getByRole('article')).toHaveCount(1);
    }
    await queue.getByRole('button', { name: /^All open/ }).click();
    await expect(page.getByRole('region', { name: 'Follow-up list', exact: true }).getByRole('article')).toHaveCount(4);
    await page.getByRole('button', { name: 'Progress responses', exact: false }).click();
    await expect(queue).toHaveCount(0);
  });

  test('compact table, full preserved answers and new source-record details remain accessible', async ({ page, request }) => {
    await mockWorkspace(page, request);
    await page.setViewportSize({ width: 431, height: 332 });
    await unlockWorkspace(page);
    await page.getByRole('button', { name: 'Compact table', exact: true }).click();
    await expect(page.getByRole('table')).toContainText('Synthetic Advisor');
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'View contact Due · Synthetic', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Contact details', exact: true });
    await expect(drawer).toContainText('Original score factor');
    await drawer.getByText('Additional retained database fields', { exact: true }).click();
    await expect(drawer.getByText('Preserved historical campaign', { exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: 'Close contact details', exact: true }).click();
    await page.getByRole('navigation', { name: 'Admin workspace sections' }).getByRole('link', { name: 'Main application', exact: true }).click();
    await page.getByRole('button', { name: 'View opportunity', exact: true }).click();
    const opportunity = page.getByRole('dialog', { name: 'Opportunity details', exact: true });
    await expect(opportunity).toContainText('Offer amount');
    await expect(opportunity.locator('dd').filter({ hasText: /^0$/ })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  test('overview exposes data quality and unknown duration, and stale report exports are blocked', async ({ page, request }) => {
    const fixture = await mockWorkspace(page, request);
    Object.assign(fixture.summary.totals, { resumeRecords: 0, rawResumeRecords: 0, followUpRespondents: 0 });
    fixture.summary.systemInfo = { ...fixture.summary.systemInfo, rawResumeRecords: 0, rawResumeRetentionRate: 0 };
    fixture.summary.careerLevels = {};
    fixture.summary.recentResumeRecords = [];
    fixture.summary.followUpFunnel = fixture.summary.followUpFunnel.map((item: { label: string }) => ({ ...item, count: 0, rate: 0, denominator: 0 }));
    await unlockWorkspace(page, '/admin?view=overview');
    await expect(panel(page, 'Data quality and coverage')).toContainText('Identity review needed');
    const average = panel(page, 'Session engagement').getByRole('article').filter({ hasText: 'Average session duration' });
    await expect(average).toContainText('Not available');
    await expect(average).toContainText('2 without positive duration');
    const retention = panel(page, 'System metadata').getByRole('article').filter({ hasText: 'Raw resume retention rate' });
    await expect(retention).toContainText('Not available');
    await expect(retention).toContainText('No saved analyses in the current matching cohort.');
    await page.getByRole('navigation', { name: 'Admin workspace sections' }).getByRole('link', { name: 'Main application', exact: true }).click();
    await expect(panel(page, 'Career levels')).toContainText('No records in this report population.');
    await expect(panel(page, 'Career levels')).not.toContainText('0 population records are not represented');
    await page.getByRole('navigation', { name: 'Admin workspace sections' }).getByRole('link', { name: 'Reports', exact: true }).click();
    const funnel = panel(page, 'Follow-up outcome funnel');
    await expect(funnel).toContainText('Not available: no records in the base population.');
    await expect(funnel.getByText('Not available', { exact: true })).toHaveCount(5);
    await expect(funnel).not.toContainText('% of base');
    const downloadPromise = page.waitForEvent('download');
    await funnel.getByRole('button', { name: 'Export data', exact: true }).click();
    const funnelCsv = await readFile((await (await downloadPromise).path())!, 'utf8');
    expect(funnelCsv).toContain('no-data');
    expect(funnelCsv).toContain('Denominator');
    fixture.failRefresh();
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('alert').first()).toContainText('Refresh failed');
    await expect(page.getByRole('button', { name: 'Export report data', exact: true })).toBeDisabled();
    await expect(panel(page, 'Schools').getByRole('button', { name: 'Export Schools data', exact: true })).toBeDisabled();
    await expect(panel(page, 'Schools').getByRole('button', { name: 'Download Schools PNG', exact: true })).toBeDisabled();
  });
});
