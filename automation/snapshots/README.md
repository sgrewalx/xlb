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
- `search-console-queries-YYYY-MM-DD.json` for private query-and-page performance

The data contract for each snapshot lives in:

- `automation/contracts/analytics-snapshot.schema.json`
- `automation/contracts/search-console-query-snapshot.schema.json`

Notes:

- the normalized snapshot format is source-agnostic
- query snapshots remain private automation evidence and are never published under `public/`
- XLB should not assume a Cloudflare zone exists
- zone-based Cloudflare fetching is optional and only applies when the domain is configured as a Cloudflare zone
