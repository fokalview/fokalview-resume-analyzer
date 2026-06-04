import { ensureUser } from "./identity.js";
import { tableColumns } from "./ids.js";

const ALLOWED_EVENTS = new Set([
  "session_started",
  "session_heartbeat",
  "session_completed",
  "resume_analysis_completed",
  "opportunity_saved",
  "report_downloaded",
  "advisor_action"
]);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Missing D1 binding DB." }, 500);

  const columns = await tableColumns(env.DB, "user_events");
  if (!columns.has("event_type")) {
    return json({ error: "User event storage needs the latest D1 migration." }, 503);
  }

  try {
    const body = await request.json();
    const eventType = clean(body.eventType, 80);
    if (!ALLOWED_EVENTS.has(eventType)) {
      return json({ error: "Unsupported event type." }, 400);
    }

    const identity = await ensureUser(request, env);
    const now = new Date().toISOString();
    const durationSeconds = Math.max(0, Math.min(Number(body.durationSeconds || 0), 24 * 60 * 60));
    const metadata = sanitizeMetadata(body.metadata);

    await env.DB.prepare(
      `INSERT INTO user_events (
        id, user_id, candidate_id, lead_id, event_type, event_source, page_path,
        session_id, duration_seconds, campaign, metadata_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        identity?.userId || "",
        identity?.candidateId || clean(body.candidateId, 80),
        clean(body.leadId, 80),
        eventType,
        clean(body.eventSource, 120),
        clean(body.pagePath, 240),
        clean(body.sessionId, 120),
        Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : 0,
        clean(body.campaign, 120),
        JSON.stringify(metadata),
        now
      )
      .run();

    return json({ ok: true, savedAt: now });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not save event." }, 400);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

function clean(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 20)
      .map(([key, item]) => [clean(key, 80), clean(item, 500)])
  );
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}
