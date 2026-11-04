import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// Real local Pages + D1 integration: supply a synthetic ADMIN_ACCESS_CODE in
// ignored .dev.vars and the same SAGITTAIQ_TEST_ADMIN_CODE environment variable.
// WAITLIST_PREVIEW_PATH optionally saves a user-facing synthetic-data screenshot.
const adminCode = process.env.SAGITTAIQ_TEST_ADMIN_CODE;
test.use({ viewport: { width: 1440, height: 1050 } });

test('waitlist contact details survive public signup, protected admin views and CSV export', async ({ page, baseURL }, testInfo) => {
  test.skip(!adminCode, 'Requires an explicitly configured local synthetic admin credential.');
  expect(['127.0.0.1', 'localhost']).toContain(new URL(baseURL!).hostname);
  test.setTimeout(60000);

  const unique = Date.now().toString();
  const name = `Alex Morgan — Synthetic Test ${unique}`;
  const email = `waitlist-ui-${unique}@example.test`;
  const phone = '+1 (202) 555-0142';
  const challenge = 'I need help turning resume feedback into interviews.';

  await page.goto('/waitlist');
  await expect(page.getByText(/SagittaIQ stores your name, email address, contact details, and answers/)).toBeVisible();
  await expect(page.getByLabel('Phone number (include country code)')).toHaveCount(0);
  await page.getByLabel('Full name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email.toUpperCase());
  await page.getByLabel('Country', { exact: true }).fill('United States');
  await page.getByLabel('State / province', { exact: true }).fill('Massachusetts');
  await page.getByLabel('City', { exact: true }).fill('Worcester');
  await page.getByLabel('ZIP / postal code', { exact: true }).fill('01609');
  await page.getByLabel('Preferred contact', { exact: true }).selectOption('Phone');
  await expect(page.getByLabel('Phone number (include country code)')).toBeVisible();
  await page.getByLabel('What are you trying to improve?', { exact: true }).fill(challenge);
  await page.getByRole('button', { name: 'Request access', exact: true }).click();
  await expect(page.getByText('Enter a phone number so we can follow up by phone.', { exact: true })).toBeVisible();
  await page.getByLabel('Phone number (include country code)').fill(phone);
  await page.getByLabel('Target role', { exact: true }).fill('Data Analyst');
  await page.getByLabel('Target salary', { exact: true }).fill('$75,000');
  await page.getByRole('checkbox', { name: /Product updates/i }).uncheck();

  const signupResponse = page.waitForResponse(response => response.url().endsWith('/api/waitlist') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Request access', exact: true }).click();
  const response = await signupResponse;
  expect(response.status()).toBe(200);
  const publicResult = await response.json();
  expect(Object.keys(publicResult).sort()).toEqual(['id', 'ok']);
  expect(JSON.stringify(publicResult)).not.toContain(email);
  expect(JSON.stringify(publicResult)).not.toContain(phone);
  await expect(page.getByText('Your waitlist request has been received for early-access review.', { exact: true })).toBeVisible();

  await page.goto('/admin');
  await page.getByPlaceholder('Admin access code', { exact: true }).fill(adminCode!);
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('tab', { name: /^Waitlist/ }).click();
  const waitlistPanel = page.locator('section.admin-table-panel').filter({ has: page.getByRole('heading', { name: 'Waitlist Discovery', exact: true }) });
  const row = waitlistPanel.locator('article').filter({ hasText: name });
  await expect(row.getByRole('link', { name: email, exact: true })).toHaveAttribute('href', `mailto:${encodeURIComponent(email)}`);
  await expect(row.getByRole('link', { name: phone, exact: true })).toHaveAttribute('href', 'tel:+12025550142');
  await expect(row.getByText('Preferred contact: Phone', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'View full signup', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Waitlist record detail', exact: true });
  await expect(dialog.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: email, exact: true })).toBeVisible();
  await expect(dialog.getByText(challenge, { exact: true })).toBeVisible();
  await dialog.getByText('Complete signup answers', { exact: true }).click();
  const answers = dialog.locator('details[open]');
  await expect(answers.getByText('$75,000', { exact: true })).toBeVisible();
  const productUpdates = answers.locator('dl > div').filter({ has: page.locator('dt', { hasText: 'Product updates requested' }) });
  await expect(productUpdates.locator('dd')).toHaveText('No');
  await dialog.getByRole('heading', { name, exact: true }).scrollIntoViewIfNeeded();
  const screenshotPath = process.env.WAITLIST_PREVIEW_PATH || testInfo.outputPath('waitlist-contact-preview.png');
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('Waitlist contact preview (synthetic data)', { path: screenshotPath, contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await waitlistPanel.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/waitlist-contacts.*\.csv$/);
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv).toContain('"Email address"');
  expect(csv).toContain('"Phone number"');
  expect(csv).toContain('"What they want to improve"');
  expect(csv).toContain(email);
  expect(csv).toContain(`"'${phone}"`);
  expect(csv).toContain(challenge);
  expect(csv).toContain('$75,000');
});

test('follow-up clearly explains retained contact details and no longer promises hash-only email', async ({ page, baseURL }) => {
  expect(['127.0.0.1', 'localhost']).toContain(new URL(baseURL!).hostname);
  await page.goto('/follow-up');
  await expect(page.getByText(/We retain the contact details you provide so our team can follow up/)).toBeVisible();
  await expect(page.getByText('Your contact details and responses are available to authorized SagittaIQ administrators for follow-up and progress reporting.', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Email address for follow-up', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Phone number (optional, include country code)', { exact: true })).toBeVisible();
  await expect(page.getByText(/without storing raw email|email.*hashed|hash.*email/i)).toHaveCount(0);
});
