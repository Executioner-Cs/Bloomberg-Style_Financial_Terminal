export type NewsArticle = {
  id: string;
  headline: string;
  summary: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  publishedAt: string;
  symbols: string[];
};

export type NewsResponse = {
  articles: NewsArticle[];
  total: number;
  page: number;
  pageSize: number;
};
