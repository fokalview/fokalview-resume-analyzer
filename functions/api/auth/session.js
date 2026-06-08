import { linkVerifiedUser, sessionCookie, verifiedSession } from "../../lib/workos.js";

export async function onRequestGet({ request, env }) {
  try {
    const result = await verifiedSession(request, env, { refresh: true });
    if (!result.authenticated) {
      return Response.json({ authenticated: false, reason: result.reason || "invalid_session" }, { status: 401 });
    }

    const linked = await linkVerifiedUser(env.DB, env, result.user);
    const headers = new Headers({ "Content-Type": "application/json" });
    if (result.sealedSession) headers.append("Set-Cookie", sessionCookie(result.sealedSession, request));

    return new Response(JSON.stringify({
      authenticated: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName || "",
        lastName: result.user.lastName || "",
        emailVerified: Boolean(result.user.emailVerified)
      },
      userId: linked?.userId || "",
      candidateId: linked?.candidateId || "",
      organizationId: result.organizationId || "",
      role: result.role || "",
      permissions: result.permissions || []
    }), { status: 200, headers });
  } catch (error) {
    return Response.json({ authenticated: false, error: error instanceof Error ? error.message : "Could not validate session." }, { status: 500 });
  }
}
