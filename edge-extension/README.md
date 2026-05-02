# FokalView Job Tracker Edge Extension

This is a Manifest V3 extension source folder built from the uploaded FokalView package and demo.

## Load In Microsoft Edge

1. Open `edge://extensions`.
2. Turn on `Developer mode`.
3. Choose `Load unpacked`.
4. Select this `edge-extension` folder.
5. Open a job posting page, click the extension icon, review the detected fields, and save.

## What It Does

- Extracts job title, company, location, URL, and source from the current tab when possible.
- Saves applications to local browser storage only.
- Tracks total applications, applications this week, interview count, and weekly goal progress.
- Exports/imports JSON backups.
- Opens the local resume analyzer at `http://localhost:5173` for the companion workflow.
- Sends saved job details into the resume analyzer with the `Send to resume` dashboard button.

## Notes Before Store Submission

- Replace `icon.svg` with 16, 48, and 128 pixel PNG icons before submitting to Edge Add-ons if the store requires PNG assets.
- Replace the local resume analyzer link with the production URL after deployment.
- Narrow `host_permissions` from `<all_urls>` to specific job boards if you want a stricter store review posture.
