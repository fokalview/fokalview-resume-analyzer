import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { adminCode, requireLocal, unlockWorkspace, seedContact, contactCard, assertNoHorizontalOverflow, capturePreview } from './support/admin-workspace';

const executeFile = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const targetRole = `Synthetic reporting analyst ${suffix}`;
const reportId = `REPORT-PARITY-${suffix}`;
const analysisSummary = 'Synthetic evidence connects reporting experience with the target analyst role.';
const technicalSkills = ['SQL', ...Array.from({ length: 11 }, (_, index) => `Synthetic skill ${String(index + 1).padStart(2, '0')}`)];

function quote(value: string) { return `'${value.replaceAll("'", "''")}'`; }
function nav(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Admin workspace sections', exact: true }).getByRole('link', { name, exact: true });
}
function panel(page: Page, title: string) {
  return page.getByRole('heading', { name: title, exact: true }).locator('xpath=ancestor::section[1]');
}
async function headings(page: Page, names: string[]) {
  for (const name of names) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

async function seedReportingData(request: APIRequestContext) {
  const contact = await seedContact(request, {
    name: `Institutional parity · Synthetic ${suffix}`, userType: 'Student',
    gpa: '3.7', certifications: 'CAPM', degreeLevel: "Master's", classYear: '2028',
    studentStatus: 'Full-time student', seekingStatus: 'Actively seeking', domesticInternational: 'International',
    referralSource: 'Conference', source: 'synthetic_parity_signup'
  });
  const followup = await request.post('/api/follow-up', { data: {
    email: contact.email, currentStatus: 'Interviewing', applicationCount: 8, interviewCount: 2, offerCount: 1,
    placementStatus: 'Offer received', salaryAmount: 82000, salaryCurrency: 'USD', salaryPeriod: 'Annual',
    employer: 'Synthetic Reporting Cooperative', jobTitle: targetRole, currentIndustry: 'Technology',
    supportNeeded: 'Compare the role and compensation before deciding.', notes: 'Synthetic report parity response.'
  } });
  expect(followup.status(), await followup.text()).toBe(200);
  const event = await request.post('/api/events', { data: {
    eventType: 'session_completed', eventSource: 'synthetic_parity_source', pagePath: '/synthetic-parity',
    sessionId: `session-parity-${suffix}`, durationSeconds: 180, campaign: 'synthetic-parity-campaign',
    metadata: { fixture: 'admin reporting parity' }
  } });
  expect(event.status(), await event.text()).toBe(200);

  // Candidate writes normally require WorkOS. Populate representative saved
  // records in the explicit local-only database, then exercise the real admin
  // API and UI instead of replacing the summary response with a browser mock.
  const localConfig = resolve(repository, 'wrangler.local.toml');
  expect(await readFile(localConfig, 'utf8')).toContain('00000000-0000-0000-0000-000000000001');
  const now = new Date().toISOString();
  const userId = `synthetic-parity-user-${suffix}`;
  const profile = {
    currentTitle: 'Reporting specialist', careerLevel: 'Senior',
    skills: { technical: technicalSkills, tools: ['Tableau'], soft: ['Communication'] },
    industries: ['Technology'], workHistory: [], education: [], certifications: ['CAPM']
  };
  const analysis = {
    score: 88, summary: analysisSummary, keywordAnalysis: { matched: ['SQL'], missing: ['Python', 'Leadership', 'Regulatory knowledge'] },
    strengths: ['Clear reporting evidence'], improvements: [], sections: []
  };
  const sql = [
    `INSERT INTO users (id,client_hash,identifier_type,email_domain,email_domain_type,country,candidate_id,created_at,last_seen_at) VALUES (${quote(userId)},${quote(userId)},'client','parity.example.test','institutional','Canada',${quote(`CANDIDATE-PARITY-${suffix}`)},${quote(now)},${quote(now)})`,
    `INSERT INTO resume_records (id,client_hash,user_id,report_id,target_role,profile_json,analysis_json,raw_resume_retained,consent_version,captured_at,updated_at) VALUES (${quote(`resume-${suffix}`)},${quote(userId)},${quote(userId)},${quote(reportId)},${quote(targetRole)},${quote(JSON.stringify(profile))},${quote(JSON.stringify(analysis))},0,'synthetic-browser-test',${quote(now)},${quote(now)})`,
    `INSERT INTO application_captures (id,client_hash,user_id,application_id,title,company,status,source,consent_version,captured_at,updated_at,synced_at) VALUES (${quote(`application-${suffix}`)},${quote(userId)},${quote(userId)},${quote(`APP-PARITY-${suffix}`)},${quote(targetRole)},'Synthetic Reporting Cooperative','Interviewing','synthetic_parity_job_board','synthetic-browser-test',${quote(now)},${quote(now)},${quote(now)})`
  ].join(';');
  await executeFile(process.execPath, [resolve(repository, 'node_modules/wrangler/bin/wrangler.js'),
    'd1', 'execute', 'DB', '--local', '--config', localConfig, '--persist-to', resolve(repository, '.wrangler/state'), '--command', sql, '--json'],
  { cwd: repository, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, timeout: 60000 });
  return contact;
}

test.describe('original admin reporting remains alongside contact tools', () => {
  test.skip(!adminCode, 'Requires the explicitly configured local synthetic admin credential.');
  test.use({ viewport: { width: 1440, height: 1000 } });
  let contact: Awaited<ReturnType<typeof seedContact>>;
  test.beforeAll(async ({ request, baseURL }) => {
    test.setTimeout(90000);
    requireLocal(baseURL);
    contact = await seedReportingData(request);
  });
  test.beforeEach(async ({ page, baseURL }) => {
    requireLocal(baseURL);
    page.setDefaultTimeout(10000);
  });

  test('Overview restores operational information, sessions, trends and metadata', async ({ page }, testInfo) => {
    await unlockWorkspace(page, '/admin?view=overview');
    await expect(nav(page, 'Overview')).toHaveAttribute('aria-current', 'page');
    await headings(page, ['Platform health', 'Advisor action queue', 'Recent user activity', 'Reporting shortcuts', 'Decision signals', 'User signals', 'Session engagement', 'Usage trends', 'System metadata']);
    await expect(panel(page, 'Session engagement')).toContainText(/Sessions/i);
    await expect(panel(page, 'System metadata')).toContainText(/readiness/i);
    await assertNoHorizontalOverflow(page);
    await capturePreview(page, testInfo, 'ADMIN_OVERVIEW_PREVIEW_PATH', 'admin-overview-preview.png');
    await page.goto('/admin?view=all');
    await expect(nav(page, 'Overview')).toHaveAttribute('aria-current', 'page');
  });

  test('Institutional reporting preserves academic fields and original submitted answers', async ({ page }, testInfo) => {
    await unlockWorkspace(page, '/admin?view=institutional');
    await expect(nav(page, 'Institutional reporting')).toHaveAttribute('aria-current', 'page');
    await headings(page, ['Student and program profile', 'GPA bands', 'Certifications', 'Degree levels', 'Class years', 'Domestic / international', 'Student statuses', 'Seeking statuses']);
    for (const [title, value] of [['GPA bands', '3.50-4.00'], ['Certifications', 'CAPM'], ['Degree levels', "Master's"], ['Class years', '2028'], ['Domestic / international', 'International'], ['Student statuses', 'Full-time student'], ['Seeking statuses', 'Actively seeking']]) {
      await expect(panel(page, title).getByLabel(title, { exact: true }).getByText(value, { exact: true })).toBeVisible();
    }
    await assertNoHorizontalOverflow(page);
    await capturePreview(page, testInfo, 'ADMIN_INSTITUTIONAL_PREVIEW_PATH', 'admin-institutional-preview.png');
    await nav(page, 'Waitlist').click();
    await page.getByLabel('Search contacts', { exact: true }).fill(contact.email);
    await expect(page.getByRole('region', { name: 'Waitlist contact list', exact: true }).getByRole('article')).toHaveCount(1);
    await contactCard(page, contact.name).getByRole('button', { name: 'View contact', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
    await expect(dialog.getByText('3.7', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Follow-up plan', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Save follow-up plan', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Survey responses (1)', exact: true }).click();
    await dialog.locator('summary').filter({ hasText: /Interviewing/ }).click();
    await expect(dialog.getByText('Synthetic report parity response.', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('Main application keeps cohort analytics and complete saved analysis details', async ({ page }) => {
    await unlockWorkspace(page, '/admin?view=applications');
    await expect(nav(page, 'Main application')).toHaveAttribute('aria-current', 'page');
    await headings(page, ['Saved analyses', 'Career levels', 'Top skills', 'Top tools', 'Skill gaps: Technical Skills', 'Skill gaps: Domain Knowledge', 'Skill gaps: Soft Skills', 'Resume cohort countries', 'Resume cohort email domains', 'Resume cohort email domain types', 'Opportunity job titles', 'Session sources', 'Session pages', 'Session campaigns', 'User event types']);
    for (const [title, value] of [['Career levels', 'Senior'], ['Top skills', 'SQL'], ['Top tools', 'Tableau'], ['Skill gaps: Technical Skills', 'python'], ['Resume cohort countries', 'Canada'], ['Resume cohort email domains', 'parity.example.test'], ['Resume cohort email domain types', 'institutional'], ['Session sources', 'synthetic_parity_source'], ['Session pages', '/synthetic-parity'], ['Session campaigns', 'synthetic-parity-campaign'], ['User event types', 'session_completed']]) {
      await expect(panel(page, title).getByLabel(title, { exact: true }).getByText(value, { exact: true })).toBeVisible();
    }
    await page.getByLabel('Search analyses', { exact: true }).fill(targetRole);
    const saved = page.getByRole('region', { name: 'Saved analyses', exact: true });
    await saved.getByRole('button', { name: 'View analysis', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Analysis details', exact: true });
    await expect(dialog.getByText(analysisSummary, { exact: true })).toBeVisible();
    await expect(dialog.getByText(reportId, { exact: true }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export analyses JSON', exact: true }).click();
    const records = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ reportId, analysis: { score: 88, summary: analysisSummary }, profile: { skills: { technical: technicalSkills } } });
  });

  test('Waitlist reports retain lead scoring, sources, funnels and complete export on mobile', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await unlockWorkspace(page, '/admin?view=reports');
    await headings(page, ['Lead score bands', 'Signup sources', 'Waitlist pipeline', 'Follow-up outcome funnel', 'Conversion metrics']);
    await expect(page.getByText('Average lead score', { exact: true })).toBeVisible();
    await expect(panel(page, 'Signup sources').getByLabel('Signup sources', { exact: true }).getByText('synthetic_parity_signup', { exact: true })).toBeVisible();
    await expect(panel(page, 'Referral sources').getByLabel('Referral sources', { exact: true }).getByText('Conference', { exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    const pngPending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Signup sources PNG', exact: true }).click();
    const pngDownload = await pngPending;
    expect(pngDownload.suggestedFilename()).toMatch(/signup-sources.*\.png$/);
    const png = await readFile((await pngDownload.path())!);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.length).toBeGreaterThan(1000);
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export report data', exact: true }).click();
    const data = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
    expect(data.meta.sources.events.status).toBe('available');
    expect(data.usageByDay).toHaveLength(14);
    expect(data.userEventTypes.session_completed).toBeGreaterThan(0);
    expect(data.waitlistGpaBands['3.50-4.00']).toBeGreaterThan(0);
    expect(data.recentResumeRecords.some((record: { reportId: string }) => record.reportId === reportId)).toBe(true);
    expect(data.recentWaitlistSignups.some((record: { email: string }) => record.email === contact.email)).toBe(true);
    await nav(page, 'Overview').click();
    await expect(nav(page, 'Overview')).toHaveAttribute('aria-current', 'page');
    await assertNoHorizontalOverflow(page);
    await capturePreview(page, testInfo, 'ADMIN_PARITY_MOBILE_PREVIEW_PATH', 'admin-parity-mobile-preview.png');
    for (const name of ['Waitlist', 'Follow-ups', 'Overview', 'Institutional reporting', 'Main application', 'Reports']) {
      await expect(nav(page, name)).toBeVisible();
    }
    await nav(page, 'Main application').click();
    const skills = panel(page, 'Top skills');
    await skills.getByRole('combobox', { name: 'Sort Top skills', exact: true }).selectOption('Alphabetical');
    await skills.getByRole('button', { name: /^Show all \d+$/ }).click();
    await expect(skills.getByLabel('Top skills', { exact: true }).getByText('Synthetic skill 11', { exact: true })).toBeVisible();
    await expect(skills.getByRole('button', { name: 'Show top 10', exact: true })).toBeVisible();
    const labels = await skills.getByLabel('Top skills', { exact: true }).locator('dt').allTextContents();
    expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right)));
    await assertNoHorizontalOverflow(page);
    await nav(page, 'Waitlist').click();
    await expect(page.getByLabel('Search contacts', { exact: true })).toBeVisible();
  });
});
