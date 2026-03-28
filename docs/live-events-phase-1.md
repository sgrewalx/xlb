# XLB Live Events Phase 1

## Objective

XLB shifts from a broad curiosity dashboard into a live-events publishing system focused on repeat-visit, automation-friendly public-interest events.

Phase 1 goal:

- establish a narrow editorial thesis
- define safe automation boundaries
- create machine-readable contracts for agents
- prepare event inventory that can later drive page generation

## Editorial Focus

Primary verticals:

- `space`
- `earth`

Initial event families:

- rocket launches
- NASA live programming
- ISS events
- eclipses
- meteor showers
- earthquakes
- volcanoes
- aurora / geomagnetic activity
- major storm watch pages

## Product Shape

The homepage remains a lightweight front door, but durable traffic should come from destination pages and topic hubs:

- `/live`
- `/live/space`
- `/live/earth`
- `/events/<slug>`
- `/topics/<slug>`
- `/watch/<slug>`

Each event page should eventually include:

- title
- status
- event window
- watch destination or authoritative source
- short human-readable summary
- why it matters
- source attribution
- update timestamp
- related topics and related events

## Automation Loop

Daily operating loop:

1. collect analytics snapshots
2. score page, topic, and template performance
3. detect opportunities and regressions
4. generate low-risk content and metadata updates
5. open PRs for medium-risk changes
6. require human approval for monetization and policy-sensitive changes
7. measure outcome and feed it into the next cycle

## Agent Roles

`signal-agent`
- ingests Cloudflare, Search Console, GA4, and ad metrics

`opportunity-agent`
- ranks winning topics, decaying topics, and page templates worth expanding

`content-agent`
- drafts event summaries, structured metadata, and topic relationships

`seo-agent`
- improves title tags, descriptions, schema, and internal links

`prune-agent`
- recommends freezing, consolidating, or removing weak content clusters

`governor-agent`
- enforces policy and approval thresholds

## Success Criteria

Phase 1 success is not revenue. It is operational readiness.

We should be able to answer:

- which event categories drive repeat traffic?
- which page templates earn clicks and engagement?
- which topics should be expanded or pruned?
- which changes are safe to automate end to end?

## Approval Boundaries

Safe to automate:

- event inventory refresh
- metadata updates
- summaries derived from approved templates
- internal linking updates
- sitemap and index refreshes
- archival of stale event pages under published rules

Human approval required:

- ad density changes
- new monetization vendors
- changes to privacy / legal copy
- new source classes with unclear rights
- politically or reputationally sensitive content
- large homepage redesigns

## Near-Term Build Order

1. validate a live-events content manifest
2. store analytics and experiment data in machine-readable form
3. codify agent permissions and review thresholds
4. generate static event pages from manifests
5. connect analytics-driven ranking to the content generation loop
