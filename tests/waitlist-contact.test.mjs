import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareMigrations } from '../scripts/migration-plan.mjs';
import { onRequestPost as signup } from '../functions/api/waitlist.js';
import { onRequestPost as followup } from '../functions/api/follow-up.js';
import { onRequestGet as summary } from '../functions/api/admin/summary.js';
import { flattenRecord, csvForRecords, displayValue } from '../src/lib/waitlistExport.js';

const migrationDirectory = new URL('../migrations/', import.meta.url);
const migrations = () => readdirSync(migrationDirectory).filter(name => name.endsWith('.sql')).sort()
  .map(name => ({ name, sql: readFileSync(new URL(name, migrationDirectory), 'utf8') }));
const migrationNumber = file => Number(file.name.slice(0, 4));

// Only D1's transport shape is adapted; production handlers execute their real SQL.
function setup({ version = 18, contacts = true } = {}) {
  const sql = new DatabaseSync(':memory:');
  const files = migrations();
  const baseline = files.filter(file => migrationNumber(file) <= version);
  for (const file of prepareMigrations(baseline, { application_captures: [], users: [] })) sql.exec(file.sql);
  if (version < 8) {
    // Exercise earlier signup INSERT shapes with the follow-up table present.
    const followupSchema = files.find(file => migrationNumber(file) === 8).sql;
    sql.exec(followupSchema.slice(followupSchema.indexOf('CREATE TABLE')));
  }
  if (contacts) {
    const contactMigration = files.find(file => migrationNumber(file) === 19);
    assert.ok(contactMigration, 'The waitlist contact migration must be checked in.');
    sql.exec(contactMigration.sql);
  }
  function statement(query, args = []) {
    return {
      bind(...values) { return statement(query, values); },
      async run() { return sql.prepare(query).run(...args); },
      async first() { return sql.prepare(query).get(...args) || null; },
      async all() { return { results: sql.prepare(query).all(...args) }; }
    };
  }
  return { sql, env: { DB: { prepare: statement }, APPLICATION_SYNC_SALT: 'synthetic-only', ADMIN_ACCESS_CODE: 'test-admin' } };
}

const post = (path, body) => new Request(`https://example.test/api/${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const exampleSignup = overrides => ({
  name: 'Synthetic Contact', email: '  Person@Gmail.com  ', phone: '+1 (202) 555-0142',
  userType: 'Individual Job Seeker', preferredContactMethod: 'Phone',
  country: 'United States', state: 'Massachusetts', city: 'Worcester', zipPostal: '01609',
  linkedinUrl: 'https://www.linkedin.com/in/synthetic-example',
  biggestChallenge: 'Need interview preparation', currentTools: 'Spreadsheet',
  desiredFeatures: 'Clear application tracking', targetRole: 'Data Analyst',
  targetSalary: '$75,000', individualChallenges: ['Not getting interviews', 'Skill gaps'],
  individualTools: ['Google Sheets'], betaInterest: true, interviewInterest: true, productUpdatesInterest: false,
  feedbackInterest: false, ...overrides
});
async function submit(handler, path, body, env) {
  const response = await handler({ request: post(path, body), env });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
async function admin(env, query = '') {
  const response = await summary({ request: new Request(`https://example.test/api/admin/summary${query}`, {
    headers: { 'X-Admin-Access-Code': 'test-admin' }
  }), env });
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get('Cache-Control') || '', /no-store/);
  return response.json();
}

for (const version of [5, 6, 7, 8, 10, 11, 18]) {
  test(`signup retains readable contact and full intake against schema ${version}`, async () => {
    const { sql, env } = setup({ version });
    try {
      const result = await submit(signup, 'waitlist', exampleSignup(), env);
      assert.equal(result.ok, true);
      assert.deepEqual(Object.keys(result).sort(), ['id', 'ok']);
      const row = sql.prepare('SELECT * FROM waitlist_signups WHERE id = ?').get(result.id);
      assert.equal(row.email, 'person@gmail.com');
      assert.equal(row.phone, '+1 (202) 555-0142');
      assert.equal(row.email_domain, 'gmail.com');
      assert.match(row.email_hash, /^[a-f0-9]{64}$/);
      assert.notEqual(row.email_hash, row.email);
      assert.equal(row.name, 'Synthetic Contact');
      const details = JSON.parse(row.intake_details_json);
      assert.equal(details.branchProfile.targetSalary, '$75,000');
      assert.deepEqual(details.branchProfile.individualChallenges, ['Not getting interviews', 'Skill gaps']);
      assert.equal(details.branchProfile.interests.productUpdates, false);
      assert.equal(details.branchProfile.interests.feedback, false);
      assert.equal(details.emailHash, undefined);
      assert.equal(details.id, undefined);
      assert.ok(!JSON.stringify(result).includes('person@gmail.com'));
      assert.ok(!JSON.stringify(result).includes('555-0142'));
    } finally { sql.close(); }
  });
}

test('contact migration preserves pre-existing signup and follow-up hashes without inventing addresses', async () => {
  const { sql, env } = setup({ contacts: false });
  try {
    const hash = 'a'.repeat(64);
    sql.prepare("INSERT INTO waitlist_signups (id, name, email_hash, email_domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run('legacy', 'Historical Contact', hash, 'personal_email', '2026-01-01', '2026-01-01');
    sql.prepare('INSERT INTO waitlist_followups (id, email_hash, submitted_at) VALUES (?, ?, ?)')
      .run('legacy-followup', hash, '2026-01-02');
    sql.exec(migrations().find(file => migrationNumber(file) === 19).sql);
    const before = sql.prepare('SELECT * FROM waitlist_signups WHERE id = ?').get('legacy');
    assert.equal(before.email_hash, hash);
    assert.equal(before.email, null);
    assert.equal(before.phone, null);
    assert.equal(before.name, 'Historical Contact');
    const oldFollowup = sql.prepare('SELECT email, email_hash FROM waitlist_followups').get();
    assert.equal(oldFollowup.email, null);
    assert.equal(oldFollowup.email_hash, hash);
    const data = await admin(env);
    const item = data.recentWaitlistSignups.find(row => row.id === 'legacy');
    assert.ok(item);
    assert.equal(item.email, '');
    assert.match(item.emailStatus, /not retained|legacy/i);
    assert.ok(!JSON.stringify(data).includes(hash));
  } finally { sql.close(); }
});

for (const [path, handler, table] of [['waitlist', signup, 'waitlist_signups'], ['follow-up', followup, 'waitlist_followups']]) {
  test(`${path} refuses writes until contact migration is installed`, async () => {
    const { sql, env } = setup({ contacts: false });
    try {
      const response = await handler({ request: post(path, exampleSignup()), env });
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /0019/);
      assert.equal(sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
    } finally { sql.close(); }
  });
}

test('signup validates the selected contact method and email without retaining unusable contacts', async () => {
  const { sql, env } = setup();
  try {
    for (const body of [
      exampleSignup({ email: 'not-an-email' }),
      exampleSignup({ preferredContactMethod: 'Phone', phone: '' }),
      exampleSignup({ preferredContactMethod: 'LinkedIn', linkedinUrl: '' })
    ]) {
      const response = await signup({ request: post('waitlist', body), env });
      assert.equal(response.status, 400, await response.clone().text());
    }
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM waitlist_signups').get().n, 0);
    await submit(signup, 'waitlist', exampleSignup({ preferredContactMethod: 'Email', phone: '' }), env);
    assert.equal(sql.prepare('SELECT email FROM waitlist_signups').get().email, 'person@gmail.com');
  } finally { sql.close(); }
});

for (const userType of ['Career Counselor / Advisor', 'Institution / Program Leader', 'Workforce / Gov / Nonprofit', 'Employer / Hiring Partner']) {
  test(`${userType} requires an organization or company name before saving`, async () => {
    const { sql, env } = setup();
    try {
      for (const organization of ['', '   ']) {
        const response = await signup({ request: post('waitlist', exampleSignup({ userType, organization })), env });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error, userType === 'Employer / Hiring Partner' ? 'Enter your company name.' : 'Enter your organization name.');
      }
      assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM waitlist_signups').get().n, 0);
      const { id } = await submit(signup, 'waitlist', exampleSignup({ userType, organization: '  Synthetic Organization  ' }), env);
      const row = sql.prepare('SELECT * FROM waitlist_signups WHERE id = ?').get(id);
      assert.equal(row.organization, 'Synthetic Organization');
      assert.equal(JSON.parse(row.intake_details_json).organization, 'Synthetic Organization');
    } finally { sql.close(); }
  });
}

for (const userType of ['Individual Job Seeker', 'Student']) {
  test(`${userType} can join without an organization`, async () => {
    const { sql, env } = setup();
    try {
      const { id } = await submit(signup, 'waitlist', exampleSignup({ userType, organization: '' }), env);
      assert.equal(sql.prepare('SELECT organization FROM waitlist_signups WHERE id = ?').get(id).organization, '');
    } finally { sql.close(); }
  });
}

test('signup rejects malformed or out-of-range GPA instead of changing or discarding the answer', async () => {
  const { sql, env } = setup();
  try {
    for (const gpa of ['3.7garbage', '5.0', '4.01', '-0.1', 'NaN', 'Infinity', '3e0', '0x3', '3,7']) {
      const response = await signup({ request: post('waitlist', exampleSignup({ userType: 'Student', gpa })), env });
      assert.equal(response.status, 400, `GPA ${gpa}`);
      assert.equal((await response.json()).error, 'Enter a GPA from 0 to 4, or leave it blank.');
    }
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM waitlist_signups').get().n, 0);
  } finally { sql.close(); }
});

test('signup preserves GPA endpoints and precision while leaving omitted GPA absent', async () => {
  const { sql, env } = setup();
  try {
    for (const [gpa, expected] of [[0, 0], ['0', 0], ['4', 4], [3.75, 3.75], ['.5', 0.5], ['3.625', 3.625], ['', null], ['   ', null], [null, null], [undefined, null]]) {
      const { id } = await submit(signup, 'waitlist', exampleSignup({ userType: 'Student', gpa }), env);
      const row = sql.prepare('SELECT * FROM waitlist_signups WHERE id = ?').get(id);
      const details = JSON.parse(row.intake_details_json);
      assert.equal(row.gpa, expected);
      assert.equal(details.gpa, expected);
      assert.equal(details.branchProfile.gpa, expected === null ? undefined : expected);
    }
  } finally { sql.close(); }
});

test('signup validates every provided LinkedIn URL even when email is the preferred contact', async () => {
  const { sql, env } = setup();
  try {
    for (const linkedinUrl of [
      'not a URL', 'https://example.test/in/person', 'https://linkedin.com.example.test/in/person',
      'https://notlinkedin.com/in/person', 'https://www.linkedin.com@example.test/in/person',
      'https://person:password@linkedin.com/in/person', 'ftp://linkedin.com/in/person', 'javascript:alert(1)'
    ]) {
      const response = await signup({ request: post('waitlist', exampleSignup({ preferredContactMethod: 'Email', linkedinUrl })), env });
      assert.equal(response.status, 400, linkedinUrl);
      assert.equal((await response.json()).error, 'Enter a valid LinkedIn profile URL, or leave it blank.');
    }
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM waitlist_signups').get().n, 0);
  } finally { sql.close(); }
});

test('signup normalizes common schemeless LinkedIn profiles and preserves complete valid profile URLs', async () => {
  const { sql, env } = setup();
  try {
    const profiles = [
      [' linkedin.com/in/synthetic-person?trk=public#about ', 'https://linkedin.com/in/synthetic-person?trk=public#about'],
      ['www.linkedin.com/in/synthetic-person', 'https://www.linkedin.com/in/synthetic-person'],
      ['https://uk.linkedin.com/in/synthetic-person', 'https://uk.linkedin.com/in/synthetic-person'],
      ['http://linkedin.com/in/synthetic-person', 'http://linkedin.com/in/synthetic-person']
    ];
    for (const preferredContactMethod of ['Email', 'LinkedIn']) {
      for (const [linkedinUrl, expected] of profiles) {
        const { id } = await submit(signup, 'waitlist', exampleSignup({ preferredContactMethod, linkedinUrl }), env);
        const row = sql.prepare('SELECT * FROM waitlist_signups WHERE id = ?').get(id);
        assert.equal(row.linkedin_url, expected);
        assert.equal(JSON.parse(row.intake_details_json).linkedinUrl, expected);
        assert.equal((await admin(env)).recentWaitlistSignups.find(item => item.id === id).linkedinUrl, expected);
      }
    }
  } finally { sql.close(); }
});

test('signup allows an omitted optional LinkedIn URL but requires it for LinkedIn contact', async () => {
  const { sql, env } = setup();
  try {
    const response = await signup({ request: post('waitlist', exampleSignup({ preferredContactMethod: 'LinkedIn', linkedinUrl: '  ' })), env });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Enter your LinkedIn profile URL so we can contact you there.');
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM waitlist_signups').get().n, 0);
    const { id } = await submit(signup, 'waitlist', exampleSignup({ preferredContactMethod: 'Email', linkedinUrl: '' }), env);
    assert.equal(sql.prepare('SELECT linkedin_url FROM waitlist_signups WHERE id = ?').get(id).linkedin_url, '');
  } finally { sql.close(); }
});

for (const version of [8, 10, 18]) {
  test(`follow-up retains readable email, phone and complete response against schema ${version}`, async () => {
    const { sql, env } = setup({ version });
    try {
      const result = await submit(followup, 'follow-up', {
        email: '  Followup@Gmail.com ', phone: '+44 20 7946 0018',
        currentStatus: 'Employed', applicationCount: 8, interviewCount: 2, offerCount: 1,
        placementStatus: 'Placed', salaryAmount: '75000', salaryPeriod: 'Annual',
        employer: 'Synthetic Employer', notes: 'Please follow up next month.', supportNeeded: 'Negotiation',
        leadId: 'LD-000123', contactId: 'CT-000123'
      }, env);
      assert.equal(result.ok, true);
      assert.deepEqual(Object.keys(result).sort(), ['ok', 'submittedAt']);
      const row = sql.prepare('SELECT * FROM waitlist_followups').get();
      assert.equal(row.email, 'followup@gmail.com');
      assert.equal(row.phone, '+44 20 7946 0018');
      assert.equal(row.email_domain, 'gmail.com');
      assert.match(row.email_hash, /^[a-f0-9]{64}$/);
      assert.equal(row.notes, 'Please follow up next month.');
      const details = JSON.parse(row.response_details_json);
      assert.equal(Number(details.salaryAmount), 75000);
      assert.equal(details.employer, 'Synthetic Employer');
      assert.ok(!JSON.stringify(result).includes('followup@gmail.com'));
    } finally { sql.close(); }
  });
}

test('admin only receives retained contact details and the complete signup context', async () => {
  const { sql, env } = setup();
  try {
    const { id } = await submit(signup, 'waitlist', exampleSignup(), env);
    for (const headers of [{}, { 'X-Admin-Access-Code': 'wrong' }, { 'X-Beta-Access-Code': 'test-admin' }]) {
      const response = await summary({ request: new Request('https://example.test/api/admin/summary', { headers }), env });
      assert.equal(response.status, 401);
      assert.ok(!(await response.text()).includes('person@gmail.com'));
    }
    const data = await admin(env);
    const item = data.recentWaitlistSignups.find(row => row.id === id);
    assert.equal(item.email, 'person@gmail.com');
    assert.equal(item.phone, '+1 (202) 555-0142');
    assert.equal(item.emailStatus, 'Available');
    assert.equal(item.preferredContactMethod, 'Phone');
    assert.equal(item.city, 'Worcester');
    assert.equal(item.zipPostal, '01609');
    assert.equal(item.linkedinUrl, 'https://www.linkedin.com/in/synthetic-example');
    assert.equal(item.biggestChallenge, 'Need interview preparation');
    assert.equal(item.currentTools, 'Spreadsheet');
    assert.equal(item.desiredFeatures, 'Clear application tracking');
    assert.equal(item.intakeDetails.branchProfile.targetSalary, '$75,000');
    assert.equal(data.pendingIntakeFollowUps[0].email, item.email);
    assert.equal(data.pendingIntakeFollowUps[0].phone, item.phone);
    assert.ok(!JSON.stringify(data).includes('email_hash'));
    const filtered = await admin(env, '?q=person%40gmail.com');
    assert.equal(filtered.totals.waitlistSignups, 1);
    const absent = await admin(env, '?q=nobody%40example.test');
    assert.equal(absent.totals.waitlistSignups, 0);
  } finally { sql.close(); }
});

test('a follow-up matches only the same contact, never everyone sharing a personal or organization domain', async () => {
  const { sql, env } = setup();
  try {
    for (const email of ['first@gmail.com', 'second@gmail.com', 'first@company.test', 'second@company.test']) {
      await submit(signup, 'waitlist', exampleSignup({ email, preferredContactMethod: 'Email' }), env);
    }
    await submit(followup, 'follow-up', { email: ' FIRST@GMAIL.COM ', currentStatus: 'Employed' }, env);
    await submit(followup, 'follow-up', { email: 'first@company.test', currentStatus: 'Employed' }, env);
    const data = await admin(env);
    assert.equal(data.totals.pendingIntakeFollowUps, 2);
    assert.deepEqual(data.pendingIntakeFollowUps.map(item => item.email).sort(), ['second@company.test', 'second@gmail.com']);
    assert.equal(data.completedFollowUps.length, 2);
    assert.equal(data.completedFollowUps.find(item => item.email === 'first@gmail.com').emailStatus, 'Available');
  } finally { sql.close(); }
});

test('follow-up notes and identity remain readable in protected admin results', async () => {
  const { sql, env } = setup();
  try {
    await submit(followup, 'follow-up', {
      email: 'Person@Example.test', phone: '+1 202 555 0142', notes: 'Call after 3 PM',
      supportNeeded: 'Interview practice', employer: 'Synthetic Employer', salaryAmount: '0',
      verificationStatus: 'Self-reported'
    }, env);
    const data = await admin(env);
    const item = data.completedFollowUps[0];
    assert.equal(item.email, 'person@example.test');
    assert.equal(item.phone, '+1 202 555 0142');
    assert.equal(item.notes, 'Call after 3 PM');
    assert.equal(item.supportNeeded, 'Interview practice');
    assert.equal(item.responseDetails.employer, 'Synthetic Employer');
  } finally { sql.close(); }
});

test('all loaded waitlist contacts remain available beyond the old 20-record display and export limit', async () => {
  const { sql, env } = setup();
  try {
    for (let index = 0; index < 25; index++) {
      await submit(signup, 'waitlist', exampleSignup({ email: `contact-${index}@example.test` }), env);
    }
    const data = await admin(env);
    assert.equal(data.totals.waitlistSignups, 25);
    assert.equal(data.recentWaitlistSignups.length, 25);
    assert.equal(data.pendingIntakeFollowUps.length, 25);
    const csv = csvForRecords(data.recentWaitlistSignups);
    for (let index = 0; index < 25; index++) assert.ok(csv.includes(`contact-${index}@example.test`));
  } finally { sql.close(); }
});

test('new optional-email follow-ups are distinguished from legacy missing contact details', async () => {
  const { sql, env } = setup();
  try {
    await submit(followup, 'follow-up', { leadId: 'LD-000001', email: '', notes: 'No address supplied' }, env);
    const data = await admin(env);
    assert.equal(data.completedFollowUps[0].email, '');
    assert.equal(data.completedFollowUps[0].emailStatus, 'Not provided');
    const invalid = await followup({ request: post('follow-up', { email: 'invalid-address' }), env });
    assert.equal(invalid.status, 400);
    assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM waitlist_followups').get().n, 1);
  } finally { sql.close(); }
});

test('searching a signup by name still recognizes an existing email-matched follow-up', async () => {
  const { sql, env } = setup();
  try {
    await submit(signup, 'waitlist', exampleSignup({ name: 'Unique Synthetic Name' }), env);
    await submit(followup, 'follow-up', { email: 'person@gmail.com', currentStatus: 'Employed' }, env);
    const data = await admin(env, '?q=Unique%20Synthetic%20Name');
    assert.equal(data.totals.waitlistSignups, 1);
    assert.equal(data.totals.pendingIntakeFollowUps, 0);
    assert.equal(data.waitlistFunnel.find(stage => stage.label === 'Submitted follow-up').count, 1);
  } finally { sql.close(); }
});

test('missing salary stays distinct from an explicitly reported zero in admin results and exports', async () => {
  const { sql, env } = setup();
  try {
    await submit(followup, 'follow-up', { email: 'missing@example.test', salaryAmount: '' }, env);
    await submit(followup, 'follow-up', { email: 'zero@example.test', salaryAmount: '0' }, env);
    const data = await admin(env);
    for (const records of [data.recentFollowUps, data.completedFollowUps]) {
      const missing = records.find(record => record.email === 'missing@example.test');
      const zero = records.find(record => record.email === 'zero@example.test');
      assert.equal(missing.salaryAmount, null);
      assert.equal(zero.salaryAmount, 0);
      assert.equal(flattenRecord(missing)['Salary amount'], 'Not provided');
      assert.equal(flattenRecord(zero)['Salary amount'], 0);
    }
  } finally { sql.close(); }
});

test('exports flatten full contact answers with meaningful labels and preserve zero and No values', () => {
  const flat = flattenRecord({
    name: 'Synthetic Contact', email: 'person@example.test', phone: '+1 202 555 0142',
    intakeDetails: { branchProfile: { targetSalary: '$75,000', individualChallenges: ['Skill gaps', 'Interviews'],
      interests: { productUpdates: false, beta: true } } },
    gpa: 0, interviewCount: 0, organization: null
  });
  assert.equal(flat['Full name'], 'Synthetic Contact');
  assert.equal(flat['Email address'], 'person@example.test');
  assert.equal(flat['Phone number'], '+1 202 555 0142');
  assert.equal(flat['Original signup answers / Branch profile / Target salary'], '$75,000');
  assert.equal(flat['Original signup answers / Branch profile / Job seeker challenges'], 'Skill gaps; Interviews');
  assert.equal(flat['Original signup answers / Branch profile / Interests / Product updates requested'], 'No');
  assert.equal(flat['Original signup answers / Branch profile / Interests / Early beta access interest'], 'Yes');
  assert.equal(flat.GPA, 0);
  assert.equal(flat.Interviews, 0);
  assert.equal(flat.Organization, 'Not provided');
  assert.equal(displayValue('personal_email'), 'Personal email domain (legacy record)');
});

test('CSV safely quotes text, blocks formula interpretation and includes fields appearing in later rows', () => {
  const csv = csvForRecords([
    { name: '=1+1', phone: '+1 202 555 0142', notes: 'Comma, quote " and\nnewline', interviewCount: -1 },
    { name: '  @SUM(1,2)', phone: '\t1234', responseDetails: { employer: 'Synthetic Employer' }, interviewCount: 0 }
  ]);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\'+1 202 555 0142"'));
  assert.ok(csv.includes('"\'  @SUM(1,2)"'));
  assert.ok(csv.includes('"\'\t1234"'));
  assert.ok(csv.includes('"Comma, quote "" and\nnewline"'));
  assert.ok(csv.includes('"-1"'));
  assert.ok(!csv.includes('"\'-1"'));
  assert.ok(csv.split('\r\n')[0].includes('"Follow-up answers / Employer"'));
  assert.ok(csv.includes('"Synthetic Employer"'));
  assert.equal(csvForRecords([]), '');
});
