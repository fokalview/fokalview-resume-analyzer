import {
  AUTH_STATE_COOKIE,
  callbackUrl,
  clearCookie,
  linkVerifiedUser,
  readCookie,
  sessionCookie,
  workosClient
} from "../../lib/workos.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request, AUTH_STATE_COOKIE);

  if (!code) return Response.json({ error: "No authorization code was provided." }, { status: 400 });
  if (!state || !expectedState || state !== expectedState) {
    return Response.json({ error: "The sign-in request could not be verified. Please try again." }, { status: 400 });
  }

  try {
    const workos = workosClient(env);
    const result = await workos.userManagement.authenticateWithCode({
      clientId: env.WORKOS_CLIENT_ID,
      code,
      ipAddress: request.headers.get("CF-Connecting-IP") || undefined,
      userAgent: request.headers.get("User-Agent") || undefined,
      session: {
        sealSession: true,
        cookiePassword: env.WORKOS_COOKIE_PASSWORD
      }
    });

    await linkVerifiedUser(env.DB, env, result.user);

    const headers = new Headers({
      Location: new URL("/", callbackUrl(request)).toString()
    });
    headers.append("Set-Cookie", sessionCookie(result.sealedSession, request));
    headers.append("Set-Cookie", clearCookie(AUTH_STATE_COOKIE, request));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not complete sign-in." }, { status: 500 });
  }
}
