import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const OPPORTUNITIES_FILE = new URL("../../automation/experiments/traffic-opportunities.json", import.meta.url);
const EVENTS_FILE = new URL("../../public/content/live/events.json", import.meta.url);
const SITEMAP_FILE = new URL("../../public/sitemap.xml", import.meta.url);
const REPORT_FILE = new URL("../../automation/reports/applied-opportunities.json", import.meta.url);

async function main() {
  const queue = await readJsonIfExists(OPPORTUNITIES_FILE);
  const events = await readJsonIfExists(EVENTS_FILE);

  if (!queue?.items?.length) {
    console.log("No opportunities queued — nothing to apply.");
    return;
  }

  const lowRiskQueued = queue.items.filter(
    (item) => item.risk === "low" && item.status === "queued"
  );

  console.log(`Found ${lowRiskQueued.length} low-risk queued opportunities.`);

  const applied = [];
  const skipped = [];

  for (const item of lowRiskQueued) {
    const path = item.targetPaths?.[0];
    if (!path) { skipped.push(item.id); continue; }

    if (item.signal === "index_watch") {
      const inSitemap = await isInSitemap(path);
      if (!inSitemap) {
        await addToSitemap(path);
        applied.push({ id: item.id, action: "added_to_sitemap", path });
        console.log(`Added ${path} to sitemap.`);
      } else {
        skipped.push(item.id);
      }
    }

    if (item.signal === "engagement_expand" && events?.items) {
      const event = events.items.find((e) => `/${e.slug}` === path || `/events/${e.slug}` === path);
      if (event && !event.safeToPromote) {
        event.safeToPromote = true;
        applied.push({ id: item.id, action: "promoted_event", path });
        console.log(`Promoted ${path} to safeToPromote.`);
      } else {
        skipped.push(item.id);
      }
    }
  }

  // Mark applied items as running
  const updatedAt = new Date().toISOString();
  const updatedQueue = {
    ...queue,
    updatedAt,
    items: queue.items.map((item) => {
      const wasApplied = applied.some((a) => a.id === item.id);
      return wasApplied ? { ...item, status: "running" } : item;
    }),
  };

  if (applied.length > 0 && events?.items) {
    await writeJsonIfChanged(EVENTS_FILE, { ...events, updatedAt });
  }

  await writeJsonIfChanged(OPPORTUNITIES_FILE, updatedQueue);
  await writeJsonIfChanged(REPORT_FILE, { updatedAt, applied, skipped });

  console.log(`Applied ${applied.length} opportunities, skipped ${skipped.length}.`);
}

async function isInSitemap(path) {
  try {
    const { readFile } = await import("node:fs/promises");
    const xml = await readFile(SITEMAP_FILE, "utf8");
    return xml.includes(`xlb.codemachine.in${path}`);
  } catch { return false; }
}

async function addToSitemap(path) {
  const { readFile, writeFile } = await import("node:fs/promises");
  const xml = await readFile(SITEMAP_FILE, "utf8");
  const today = new Date().toISOString().slice(0, 10);
  const newUrl = `  <url>\n    <loc>https://xlb.codemachine.in${path}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
  const updated = xml.replace("</urlset>", `${newUrl}\n</urlset>`);
  await writeFile(SITEMAP_FILE, updated, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
