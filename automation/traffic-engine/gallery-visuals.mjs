const VISUAL_WIDTH = 1200;
const VISUAL_HEIGHT = 675;

export function buildGalleryVisuals(context) {
  const events = context.liveEventsFeed.items ?? [];
  const earthquake = events.find((item) => item.slug === "global-earthquake-watch");
  const aurora = events.find((item) => item.slug === "aurora-watch");
  const launches = events.filter((item) => item.topic === "launches").slice(0, 3);
  const topics = [...(context.topicsFeed.items ?? [])]
    .sort((left, right) => right.bestScore - left.bestScore)
    .slice(0, 4);

  return [
    {
      id: "earthquake-activity",
      svg: earthquakeVisual(earthquake, context.updatedAt),
    },
    {
      id: "aurora-kp",
      svg: auroraVisual(aurora, context.updatedAt),
    },
    {
      id: "launch-timeline",
      svg: launchVisual(launches, context.updatedAt),
    },
    {
      id: "topic-signals",
      svg: topicVisual(topics, context.updatedAt),
    },
  ];
}

function earthquakeVisual(event, updatedAt) {
  const count = numberFrom(event?.summary, /reported\s+(\d+)\s+earthquake/i, 0);
  const strongest = numberFrom(event?.summary, /M([\d.]+)\s+near/i, 0);
  const circles = [0.38, 0.56, 0.74, 0.49, 0.65].map((factor, index) => {
    const radius = Math.max(12, Math.round((strongest || 3) * factor * 7));
    const x = [780, 930, 1015, 855, 1100][index];
    const y = [220, 330, 175, 470, 425][index];
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="#84e5c1" stroke-width="4" opacity="${0.9 - index * 0.11}"/>`;
  }).join("");

  return svgFrame({
    kicker: "USGS 24-HOUR SNAPSHOT",
    title: "Earthquake activity",
    subtitle: "Generated from the current USGS live event record.",
    updatedAt,
    body: `
      <text x="72" y="350" class="metric">${count}</text>
      <text x="72" y="393" class="metric-label">EVENTS REPORTED</text>
      <text x="405" y="350" class="metric">M${formatNumber(strongest)}</text>
      <text x="405" y="393" class="metric-label">STRONGEST EVENT</text>
      <path d="M760 120H1130V510H760Z M760 250H1130 M760 380H1130 M885 120V510 M1010 120V510" fill="none" stroke="#263847" stroke-width="2"/>
      ${circles}
    `,
  });
}

function auroraVisual(event, updatedAt) {
  const current = clamp(numberFrom(event?.summary, /near\s+Kp\s+([\d.]+)/i, 0), 0, 9);
  const peak = clamp(numberFrom(event?.summary, /peak\s+reached\s+Kp\s+([\d.]+)/i, current), 0, 9);
  const scaleX = (value) => 135 + value * 98;
  const ticks = Array.from({ length: 10 }, (_, index) => `
    <line x1="${scaleX(index)}" y1="315" x2="${scaleX(index)}" y2="365" stroke="#526576" stroke-width="2"/>
    <text x="${scaleX(index)}" y="398" text-anchor="middle" class="tick">${index}</text>
  `).join("");

  return svgFrame({
    kicker: "NOAA SWPC GEOMAGNETIC SNAPSHOT",
    title: "Aurora conditions",
    subtitle: "Current and recent Kp readings from the NOAA-backed event record.",
    updatedAt,
    body: `
      <line x1="135" y1="340" x2="1017" y2="340" stroke="#334654" stroke-width="18" stroke-linecap="round"/>
      <line x1="135" y1="340" x2="${scaleX(peak)}" y2="340" stroke="#84e5c1" stroke-width="18" stroke-linecap="round"/>
      ${ticks}
      <circle cx="${scaleX(current)}" cy="340" r="17" fill="#f5b642" stroke="#07111f" stroke-width="7"/>
      <text x="135" y="490" class="metric-small">Current Kp ${formatNumber(current)}</text>
      <text x="620" y="490" class="metric-small">Recent peak Kp ${formatNumber(peak)}</text>
    `,
  });
}

function launchVisual(launches, updatedAt) {
  const rows = launches.length > 0 ? launches : [{ title: "No scheduled launches", startsAt: updatedAt }];
  const body = rows.map((launch, index) => {
    const y = 320 + index * 105;
    return `
      <circle cx="120" cy="${y}" r="11" fill="#84e5c1"/>
      ${index < rows.length - 1 ? `<line x1="120" y1="${y + 14}" x2="120" y2="${y + 91}" stroke="#334654" stroke-width="4"/>` : ""}
      <text x="165" y="${y - 8}" class="row-title">${escapeXml(launch.title)}</text>
      <text x="165" y="${y + 28}" class="row-meta">${escapeXml(formatDate(launch.startsAt))} UTC · NASA launch schedule</text>
    `;
  }).join("");

  return svgFrame({
    kicker: "NASA SCHEDULE SNAPSHOT",
    title: "Launch timeline",
    subtitle: "Current launch records ordered into one source-backed visual timeline.",
    updatedAt,
    body,
  });
}

function topicVisual(topics, updatedAt) {
  const rows = topics.length > 0 ? topics : [{ title: "No current topics", bestScore: 0, eventCount: 0 }];
  const body = rows.map((topic, index) => {
    const y = 300 + index * 84;
    const width = clamp(Number(topic.bestScore) || 0, 0, 100) * 7.2;
    return `
      <text x="75" y="${y}" class="row-title">${escapeXml(topic.title)}</text>
      <rect x="365" y="${y - 24}" width="720" height="24" rx="4" fill="#1d303e"/>
      <rect x="365" y="${y - 24}" width="${width}" height="24" rx="4" fill="#84e5c1"/>
      <text x="1115" y="${y - 3}" text-anchor="end" class="row-meta">${Number(topic.bestScore) || 0} score · ${Number(topic.eventCount) || 0} events</text>
    `;
  }).join("");

  return svgFrame({
    kicker: "CURRENT SOURCE-BACKED INVENTORY",
    title: "Topic signals",
    subtitle: "Relative topic strength generated from current event and ranking records.",
    updatedAt,
    body,
  });
}

function svgFrame({ kicker, title, subtitle, updatedAt, body }) {
  const normalizedBody = body.trim().replace(/[ \t]+$/gm, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VISUAL_WIDTH}" height="${VISUAL_HEIGHT}" viewBox="0 0 ${VISUAL_WIDTH} ${VISUAL_HEIGHT}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">${escapeXml(subtitle)}</desc>
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill: #eef6ff; letter-spacing: 0; }
    .kicker { fill: #84e5c1; font-size: 18px; font-weight: 700; }
    .title { font-size: 58px; font-weight: 700; }
    .subtitle { fill: #aebdca; font-size: 22px; }
    .updated { fill: #7890a3; font-size: 16px; }
    .metric { font-size: 76px; font-weight: 700; }
    .metric-small { font-size: 27px; font-weight: 700; }
    .metric-label, .tick, .row-meta { fill: #91a5b5; font-size: 17px; }
    .row-title { font-size: 23px; font-weight: 700; }
  </style>
  <rect width="1200" height="675" fill="#07111f"/>
  <rect x="28" y="28" width="1144" height="619" rx="12" fill="#0d1d2a" stroke="#284052" stroke-width="2"/>
  <text x="72" y="92" class="kicker">${escapeXml(kicker)}</text>
  <text x="72" y="164" class="title">${escapeXml(title)}</text>
  <text x="72" y="210" class="subtitle">${escapeXml(subtitle)}</text>
  ${normalizedBody}
  <text x="1128" y="615" text-anchor="end" class="updated">UPDATED ${escapeXml(formatDate(updatedAt))} UTC</text>
</svg>\n`;
}

function numberFrom(value, pattern, fallback) {
  const match = String(value ?? "").match(pattern);
  const parsed = Number(match?.[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "DATE PENDING";
  }
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
