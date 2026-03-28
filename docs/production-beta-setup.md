# XLB Production Beta Setup

This guide covers the last external setup needed before a supervised soft beta deploy.

## 1. GitHub Secrets

Set this repository secret in GitHub:

- `VITE_GA_MEASUREMENT_ID`
  - example: `G-XXXXXXXXXX`
  - used at build time so the deployed frontend can send GA4 pageview and outbound click events

The deploy workflow already expects:

- `AWS_DEPLOY_ROLE_ARN`

Current deploy environment values live in [deploy.yml](/home/sg/cmt7/xlb/.github/workflows/deploy.yml):

- `SITE_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

## 2. Google Analytics 4

Create or use a GA4 web data stream for:

- `https://xlb.codemachine.in`

Then copy the measurement ID and store it as:

- `VITE_GA_MEASUREMENT_ID`

The app now records:

- route/page views
- `watch_source` outbound clicks
- `open_source` outbound clicks

## 3. Google Search Console

Add the property for:

- `https://xlb.codemachine.in/`

Then:

1. verify ownership
2. submit the sitemap:
   - `https://xlb.codemachine.in/sitemap.xml`

## 4. Pre-Deploy Commands

Run these before the soft beta deploy:

```bash
npm test
npm run validate:content
npm run automation:live-events
npm run automation:source-health
npm run automation:assess-live-risk
npm run automation:check-deploy-readiness
npm run build
```

## 5. Beta Deploy Operating Mode

For soft beta, keep the following true:

- live-event automation remains PR-based
- deployment remains supervised by a human
- automation summaries are reviewed in GitHub Actions
- local ops view remains available at `/__ops` only in development

## 6. Success Criteria For The First Week

The goal is not immediate traffic volume. The goal is to begin the real feedback loop.

Look for:

- pages being indexed in Search Console
- first pageviews arriving in GA4
- outbound `watch_source` clicks on live pages
- whether `/live` and event pages act like useful entry points
- whether any event/topic pages deserve expansion
