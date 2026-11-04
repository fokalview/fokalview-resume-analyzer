import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const adminCode = process.env.SAGITTAIQ_TEST_ADMIN_CODE;

export function requireLocal(baseURL: string | undefined) {
  expect(baseURL, 'Real admin fixtures require a local Pages server.').toBeTruthy();
  expect(['127.0.0.1', 'localhost']).toContain(new URL(baseURL!).hostname);
}

export async function unlockWorkspace(page: Page, path = '/admin') {
  await page.goto(path);
  await page.getByLabel('Admin access code', { exact: true }).fill(adminCode!);
  await page.getByRole('button', { name: 'Unlock workspace', exact: true }).click();
  await expect(workspaceLink(page, 'Waitlist')).toBeVisible();
}

export function workspaceLink(page: Page, name: 'Waitlist' | 'Follow-ups' | 'Reports') {
  return page.getByRole('navigation', { name: 'Admin workspace sections', exact: true })
    .getByRole('link', { name: new RegExp(`^${name}(?: \\d+)?$`) });
}

export function contactCard(page: Page, name: string) {
  return page.getByRole('article', { name, exact: true });
}

export async function seedContact(request: APIRequestContext, overrides: Record<string, unknown> = {}) {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const contact = {
    name: `Jordan Ellis · Synthetic ${suffix.slice(-5)}`,
    email: `synthetic.contact.${suffix}@example.test`,
    phone: '+1 (202) 555-0142', preferredContactMethod: 'Phone',
    userType: 'Institution / Program Leader',
    organization: 'Northstar Career Center (synthetic)', organizationType: 'University',
    role: 'Career services director',
    country: 'United States', state: 'Massachusetts', city: 'Worcester', zipPostal: '01609',
    linkedinUrl: 'https://www.linkedin.com/in/synthetic-workspace-test',
    biggestChallenge: 'Coordinate advisor outreach without losing the original signup context.',
    currentTools: 'Sheets and calendars', desiredFeatures: 'A shared follow-up queue',
    programName: 'Career readiness pilot', schoolName: 'Northstar Example University',
    primaryPopulation: ['College students', 'Adult learners'],
    reportingWish: 'Monthly outcomes by cohort',
    advisingStaffCount: '6', geographicReach: 'Regional', fundingSource: 'Institution operating budget',
    targetRole: 'Data Analyst', targetIndustry: 'Technology', targetSalary: '$75,000',
    interviewInterest: true, betaInterest: true, productUpdatesInterest: false,
    pilotInterest: true, feedbackInterest: false, budgetInterest: false,
    ...overrides
  };
  const response = await request.post('/api/waitlist', { data: contact });
  expect(response.status(), await response.text()).toBe(200);
  const result = await response.json();
  expect(Object.keys(result).sort()).toEqual(['id', 'ok']);
  return { ...contact, id: result.id };
}

export async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  expect(dimensions.content, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.width + 1);
}

export async function capturePreview(page: Page, testInfo: TestInfo, environmentKey: string, filename: string) {
  const path = process.env[environmentKey] || testInfo.outputPath(filename);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach('Synthetic admin workspace preview', { path, contentType: 'image/png' });
}
