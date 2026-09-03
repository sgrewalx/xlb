# Analytics Snapshots

This directory is reserved for machine-generated analytics snapshots consumed by XLB agents.

Planned source systems:

- Google Search Console
- Google Analytics 4
- Google AdSense
- Cloudflare Web Analytics as an optional supplemental source

Expected operating model:

- snapshots are append-only by date
- source fetchers write normalized JSON
- ranking agents read only normalized snapshots
- experiment results are written back into `automation/experiments/`

Suggested filename pattern:

- `daily-YYYY-MM-DD.json`
- `search-console-YYYY-MM-DD.json` for page-level search performance
- `search-console-queries-YYYY-MM-DD.json` for workflow-only query-and-page performance

The data contract for each snapshot lives in:

- `automation/contracts/analytics-snapshot.schema.json`
- `automation/contracts/search-console-query-snapshot.schema.json`

Notes:

- the normalized snapshot format is source-agnostic
- query snapshots are generated and validated in `Refresh Live Analytics`, ignored by Git, and never published under `public/`
- validated query snapshots are uploaded as `search-console-queries-YYYY-MM-DD` GitHub Actions artifacts with 90-day retention
- artifact access follows the repository's GitHub Actions permissions; artifacts are workflow evidence, not a general confidentiality boundary or permanent archive
- a future evaluator can retrieve an exact snapshot with `gh run download <run-id> --name search-console-queries-YYYY-MM-DD --dir <private-working-directory>`
- a cross-run evaluation workflow can use `actions/download-artifact@v4` with the source run ID, repository, and a token permitted to read Actions artifacts
- page-level `search-console-YYYY-MM-DD.json` and merged snapshots continue to be committed without raw query text
- XLB should not assume a Cloudflare zone exists
- zone-based Cloudflare fetching is optional and only applies when the domain is configured as a Cloudflare zone
