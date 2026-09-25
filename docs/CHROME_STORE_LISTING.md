# Chrome Web Store listing draft

**Name:** SagittaIQ Job Capture

**Summary:** Capture a job posting, review its requirements and details, and send it to SagittaIQ for opportunity tracking and resume comparison.

**Category:** Productivity (select the closest available category in the dashboard).

**Detailed description**

Bring the whole job posting into your next career decision.

SagittaIQ Job Capture helps you collect the information you need to compare your
resume with an opportunity. Open a job posting, click Capture this page, then
review and edit the result before sending it to SagittaIQ.

- Job title, employer, location, and published pay range
- Full description, responsibilities, and company background
- Required qualifications and nice-to-have skills
- Employment type, workplace, benefits, education, experience, and dates when listed
- Local JSON export and an editable draft

Capture runs only when you ask. Missing information stays blank. Some websites
use unsupported layouts or restrict access; you can paste or correct the text.
No extension subscription or account is needed to capture or export. Sending to
SagittaIQ requires its updated website, and saving or comparing a resume requires
a verified SagittaIQ account and access to the service. Analysis capacity and
access are governed by SagittaIQ, not by the extension.

Your reviewed job is opened as a draft in SagittaIQ. Nothing is automatically
saved to your account or submitted to an employer. The extension does not read
resumes, collect passwords, sell data, or run background scraping.

**Single purpose:** Capture, review, and transfer user-selected job-posting details
to SagittaIQ for opportunity tracking and resume comparison.

**Permission justifications**

| Permission | Reason |
| --- | --- |
| activeTab | Temporary access to the posting the user explicitly chooses to capture. |
| scripting | Execute the bundled extractor on that chosen page. No remote code. |
| storage | Preserve one editable draft locally between popup openings; clear or expire it. |

**Privacy policy URL after deployment:** https://sagittaiq.com/job-capture-privacy.html

**Homepage:** https://sagittaiq.com

**Support:** Add the actual publisher contact/URL in the developer dashboard.

**Reviewer instructions:** Capture and JSON export work without an account. Test
with an individual job posting containing JobPosting JSON-LD or visible job text.
Review/edit the fields, check consent, and select Review in SagittaIQ. For the
website save/analysis step, provide authorized test-account instructions privately
in the reviewer notes. Never submit real applicant resumes as test fixtures.
