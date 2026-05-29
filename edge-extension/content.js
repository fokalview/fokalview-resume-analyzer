chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_JOB_DETAILS") return;
  sendResponse(extractJobDetails());
});

function extractJobDetails() {
  const title =
    readMeta("og:title") ||
    textFromSelectors([
      "h1",
      "[data-testid*='job-title']",
      ".jobsearch-JobInfoHeader-title",
      ".top-card-layout__title",
      ".jobs-unified-top-card__job-title"
    ]);

  const company =
    readMeta("og:site_name") ||
    textFromSelectors([
      "[data-testid*='company']",
      ".jobsearch-InlineCompanyRating a",
      ".topcard__org-name-link",
      ".jobs-unified-top-card__company-name"
    ]);

  const location = textFromSelectors([
    "[data-testid*='location']",
    ".jobsearch-JobInfoHeader-subtitle div",
    ".topcard__flavor--bullet",
    ".jobs-unified-top-card__bullet"
  ]);

  const salary = extractSalary();

  return {
    title: cleanTitle(title || document.title),
    company: cleanCompany(company || ""),
    location: location || "",
    salary,
    url: window.location.href,
    source: new URL(window.location.href).hostname.replace(/^www\./, "")
  };
}

function readMeta(property) {
  return document.querySelector(`meta[property='${property}']`)?.content?.trim() || "";
}

function textFromSelectors(selectors) {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) return normalize(text);
  }
  return "";
}

function cleanTitle(value) {
  return normalize(value).replace(/\s+\|\s+LinkedIn.*$/i, "").replace(/\s+-\s+Indeed.*$/i, "");
}

function cleanCompany(value) {
  return normalize(value).replace(/^Careers at\s+/i, "");
}

function extractSalary() {
  const selectorText = textFromSelectors([
    "[data-testid*='salary']",
    "[class*='salary']",
    "[aria-label*='salary' i]",
    ".jobs-unified-top-card__job-insight",
    ".jobsearch-JobMetadataHeader-item"
  ]);
  const salaryFromSelectors = salaryFromText(selectorText);
  if (salaryFromSelectors) return salaryFromSelectors;

  const pageText = document.body?.innerText || "";
  return salaryFromText(pageText);
}

function salaryFromText(value) {
  const text = normalize(value);
  const match = text.match(
    /(?:salary|pay|compensation|rate)?\s*(\$[\d,.]+(?:\s?[kK])?(?:\s*(?:-|to|–|—)\s*\$?[\d,.]+(?:\s?[kK])?)?\s*(?:\/?\s?(?:year|yr|hour|hr|month|mo|annually|hourly))?)/i
  );
  return match ? normalize(match[1]) : "";
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}
