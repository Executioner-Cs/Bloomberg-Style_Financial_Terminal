/**
 * NewsPanel — timestamp-left news feed for a symbol.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ AAPL  News  [MOCK]                                       │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ 14:32  Bloomberg — Stock rallies on earnings beat         │
 *   │        Revenue grew 12% year-over-year…                  │
 *   │                                                           │
 *   │ 13:15  Reuters — Analyst raises price target             │
 *   │        …                                                  │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Articles are sorted newest-first. Timestamps are shown in local
 * time at HH:MM precision — matches Bloomberg terminal news feed.
 */
import { type JSX, memo } from 'react';
import { Newspaper } from 'lucide-react';
import type { NewsArticle } from '@terminal/types';

import { formatTime } from '@/lib/format';

import { useNewsData } from './use-news-data';

// ------------------------------------------------------------------
// Row component
// ------------------------------------------------------------------

interface NewsRowProps {
  article: NewsArticle;
}

const NewsRow = memo(function NewsRow({ article }: NewsRowProps): JSX.Element {
  const handleClick = (): void => {
    if (article.sourceUrl) window.open(article.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role={article.sourceUrl ? 'link' : 'article'}
      tabIndex={article.sourceUrl ? 0 : undefined}
      onClick={article.sourceUrl ? handleClick : undefined}
      onKeyDown={(e) => {
        if (article.sourceUrl && (e.key === 'Enter' || e.key === ' ')) handleClick();
      }}
      className={[
        'flex gap-3 px-3 py-2 border-b border-[var(--color-border)] last:border-0',
        article.sourceUrl
          ? 'cursor-pointer hover:bg-[var(--color-bg-hover)]'
          : 'hover:bg-[var(--color-bg-hover)]',
      ].join(' ')}
    >
      {/* Timestamp column */}
      <div className="shrink-0 w-10 text-[var(--color-text-muted)] tabular-nums pt-px">
        {formatTime(article.publishedAt)}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        <div className="text-[var(--color-text-secondary)] text-[10px] mb-0.5">
          {article.sourceName ?? 'Unknown source'}
        </div>
        <div className="text-[var(--color-text-primary)] leading-snug mb-0.5 font-medium">
          {article.headline}
        </div>
        {article.summary && (
          <div className="text-[var(--color-text-muted)] leading-snug line-clamp-2">
            {article.summary}
          </div>
        )}
      </div>
    </div>
  );
});

// ------------------------------------------------------------------
// Panel component
// ------------------------------------------------------------------

export interface NewsPanelProps {
  panelId: string;
  isActive: boolean;
  onClose: () => void;
  symbol: string;
}

/**
 * Displays a scrollable news feed for the given symbol.
 */
export function NewsPanel({
  panelId: _panelId,
  isActive,
  onClose: _onClose,
  symbol,
}: NewsPanelProps): JSX.Element {
  const { articles, isLoading, isUsingMockData } = useNewsData(symbol, isActive);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] font-mono text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
        <span className="font-bold text-[var(--color-accent)] tracking-wide">
          {symbol.toUpperCase()}
        </span>
        <span className="text-[var(--color-text-muted)]">News</span>
        {isUsingMockData && (
          <span className="ml-auto text-[var(--color-text-muted)] border border-[var(--color-border)] px-1 rounded text-[10px]">
            MOCK
          </span>
        )}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-16 text-[var(--color-text-muted)]">
            Loading…
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)]">
            <Newspaper size={24} />
            <span>No news for {symbol}</span>
          </div>
        ) : (
          articles.map((article) => <NewsRow key={article.id} article={article} />)
        )}
      </div>
    </div>
  );
}
