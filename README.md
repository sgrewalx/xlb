# XLB

XLB is a production-sensible static MVP for `xlb.codemachine.in`: a dark-first, curiosity-driven dashboard built with `Vite + React + TypeScript`, deployed to `S3 + CloudFront`, and provisioned with Terraform.

## A. High-level architecture

- Frontend: `Vite + React + TypeScript`, static build only, no runtime backend, no SSR, no database.
- Hosting: S3 origin behind CloudFront with ACM TLS and Route 53 DNS.
- Content model: JSON manifests in `public/content/...`, fetched client-side and validated in CI.
- Automation shape: GitHub Actions handles build/deploy now; the same manifest structure supports future scheduled agent refresh jobs.
- Why this stack: it keeps the runtime simple, cheap, cacheable, and automation-friendly while still giving you a maintainable component model.

## B. Information architecture

Pages:
- `/` homepage dashboard
- `/about`
- `/privacy`
- `/terms`
- `/contact`
- `/advertise`

Homepage sections:
- Hero / brand strip
- Top 3 News
- Top 3 Sports
- Live World modules
- Quotes ticker
- Games
- Visual feed
- Footer

Navigation:
- sticky primary nav for core homepage anchors and About
- footer nav for support/legal pages

## C. Folder structure

```text
.
├── .github/workflows/
│   ├── build.yml
│   └── deploy.yml
├── infra/
│   ├── iam/
│   │   ├── github-actions-deploy-policy.json
│   │   └── github-actions-trust-policy.json
│   └── terraform/
│       ├── main.tf
│       ├── outputs.tf
│       ├── providers.tf
│       ├── variables.tf
│       └── versions.tf
├── public/
│   ├── content/
│   │   ├── modules/modules.json
│   │   ├── news/top3.json
│   │   ├── quotes/quotes.json
│   │   ├── sports/top3.json
│   │   └── visuals/feed.json
│   ├── media/
│   │   ├── modules/*.svg
│   │   └── visuals/*.svg
│   ├── favicon.svg
│   ├── icon-192.svg
│   ├── icon-512.svg
│   ├── og-image.svg
│   ├── robots.txt
│   ├── sitemap.xml
│   └── site.webmanifest
├── scripts/
│   └── validate-content.mjs
├── src/
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
└── vite.config.ts
```

## D. JSON content schema

`/content/news/top3.json`
```json
{
  "updatedAt": "ISO-8601",
  "section": "Top 3 News",
  "items": [
    {
      "id": "string",
      "title": "string",
      "source": "string",
      "url": "https://...",
      "tag": "World",
      "publishedAt": "ISO-8601"
    }
  ]
}
```

`/content/sports/top3.json`
```json
{
  "updatedAt": "ISO-8601",
  "section": "Top 3 Sports",
  "items": [
    {
      "id": "string",
      "title": "string",
      "source": "string",
      "url": "https://...",
      "tag": "Basketball",
      "publishedAt": "ISO-8601"
    }
  ]
}
```

`/content/quotes/quotes.json`
```json
{
  "updatedAt": "ISO-8601",
  "items": [
    {
      "id": "string",
      "quote": "string",
      "author": "string",
      "context": "string"
    }
  ]
}
```

`/content/visuals/feed.json`
```json
{
  "updatedAt": "ISO-8601",
  "items": [
    {
      "id": "string",
      "title": "string",
      "category": "Travel",
      "image": "/media/visuals/example.svg",
      "alt": "descriptive alt text",
      "credit": "reviewed source label"
    }
  ]
}
```

`/content/modules/modules.json`
```json
{
  "updatedAt": "ISO-8601",
  "items": [
    {
      "id": "earthquakes",
      "title": "string",
      "description": "string",
      "provider": "USGS",
      "mode": "link",
      "image": "/media/modules/earthquakes.svg",
      "actionLabel": "Open map",
      "actionUrl": "https://...",
      "metrics": [
        { "label": "Source", "value": "Authoritative" }
      ],
      "safeNote": "reviewed integration note"
    }
  ]
}
```

Schema rules in the MVP:
- news and sports must contain exactly 3 items
- every section carries `updatedAt`
- visuals are curated only, no uploads
- live modules declare a safe integration mode up front
- `npm run validate:content` enforces the base contract

## E. UI implementation

Implemented now:
- dark premium dashboard with responsive card layout
- JSON-fed Top 3 news and sports modules
- safe live-world cards for flights, ships, earthquakes, lightning, satellites, and weather
- auto-scrolling quote marquee
- lazy-loaded local memory game module
- curated visual feed tiles
- ad-ready placeholders without intrusive behavior
- loading skeletons and error states
- site metadata, Open Graph, Twitter/X tags, canonical, sitemap, robots, manifest, favicon

Local development:
```bash
npm install
npm run validate:content
npm run dev
```

Build:
```bash
npm run build
```

## F. AWS deployment plan

Terraform provisions:
- private S3 bucket: `xlb-codemachine-in-site`
- CloudFront distribution with OAC
- ACM certificate in `us-east-1`
- Route 53 `A` and `AAAA` alias records for `xlb.codemachine.in`
- SPA fallback for `/index.html`

Deploy steps:
1. Create or confirm the hosted zone `codemachine.in` exists in Route 53.
2. Update Terraform variables if you want a different AWS region or bucket name.
3. Run:
   ```bash
   cd infra/terraform
   terraform init
   terraform plan
   terraform apply
   ```
4. Note the outputs:
   - `site_bucket_name`
   - `cloudfront_distribution_id`
5. Set the same values in GitHub Actions environment variables or secrets.
6. Deploy the frontend build into the bucket.

Cache strategy:
- `/assets/*`: `public,max-age=31536000,immutable`
- `/content/*`: `public,max-age=300,must-revalidate`
- HTML/root files: `public,max-age=60,must-revalidate`

Versioning strategy:
- Vite emits hashed asset filenames automatically
- S3 bucket versioning is enabled
- CloudFront invalidation is limited to `/`, `/index.html`, and `/content/*`

AWS CLI deploy example:
```bash
npm install
npm run validate:content
npm run build
aws s3 sync dist/assets s3://xlb-codemachine-in-site/assets --delete --cache-control "public,max-age=31536000,immutable"
aws s3 sync dist/content s3://xlb-codemachine-in-site/content --delete --cache-control "public,max-age=300,must-revalidate"
aws s3 sync dist s3://xlb-codemachine-in-site --delete --exclude "assets/*" --exclude "content/*" --cache-control "public,max-age=60,must-revalidate"
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/" "/index.html" "/content/*"
```

## G. GitHub Actions automation plan

Current workflows:
- `build.yml`: install, validate content, build on PRs and `main`
- `deploy.yml`: install, validate, build, assume AWS role via OIDC, sync to S3, invalidate CloudFront

Secrets and variables:
- `AWS_DEPLOY_ROLE_ARN` secret
- `AWS_REGION` env
- `SITE_BUCKET` env
- `CLOUDFRONT_DISTRIBUTION_ID` env

Least-privilege IAM guidance:
- use the trust and deploy policy JSON under [`infra/iam`](./infra/iam)
- scope the trust policy to the exact GitHub repo and `main` branch
- keep Terraform apply separate from content/site deploy if you want cleaner blast-radius control

## H. Automation / agent roadmap

Phase-in path:
1. Add scheduled jobs that fetch and rank top news and sports into the existing JSON schemas.
2. Add a reviewed quote and visuals pipeline that only writes approved manifests.
3. Add a module registry job that can toggle live-world cards on or off by safety or uptime status.
4. Add screenshot-based or API-based live-world enrichments for flights, ships, weather, and earthquakes.
5. Split content generation and site deployment into separate workflows so agents only touch manifests.

Recommended future folders:
- `automation/fetch-news`
- `automation/fetch-sports`
- `automation/refresh-quotes`
- `automation/review-visuals`
- `automation/validate-and-publish`

## I. Safety / content governance model

Allowed:
- headline, source, link, short compliant summary
- reviewed safe-for-work visuals
- authoritative public-interest live data sources
- static games and curated external links

Not allowed:
- porn, nudity, sexual content, exploitative content, illegal content
- unreviewed embeds that can change into unsafe material
- full copyrighted news article storage
- user uploads in MVP
- aggressive ad-tech, redirects, autoplay audio, or deceptive placements

Operational rule:
- every external provider must be either link-only, screenshot-only, or explicitly reviewed for embed safety before promotion

## J. MVP roadmap

Phase 1:
- ship the static dashboard, support pages, Terraform, CI deploy, and manual content manifests

Phase 2:
- add scheduled content refresh jobs, stronger schema validation, analytics hook, and richer live-world snapshots

Phase 3:
- move to agent-driven curation workflows with validation gates, rollback support, and manifest-level feature flags

## Terraform notes

- ACM for CloudFront must be in `us-east-1`; this is already handled with an aliased provider.
- The current setup uses one S3 bucket for simplicity. If content automation grows, split manifests into a second bucket or a dedicated `content/` publishing prefix.
- SPA routes are supported through CloudFront custom error responses for `403` and `404`.

## Content maintenance

Manual updates today:
- edit files under `public/content/...`
- run `npm run validate:content`
- build and deploy

Future automation contract:
- refresh jobs should only write JSON manifests and media references
- the frontend should not require code changes to rotate items, sources, or modules
