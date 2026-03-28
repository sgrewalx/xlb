# XLB Soft Beta Checklist

This checklist is for a supervised beta deploy whose goal is to start learning from real traffic and real source behavior.

## Beta Goal

The beta is successful if it:

- ships a credible public version of XLB
- starts collecting real GA4 and Search Console signals
- proves the source pipeline is stable in public
- gives the automation loop real behavior to learn from

It is not meant to represent full autonomous production readiness.

## Must Be True Before Beta

### Product

- homepage clearly points users into `/live`, event pages, and topic pages
- no public-facing operator copy or internal recommendation language leaks into public routes
- event pages, topic pages, and `/live` feel credible on desktop and mobile
- obvious layout issues are fixed

### Search / Crawlability

- `public/robots.txt` allows crawling and references the sitemap
- `public/sitemap.xml` is current
- page titles and descriptions reflect the live-events direction
- canonical tags resolve to `https://xlb.codemachine.in`
- internal links connect home, live, topic, and event routes

### Analytics

- GA4 measurement ID is set through `VITE_GA_MEASUREMENT_ID`
- page views are recorded on route changes
- outbound click events are recorded for:
  - `watch_source`
  - `open_source`
- Search Console ownership is verified
- sitemap is submitted in Search Console

### Source Reliability

- NASA, USGS, and NOAA source checks are healthy
- no broken event inventory is published
- stale placeholders are removed or hidden
- degraded sources do not silently publish bad output

### Governance

- live refresh remains PR-based for beta
- deploy remains blocked when governance says `review-required` or `blocked`
- humans remain in the loop for deploy approval

## Commands To Run Before Beta

```bash
npm test
npm run validate:content
npm run automation:live-events
npm run automation:source-health
npm run automation:assess-live-risk
npm run automation:check-deploy-readiness
npm run build
```

## Current Beta Readiness Call

Current state is best described as:

- technically deployable
- suitable for a supervised soft beta once production analytics is wired
- not yet suitable for unattended autonomous production

## What Beta Should Teach Us

- which event pages get any visits at all
- which event pages earn outbound clicks
- whether `/live` acts as a useful hub
- whether topic pages attract or retain attention
- which sources and page types deserve expansion
