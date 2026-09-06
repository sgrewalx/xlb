# XLB Agent Context

XLB powers `https://xlb.codemachine.in`. It is a static Vite/React site focused on source-backed live events and editorial discovery. Hosting remains S3 behind CloudFront and Route 53; there is no server, database, authentication layer, or SSR.

## Implemented Architecture

- Route-specific HTML is generated during the validated build for every sitemap route.
- Public content is stored under `public/content/` as validated JSON and generated SVG assets.
- Unknown routes and missing dynamic event/topic entities retain real 404/noindex behavior.
- The local-only `/__ops` route is gated by `import.meta.env.DEV` and is not emitted as a production route.

## Implemented Automation Pipeline

The daily `Refresh Live Analytics` workflow has two failure domains:

1. Capture GA4 and Search Console, merge and validate normalized snapshots, upload private query evidence as a workflow artifact, then persist only aggregate page snapshots.
2. Generate a candidate in this order: traffic opportunities, live events, source health, live ranking, low-risk fixes, traffic-engine manifests, opportunity application, sitemap, content audit, live risk, deploy readiness, and ops summary. The complete candidate is validated before promotion.

Independent News, Sports, Tech, Video, and Quotes refresh jobs generate and validate their own public manifests.

## Experiment Control Plane

`automation/experiments/queue.json` uses the V2 lifecycle:

`idea -> queued -> building -> awaiting-production-deployment -> measuring -> evaluating -> completed`

Experiments can also become `rejected` or `paused`. Each experiment records its hypothesis, target paths, primary/secondary metrics, guardrails, baseline, measurement threshold, release binding, current evidence, rollback plan, and supervised decision.

A pending experiment starts measuring only when a successful Deploy artifact identifies an exact release that contains both its bound implementation commit and all required implementation paths. Ambiguous and unrelated releases fail closed. Measurement uses the latest committed merged snapshot; missing source rows remain `null`. Minimum duration plus deterministic evidence moves an experiment to `evaluating`, but no automated win/loss or statistical-significance claim is made.

Completed decisions can be written once under `automation/experiments/history/`. Existing history files are never overwritten.

`automation/experiments/surface-ledger.json` is a heuristic ranking ledger. Its values are current absolute observations, not experiment deltas or causal decisions.

## Weekly Progress

The Monday workflow reads already committed normalized snapshots and generates matching machine/human records under `automation/progress/weekly/YYYY-Www.json` and `.md`. It does not call GA4 or Search Console and does not dispatch a production release. Weekly records include available traffic, search, product, experiment, release, and automation signals plus top pages and week-over-week changes. Unsupported evidence is `null`/Unavailable, never an invented zero.

An Excel export is planned, not implemented. JSON remains the source of truth and no reporting-only dependency is justified yet.

## Release Controls

- Every deployment checks out and verifies an exact SHA from a validated release handoff.
- Deploy readiness is fresh and cryptographically bound to its governance evidence.
- `blocked` cannot be overridden; `review-required` needs an explicit supervised dispatch approval.
- The explicit generated-content allowlist may auto-deploy content-only releases.
- Code, workflows, contracts, internal progress records, and experiment records remain review-required.
- The lifecycle observer does not deploy. It reads the artifact from the exact successful Deploy run and updates only matching experiment records.

## Privacy

Raw Search Console query/page evidence is uploaded as a private, time-limited workflow artifact and is ignored by Git. It must not be copied into public content, committed weekly records, experiment history, or `/__ops`. The dashboard consumes aggregate page snapshots only.

## Safety And Content Rules

- General-audience content only; no pornography, sexual content, illegal material, or extremist content.
- Prefer authoritative source links and explicit provenance.
- Store short original summaries, never copied publisher articles or layouts.
- Do not imply endorsement by source organizations.
- `safeToPromote` governance applies consistently to public live and Gallery outputs.

## Autonomy Boundary

Implemented autonomy can fetch, validate, rank, publish allowlisted content manifests, apply the two existing bounded low-risk opportunity actions, and measure experiments. It cannot autonomously rewrite application code, infrastructure, legal/privacy policy, source-domain policy, or governance rules. Those changes remain supervised.

Partially implemented: experiment evaluation is deterministic but the final decision is supervised; release-count evidence is unavailable until a durable aggregate release history exists.

Planned: evidence-backed new experiment proposals, sanitized thematic query conclusions if justified, and an optional local Excel export.
