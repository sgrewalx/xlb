export interface FeedItem {
  id: string;
  title: string;
  source: string;
  url: string;
  tag: string;
  publishedAt: string;
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
