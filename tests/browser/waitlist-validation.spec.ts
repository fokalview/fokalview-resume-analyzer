import { test, expect, type Page } from '@playwright/test';
import { adminCode, requireLocal, unlockWorkspace, contactCard } from './support/admin-workspace';

// Submit only synthetic records to the explicit local Pages + D1 server.
test.beforeEach(async ({ page, baseURL }) => {
  requireLocal(baseURL);
  page.setDefaultTimeout(10000);
});

async function fillCommonFields(page: Page, userType: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const person = {
    name: `Validation check · Synthetic ${suffix}`,
    email: `waitlist-validation-${suffix}@example.test`
  };
  await page.goto('/waitlist');
  await page.getByRole('combobox', { name: 'Who are you joining as?', exact: true }).selectOption(userType);
  for (const [name, value] of [
    ['Full name', person.name], ['Email', person.email], ['Country', 'United States'],
    ['State / province', 'Massachusetts'], ['City', 'Worcester'], ['ZIP / postal code', '01609'],
    ['What are you trying to improve?', 'Keep clear records for career advising follow-up.']
  ]) await page.getByRole(['Country', 'State / province'].includes(name) ? 'combobox' : 'textbox', { name, exact: true }).fill(value);
  await page.getByRole('combobox', { name: 'Preferred contact', exact: true }).selectOption('Email');
  return person;
}

function countSignupRequests(page: Page) {
  let count = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/waitlist' && request.method() === 'POST') count += 1;
  });
  return () => count;
}

async function submitSuccessfully(page: Page) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/waitlist' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Request access', exact: true }).click();
  const response = await pending;
  expect(response.status(), await response.text()).toBe(200);
  expect(Object.keys(await response.json()).sort()).toEqual(['id', 'ok']);
  await expect(page.getByText('Your waitlist request has been received for early-access review.', { exact: true })).toBeVisible();
}

for (const userType of ['Career Counselor / Advisor', 'Institution / Program Leader', 'Workforce / Gov / Nonprofit', 'Employer / Hiring Partner']) {
  test(`${userType} requires an organization before submitting`, async ({ page }) => {
    await fillCommonFields(page, userType);
    const label = userType === 'Employer / Hiring Partner' ? 'Company name' : 'Organization name';
    const organization = page.getByRole('textbox', { name: new RegExp(`^${label}`) });
    const submissions = countSignupRequests(page);
    await page.getByRole('button', { name: 'Request access', exact: true }).click();
    await expect(organization).toHaveAttribute('aria-invalid', 'true');
    await expect(organization).toHaveAccessibleDescription(/Enter (your |the )?(organization|company) name\./);
    expect(submissions()).toBe(0);

    await organization.fill('Example Career Organization (synthetic)');
    await submitSuccessfully(page);
    expect(submissions()).toBe(1);
  });
}

for (const gpa of ['3.7garbage', '5']) {
  test(`student GPA ${gpa} is rejected without silently changing it`, async ({ page }) => {
    await fillCommonFields(page, 'Student');
    const input = page.getByRole('textbox', { name: /^GPA/ });
    await expect(input).toHaveAccessibleName(/0.?4/i);
    await expect(input).toHaveAccessibleName(/optional/i);
    await input.fill(gpa);
    const submissions = countSignupRequests(page);
    await page.getByRole('button', { name: 'Request access', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveValue(gpa);
    await expect(input).toHaveAccessibleDescription(/GPA.*(?:between 0 and 4|from 0 to 4|0.?4)/);
    expect(submissions()).toBe(0);
    if (gpa === '3.7garbage') {
      await page.getByRole('combobox', { name: 'Who are you joining as?', exact: true }).selectOption('Individual Job Seeker');
      await expect(input).toHaveCount(0);
      // A draft from a different signup path must not invisibly block a valid
      // submission after the person changes their selected role.
      await submitSuccessfully(page);
      expect(submissions()).toBe(1);
    }
  });
}

test('a provided invalid LinkedIn address is blocked even when contact preference is Email', async ({ page }) => {
  await fillCommonFields(page, 'Individual Job Seeker');
  const linkedIn = page.getByRole('textbox', { name: /^LinkedIn profile/ });
  const submissions = countSignupRequests(page);
  for (const invalid of ['not a profile URL', 'https://linkedin.com.example.test/in/synthetic']) {
    await linkedIn.fill(invalid);
    await page.getByRole('button', { name: 'Request access', exact: true }).click();
    await expect(linkedIn).toHaveAttribute('aria-invalid', 'true');
    await expect(linkedIn).toHaveAccessibleDescription(/Enter (?:your |a )?(?:valid |full )?LinkedIn profile URL/);
    expect(submissions()).toBe(0);
  }
});

test('a scheme-free LinkedIn profile and omitted GPA save correctly and remain readable in admin', async ({ page, request }) => {
  test.skip(!adminCode, 'Requires an explicitly configured local synthetic admin credential.');
  const person = await fillCommonFields(page, 'Student');
  const linkedIn = 'linkedin.com/in/synthetic-validation-test';
  await page.getByRole('textbox', { name: 'LinkedIn profile', exact: true }).fill(linkedIn);
  await page.getByRole('combobox', { name: 'Preferred contact', exact: true }).selectOption('LinkedIn');
  await submitSuccessfully(page);

  // Inspect the actual saved API snapshot before verifying the administrator's
  // clickable link; the public response must never echo these contact fields.
  const summary = await request.get(`/api/admin/summary?q=${encodeURIComponent(person.email)}`, {
    headers: { 'X-Admin-Access-Code': adminCode! }
  });
  expect(summary.status()).toBe(200);
  const records = (await summary.json()).recentWaitlistSignups;
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ email: person.email, linkedinUrl: `https://${linkedIn}`, gpa: null });
  expect(records[0].intakeDetails.linkedinUrl).toBe(`https://${linkedIn}`);

  await unlockWorkspace(page);
  const card = contactCard(page, person.name);
  await expect(card.getByRole('link', { name: 'Open LinkedIn profile', exact: true })).toHaveAttribute('href', `https://${linkedIn}`);
  await card.getByRole('button', { name: 'View contact', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
  await expect(dialog.getByRole('link', { name: 'Open LinkedIn profile', exact: true })).toHaveAttribute('href', `https://${linkedIn}`);
  await expect(dialog.getByText(`https://${linkedIn}`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
});
