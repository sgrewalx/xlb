export interface FeedItem {
  id: string;
  title: string;
  source: string;
  url: string;
  tag: string;
  publishedAt: string;
  summary?: string;
  whyItMatters?: string;
  embedUrl?: string;
}

export interface TopFeed {
  updatedAt: string;
  section: string;
  items: FeedItem[];
}

export interface QuoteItem {
  id: string;
  quote: string;
  author: string;
  context: string;
}

export interface QuoteFeed {
  updatedAt: string;
  items: QuoteItem[];
}

export interface VisualItem {
  id: string;
  title: string;
  category: string;
  image: string;
  alt: string;
  credit: string;
}

export interface VisualFeed {
  updatedAt: string;
  items: VisualItem[];
}

export interface ModuleMetric {
  label: string;
  value: string;
}

export interface LiveModule {
  id: string;
  title: string;
  description: string;
  provider: string;
  mode: "link" | "summary";
  image: string;
  actionLabel: string;
  actionUrl: string;
  metrics: ModuleMetric[];
  safeNote: string;
}

export interface ModulesFeed {
  updatedAt: string;
  items: LiveModule[];
}

export interface LiveEventItem {
  id: string;
  slug: string;
  title: string;
  status: "upcoming" | "live" | "ended" | "watch" | "monitoring";
  category: "space" | "earth";
  topic: string;
  startsAt: string;
  endsAt?: string;
  summary: string;
  whyItMatters?: string;
  sourceName: string;
  sourceUrl: string;
  watchUrl: string;
  coverageMode: "link" | "embed_candidate" | "summary";
  safeToPromote: boolean;
  heroPriority?: number;
  importance?: number;
  featuredReason?: string;
  relatedVideoIds?: string[];
  relatedGameIds?: string[];
  relatedGalleryIds?: string[];
  rightsProfile: string;
  cadence: string;
  audienceIntent: string;
  updatedAt: string;
}

export interface LiveEventsFeed {
  updatedAt: string;
  section: string;
  items: LiveEventItem[];
}

export interface LiveEventScore {
  slug: string;
  pagePath: string;
  category: "space" | "earth";
  score: number;
  scoringMode: "cold-start" | "blended" | "observed";
  coldStartScore: number;
  heuristicScore: number;
  observedScore: number;
  pageviews: number;
  watchClicks: number;
  engagementScore: number;
  searchImpressions: number;
  searchCtr: number;
  categoryPageviews: number;
  sourceStability: "stable" | "earning-trust" | "degraded" | "unknown";
  recencyBand: string;
  recommendation: "expand" | "hold" | "prune" | "review";
  notes: string;
}

export interface LiveEventScoreboard {
  updatedAt: string;
  sourceSnapshot: string;
  items: LiveEventScore[];
}

export interface TopicItem {
  slug: string;
  title: string;
  category: "space" | "earth";
  summary: string;
  eventCount: number;
  promotedEventCount: number;
  bestScore: number;
  recommendation: "expand" | "hold" | "prune" | "review";
  updatedAt: string;
}

export interface TopicsFeed {
  updatedAt: string;
  items: TopicItem[];
}

export interface SurfaceItemLink {
  label: string;
  href: string;
}

export interface HomeModuleItem {
  id: string;
  title: string;
  href: string;
  label: string;
  summary: string;
  meta: string;
}

export interface HomeModule {
  id: string;
  kind: "happening_now" | "next_24_hours" | "why_people_check";
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  metrics: ModuleMetric[];
  items: HomeModuleItem[];
  relatedLinks: SurfaceItemLink[];
}

export interface HomeModulesFeed {
  updatedAt: string;
  thesis: string;
  items: HomeModule[];
}

export interface VideoShort {
  id: string;
  title: string;
  source: string;
  url: string;
  embedUrl: string;
  publishedAt: string;
  summary: string;
  relatedPath: string;
  relatedLabel: string;
  sourceCategory: "youtube";
  isShort: boolean;
  freshnessScore: number;
  diversityScore: number;
  retentionScore: number;
}

export interface VideoShortsFeed {
  updatedAt: string;
  thesis: string;
  items: VideoShort[];
}

export interface GameCatalogItem {
  id: string;
  mode: string;
  title: string;
  description: string;
  prompt: string;
  relatedPath: string;
  relatedLabel: string;
  metricLabel: string;
  metricValue: string;
  featured: boolean;
}

export interface GamesCatalogFeed {
  updatedAt: string;
  thesis: string;
  items: GameCatalogItem[];
}

export interface GalleryCollectionEntry {
  id: string;
  title: string;
  summary: string;
  metricLabel: string;
  metricValue: string;
  href: string;
  accent: "earth" | "space" | "signal";
}

export interface GalleryCollectionItem {
  id: string;
  title: string;
  description: string;
  category: "quake" | "aurora" | "launch" | "topic";
  relatedPath: string;
  relatedLabel: string;
  entries: GalleryCollectionEntry[];
}

export interface GalleryCollectionsFeed {
  updatedAt: string;
  thesis: string;
  items: GalleryCollectionItem[];
}
