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

export async function validateAccessCode(code: string, email = "") {
  const response = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, email: normalizeEmail(email) })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Access code was not accepted.");
  }

  return Boolean(payload.ok);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
