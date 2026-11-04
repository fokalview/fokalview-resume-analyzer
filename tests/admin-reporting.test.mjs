import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { prepareMigrations } from '../scripts/migration-plan.mjs';
import { onRequestGet } from '../functions/api/admin/summary.js';
import { onRequestPost as submitFollowup } from '../functions/api/follow-up.js';

function setup({ failSource = '' } = {}) {
  const sql = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  const files = readdirSync(directory).filter(name => name.endsWith('.sql') && Number(name.slice(0, 4)) <= 19)
    .sort().map(name => ({ name, sql: readFileSync(new URL(name, directory), 'utf8') }));
  for (const file of prepareMigrations(files, { application_captures: [], users: [] })) sql.exec(file.sql);
  const statement = (query, args = []) => ({
    bind(...values) { return statement(query, values); },
    async run() { return sql.prepare(query).run(...args); },
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() {
      if (failSource && query.includes(`FROM ${failSource}`)) throw new Error('Synthetic data-source failure');
      return { results: sql.prepare(query).all(...args) };
    }
  });
  return { sql, env: { DB: { prepare: statement }, ADMIN_ACCESS_CODE: 'synthetic-admin' } };
}

function addSignup(sql, { id, email = `${id}@example.test`, leadId = id, name = id, gpa = null, hash = `signup-${email}`, interviewInterest = 1 }) {
  sql.prepare(`INSERT INTO waitlist_signups (id,name,email,email_hash,lead_id,gpa,interview_interest,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, name, email, hash, leadId, gpa, interviewInterest, '2026-10-01', '2026-10-01');
}

function addFollowup(sql, {
  id, email = `${id}@example.test`, leadId = '', hash = email ? `followup-${email}` : '',
  applications = 0, interviews = 0, offers = 0, placement = 'Not placed',
  salary = null, period = '', currency = '', at = '2026-10-01', notes = ''
}) {
  sql.prepare(`INSERT INTO waitlist_followups (id,email,email_hash,lead_id,application_count,interview_count,offer_count,placement_status,salary_amount,salary_period,submitted_at,notes,response_details_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, email, hash, leadId, applications, interviews, offers, placement, salary, period, at, notes, JSON.stringify({ salaryCurrency: currency }));
}

function addResume(sql, id, { careerLevel = '', gaps = [], score = 80 } = {}) {
  const profile = { careerLevel, skills: { technical: [], tools: [], soft: [] }, industries: [], workHistory: [], education: [] };
  const analysis = { score, keywordAnalysis: { missing: gaps, matched: [] }, strengths: [], improvements: [], sections: [] };
  sql.prepare(`INSERT INTO resume_records (id,client_hash,profile_json,analysis_json,consent_version,captured_at,updated_at)
    VALUES (?,?,?,?,?,?,?)`).run(id, `synthetic-${id}`, JSON.stringify(profile), JSON.stringify(analysis), 'test', '2026-10-01', '2026-10-01');
}

async function read(env, query = '') {
  const response = await onRequestGet({ request: new Request(`https://example.test/api/admin/summary${query}`, { headers: { 'X-Admin-Access-Code': 'synthetic-admin' } }), env });
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  return response.json();
}

test('only explicit placed/accepted statuses count as placements', async () => {
  const { sql, env } = setup();
  try {
    ['Not placed', 'Placed', 'Offer received', 'Accepted role', 'Unplaced', 'Not accepted', 'Prefer not to say']
      .forEach((placement, index) => addFollowup(sql, { id: `response-${index}`, placement }));
    const data = await read(env);
    assert.equal(data.totals.followUpPlacements, 2);
    assert.equal(data.totals.followUpRespondents, 7);
    assert.equal(data.conversionMetrics.find(item => item.label === 'Respondents placed').value, 29);
  } finally { sql.close(); }
});

test('outcome totals use the latest cumulative response per exact linked identity while preserving history', async () => {
  const { sql, env } = setup();
  try {
    addSignup(sql, { id: 'lead-a', email: 'person@example.test' });
    addFollowup(sql, { id: 'older', email: 'person@example.test', applications: 10, interviews: 3, offers: 1, placement: 'Placed', at: '2026-10-01' });
    addFollowup(sql, { id: 'newer', email: '', leadId: 'lead-a', applications: 14, interviews: 4, offers: 2, placement: 'Not placed', at: '2026-10-02' });
    const data = await read(env);
    assert.equal(data.totals.followUpSurveys, 2);
    assert.equal(data.totals.followUpRespondents, 1);
    assert.equal(data.totals.followUpApplications, 14);
    assert.equal(data.totals.followUpInterviews, 4);
    assert.equal(data.totals.followUpOffers, 2);
    assert.equal(data.totals.followUpPlacements, 0);
    assert.equal(data.recentFollowUps.length, 2);
    assert.equal(data.completedFollowUps.length, 2);
    for (const stage of data.followUpFunnel) assert.ok(stage.rate >= 0 && stage.rate <= 100);
    assert.equal(data.followUpFunnel.find(item => item.label === 'Respondents reporting interviews').count, 1);
  } finally { sql.close(); }
});

test('coverage counts distinct matched waitlist contacts, not duplicate or unrelated response rows', async () => {
  const { sql, env } = setup();
  try {
    addSignup(sql, { id: 'lead-a', email: 'first@gmail.com' });
    addSignup(sql, { id: 'duplicate-a', email: 'first@gmail.com' });
    addSignup(sql, { id: 'lead-b', email: 'second@gmail.com' });
    addFollowup(sql, { id: 'first', email: 'first@gmail.com', at: '2026-10-01' });
    addFollowup(sql, { id: 'repeat', email: 'first@gmail.com', at: '2026-10-02' });
    addFollowup(sql, { id: 'unrelated', email: 'other@gmail.com' });
    addFollowup(sql, { id: 'anonymous', email: '', applications: 999, placement: 'Placed' });
    const data = await read(env);
    assert.equal(data.totals.waitlistSignups, 3);
    assert.equal(data.totals.uniqueWaitlistContacts, 2);
    assert.equal(data.totals.waitlistContactsWithFollowUp, 1);
    assert.equal(data.conversionMetrics.find(item => item.label === 'Follow-up coverage').value, 50);
    assert.equal(data.decisionSignals.find(item => item.label === 'Outcome-data coverage').value, 50);
    assert.equal(data.totals.followUpRespondents, 2);
    assert.equal(data.totals.unlinkedFollowUpResponses, 1);
    assert.equal(data.totals.followUpApplications, 0);
    assert.equal(data.totals.followUpPlacements, 0);
  } finally { sql.close(); }
});

test('legacy hashes deduplicate within their own record type without guessing cross-type matches', async () => {
  const { sql, env } = setup();
  try {
    addSignup(sql, { id: 'legacy-a', email: null, leadId: '', hash: 'same-opaque-hash' });
    addFollowup(sql, { id: 'older', email: null, hash: 'same-opaque-hash', applications: 3, at: '2026-10-01' });
    addFollowup(sql, { id: 'newer', email: null, hash: 'same-opaque-hash', applications: 4, at: '2026-10-02' });
    const data = await read(env);
    assert.equal(data.totals.followUpRespondents, 1);
    assert.equal(data.totals.followUpApplications, 4);
    assert.equal(data.totals.waitlistContactsWithFollowUp, 0);
    assert.ok(!JSON.stringify(data).includes('same-opaque-hash'));
  } finally { sql.close(); }
});

test('duplicate signup identities share completed coverage and are never left falsely pending', async () => {
  const { sql, env } = setup();
  try {
    addSignup(sql, { id: 'lead-a', email: 'same@example.test' });
    addSignup(sql, { id: 'lead-b', email: 'same@example.test' });
    addFollowup(sql, { id: 'response', email: '', leadId: 'lead-b' });
    const data = await read(env);
    assert.equal(data.totals.uniqueWaitlistContacts, 1);
    assert.equal(data.totals.waitlistContactsWithFollowUp, 1);
    assert.equal(data.totals.pendingIntakeFollowUps, 0);
    assert.equal(data.waitlistFunnel.find(stage => stage.label === 'Submitted follow-up').count, 2);
  } finally { sql.close(); }
});

test('salary statistics keep periods separate, include explicit zero, and exclude missing values', async () => {
  const { sql, env } = setup();
  try {
    addFollowup(sql, { id: 'annual', salary: 100000, period: 'Annual', currency: 'USD' });
    addFollowup(sql, { id: 'hourly', salary: 50, period: 'Hourly', currency: 'USD' });
    addFollowup(sql, { id: 'zero', salary: 0, period: 'Hourly', currency: 'USD' });
    addFollowup(sql, { id: 'missing', salary: null, period: 'Annual' });
    const data = await read(env);
    assert.equal(data.totals.salaryResponses, 3);
    assert.equal(data.totals.medianSalary, null);
    assert.equal(data.totals.averageSalary, null);
    assert.deepEqual(data.salaryByPeriod.map(({ note, ...values }) => values), [
      { currency: 'USD', period: 'Annual', count: 1, median: 100000, average: 100000 },
      { currency: 'USD', period: 'Hourly', count: 2, median: 25, average: 25 }
    ]);
  } finally { sql.close(); }
});

test('all signup and report records are accessible beyond previous 1000/20 caps, with independent global counts', async () => {
  const { sql, env } = setup();
  try {
    for (let index = 0; index < 1005; index++) addSignup(sql, { id: `lead-${index}`, name: index === 0 ? 'OnlyMatch' : `Person ${index}` });
    for (let index = 0; index < 24; index++) addResume(sql, `report-${index}`);
    const data = await read(env);
    assert.equal(data.recentWaitlistSignups.length, 1005);
    assert.equal(data.globalTotals.waitlistSignups, 1005);
    assert.equal(data.recentResumeRecords.length, 24);
    assert.equal(new Set(data.recentResumeRecords.map(row => row.id)).size, 24);
    assert.equal(data.meta.recordScope, 'All matching records');
    assert.equal(data.meta.sources.waitlist.count, 1005);
    assert.ok(data.recentResumeRecords[0].analysis);
    const filtered = await read(env, '?q=OnlyMatch');
    assert.equal(filtered.recentWaitlistSignups.length, 1);
    assert.equal(filtered.totals.waitlistSignups, 1);
    assert.equal(filtered.globalTotals.waitlistSignups, 1005);
    assert.equal(filtered.globalTotals.resumeRecords, 24);
  } finally { sql.close(); }
});

test('a failed source returns actionable unavailability, never an empty-success dashboard', async () => {
  const { sql, env } = setup({ failSource: 'waitlist_signups' });
  try {
    const response = await onRequestGet({ request: new Request('https://example.test/api/admin/summary', { headers: { 'X-Admin-Access-Code': 'synthetic-admin' } }), env });
    assert.equal(response.status, 503);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    const data = await response.json();
    assert.deepEqual(data.sourceErrors, ['waitlist']);
    assert.equal(data.totals, undefined);
    assert.ok(!JSON.stringify(data).includes('Synthetic data-source failure'));
  } finally { sql.close(); }
});

test('empty sources are available and empty, with no invented salary observations', async () => {
  const { sql, env } = setup();
  try {
    const data = await read(env);
    assert.deepEqual(data.meta.sources.waitlist, { status: 'available', count: 0 });
    assert.equal(data.totals.waitlistSignups, 0);
    assert.equal(data.totals.medianSalary, null);
    assert.deepEqual(data.salaryByPeriod, []);
  } finally { sql.close(); }
});

test('unreadable stored report data is reported as unavailable instead of silently dropping analyses', async () => {
  const { sql, env } = setup();
  try {
    addResume(sql, 'broken');
    sql.prepare('UPDATE resume_records SET analysis_json=? WHERE id=?').run('{not-json', 'broken');
    const response = await onRequestGet({ request: new Request('https://example.test/api/admin/summary', { headers: { 'X-Admin-Access-Code': 'synthetic-admin' } }), env });
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.deepEqual(data.sourceErrors, ['resumes']);
    assert.equal(data.totals, undefined);
  } finally { sql.close(); }
});

test('salary amounts with unknown or Other periods are counted but never misleadingly averaged', async () => {
  const { sql, env } = setup();
  try {
    addFollowup(sql, { id: 'unknown', salary: 2000, period: '' });
    addFollowup(sql, { id: 'other', salary: 40, period: 'Other' });
    const data = await read(env);
    assert.equal(data.totals.salaryResponses, 2);
    for (const group of data.salaryByPeriod) {
      assert.equal(group.count, 1);
      assert.equal(group.median, null);
      assert.equal(group.average, null);
    }
  } finally { sql.close(); }
});

test('unknown career level stays unknown, GPA zero is included, and duplicate skills count once per analysis', async () => {
  const { sql, env } = setup();
  try {
    addResume(sql, 'unknown', { gaps: ['SQL', 'sql', 'SQL'] });
    addResume(sql, 'mid', { careerLevel: 'Mid Career', gaps: ['SQL'] });
    addSignup(sql, { id: 'zero', gpa: 0 });
    addSignup(sql, { id: 'missing', gpa: null });
    const data = await read(env);
    assert.equal(data.careerLevels.Unknown, 1);
    assert.equal(data.careerLevels['Mid Career'], 1);
    assert.equal(data.waitlistGpaBands['0.00-2.49'], 1);
    const sqlGap = data.commonSkillGaps['Technical Skills'].find(item => item.label === 'sql');
    assert.equal(sqlGap.count, 2);
    assert.equal(sqlGap.percentAffected, 100);
  } finally { sql.close(); }
});

test('querying a signup name retains global response linkage and latest respondent metrics', async () => {
  const { sql, env } = setup();
  try {
    addSignup(sql, { id: 'lead', email: 'person@example.test', name: 'Named Person' });
    addFollowup(sql, { id: 'response', email: 'person@example.test', applications: 5, placement: 'Placed' });
    const data = await read(env, '?q=Named%20Person');
    assert.equal(data.totals.waitlistContactsWithFollowUp, 1);
    assert.equal(data.totals.followUpRespondents, 1);
    assert.equal(data.totals.followUpApplications, 5);
    assert.equal(data.totals.pendingIntakeFollowUps, 0);
    assert.equal(data.recentWaitlistSignups[0].linkedFollowUps[0].matchedContactName, 'Named Person');
    assert.deepEqual(data.recentWaitlistSignups[0].linkedFollowUpIds, ['response']);
    assert.deepEqual(data.recentWaitlistSignups[0].linkedFollowUps[0].matchedSignupIds, ['lead']);
    assert.equal(data.recentWaitlistSignups[0].linkedFollowUps[0].applicationCount, 5);
    assert.ok(!JSON.stringify(data).includes('followup-person@example.test'));
  } finally { sql.close(); }
});

test('same-period salary statistics never mix currencies or infer currency for legacy responses', async () => {
  const { sql, env } = setup();
  try {
    addFollowup(sql, { id: 'usd', salary: 100000, period: 'Annual', currency: 'USD' });
    addFollowup(sql, { id: 'eur', salary: 50000, period: 'Annual', currency: 'EUR' });
    addFollowup(sql, { id: 'unknown', salary: 90000, period: 'Annual' });
    const data = await read(env);
    assert.equal(data.totals.medianSalary, null);
    assert.equal(data.salaryByPeriod.find(group => group.currency === 'USD').median, 100000);
    assert.equal(data.salaryByPeriod.find(group => group.currency === 'EUR').median, 50000);
    const unknown = data.salaryByPeriod.find(group => !group.currency);
    assert.equal(unknown.count, 1);
    assert.equal(unknown.median, null);
    assert.match(unknown.note, /Currency was not provided/);
    assert.equal(data.recentFollowUps.find(row => row.id === 'unknown').salaryAmount, 90000);
  } finally { sql.close(); }
});

test('public follow-up currency is normalized, retained and validated without leaking it in submission response', async () => {
  const { sql, env } = setup();
  try {
    const post = body => new Request('https://example.test/api/follow-up', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const saved = await submitFollowup({ env, request: post({ email: 'person@example.test', salaryAmount: '1500', salaryPeriod: 'Monthly', salaryCurrency: ' usd ' }) });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).salaryCurrency, undefined);
    const data = await read(env);
    assert.equal(data.recentFollowUps[0].salaryCurrency, 'USD');
    assert.equal(data.recentFollowUps[0].responseDetails.salaryCurrency, 'USD');
    assert.equal(data.totals.medianSalary, 1500);
    assert.equal(data.totals.salarySummaryCurrency, 'USD');
    assert.equal(data.totals.salarySummaryPeriod, 'Monthly');
    const invalid = await submitFollowup({ env, request: post({ email: 'person@example.test', salaryCurrency: 'DOLLARS' }) });
    assert.equal(invalid.status, 400);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM waitlist_followups').get().n, 1);
  } finally { sql.close(); }
});
