import { verifiedSession } from './workos.js';

// Roles are assigned to immutable WorkOS user IDs, never email domains or client headers.
export async function requireAdminAccess(request, env) {
  try {
    const session = await verifiedSession(request, env);
    if (!session.authenticated || !session.user?.emailVerified) return { response: denied(401, 'Sign in with your verified administrator account.') };
    const ids = value => new Set(String(value || '').split(/[\s,]+/).filter(Boolean));
    const userId = session.user.id;
    const role = ids(env.OWNER_USER_IDS).has(userId) ? 'owner' : ids(env.ADMIN_USER_IDS).has(userId) ? 'admin' : null;
    if (!role) return { response: denied(403, 'Your verified account does not have administrator access.') };
    return { userId, role };
  } catch {
    return { response: denied(401, 'Your administrator session could not be verified. Sign in again.') };
  }
}
function denied(status, error) { return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } }); }
