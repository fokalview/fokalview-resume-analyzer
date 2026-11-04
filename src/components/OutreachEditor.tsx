import { useEffect, useRef, useState, type FormEvent } from 'react';
import './OutreachEditor.css';

export type OutreachPlan = {
  leadId: string; revision: number; status: string; owner: string; notes: string;
  lastContactDate: string; nextFollowUpDate: string; updatedAt: string | null; id?: string;
};
const statuses = ['New', 'Contacted', 'Awaiting reply', 'Meeting scheduled', 'Pilot discussion', 'Closed'];
const blank = (leadId: string): OutreachPlan => ({ leadId, revision: 0, status: 'New', owner: '', notes: '', lastContactDate: '', nextFollowUpDate: '', updatedAt: null });
const calendarDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString() : 'Not set';

export function OutreachEditor({ leadId, adminCode, onSaved }: { leadId: string; adminCode: string; onSaved?: (plan: OutreachPlan) => void }) {
  const [plan, setPlan] = useState<OutreachPlan>(blank(leadId));
  const [history, setHistory] = useState<OutreachPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const [conflict, setConflict] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const saveRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setSaved(false); setConflict(false); setLoadFailed(false); setSaving(false);
    setPlan(blank(leadId)); setHistory([]);
    fetch(`/api/admin/outreach?leadId=${encodeURIComponent(leadId)}`, { headers: { 'X-Admin-Access-Code': adminCode }, cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Follow-up plans are unavailable.'); return data; })
      .then(data => { if (!controller.signal.aborted) { setPlan(data.current); setHistory(data.history); } })
      .catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setLoadFailed(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); saveRequest.current?.abort(); };
  }, [leadId, adminCode, reload]);

  function edit(field: keyof OutreachPlan, value: string) {
    setPlan(current => ({ ...current, [field]: value })); setSaved(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || loading || loadFailed || conflict) return;
    const controller = new AbortController(); saveRequest.current = controller;
    setSaving(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/admin/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Access-Code': adminCode },
        body: JSON.stringify({ ...plan, expectedRevision: plan.revision }), cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) { setConflict(response.status === 409); throw new Error(data.error || 'Could not save the follow-up plan.'); }
      setPlan(data.current); setHistory(items => [data.current, ...items]); setSaved(true); onSaved?.(data.current);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not save the follow-up plan.'); }
    finally { if (!controller.signal.aborted) setSaving(false); }
  }

  return <section className="outreach-editor" aria-labelledby="outreach-heading">
    <div><h3 id="outreach-heading">Follow-up plan</h3><p>Track your outreach here. Survey responses are recorded separately.</p></div>
    {loading ? <p role="status">Loading follow-up plan…</p> : <>
      {error && <div role="alert" className="outreach-error">{error} <button type="button" onClick={() => setReload(value => value + 1)}>Reload latest plan</button></div>}
      <form onSubmit={save}>
        <fieldset disabled={saving || conflict || loadFailed}>
          <legend className="sr-only">Edit follow-up plan</legend>
          <div className="outreach-fields">
            <label>Contact status<select value={plan.status} onChange={event => edit('status', event.target.value)}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>
            <label>Assigned owner<input value={plan.owner} maxLength={120} onChange={event => edit('owner', event.target.value)} placeholder="Team member name" /></label>
            <label>Last contact date<input type="date" value={plan.lastContactDate} onChange={event => edit('lastContactDate', event.target.value)} /></label>
            <label>Next follow-up date<input type="date" value={plan.nextFollowUpDate} onChange={event => edit('nextFollowUpDate', event.target.value)} /></label>
          </div>
          <label>Follow-up notes<textarea rows={4} maxLength={5000} value={plan.notes} onChange={event => edit('notes', event.target.value)} placeholder="What was discussed and what happens next" /></label>
          <button type="submit" className="primary-button">{saving ? 'Saving…' : 'Save follow-up plan'}</button>
        </fieldset>
      </form>
      {saved && <p role="status" className="outreach-success">Follow-up plan saved.</p>}
      <details className="outreach-history"><summary>Activity history ({history.length})</summary>
        <p>Each save creates a preserved revision. Changes use the shared admin access; assigned owner identifies responsibility, not who signed in.</p>
        {!history.length ? <p>No outreach recorded yet.</p> : <ol>{history.map(item => <li key={item.revision}>
          <strong>{item.status} · Revision {item.revision}</strong>
          <time>{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Not saved'}</time>
          <p>Owner: {item.owner || 'Unassigned'} · Last contact: {calendarDate(item.lastContactDate)} · Next follow-up: {calendarDate(item.nextFollowUpDate)}</p>
          <p className="outreach-note">{item.notes || 'No notes provided.'}</p>
        </li>)}</ol>}
      </details>
    </>}
  </section>;
}
