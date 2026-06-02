const ID_TYPES = {
  lead: { prefix: "LD", width: 6 },
  contact: { prefix: "CT", width: 6 },
  organization: { prefix: "ORG", width: 6 },
  candidate: { prefix: "SGQ-C", width: 6 },
  application: { prefix: "APP", width: 6 },
  pilot: { prefix: "PLT", width: 6 },
  report: { prefix: "RPT", width: 6 }
};

export async function nextPlatformId(db, idType) {
  const config = ID_TYPES[idType];
  if (!config) throw new Error(`Unknown id type: ${idType}`);

  try {
    await db.prepare("INSERT OR IGNORE INTO platform_id_counters (id_type, next_value) VALUES (?, 1)")
      .bind(idType)
      .run();
    const result = await db.prepare(
      "UPDATE platform_id_counters SET next_value = next_value + 1 WHERE id_type = ? RETURNING next_value - 1 AS value"
    )
      .bind(idType)
      .first();
    const value = Number(result?.value || 0);
    if (value > 0) return `${config.prefix}-${String(value).padStart(config.width, "0")}`;
  } catch {
    // Older databases may not have platform_id_counters yet. Fall through to a stable-looking fallback.
  }

  const fallback = Math.floor(Date.now() % 1000000);
  return `${config.prefix}-${String(fallback).padStart(config.width, "0")}`;
}

export async function tableColumns(db, tableName) {
  try {
    const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set((columns.results || []).map((column) => column.name));
  } catch {
    return new Set();
  }
}
