export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const code = String(body.code || "").trim();
  const betaAccessCode = env.BETA_ACCESS_CODE || "";

  if (betaAccessCode && code !== betaAccessCode) {
    return Response.json({ error: "Invalid beta access code." }, { status: 401 });
  }

  return Response.json({ ok: true });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}
