param(
  [Parameter(Mandatory = $true)]
  [string]$Title
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$journalPath = Join-Path $repoRoot "docs\JOURNAL.md"
$marker = "<!-- NEW_ENTRIES_BELOW -->"

if (-not (Test-Path -LiteralPath $journalPath)) {
  throw "Journal not found at $journalPath"
}

$journal = Get-Content -LiteralPath $journalPath -Raw
if (-not $journal.Contains($marker)) {
  throw "Journal marker not found. Expected: $marker"
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$entry = @"

## $timestamp ET - $Title

### Objective

Describe the problem being solved.

### Completed

- Describe the concrete work or decision.

### Why

Explain why this approach was selected.

### Verification

- Record build, test, deployment, database, or manual verification.

### Risks And Open Questions

- Record anything incomplete or uncertain.

### Next Steps

- Record the highest-value next action.

### References

- Commit:
- Migration:
- Relevant files:
"@

$updated = $journal.Replace($marker, "$marker$entry")
Set-Content -LiteralPath $journalPath -Value $updated -Encoding utf8
Write-Host "Added journal entry: $timestamp ET - $Title"
