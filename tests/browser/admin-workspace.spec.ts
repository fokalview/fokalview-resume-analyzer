import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { adminCode, requireLocal, unlockWorkspace, workspaceLink, contactCard, seedContact, assertNoHorizontalOverflow, capturePreview } from './support/admin-workspace';

// These integration tests write synthetic data only to the explicit local test
// server. Configure matching ADMIN_ACCESS_CODE in ignored .dev.vars and
// SAGITTAIQ_TEST_ADMIN_CODE in the test environment.
test.use({ viewport: { width: 1440, height: 1000 } });

test('admin sign-in clearly identifies the workspace without displaying contact data', async ({ page, baseURL }) => {
  requireLocal(baseURL);
  await page.goto('/admin');
  await expect(page.getByLabel('Admin access code', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlock workspace', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View contact', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test.describe('real local admin workspace', () => {
  test.skip(!adminCode, 'Requires an explicitly configured local synthetic admin credential.');
  test.beforeEach(async ({ page, baseURL }) => {
    requireLocal(baseURL);
    page.setDefaultTimeout(10000);
  });

  test('opens directly to contacts with grouped complete answers and restores focus after closing details', async ({ page, request }, testInfo) => {
    const contact = await seedContact(request);
    await unlockWorkspace(page);
    await expect(workspaceLink(page, 'Waitlist')).toHaveAttribute('aria-current', 'page');
    const card = contactCard(page, contact.name);
    await expect(card).toBeVisible();
    await expect(card.getByRole('link', { name: contact.email, exact: true })).toBeInViewport();
    const opener = card.getByRole('button', { name: 'View contact', exact: true });
    await expect(opener).toBeInViewport();
    await assertNoHorizontalOverflow(page);
    await capturePreview(page, testInfo, 'ADMIN_WORKSPACE_PREVIEW_PATH', 'admin-workspace-preview.png');
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
    for (const heading of ['Contact information', 'Goals and interests', 'Profile and organization', 'Additional answers']) {
      await expect(dialog.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    for (const value of [contact.email, contact.phone, contact.organization, contact.role, contact.city,
      contact.biggestChallenge, contact.currentTools, contact.desiredFeatures, contact.schoolName,
      contact.reportingWish, contact.fundingSource, contact.targetSalary]) {
      await expect(dialog.getByText(value, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    const updates = dialog.locator('dl > div').filter({ has: page.locator('dt', { hasText: /Product updates requested/ }) });
    await expect(updates.filter({ visible: true }).first().locator('dd')).toHaveText('No');
    const internal = dialog.locator('details').filter({ has: page.locator('summary', { hasText: 'Internal references' }) });
    await expect(internal).not.toHaveAttribute('open', '');
    await dialog.getByRole('button', { name: 'Close contact details', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  for (const viewport of [{ width: 431, height: 332 }, { width: 390, height: 844 }]) {
    test(`contacts, navigation and detail controls work at ${viewport.width}x${viewport.height}`, async ({ page, request }, testInfo) => {
      await page.setViewportSize(viewport);
      const contact = await seedContact(request, { email: `long.synthetic.contact.${Date.now()}@example.test` });
      await unlockWorkspace(page);
      await assertNoHorizontalOverflow(page);
      for (const name of ['Waitlist', 'Follow-ups', 'Reports'] as const) await expect(workspaceLink(page, name)).toBeVisible();
      await page.getByLabel('Search contacts', { exact: true }).fill(contact.email);
      const card = contactCard(page, contact.name);
      await expect(card).toBeVisible();
      await expect(page.getByRole('region', { name: 'Waitlist contact list', exact: true }).getByRole('article')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeEnabled();
      await assertNoHorizontalOverflow(page);
      if (viewport.width === 390) {
        await page.getByRole('heading', { name: 'Waitlist contacts', exact: true }).click();
        await workspaceLink(page, 'Waitlist').scrollIntoViewIfNeeded();
        await capturePreview(page, testInfo, 'ADMIN_WORKSPACE_MOBILE_PREVIEW_PATH', 'admin-workspace-mobile-preview.png');
      }
      await card.getByRole('button', { name: 'View contact', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
      await expect(dialog.getByRole('link', { name: contact.email, exact: true })).toBeVisible();
      await assertNoHorizontalOverflow(page);
      await expect(dialog.getByRole('button', { name: 'Close contact details', exact: true })).toBeInViewport();
      await dialog.getByRole('button', { name: 'Close contact details', exact: true }).click();
      await workspaceLink(page, 'Follow-ups').click();
      await expect(page).toHaveURL(/view=followups/);
      await expect(workspaceLink(page, 'Follow-ups')).toHaveAttribute('aria-current', 'page');
      await assertNoHorizontalOverflow(page);
    });
  }

  test('deep links, reload and browser Back keep the selected workspace section', async ({ page }) => {
    await unlockWorkspace(page, '/admin?view=followups');
    await expect(workspaceLink(page, 'Follow-ups')).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(workspaceLink(page, 'Follow-ups')).toHaveAttribute('aria-current', 'page');
    await workspaceLink(page, 'Reports').click();
    await expect(page).toHaveURL(/view=reports/);
    await expect(workspaceLink(page, 'Reports')).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(workspaceLink(page, 'Follow-ups')).toHaveAttribute('aria-current', 'page');
  });

  test('submitted surveys remain readable, exported and linked when finding a contact by name', async ({ page, request }) => {
    const contact = await seedContact(request);
    const survey = {
      email: contact.email, phone: contact.phone, currentStatus: 'Interviewing',
      applicationCount: 12, interviewCount: 3, offerCount: 0, placementStatus: 'Not placed',
      currentRole: 'Career transition', currentIndustry: 'Technology', salaryRange: '$70,000–$80,000',
      employer: 'Example Research Cooperative', jobTitle: 'Data analyst', salaryAmount: 75000,
      salaryCurrency: 'USD', salaryPeriod: 'Annual', outcomeDate: '2026-11-04', jobLocation: 'Remote, Massachusetts',
      dataSource: 'Self-reported follow-up', verificationStatus: 'Self-reported',
      supportNeeded: 'Prepare for the final technical interview.',
      notes: 'Discussed portfolio examples and interview preparation.', source: 'browser_synthetic_test'
    };
    const submitted = await request.post('/api/follow-up', { data: survey });
    expect(submitted.status(), await submitted.text()).toBe(200);
    expect(Object.keys(await submitted.json()).sort()).toEqual(['ok', 'submittedAt']);
    await unlockWorkspace(page, '/admin?view=followups');
    const responseCard = page.getByRole('article', { name: contact.email, exact: true });
    await expect(responseCard.getByRole('heading', { name: contact.name, exact: true })).toBeVisible();
    await responseCard.getByRole('button', { name: 'View response', exact: true }).click();
    const responseDialog = page.getByRole('dialog', { name: 'Follow-up details', exact: true });
    await expect(responseDialog.getByRole('heading', { name: 'Progress and outcomes', exact: true })).toBeVisible();
    for (const value of [survey.email, survey.phone, survey.supportNeeded, survey.notes, survey.employer,
      survey.jobTitle, survey.jobLocation, survey.salaryCurrency, String(survey.salaryAmount)]) {
      await expect(responseDialog.getByText(value, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    await page.keyboard.press('Escape');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const download = await downloadPromise;
    const records = JSON.parse(await readFile((await download.path())!, 'utf8'));
    const exported = records.find((record: { email: string }) => record.email === contact.email);
    expect(exported).toMatchObject({ matchedContactName: contact.name, salaryCurrency: 'USD', responseDetails: survey });
    await page.getByRole('button', { name: /^Needs intake(?: \d+)?$/ }).click();
    await expect(contactCard(page, contact.name)).toHaveCount(0);

    await workspaceLink(page, 'Waitlist').click();
    await page.getByLabel('Search contacts', { exact: true }).fill(contact.name);
    await expect(page.getByRole('region', { name: 'Waitlist contact list', exact: true }).getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Export JSON', exact: true })).toBeEnabled();
    await contactCard(page, contact.name).getByRole('button', { name: 'View contact', exact: true }).click();
    const contactDialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
    await contactDialog.getByRole('button', { name: 'Survey responses (1)', exact: true }).click();
    await contactDialog.locator('summary').filter({ hasText: /Interviewing/ }).click();
    await expect(contactDialog.getByText(survey.notes, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(contactDialog.getByText('USD', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });

  test('sign out clears credentials and contact data even when a refresh was in flight', async ({ page, request }) => {
    const contact = await seedContact(request);
    await unlockWorkspace(page);
    await expect(contactCard(page, contact.name)).toBeVisible();
    let release: (() => void) | undefined;
    let finished: (() => void) | undefined;
    const completed = new Promise<void>(resolve => { finished = resolve; });
    await page.route('**/api/admin/summary*', async route => {
      const response = await route.fetch();
      await new Promise<void>(resolve => { release = resolve; });
      try { await route.fulfill({ response }); } catch { /* An aborted signed-out request is safe. */ }
      finished!();
    });
    try {
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect.poll(() => Boolean(release)).toBe(true);
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      release!();
      await completed;
      // Let the released or aborted refresh settle before checking that it
      // cannot repopulate the signed-out workspace.
      await page.waitForLoadState('networkidle');
      await expect(page.getByLabel('Admin access code', { exact: true })).toHaveValue('');
      await expect(page.getByRole('button', { name: 'Unlock workspace', exact: true })).toBeVisible();
      await expect(contactCard(page, contact.name)).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.getItem('fokalview_admin_access_code'))).toBeNull();
      await page.unroute('**/api/admin/summary*');
      await page.reload();
      await expect(page.getByRole('button', { name: 'Unlock workspace', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'View contact', exact: true })).toHaveCount(0);
    } finally { release?.(); }
  });

  test('follow-up plans persist status, owner, notes and dates with activity history', async ({ page, request }) => {
    const contact = await seedContact(request);
    await unlockWorkspace(page);
    await contactCard(page, contact.name).getByRole('button', { name: 'View contact', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
    await dialog.getByRole('button', { name: 'Follow-up plan', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Contact status', exact: true }).selectOption('Contacted');
    await dialog.getByLabel('Assigned owner', { exact: true }).fill('Taylor · Synthetic coordinator');
    await dialog.getByLabel('Last contact date', { exact: true }).fill('2026-11-04');
    await dialog.getByLabel('Next follow-up date', { exact: true }).fill('2026-11-11');
    const note = 'Share the product walkthrough and ask about pilot timing.';
    await dialog.getByRole('textbox', { name: 'Follow-up notes', exact: true }).fill(note);
    const saveResponse = page.waitForResponse(response => response.url().includes('/api/admin/outreach') && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Save follow-up plan', exact: true }).click();
    expect((await saveResponse).status()).toBe(200);
    await expect(dialog.getByText('Follow-up plan saved.', { exact: true })).toBeVisible();
    await page.reload();
    await contactCard(page, contact.name).getByRole('button', { name: 'View contact', exact: true }).click();
    await dialog.getByRole('button', { name: 'Follow-up plan', exact: true }).click();
    await expect(dialog.getByRole('combobox', { name: 'Contact status', exact: true })).toHaveValue('Contacted');
    await expect(dialog.getByLabel('Assigned owner', { exact: true })).toHaveValue('Taylor · Synthetic coordinator');
    await expect(dialog.getByLabel('Last contact date', { exact: true })).toHaveValue('2026-11-04');
    await expect(dialog.getByLabel('Next follow-up date', { exact: true })).toHaveValue('2026-11-11');
    await expect(dialog.getByRole('textbox', { name: 'Follow-up notes', exact: true })).toHaveValue(note);
    await dialog.locator('summary').filter({ hasText: /^Activity history/ }).click();
    await expect(dialog.getByText(note, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Signup answers', exact: true }).click();
    await expect(dialog.getByText(contact.biggestChallenge, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  });
});
