import { linkVerifiedUser, verifiedSession } from "../lib/workos.js";

// Request headers are not proof of identity, including during beta migration.
export async function readIdentity(request, env) {
  if (!env.WORKOS_API_KEY || !env.WORKOS_CLIENT_ID || !env.WORKOS_COOKIE_PASSWORD || !env.DB) return null;
  try {
    const session = await verifiedSession(request, env);
    if (!session.authenticated || !session.user?.emailVerified) return null;
    const linked = await linkVerifiedUser(env.DB, env, session.user);
    if (!linked?.userId) return null;
    return {
      userId: linked.userId,
      candidateId: linked.candidateId || "",
      clientHash: "",
      identifierType: "verified_email",
      emailDomain: "",
      emailDomainType: "",
      country: /^[A-Z]{2}$/.test(request.headers.get("CF-IPCountry") || "") ? request.headers.get("CF-IPCountry") : ""
    };
  } catch {
    return null;
  }
}

export async function ensureUser(request, env) {
  return readIdentity(request, env);
}
