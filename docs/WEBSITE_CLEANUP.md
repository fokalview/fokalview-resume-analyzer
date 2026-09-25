# Website cleanup delivery

Implemented on feat/website-ux-cleanup, stacked on the Chrome capture branch.

- Entry: direct sign-in, shorter introduction, onboarding below access controls, clear expired-admission guidance while preserving the beta gate.
- Responsive: no page overflow in candidate dashboard/review/report/tracker at 320/390/768/1440px in both themes, tested with populated synthetic records and long titles. Corrected dark tracker text and metric contrast.
- Navigation: URL-backed views, Back/refresh support, individual saved-report IDs, explicit unavailable-report state, linked-opportunity focus, keyboard focus after lazy loading.
- Tracker: collapsed editor, search/status filter, recent/company/follow-up ordering, accessible status/link names, visible review-history failures, individual View review actions.
- Review: keyboard upload, explicit minimum input requirements, staged progress, retry without discarding text, preserve generated report if saving fails.
- Dashboard: first-use guidance, loading/error/retry states, informational recommendations instead of unsaved task checkboxes, accessible chart descriptions/meters.
- Reports: contextual opportunity action, optional scoring detail, proper page headings.
- Delivery: screen chunks plus on-demand PDF/ZIP parsers. Main JS ~257 KB versus ~928 KB before cleanup; upload screen ~14 KB with document parsers fetched only when needed. Values are uncompressed build output, not a live performance benchmark.

Validation: 33 regression tests and 66 browser checks passed. Production build and Pages worker compilation passed. Four targeted browser checks rerun after final focus adjustment. Synthetic local visual inspection covered mobile home, populated tracker and report; no production candidate data was used. Automated responsive coverage includes all four principal candidate views in both themes. This is not a full screen-reader or accessibility certification.

Release boundaries: code is pushed to PR #3; no merge/deployment. Privacy retention periods, contact details and product-availability claims require accurate owner-supplied policy information, so none were invented. Administrative workflows were not redesigned as part of this candidate-experience cleanup. GitHub CI should be checked on the final commit before merge.
