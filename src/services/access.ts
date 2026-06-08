const STORAGE_KEY = "fokalview_beta_access_code";
const EMAIL_STORAGE_KEY = "fokalview_beta_user_email";

export function getStoredAccessCode() {
  return sessionStorage.getItem(STORAGE_KEY) || "";
}

export function getStoredUserEmail() {
  return sessionStorage.getItem(EMAIL_STORAGE_KEY) || "";
}

export function hasStoredUserEmail() {
  return Boolean(getStoredUserEmail());
}

export function storeAccessCode(code: string, email = "") {
  sessionStorage.setItem(STORAGE_KEY, code);
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    sessionStorage.setItem(EMAIL_STORAGE_KEY, normalizedEmail);
  } else {
    sessionStorage.removeItem(EMAIL_STORAGE_KEY);
  }
}

export async function validateAccessCode(code: string, email = "", userPin = "") {
  const response = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, email: normalizeEmail(email), userPin: userPin.trim() })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Access code was not accepted.");
  }

  return Boolean(payload.ok);
}

export type VerifiedAuthSession = {
  authenticated: true;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    emailVerified: boolean;
  };
  userId: string;
  candidateId?: string;
  organizationId?: string;
  role?: string;
  permissions?: string[];
};

export async function getVerifiedAuthSession(): Promise<VerifiedAuthSession | null> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });

  if (response.status === 401) return null;
  const payload = await response.json();
  if (!response.ok || !payload.authenticated) return null;
  return payload as VerifiedAuthSession;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
