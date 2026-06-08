# SagittaIQ Project Memory

This directory is the durable operating memory for SagittaIQ. It exists so the
product can be understood, operated, recovered, and transferred without relying
on chat history or one person's memory.

## Start Here

- [JOURNAL.md](JOURNAL.md): dated decisions, completed work, lessons, and next steps
- [BUILD_HISTORY.md](BUILD_HISTORY.md): chronological reconstruction from the first commit
- [ARCHITECTURE.md](ARCHITECTURE.md): how the current system works
- [DATABASE.md](DATABASE.md): current tables, relationships, and migration risks
- [CLOUDFLARE_RUNBOOK.md](CLOUDFLARE_RUNBOOK.md): deployment, migration, and recovery procedures
- [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md): current product state and prioritized direction
- [DECISIONS/](DECISIONS/): architecture decision records explaining major choices

## Documentation Rule

Update the journal whenever work changes any of the following:

- product behavior or user workflow
- database schema or data collection
- authentication, authorization, privacy, or retention
- Cloudflare configuration or deployment process
- scoring logic or AI behavior
- institutional onboarding or commercial scope

The journal entry should say what changed, why it changed, how it was verified,
what remains risky, and what should happen next. Do not include secrets,
access codes, API keys, raw resumes, or personal data.

Use [JOURNAL_ENTRY_TEMPLATE.md](JOURNAL_ENTRY_TEMPLATE.md) for new entries.

On Windows, create a new timestamped entry at the top of the journal with:

```powershell
.\scripts\new-journal-entry.ps1 -Title "Short description of the work"
```

The command inserts a structured entry using the local Eastern time shown by the
computer. Complete the entry before committing meaningful work.
