# XLB Agent Context
XLB powers the website:
https://xlb.codemachine.in
The site is evolving from a broad curiosity dashboard into a live-events publishing system focused on repeat-visit, automation-friendly public-interest events. The architecture remains intentionally simple so automation can safely update content.
---

# Core Principle
The frontend code should change less often than the content layer. Automation modifies JSON manifests, experiments, and analytics snapshots that the frontend and generation pipeline read dynamically. This allows the site to evolve without changing application code every time a topic wins or loses.
---

# Architecture
Frontend:
- Vite
- React
- TypeScript
- Static build
Hosting:
- AWS S3
- CloudFront CDN
- Route53 DNS
- Terraform infrastructure
There is:
- no backend
- no database
- no SSR
All content is JSON.
---

# Content Manifests
Content lives in:
public/content/
Manifests include:
news/top3.json  
sports/top3.json  
quotes/quotes.json  
visuals/feed.json  
modules/modules.json  
live/events.json  

Each manifest contains:
updatedAt timestamp  
items array

Rules:
- news must contain exactly 3 items
- sports must contain exactly 3 items
- visuals are curated only
- no user uploads
- external sources must link to original content
- live events should prefer authoritative source links and clear event status

Validation command:
npm run validate:content
---

# Automation Strategy
Automation updates content manifests, analytics snapshots, and experiment queues. Current jobs include:
fetch-news  
fetch-sports  
refresh-quotes  

Planned jobs include:
refresh-live-events  
capture-analytics  
rank-opportunities  
optimize-content  
prune-low-value-topics  

Automation scripts live in:
automation/

These scripts may:
fetch source feeds  
filter unsafe content  
rank topics and events  
generate manifests  
score experiments  
recommend pruning or expansion

Automation must never modify:
Terraform infrastructure  
IAM policies  
GitHub deploy workflows
---

# Analytics and Optimization
The site should track user engagement and content performance signals.
Preferred source order:
GA4  
Search Console  
AdSense  
Cloudflare Web Analytics as an optional supplemental signal  

Metrics include:
page views  
watch clicks  
external link clicks  
return visits  
search impressions  
CTR  
revenue per page  

Analytics data feeds a daily optimization job that may:
promote winning event clusters  
rotate or demote weak topics  
introduce experiments  
archive stale pages  

---
# Safety Rules
The site must remain safe for general audiences.
Disallowed content includes:
pornography  
sexual content  
illegal material  
extremist content  

Only short summaries and links are allowed for third-party news and event coverage.
Full third-party article text must never be stored.
Agents must not imply endorsement from public institutions or source organizations.
---

# Long-Term Goal
XLB evolves toward a self-improving website.
Automation loop:
traffic  
→ analytics  
→ AI analysis  
→ content optimization  
→ redeploy  
The system should gradually become a supervised-autonomy live-events site where low-risk changes can ship automatically and higher-risk changes pause for human review.
Low-risk autonomy is earned only after repeated healthy runs with real analytics coverage; it should not unlock from a single snapshot.
Source adapters must also prove stability across repeated non-fallback runs before unattended deploy is allowed.
