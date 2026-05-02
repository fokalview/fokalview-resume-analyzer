chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("dailyJobSearchReminder", {
    delayInMinutes: 60,
    periodInMinutes: 24 * 60
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "dailyJobSearchReminder") return;

  const { settings = {} } = await chrome.storage.local.get("settings");
  if (settings.reminders === false) return;

  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icon.svg"),
    title: "FokalView Job Tracker",
    message: "Check your weekly application goal and save today's progress."
  });
});
