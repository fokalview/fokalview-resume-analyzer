const state = {
  applications: [],
  settings: { weeklyGoal: 10, reminders: true },
  filter: ""
};

const elements = {
  total: document.getElementById("total"),
  weekly: document.getElementById("weekly"),
  interviews: document.getElementById("interviews"),
  goalText: document.getElementById("goalText"),
  goal: document.getElementById("goal"),
  progressBar: document.getElementById("progressBar"),
  table: document.getElementById("table"),
  statusFilter: document.getElementById("statusFilter"),
  cloudSyncConsent: document.getElementById("cloudSyncConsent"),
  cloudAccessCode: document.getElementById("cloudAccessCode"),
  syncCloud: document.getElementById("syncCloud"),
  syncMessage: document.getElementById("syncMessage")
};

document.getElementById("export").addEventListener("click", exportData);
document.getElementById("import").addEventListener("change", importData);
document.getElementById("resume").addEventListener("click", () => {
  chrome.tabs.create({ url: RESUME_ANALYZER_URL });
});

elements.goal.addEventListener("change", async () => {
  state.settings.weeklyGoal = Number(elements.goal.value || 10);
  await chrome.storage.local.set({ settings: state.settings });
  render();
});

elements.statusFilter.addEventListener("change", () => {
  state.filter = elements.statusFilter.value;
  render();
});
elements.cloudSyncConsent.addEventListener("change", saveSyncSettings);
elements.cloudAccessCode.addEventListener("change", saveSyncSettings);
elements.syncCloud.addEventListener("click", syncAllLocalApplications);

load();

async function load() {
  const data = await chrome.storage.local.get(["applications", "settings"]);
  state.applications = data.applications || [];
  state.settings = { ...state.settings, ...(data.settings || {}) };
  elements.goal.value = state.settings.weeklyGoal;
  elements.cloudSyncConsent.checked = state.settings.cloudSyncConsent === true;
  elements.cloudAccessCode.value = state.settings.cloudAccessCode || "";
  render();
}

function render() {
  const weeklyCount = state.applications.filter(isThisWeek).length;
  const goal = Number(state.settings.weeklyGoal || 10);
  const percent = Math.min(100, Math.round((weeklyCount / goal) * 100));

  elements.total.textContent = String(state.applications.length);
  elements.weekly.textContent = String(weeklyCount);
  elements.interviews.textContent = String(
    state.applications.filter((item) => item.status === "Interviewing").length
  );
  elements.goalText.textContent = `${weeklyCount} / ${goal}`;
  elements.progressBar.style.width = `${percent}%`;

  const filtered = state.filter
    ? state.applications.filter((item) => item.status === state.filter)
    : state.applications;

  elements.table.innerHTML = filtered.length
    ? filtered.map(rowTemplate).join("")
    : "<p class='empty-state'>No saved jobs yet. Open a job post, click the extension, and save it.</p>";

  elements.table.querySelectorAll("[data-status]").forEach((select) => {
    select.addEventListener("change", updateStatus);
  });
  elements.table.querySelectorAll("[data-send-resume]").forEach((button) => {
    button.addEventListener("click", sendToResumeAnalyzer);
  });
}

function rowTemplate(item) {
  const safeTitle = escapeHtml(item.title);
  const safeCompany = escapeHtml(item.company);
  const safeLocation = escapeHtml(item.location || "Location not saved");
  const safeSalary = escapeHtml(item.salary || "");
  const safeNotes = escapeHtml(item.notes || "");
  const link = item.url ? `<a href="${escapeAttribute(item.url)}" target="_blank">Open</a>` : "";

  return `
    <article class="application-row">
      <div>
        <strong>${safeTitle}</strong>
        <span>${safeCompany} - ${safeLocation}</span>
        ${safeSalary ? `<span>Salary: ${safeSalary}</span>` : ""}
        ${safeNotes ? `<p>${safeNotes}</p>` : ""}
      </div>
      <select data-status="${item.id}">
        ${["Interested", "Applied", "Interviewing", "Offer", "Rejected"]
          .map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`)
          .join("")}
      </select>
      <div class="row-actions">
        <button data-send-resume="${item.id}" class="small-button">Send to resume</button>
        ${syncBadge(item)}
        ${link}
      </div>
    </article>
  `;
}

function syncBadge(item) {
  if (item.syncStatus === "synced") return "<span class='sync-badge'>Synced</span>";
  if (item.syncStatus === "error") return "<span class='sync-badge error'>Sync error</span>";
  return "";
}

function sendToResumeAnalyzer(event) {
  const id = event.currentTarget.dataset.sendResume;
  const application = state.applications.find((item) => item.id === id);
  if (!application) return;
  chrome.tabs.create({ url: buildResumeAnalyzerUrl(application) });
}

function buildResumeAnalyzerUrl(application) {
  const params = new URLSearchParams({
    jobTitle: application.title || "",
    company: application.company || "",
    location: application.location || "",
    salary: application.salary || "",
    notes: application.notes || "",
    jobUrl: application.url || "",
    source: application.source || ""
  });
  return `${RESUME_ANALYZER_URL}/?${params.toString()}`;
}

async function updateStatus(event) {
  const id = event.target.dataset.status;
  const status = event.target.value;
  state.applications = state.applications.map((item) =>
    item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
  );
  await chrome.storage.local.set({ applications: state.applications });
  render();
}

async function saveSyncSettings() {
  state.settings = {
    ...state.settings,
    cloudSyncConsent: elements.cloudSyncConsent.checked,
    cloudAccessCode: elements.cloudAccessCode.value.trim()
  };
  await chrome.storage.local.set({ settings: state.settings });
}

async function syncAllLocalApplications() {
  await saveSyncSettings();

  if (!state.settings.cloudSyncConsent) {
    showSyncMessage("Turn on cloud storage consent before syncing.", "error");
    return;
  }

  if (!state.settings.cloudAccessCode) {
    showSyncMessage("Add an access code before syncing.", "error");
    return;
  }

  let synced = 0;
  let failed = 0;
  const updated = [];

  for (const application of state.applications) {
    try {
      const result = await syncApplication(application, state.settings);
      updated.push({ ...application, syncStatus: "synced", syncedAt: result.syncedAt, syncError: "" });
      synced += 1;
    } catch (error) {
      updated.push({
        ...application,
        syncStatus: "error",
        syncError: error.message || "Sync failed"
      });
      failed += 1;
    }
  }

  state.applications = updated;
  await chrome.storage.local.set({ applications: state.applications });
  render();
  showSyncMessage(
    failed ? `Synced ${synced}. ${failed} need another try.` : `Synced ${synced} local jobs.`,
    failed ? "error" : "success"
  );
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

function showSyncMessage(text, type) {
  elements.syncMessage.textContent = text;
  elements.syncMessage.className = `message ${type}`;
  elements.syncMessage.hidden = false;
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fokalview-job-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const imported = JSON.parse(await file.text());
  state.applications = Array.isArray(imported.applications) ? imported.applications : [];
  state.settings = { ...state.settings, ...(imported.settings || {}) };
  await chrome.storage.local.set({ applications: state.applications, settings: state.settings });
  render();
}

function isThisWeek(item) {
  const date = new Date(item.createdAt);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return date >= start;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
