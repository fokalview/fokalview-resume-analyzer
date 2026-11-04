import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestGet, onRequestPost } from '../functions/api/admin/outreach.js';

function setup() {
  const sql = new DatabaseSync(':memory:');
  sql.exec("CREATE TABLE waitlist_signups (id TEXT PRIMARY KEY, name TEXT); INSERT INTO waitlist_signups VALUES ('lead-a', 'Synthetic lead'), ('lead-b', 'Second synthetic lead');");
  const migration = readFileSync(new URL('../migrations/0020_waitlist_outreach.sql', import.meta.url), 'utf8');
  sql.exec(migration); sql.exec(migration);
  const prepare = (query, args = []) => ({
    bind(...next) { return prepare(query, next); },
    async first() { return sql.prepare(query).get(...args) || null; },
    async all() { return { results: sql.prepare(query).all(...args) }; }
  });
  return { sql, env: { DB: { prepare }, ADMIN_ACCESS_CODE: 'synthetic-admin' } };
}
const request = (body, code = 'synthetic-admin') => new Request('https://example.test/api/admin/outreach', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Access-Code': code }, body: JSON.stringify(body)
});
const plan = (overrides = {}) => ({ leadId: 'lead-a', expectedRevision: 0, status: 'Contacted', owner: 'Alex', notes: 'Asked for a demo', lastContactDate: '2026-11-04', nextFollowUpDate: '2026-11-10', ...overrides });
const get = (env, id = 'lead-a') => onRequestGet({ env, request: new Request(`https://example.test/api/admin/outreach${id ? `?leadId=${id}` : ''}`, { headers: { 'X-Admin-Access-Code': 'synthetic-admin' } }) });

test('outreach refuses unauthenticated reads and writes before touching storage', async () => {
  const env = { ADMIN_ACCESS_CODE: 'synthetic-admin', DB: { prepare() { throw new Error('must not touch data'); } } };
  for (const code of ['', 'wrong']) {
    assert.equal((await onRequestPost({ env, request: request(plan(), code) })).status, 401);
    assert.equal((await onRequestGet({ env, request: new Request('https://example.test/api/admin/outreach', { headers: { 'X-Admin-Access-Code': code } }) })).status, 401);
  }
  assert.equal((await onRequestPost({ env: {}, request: request(plan()) })).status, 503);
});

test('follow-up revisions persist all fields, reject stale writes and preserve signup records', async () => {
  const { sql, env } = setup();
  try {
    const empty = await (await get(env)).json();
    assert.equal(empty.current.status, 'New'); assert.equal(empty.history.length, 0);
    const first = await onRequestPost({ env, request: request(plan()) });
    assert.equal(first.status, 200); assert.equal(first.headers.get('Cache-Control'), 'no-store');
    const saved = (await first.json()).current;
    assert.equal(saved.revision, 1); assert.equal(saved.owner, 'Alex'); assert.equal(saved.nextFollowUpDate, '2026-11-10');
    const second = await onRequestPost({ env, request: request(plan({ expectedRevision: 1, status: 'Awaiting reply', notes: 'Second note' })) });
    assert.equal(second.status, 200);
    assert.equal((await onRequestPost({ env, request: request(plan({ expectedRevision: 1, notes: 'Stale overwrite' })) })).status, 409);
    const data = await (await get(env)).json();
    assert.equal(data.current.status, 'Awaiting reply'); assert.equal(data.history.length, 2);
    assert.equal(data.history[1].notes, 'Asked for a demo'); assert.equal(data.current.notes, 'Second note');
    const index = await (await get(env, '')).json();
    assert.equal(index.records.length, 1); assert.equal(index.records[0].revision, 2);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM waitlist_signups').get().n, 2);
    assert.equal((await (await get(env, 'lead-b')).json()).current.revision, 0);
  } finally { sql.close(); }
});

test('outreach rejects invalid statuses, oversized notes, impossible dates and unknown leads', async () => {
  const { sql, env } = setup();
  try {
    for (const changes of [{ status: 'Approved' }, { notes: 'x'.repeat(5001) }, { nextFollowUpDate: '2026-02-30' }, { expectedRevision: -1 }, { expectedRevision: Number.MAX_SAFE_INTEGER }, { owner: {} }]) {
      assert.equal((await onRequestPost({ env, request: request(plan(changes)) })).status, 400);
    }
    assert.equal((await onRequestPost({ env, request: request(plan({ leadId: 'missing' })) })).status, 404);
    assert.equal((await get(env, 'missing')).status, 404);
    assert.equal(sql.prepare('SELECT count(*) AS n FROM waitlist_outreach').get().n, 0);
  } finally { sql.close(); }
});

test('outreach reports unavailable storage instead of an empty successful history', async () => {
  const { sql, env } = setup();
  try {
    sql.exec('DROP TABLE waitlist_outreach');
    assert.equal((await get(env)).status, 503);
    assert.equal((await onRequestPost({ env, request: request(plan()) })).status, 503);
  } finally { sql.close(); }
});
