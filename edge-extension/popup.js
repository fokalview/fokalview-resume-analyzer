const fields = {
  title: document.getElementById("title"),
  company: document.getElementById("company"),
  location: document.getElementById("location"),
  status: document.getElementById("status"),
  notes: document.getElementById("notes"),
  cloudSyncConsent: document.getElementById("cloudSyncConsent"),
  cloudAccessCode: document.getElementById("cloudAccessCode")
};

const message = document.getElementById("message");

document.getElementById("save").addEventListener("click", saveApplication);
document.getElementById("dashboard").addEventListener("click", openDashboard);
document.getElementById("resume").addEventListener("click", openResumeAnalyzer);
fields.cloudSyncConsent.addEventListener("change", saveSyncSettings);
fields.cloudAccessCode.addEventListener("change", saveSyncSettings);

hydrateSyncSettings();
hydrateFromActiveTab();

async function hydrateSyncSettings() {
  const { settings = {} } = await chrome.storage.local.get("settings");
  fields.cloudSyncConsent.checked = settings.cloudSyncConsent === true;
  fields.cloudAccessCode.value = settings.cloudAccessCode || "";
}

async function hydrateFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const [response] = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_DETAILS" });
    if (!response) return;
    fields.title.value = response.title || "";
    fields.company.value = response.company || "";
    fields.location.value = response.location || "";
    fields.status.value = "Interested";
    fields.notes.dataset.url = response.url || tab.url || "";
    fields.notes.dataset.source = response.source || "";
  } catch {
    fields.notes.dataset.url = tab.url || "";
    fields.title.value = tab.title || "";
  }
}

async function saveApplication() {
  const application = {
    id: crypto.randomUUID(),
    title: fields.title.value.trim(),
    company: fields.company.value.trim(),
    location: fields.location.value.trim(),
    status: fields.status.value,
    notes: fields.notes.value.trim(),
    url: fields.notes.dataset.url || "",
    source: fields.notes.dataset.source || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!application.title || !application.company) {
    showMessage("Add at least a job title and company.", "error");
    return;
  }

  const settings = readSyncSettings();
  await persistSyncSettings(settings);

  const { applications = [] } = await chrome.storage.local.get("applications");
  await chrome.storage.local.set({ applications: [application, ...applications] });

  if (!settings.cloudSyncConsent) {
    showMessage("Saved locally. Cloud sync is off.", "success");
    return;
  }

  if (!settings.cloudAccessCode) {
    showMessage("Saved locally. Add an access code to sync to cloud storage.", "error");
    return;
  }

  try {
    const result = await syncApplication(application, settings);
    await markApplicationSynced(application.id, result.syncedAt);
    showMessage("Saved locally and synced to cloud storage.", "success");
  } catch (error) {
    await markApplicationSyncError(application.id, error.message || "Sync failed");
    showMessage(`Saved locally. Cloud sync failed: ${error.message || "try again later"}`, "error");
  }
}

function readSyncSettings() {
  return {
    cloudSyncConsent: fields.cloudSyncConsent.checked,
    cloudAccessCode: fields.cloudAccessCode.value.trim()
  };
}

async function saveSyncSettings() {
  await persistSyncSettings(readSyncSettings());
}

async function persistSyncSettings(nextSettings) {
  const { settings = {} } = await chrome.storage.local.get("settings");
  await chrome.storage.local.set({ settings: { ...settings, ...nextSettings } });
}

async function syncApplication(application, settings) {
  const clientId = await getClientId();
  const response = await fetch(`${FOKALVIEW_API_URL}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Beta-Access-Code": settings.cloudAccessCode,
      "X-FokalView-Client-ID": clientId
    },
    body: JSON.stringify({
      consent: true,
      consentVersion: APPLICATION_SYNC_CONSENT_VERSION,
      application
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not sync application.");
  }
  return payload;
}

async function getClientId() {
  const data = await chrome.storage.local.get("clientId");
  if (data.clientId) return data.clientId;

  const clientId = crypto.randomUUID();
  await chrome.storage.local.set({ clientId });
  return clientId;
}

async function markApplicationSynced(id, syncedAt) {
  const { applications = [] } = await chrome.storage.local.get("applications");
  await chrome.storage.local.set({
    applications: applications.map((item) =>
      item.id === id ? { ...item, syncStatus: "synced", syncedAt, syncError: "" } : item
    )
  });
}

async function markApplicationSyncError(id, syncError) {
  const { applications = [] } = await chrome.storage.local.get("applications");
  await chrome.storage.local.set({
    applications: applications.map((item) =>
      item.id === id ? { ...item, syncStatus: "error", syncError } : item
    )
  });
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

function openResumeAnalyzer() {
  chrome.tabs.create({ url: buildResumeAnalyzerUrl(readFormApplication()) });
}

function readFormApplication() {
  return {
    title: fields.title.value.trim(),
    company: fields.company.value.trim(),
    location: fields.location.value.trim(),
    notes: fields.notes.value.trim(),
    url: fields.notes.dataset.url || "",
    source: fields.notes.dataset.source || ""
  };
}

function buildResumeAnalyzerUrl(application) {
  const params = new URLSearchParams({
    jobTitle: application.title,
    company: application.company,
    location: application.location,
    notes: application.notes,
    jobUrl: application.url,
    source: application.source
  });
  return `${RESUME_ANALYZER_URL}/?${params.toString()}`;
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = `message ${type}`;
  message.hidden = false;
}
