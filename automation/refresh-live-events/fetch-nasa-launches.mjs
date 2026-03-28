import { readFile } from "node:fs/promises";
import path from "node:path";

const NASA_LAUNCH_SCHEDULE_URL = "https://www.nasa.gov/event-type/launch-schedule/";

export async function fetchNasaLaunchSeeds() {
  const { html, fallbackUsed } = await loadLaunchScheduleHtml();
  let items = parseLaunchScheduleHtml(html);

  if (!items.length) {
    const bundledFixture = new URL("./fixtures/nasa-launch-schedule.html", import.meta.url);
    const fallbackHtml = await readFile(bundledFixture, "utf8");
    items = parseLaunchScheduleHtml(fallbackHtml);
  }

  if (!items.length) {
    throw new Error("NASA launch schedule returned no parseable launch items");
  }

  return {
    items,
    fallbackUsed,
  };
}

async function loadLaunchScheduleHtml() {
  const fixtureDir = process.env.XLB_LIVE_EVENTS_FIXTURE_DIR;
  const bundledFixture = new URL("./fixtures/nasa-launch-schedule.html", import.meta.url);

  if (fixtureDir) {
    const fixturePath = path.join(fixtureDir, "nasa-launch-schedule.html");

    try {
      return { html: await readFile(fixturePath, "utf8"), fallbackUsed: true };
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  try {
    const response = await fetch(NASA_LAUNCH_SCHEDULE_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "xlb-live-events-automation/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`NASA launch schedule request failed: ${response.status} ${response.statusText}`);
    }

    return { html: await response.text(), fallbackUsed: false };
  } catch {
    return { html: await readFile(bundledFixture, "utf8"), fallbackUsed: true };
  }
}

export function parseLaunchScheduleHtml(html) {
  const anchorMatches = [
    ...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
  ];

  const launchItems = [];

  for (const match of anchorMatches) {
    const href = canonicalizeUrl(match[1]);
    const text = cleanText(match[2]);

    if (!href || !text) {
      continue;
    }

    if (!looksLikeLaunchScheduleEntry(text, href)) {
      continue;
    }

    const parsed = buildLaunchItem(text, href, launchItems.length);

    if (parsed) {
      launchItems.push(parsed);
    }

    if (launchItems.length === 3) {
      break;
    }
  }

  return launchItems;
}

export function looksLikeLaunchScheduleEntry(text, href) {
  return (
    href.includes("/event/") &&
    text.startsWith("No Earlier Than") &&
    /\bArtemis\b|\bCRS-\d+\b|\bStarliner\b|\bCommercial Crew\b|\bCLPS\b|\bSoyuz\b|\bProgress\b/i.test(text)
  );
}

export function buildLaunchItem(rawText, url, index) {
  const text = rawText.replace(/\s+/g, " ").trim();
  const normalized = text.replace(/\s*Launch Schedule\s*/gi, " ").replace(/\s+/g, " ").trim();
  const title = extractTitle(normalized);
  if (!title) {
    return null;
  }

  const parsedDate = inferStartsAt(text);
  const topic = inferTopic(title);
  const slug = slugify(title).slice(0, 64) || `nasa-launch-${index + 1}`;

  return {
    id: `space-launch-${slug}`,
    slug,
    title,
    status: "upcoming",
    category: "space",
    topic: "launches",
    startsAt: parsedDate,
    summary: `${title} is on NASA's published launch schedule and is a strong candidate for a source-backed launch event page.`,
    whyItMatters: `Launches convert the vague launch placeholder into a real, source-backed event record. Topic hint: ${topic}.`,
    sourceName: "NASA Launch Schedule",
    sourceUrl: url,
    watchUrl: "https://www.nasa.gov/live",
    coverageMode: "link",
    safeToPromote: true,
    heroPriority: Math.max(88 - index * 6, 70),
    rightsProfile: "public-information",
    cadence: "scheduled",
    audienceIntent: "watch-live",
    updatedAt: new Date().toISOString(),
  };
}

export function inferStartsAt(text) {
  const withTime = text.match(/No Earlier Than ([A-Za-z]+ \d{1,2},\s*\d{4} \d{1,2}:\d{2} [ap]m)/i);

  if (withTime) {
    const date = new Date(`${withTime[1]} UTC`);
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString();
    }
  }

  const dateOnly = text.match(/No Earlier Than ([A-Za-z]+ \d{1,2},\s*\d{4})/i);

  if (dateOnly) {
    const date = new Date(`${dateOnly[1]} 12:00 UTC`);
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString();
    }
  }

  const monthOnly = text.match(/No Earlier Than ([A-Za-z]+ \d{4})/i);

  if (monthOnly) {
    const date = new Date(`1 ${monthOnly[1]} 12:00 UTC`);
    if (!Number.isNaN(date.valueOf())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

export function extractTitle(text) {
  let title = text.replace(/^No Earlier Than\s+/i, "").trim();
  title = title.replace(
    /^[A-Za-z]+\s+\d{1,2},\s*\d{4}(?:\s+\d{1,2}:\d{2}\s+[ap]m)?\s*/i,
    "",
  );
  title = title.replace(/^[A-Za-z]+\s+\d{4}\s+/i, "");
  return title.trim();
}

export function inferTopic(title) {
  if (/artemis/i.test(title)) {
    return "artemis";
  }

  if (/spacex/i.test(title)) {
    return "spacex";
  }

  if (/starliner/i.test(title)) {
    return "starliner";
  }

  if (/northrop grumman/i.test(title)) {
    return "cargo";
  }

  return "launches";
}

export function cleanText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeUrl(value) {
  try {
    return new URL(value, NASA_LAUNCH_SCHEDULE_URL).toString();
  } catch {
    return "";
  }
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
