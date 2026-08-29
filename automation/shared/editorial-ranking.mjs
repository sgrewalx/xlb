const HOUR_MS = 60 * 60 * 1000;
const FRESHNESS_BANDS_MS = [2 * HOUR_MS, 6 * HOUR_MS, 24 * HOUR_MS, 72 * HOUR_MS];

export function rankEditorialArticles(articles) {
  const candidates = (articles ?? []).map((article, index) => ({ article, index }));
  const latestPublishedAt = Math.max(
    ...candidates.map(({ article }) => parsePublishedAt(article.publishedAt)),
  );

  return candidates
    .sort((left, right) => {
      const leftTime = parsePublishedAt(left.article.publishedAt);
      const rightTime = parsePublishedAt(right.article.publishedAt);
      const bandDifference =
        freshnessBand(latestPublishedAt - leftTime) -
        freshnessBand(latestPublishedAt - rightTime);

      if (bandDifference !== 0) {
        return bandDifference;
      }

      const imageDifference = Number(Boolean(right.article.image)) - Number(Boolean(left.article.image));
      if (imageDifference !== 0) {
        return imageDifference;
      }

      const timeDifference = rightTime - leftTime;
      if (timeDifference !== 0) {
        return timeDifference;
      }

      return left.index - right.index;
    })
    .map(({ article }) => article);
}

function freshnessBand(ageMs) {
  const normalizedAge = Number.isFinite(ageMs) ? Math.max(0, ageMs) : Number.POSITIVE_INFINITY;
  const index = FRESHNESS_BANDS_MS.findIndex((limit) => normalizedAge <= limit);
  return index === -1 ? FRESHNESS_BANDS_MS.length : index;
}

function parsePublishedAt(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}
