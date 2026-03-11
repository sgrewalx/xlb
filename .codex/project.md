# XLB Agent Context
XLB powers the website:
https://xlb.codemachine.in
The site is a curiosity-driven website that aggregates global information modules including news, sports, quotes, visuals, and live-world trackers. The architecture is intentionally simple so automation can safely update content.
---

# Core Principle
The frontend code rarely changes. Automation modifies JSON manifests that the frontend reads dynamically. This allows the site to evolve without changing application code.
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

Each manifest contains:
updatedAt timestamp  
items array

Rules:
- news must contain exactly 3 items
- sports must contain exactly 3 items
- visuals are curated only
- no user uploads
- external sources must link to original content

Validation command:
npm run validate:content
---

# Automation Strategy
Automation updates content manifests. Automation jobs include:
fetch-news  
fetch-sports  
refresh-quotes  
refresh-visuals  
analyze-metrics  
optimize-content  

Automation scripts live in:
automation/

These scripts may:
fetch RSS feeds  
filter unsafe content  
rank headlines  
generate manifests  

Automation must never modify:
Terraform infrastructure  
IAM policies  
GitHub deploy workflows
---

# Analytics and Optimization
The site tracks user engagement events.
Metrics include:
page views  
card clicks  
external link clicks  
module opens  

Analytics data feeds a daily optimization job that may:
rotate headlines  
promote popular sections  
introduce experiments  

---
# Safety Rules
The site must remain safe for general audiences.
Disallowed content includes:
pornography  
sexual content  
illegal material  
extremist content  

Only headlines and links are allowed for news.
Full article text must never be stored.
---

# Long-Term Goal
XLB evolves toward a self-improving website.
Automation loop:
traffic  
→ analytics  
→ AI analysis  
→ content optimization  
→ redeploy  
The system should gradually become a fully autonomous curiosity dashboard.