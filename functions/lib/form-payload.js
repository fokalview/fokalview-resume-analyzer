// Validate iteratively before JSON.stringify or recursive display/export helpers.
// Six branch drafts fit comfortably; arbitrary nested object graphs do not.
export function validateFormPayload(body) {
  const invalid = () => new Error('Some response details are too complex. Review your entries and try again.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid();
  const pending = [{ value: body, depth: 0 }];
  const visited = new Set();
  let entries = 0;
  while (pending.length) {
    const { value, depth } = pending.pop();
    if (++entries > 4096 || depth > 8) throw invalid();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') continue;
    if (typeof value === 'number' && Number.isFinite(value)) continue;
    if (typeof value !== 'object' || visited.has(value)) throw invalid();
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid();
    visited.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__','prototype','constructor'].includes(key)) throw invalid();
      pending.push({ value: child, depth: depth + 1 });
    }
  }
  if (JSON.stringify(body).length > 64000) throw new Error('This response is too long. Shorten it before submitting.');
}
