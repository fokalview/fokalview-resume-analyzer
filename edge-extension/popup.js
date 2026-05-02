const fields = {
  title: document.getElementById("title"),
  company: document.getElementById("company"),
  location: document.getElementById("location"),
  status: document.getElementById("status"),
  notes: document.getElementById("notes")
};

const message = document.getElementById("message");

document.getElementById("save").addEventListener("click", saveApplication);
document.getElementById("dashboard").addEventListener("click", openDashboard);
document.getElementById("resume").addEventListener("click", openResumeAnalyzer);

hydrateFromActiveTab();

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

  const { applications = [] } = await chrome.storage.local.get("applications");
  await chrome.storage.local.set({ applications: [application, ...applications] });
  showMessage("Saved. Nice, one more in the tracker.", "success");
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
