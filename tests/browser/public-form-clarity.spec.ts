import { test, expect, type Page } from '@playwright/test';
import { requireLocal } from './support/admin-workspace';

test.beforeEach(({ baseURL }) => requireLocal(baseURL));

async function commonSignup(page: Page) {
  await page.getByRole('textbox', { name: 'Full name', exact: true }).fill('Morgan Example (synthetic)');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('clarity-test@example.test');
  await page.getByRole('combobox', { name: 'Country', exact: true }).fill('United States');
  await page.getByRole('combobox', { name: 'State / province', exact: true }).fill('Massachusetts');
  await page.getByRole('textbox', { name: 'What are you trying to improve?', exact: true }).fill('Understand my next career step.');
}

test('location suggestions support keyboard selection, Escape and custom values without coercion', async ({ page }) => {
  await page.goto('/waitlist');
  const country = page.getByRole('combobox', { name: 'Country', exact: true });
  await page.getByRole('button', { name: 'Show country suggestions', exact: true }).click();
  const countrySuggestions = page.getByRole('listbox', { name: 'Country suggestions', exact: true });
  await expect(countrySuggestions.getByRole('option')).toHaveCount(30);
  await expect(countrySuggestions.getByText('Showing first 30 of 249 suggestions. Type to narrow the results.', { exact: true })).toBeVisible();
  await expect(country.locator('xpath=../..').getByRole('status')).toContainText('Showing first 30 of 249 suggestions. Type to narrow the results.');
  await country.fill('USA');
  await expect(country.locator('xpath=../..').getByRole('status')).toContainText('1 suggestion.');
  await country.press('ArrowDown');
  await country.press('Enter');
  await expect(country).toHaveValue('United States');
  await country.press('Tab');
  await country.focus();
  await country.fill('Canada');
  await country.press('Escape');
  await expect(country).toHaveValue('United States');
  const region = page.getByRole('combobox', { name: 'State / province', exact: true });
  await region.fill('MA');
  await expect(page.getByRole('option', { name: 'Massachusetts', exact: true })).toBeVisible();
  await region.fill('Custom region name');
  await region.press('Tab');
  await expect(region).toHaveValue('Custom region name');
});

test('international organization can submit without a postal code', async ({ page }) => {
  await page.goto('/waitlist');
  await commonSignup(page);
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(`international-org-${Date.now()}@example.test`);
  await page.getByRole('combobox', { name: 'Who are you joining as?', exact: true }).selectOption('Institution / Program Leader');
  await page.getByRole('textbox', { name: 'Organization name', exact: true }).fill('Synthetic International Career Centre');
  await page.getByRole('combobox', { name: 'Country', exact: true }).fill('Hong Kong');
  await page.getByRole('combobox', { name: 'State / province', exact: true }).fill('Not applicable');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('Hong Kong');
  const postal = page.getByRole('textbox', { name: 'ZIP / postal code', exact: true });
  await expect(postal).not.toHaveAttribute('required');
  await expect(postal).toHaveValue('');
  await expect(postal).toHaveAttribute('autocomplete', 'postal-code');
  await expect(postal).toHaveAccessibleDescription('Optional. Leave blank if your address does not use a postal code.');
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/waitlist' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Request access', exact: true }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  expect(response.request().postDataJSON().zipPostal).toBe('');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('signup preserves per-profile drafts and submits neutral choices with explicit version', async ({ page }) => {
  let submitted: any;
  await page.route('**/api/waitlist', async route => { submitted = route.request().postDataJSON(); await route.fulfill({ json: { ok: true, id: 'synthetic-clarity' } }); });
  await page.goto('/waitlist');
  await commonSignup(page);
  await expect(page.getByRole('combobox', { name: 'Referral source', exact: true })).toHaveValue('');
  for (const name of ['Early beta access', 'Resume analysis', 'Application tracker', 'Willing to give feedback', 'Intro or discovery call', 'Product updates']) {
    await expect(page.getByRole('checkbox', { name: new RegExp(`^${name}`) })).not.toBeChecked();
  }
  const profile = page.getByRole('combobox', { name: 'Who are you joining as?', exact: true });
  await profile.selectOption('Student');
  await page.getByRole('textbox', { name: 'School / institution', exact: true }).fill('Synthetic Academy');
  await page.getByRole('textbox', { name: 'Degree / program', exact: true }).fill('Biology');
  await page.getByRole('textbox', { name: /^GPA/ }).fill('3.7');
  await profile.selectOption('Employer / Hiring Partner');
  await expect(page.getByRole('textbox', { name: 'Company name', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('Synthetic Employer');
  await profile.selectOption('Student');
  await expect(page.getByRole('textbox', { name: 'School / institution', exact: true })).toHaveValue('Synthetic Academy');
  await expect(page.getByRole('textbox', { name: 'Degree / program', exact: true })).toHaveValue('Biology');
  await profile.selectOption('Individual Job Seeker');
  await page.getByRole('button', { name: 'Request access', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(submitted.formVersion).toBe('2026-11-04-clarity');
  expect(submitted.gpa).toBe('');
  expect(submitted.degreeProgram).toBe('');
  expect(submitted.branchDrafts.Student.gpa).toBe('3.7');
  expect(submitted.branchDrafts['Employer / Hiring Partner'].organization).toBe('Synthetic Employer');
  expect(submitted.betaInterest).toBe(false);
  await expect(page.getByRole('button', { name: 'Got it', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Request access', exact: true })).toBeFocused();
});

test('signup validation focuses a linked error summary and None is exclusive', async ({ page }) => {
  await page.goto('/waitlist');
  await page.getByRole('button', { name: 'Request access', exact: true }).click();
  const summary = page.getByRole('alert');
  await expect(summary).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toHaveAccessibleDescription('Enter your full name.');
  await summary.getByRole('link', { name: 'Full name', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Full name', exact: true })).toBeFocused();
  const tools = page.getByRole('group', { name: 'Current tools', exact: true });
  await tools.getByRole('checkbox', { name: 'None', exact: true }).check();
  await tools.getByRole('checkbox', { name: 'LinkedIn', exact: true }).check();
  await expect(tools.getByRole('checkbox', { name: 'None', exact: true })).not.toBeChecked();
  await tools.getByRole('checkbox', { name: 'None', exact: true }).check();
  await expect(tools.getByRole('checkbox', { name: 'LinkedIn', exact: true })).not.toBeChecked();
});

test('follow-up distinguishes unknown counts, decimals and verification claims while retaining references', async ({ page }) => {
  let submitted: any;
  await page.route('**/api/follow-up', async route => { submitted = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); });
  await page.goto('/follow-up?leadId=LD-synthetic');
  await expect(page.getByRole('textbox', { name: 'Lead ID', exact: true })).not.toBeVisible();
  await page.getByText('Invitation references (optional)', { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Lead ID', exact: true })).toHaveValue('LD-synthetic');
  await expect(page.getByRole('combobox', { name: 'Current status', exact: true })).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Applications sent', exact: true })).toHaveValue('');
  await page.getByRole('spinbutton', { name: 'Applications sent', exact: true }).fill('1.5');
  await page.getByRole('button', { name: 'Submit follow-up', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Please fix');
  await expect(page.getByRole('spinbutton', { name: 'Applications sent', exact: true })).toHaveAccessibleDescription('Enter a whole number from 0 to 999, or leave blank if unknown.');
  await expect(page.getByRole('alert').getByRole('link', { name: 'Applications sent', exact: true })).toBeVisible();
  expect(submitted).toBeUndefined();
  await page.getByRole('spinbutton', { name: 'Applications sent', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'Salary amount', exact: true }).fill('25.75');
  await page.getByRole('combobox', { name: 'Salary currency (3-letter code, optional)', exact: true }).fill('USD');
  await page.getByRole('combobox', { name: 'Salary period', exact: true }).selectOption('Hourly');
  await page.getByRole('combobox', { name: 'Reported verification status', exact: true }).selectOption('Employer verified');
  await expect(page.getByText(/This is a self-reported update/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit follow-up', exact: true }).click();
  await expect(page.getByText('Follow-up saved. Thank you for helping improve the readiness data.', { exact: true })).toBeVisible();
  expect(submitted).toMatchObject({ leadId: 'LD-synthetic', applicationCount: '0', interviewCount: '', salaryAmount: '25.75', salaryCurrency: 'USD', salaryPeriod: 'Hourly', verificationStatus: 'Employer verified', formVersion: '2026-11-04-clarity' });
});

for (const width of [390, 738]) test(`public forms retain usable controls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 500 });
  for (const route of ['/waitlist', '/follow-up']) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Light mode/ }).click();
    await expect(page.locator('main')).toHaveAttribute('data-theme', 'light');
  }
});
