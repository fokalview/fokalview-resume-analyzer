import { clearCookie, SESSION_COOKIE, verifiedSession, workosClient } from "../../lib/workos.js";

export async function onRequestGet({ request, env }) {
  let location = new URL("/", request.url).toString();

  try {
    const result = await verifiedSession(request, env);
    if (result.authenticated) {
      const workos = workosClient(env);
      const sessionData = request.headers.get("Cookie") || "";
      const session = workos.userManagement.loadSealedSession({
        sessionData: cookieValue(sessionData, SESSION_COOKIE),
        cookiePassword: env.WORKOS_COOKIE_PASSWORD
      });
      location = await session.getLogoutUrl();
    }
  } catch {
    // Clearing the local cookie still safely ends the local session.
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Set-Cookie": clearCookie(SESSION_COOKIE, request)
    }
  });
}

function cookieValue(cookieHeader, name) {
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}
