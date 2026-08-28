export const TECH_MAX_AGE_HOURS = 72;
export const TECH_MAX_FUTURE_SKEW_HOURS = 6;

const HOUR_MS = 60 * 60 * 1000;
const PROMOTIONAL_TITLE_PATTERN = /\b(?:promo|coupon|discount) codes?\b|\bdeals? page\b/i;

export function assessTechArticle(article, referenceTime) {
  const referenceMs = parseReferenceTime(referenceTime);
  const publishedMs = Date.parse(article?.publishedAt);

  if (!Number.isFinite(publishedMs)) {
    return { eligible: false, reason: "invalid-date" };
  }

  if (publishedMs < referenceMs - TECH_MAX_AGE_HOURS * HOUR_MS) {
    return { eligible: false, reason: "stale" };
  }

  if (publishedMs > referenceMs + TECH_MAX_FUTURE_SKEW_HOURS * HOUR_MS) {
    return { eligible: false, reason: "future-dated" };
  }

  if (PROMOTIONAL_TITLE_PATTERN.test(article?.title ?? "")) {
    return { eligible: false, reason: "promotional" };
  }

  return { eligible: true, reason: "eligible" };
}

export function partitionTechArticles(articles, referenceTime) {
  const eligible = [];
  const rejected = [];

  for (const article of articles ?? []) {
    const assessment = assessTechArticle(article, referenceTime);

    if (assessment.eligible) {
      eligible.push(article);
    } else {
      rejected.push({ article, reason: assessment.reason });
    }
  }

  return { eligible, rejected };
}

export function selectTopTechArticles(articles, count, referenceTime) {
  const { eligible } = partitionTechArticles(articles, referenceTime);
  const selected = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  const seenSources = new Set();
  const ranked = [...eligible].sort(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
  );

  for (const article of ranked) {
    const normalizedTitle = article.title.toLowerCase();

    if (
      seenUrls.has(article.url) ||
      seenTitles.has(normalizedTitle) ||
      seenSources.has(article.source)
    ) {
      continue;
    }

    addArticle(article, selected, seenUrls, seenTitles);
    seenSources.add(article.source);

    if (selected.length === count) {
      return selected;
    }
  }

  for (const article of ranked) {
    const normalizedTitle = article.title.toLowerCase();

    if (seenUrls.has(article.url) || seenTitles.has(normalizedTitle)) {
      continue;
    }

    addArticle(article, selected, seenUrls, seenTitles);

    if (selected.length === count) {
      break;
    }
  }

  return selected;
}

export function buildTechSelection({
  articles,
  existingTop3,
  existingExpanded,
  referenceTime,
  topCount = 3,
  expandedCount = 12,
}) {
  const fallbackItems = [
    ...(existingTop3?.items ?? []),
    ...(existingExpanded?.items ?? []),
  ];
  const expanded = selectTopTechArticles(
    [...articles, ...fallbackItems],
    expandedCount,
    referenceTime,
  );
  const top3 = expanded.slice(0, topCount);

  if (top3.length < topCount) {
    throw new Error(`Expected at least ${topCount} fresh Tech articles, received ${top3.length}`);
  }

  return { expanded, top3 };
}

function addArticle(article, selected, seenUrls, seenTitles) {
  seenUrls.add(article.url);
  seenTitles.add(article.title.toLowerCase());
  selected.push(article);
}

function parseReferenceTime(referenceTime) {
  const referenceMs = referenceTime instanceof Date
    ? referenceTime.valueOf()
    : Date.parse(referenceTime);

  if (!Number.isFinite(referenceMs)) {
    throw new Error("Tech freshness reference time is invalid");
  }

  return referenceMs;
}
