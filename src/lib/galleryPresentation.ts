import type { GalleryCollectionEntry, GalleryCollectionItem } from "../types/content";

export type GalleryCategory = GalleryCollectionItem["category"];
export type GallerySelection = "all" | GalleryCategory;

const CONSUMER_METRIC_LABELS = new Map([
  ["countdown", "Countdown"],
  ["updated", "Updated"],
]);

export function getConsumerMetric(entry: GalleryCollectionEntry) {
  const label = CONSUMER_METRIC_LABELS.get(entry.metricLabel.trim().toLowerCase());
  const value = entry.metricValue.trim();

  if (!label || !value || /^0(?:\.0+)?$/.test(value)) {
    return null;
  }

  return { label, value };
}

export function getGalleryCategories(items: GalleryCollectionItem[]) {
  return [...new Set(items.map((item) => item.category))];
}

export function getGalleryDiscoveryItems(
  items: GalleryCollectionItem[],
  selectedCategory: GallerySelection,
) {
  const collections = selectedCategory === "all"
    ? items.slice(1)
    : items.filter((collection) => collection.category === selectedCategory);

  return collections.flatMap((collection) => (
    collection.entries.map((entry) => ({ collection, entry }))
  ));
}
