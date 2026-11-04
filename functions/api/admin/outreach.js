const STATUSES = new Set(['New', 'Contacted', 'Awaiting reply', 'Meeting scheduled', 'Pilot discussion', 'Closed']);
const SELECT_FIELDS = 'id, lead_id AS leadId, revision, status, owner, notes, last_contact_date AS lastContactDate, next_followup_date AS nextFollowUpDate, created_at AS updatedAt';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function authorize(request, env) {
  const supplied = request.headers.get('X-Admin-Access-Code');
  if (!env.ADMIN_ACCESS_CODE && !env.OWNER_ACCESS_CODE) return json({ error: 'Admin access is not configured.' }, 503);
  if (!supplied || (supplied !== env.ADMIN_ACCESS_CODE && supplied !== env.OWNER_ACCESS_CODE)) return json({ error: 'Invalid admin access code.' }, 401);
  if (!env.DB) return json({ error: 'Follow-up storage is unavailable.' }, 503);
  return null;
}

function defaultPlan(leadId) {
  return { leadId, revision: 0, status: 'New', owner: '', notes: '', lastContactDate: '', nextFollowUpDate: '', updatedAt: null };
}

export async function onRequestGet({ request, env }) {
  const denied = authorize(request, env);
  if (denied) return denied;
  const leadId = new URL(request.url).searchParams.get('leadId');
  try {
    if (!leadId) {
      const rows = await env.DB.prepare(`SELECT ${SELECT_FIELDS} FROM waitlist_outreach AS o
        WHERE revision = (SELECT MAX(revision) FROM waitlist_outreach WHERE lead_id = o.lead_id)
        ORDER BY created_at DESC, id DESC`).all();
      return json({ records: rows.results || [] });
    }
    if (leadId.length > 200) return json({ error: 'Invalid waitlist record.' }, 400);
    const lead = await env.DB.prepare('SELECT id FROM waitlist_signups WHERE id = ?').bind(leadId).first();
    if (!lead) return json({ error: 'Waitlist record not found.' }, 404);
    const rows = await env.DB.prepare(`SELECT ${SELECT_FIELDS} FROM waitlist_outreach WHERE lead_id = ? ORDER BY revision DESC`).bind(leadId).all();
    const history = rows.results || [];
    return json({ current: history[0] || defaultPlan(leadId), history });
  } catch {
    return json({ error: 'Follow-up plans could not be loaded. Please retry; existing records are preserved.' }, 503);
  }
}

function textField(body, key, max) {
  const value = body[key] ?? '';
  if (typeof value !== 'string' || value.length > max) throw new Error(`${key} must be text of at most ${max} characters.`);
  return value.trim();
}

function dateField(body, key) {
  const value = textField(body, key, 10);
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) {
    throw new Error(`${key} must be a valid calendar date.`);
  }
  return value;
}

export async function onRequestPost({ request, env }) {
  const denied = authorize(request, env);
  if (denied) return denied;
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Send a JSON follow-up plan.' }, 415);
  let plan;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: 'Follow-up plan is too large.' }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Enter a valid follow-up plan.');
    const leadId = textField(body, 'leadId', 200);
    const status = textField(body, 'status', 40);
    const expectedRevision = body.expectedRevision;
    if (!leadId || !STATUSES.has(status)) throw new Error('Choose a valid waitlist record and contact status.');
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('Reload this follow-up plan before saving.');
    plan = { leadId, status, expectedRevision, owner: textField(body, 'owner', 120), notes: textField(body, 'notes', 5000),
      lastContactDate: dateField(body, 'lastContactDate'), nextFollowUpDate: dateField(body, 'nextFollowUpDate') };
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? 'Send valid JSON.' : error.message }, 400);
  }
  try {
    const lead = await env.DB.prepare('SELECT id FROM waitlist_signups WHERE id = ?').bind(plan.leadId).first();
    if (!lead) return json({ error: 'Waitlist record not found.' }, 404);
    // One conditional INSERT is atomic: a stale editor cannot overwrite a newer revision.
    const saved = await env.DB.prepare(`INSERT INTO waitlist_outreach
      (id, lead_id, revision, status, owner, notes, last_contact_date, next_followup_date, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT COALESCE(MAX(revision), 0) FROM waitlist_outreach WHERE lead_id = ?) = ?
      RETURNING ${SELECT_FIELDS}`)
      .bind(crypto.randomUUID(), plan.leadId, plan.expectedRevision + 1, plan.status, plan.owner, plan.notes,
        plan.lastContactDate, plan.nextFollowUpDate, new Date().toISOString(), plan.leadId, plan.expectedRevision).first();
    if (!saved) return json({ error: 'This plan changed in another session. Reload the latest plan before saving.' }, 409);
    return json({ current: saved });
  } catch {
    return json({ error: 'The follow-up plan could not be saved. Please retry; existing revisions are preserved.' }, 503);
  }
}
