const VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000;
const DOMAIN = 'sagittaiq.analysis-receipt.v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});

function invalid() { return new Error('Analysis receipt is missing, invalid, or expired. Run a new review.'); }
function secret(env) {
  const value = env?.ANALYSIS_SIGNING_SECRET || env?.WORKOS_COOKIE_PASSWORD;
  if (typeof value !== 'string' || value.length < 32) throw new Error('Analysis signing is not configured.');
  return value;
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function analysisJson(analysis) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) throw invalid();
  // Match the JSON transport exactly, including omitted optional fields.
  const {provenance, ...content} = analysis;
  return canonical(JSON.parse(JSON.stringify(content)));
}
function encode(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalid();
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function hash(value) { return encode(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function key(env) {
  return crypto.subtle.importKey('raw', encoder.encode(secret(env)), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}
function identity(userId) { if (typeof userId !== 'string' || !userId || userId.length > 512) throw invalid(); }
function source(value) { if (typeof value !== 'string') throw invalid(); return value; }

/** Issue only for server-produced analysis and an authenticated WorkOS user ID. */
export async function issueAnalysisReceipt(analysis, {userId, resumeText, jobContext, targetRole}, env) {
  identity(userId);
  const issuedAt = Date.now();
  const payload = {
    version: VERSION, reviewId: crypto.randomUUID(), userId, issuedAt, expiresAt: issuedAt + TTL_MS,
    analysisHash: await hash(analysisJson(analysis)),
    resumeTextHash: await hash(source(resumeText)),
    jobContextHash: await hash(source(jobContext)),
    targetRoleHash: await hash(source(targetRole)),
  };
  const encoded = encode(encoder.encode(canonical(payload)));
  const signature = await crypto.subtle.sign('HMAC', await key(env), encoder.encode(`${DOMAIN}.${encoded}`));
  return {version: VERSION, token: `${encoded}.${encode(signature)}`};
}

/** Verify BEFORE any normalization or persistence. Omitted sources skip only that source comparison. */
export async function verifyAnalysisReceipt(analysis, context, env) {
  identity(context?.userId);
  const signingKey = await key(env);
  try {
    const receipt = analysis?.provenance;
    if (receipt?.version !== VERSION || typeof receipt.token !== 'string' || receipt.token.length > 4096) throw invalid();
    const pieces = receipt.token.split('.');
    if (pieces.length !== 2) throw invalid();
    const [encoded, signature] = pieces;
    // WebCrypto performs the MAC comparison; never compare signature strings in JS.
    if (!await crypto.subtle.verify('HMAC', signingKey, decode(signature), encoder.encode(`${DOMAIN}.${encoded}`))) throw invalid();
    const payload = JSON.parse(decoder.decode(decode(encoded)));
    const now = Date.now();
    if (payload.version !== VERSION || payload.userId !== context.userId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(payload.reviewId) ||
        !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt) ||
        payload.issuedAt > now || payload.expiresAt <= now || payload.expiresAt - payload.issuedAt !== TTL_MS ||
        payload.analysisHash !== await hash(analysisJson(analysis))) throw invalid();
    for (const field of ['resumeText', 'jobContext', 'targetRole']) {
      if (context[field] !== undefined && payload[`${field}Hash`] !== await hash(source(context[field]))) throw invalid();
    }
    return payload;
  } catch { throw invalid(); }
}
