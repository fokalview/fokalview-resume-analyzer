const STORAGE_KEY = "fokalview_beta_access_code";

export function getStoredAccessCode() {
  return sessionStorage.getItem(STORAGE_KEY) || "";
}

export function storeAccessCode(code: string) {
  sessionStorage.setItem(STORAGE_KEY, code);
}

export async function validateAccessCode(code: string) {
  const response = await fetch("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Access code was not accepted.");
  }

  return Boolean(payload.ok);
}
