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

The data contract for each snapshot lives in:

- `automation/contracts/analytics-snapshot.schema.json`

Notes:

- the normalized snapshot format is source-agnostic
- XLB should not assume a Cloudflare zone exists
- zone-based Cloudflare fetching is optional and only applies when the domain is configured as a Cloudflare zone
