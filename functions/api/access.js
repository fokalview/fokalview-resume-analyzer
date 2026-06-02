export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const code = String(body.code || "").trim();
  const userSecurityCode = String(body.userSecurityCode || "").trim();
  const email = normalizeEmail(body.email);
  const betaAccessCode = env.BETA_ACCESS_CODE || "";
  const requiredUserSecurityCode = env.USER_SECURITY_CODE || "";

  if (betaAccessCode && code !== betaAccessCode) {
    return Response.json({ error: "Invalid beta access code." }, { status: 401 });
  }

  if (requiredUserSecurityCode && userSecurityCode !== requiredUserSecurityCode) {
    return Response.json({ error: "Invalid user security code." }, { status: 401 });
  }

  if (email && !isValidEmail(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  return Response.json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
