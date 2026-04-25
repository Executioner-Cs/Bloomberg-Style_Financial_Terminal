/**
 * News API client functions.
 *
 * The backend returns snake_case fields from NewsAPI.org. These are
 * mapped to the camelCase NewsArticle shape from @terminal/types here,
 * so all consumers receive the canonical type without knowing about the
 * wire format difference.
 */
import type { NewsResponse } from '@terminal/types';

import { apiGet } from './client';
import { API_V1_PREFIX } from './constants';

/**
 * Wire format returned by GET /api/v1/news — snake_case from the backend.
 * Not exported: consumers receive the normalised NewsResponse.
 */
type ApiNewsArticle = {
  id: string;
  title: string;
  description: string | null;
  source_name: string | null;
  url: string | null;
  published_at: string;
  symbols: string[];
};

type ApiNewsResponse = {
  articles: ApiNewsArticle[];
  total: number;
  page: number;
  page_size: number;
};

/** Normalise wire format → @terminal/types NewsResponse. */
function normaliseNewsResponse(raw: ApiNewsResponse): NewsResponse {
  return {
    articles: raw.articles.map((a) => ({
      id: a.id,
      headline: a.title,
      summary: a.description,
      sourceName: a.source_name,
      sourceUrl: a.url,
      publishedAt: a.published_at,
      symbols: a.symbols,
    })),
    total: raw.total,
    page: raw.page,
    pageSize: raw.page_size,
  };
}

/**
 * Fetch news articles for a specific symbol.
 *
 * @param symbol - Equity ticker or crypto id, e.g. "AAPL", "bitcoin"
 * @param page   - 1-based page number (default 1)
 */
export async function fetchNewsBySymbol(symbol: string, page = 1): Promise<NewsResponse> {
  const raw = await apiGet<ApiNewsResponse>(`${API_V1_PREFIX}/news/${encodeURIComponent(symbol)}`, {
    page: String(page),
  });
  return normaliseNewsResponse(raw);
}

/**
 * Search news by keyword query.
 *
 * @param q    - Search query string (min 2 characters, alphanumeric + spaces)
 * @param page - 1-based page number (default 1)
 */
export async function fetchNews(q: string, page = 1): Promise<NewsResponse> {
  const raw = await apiGet<ApiNewsResponse>(`${API_V1_PREFIX}/news`, {
    q,
    page: String(page),
  });
  return normaliseNewsResponse(raw);
}
