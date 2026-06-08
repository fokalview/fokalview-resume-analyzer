import { ensureUser } from "./identity.js";
import { hasVerifiedAccess } from "../lib/workos.js";

export async function onRequestGet({ request, env }) {
  const betaAccessCode = env.BETA_ACCESS_CODE || "";
  const verified = await hasVerifiedAccess(request, env);
  if (!verified && betaAccessCode && request.headers.get("X-Beta-Access-Code") !== betaAccessCode) {
    return Response.json({ error: "Invalid beta access code." }, { status: 401 });
  }

  if (!env.DB) {
    return Response.json({ error: "Missing D1 binding DB." }, { status: 500 });
  }

  const identity = await ensureUser(request, env);
  if (!identity) {
    return Response.json({ error: "Missing user identifier." }, { status: 400 });
  }

  return Response.json({
    userId: identity.userId,
    candidateId: identity.candidateId || "",
    identifierType: identity.identifierType,
    verified
  });
}
