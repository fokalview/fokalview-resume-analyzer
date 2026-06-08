import { AUTH_STATE_COOKIE, callbackUrl, stateCookie, workosClient } from "../../lib/workos.js";

export async function onRequestGet({ request, env }) {
  try {
    const state = crypto.randomUUID();
    const workos = workosClient(env);
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: "authkit",
      redirectUri: callbackUrl(request),
      clientId: env.WORKOS_CLIENT_ID,
      screenHint: "sign-in",
      state
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: authorizationUrl,
        "Set-Cookie": stateCookie(state, request)
      }
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not start sign-in." }, { status: 500 });
  }
}
