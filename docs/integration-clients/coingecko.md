# CoinGecko Integration Client

**Module:** `services/api/src/integrations/coingecko.py` (mirrored in worker)
**Pattern:** `BaseIntegrationClient` (HTTP)
**Status:** Phase 1 ✅ operational

## Purpose

Crypto OHLCV and coin-list data. Scheduled daily at 00:05 UTC via the `ingest_coingecko_ohlcv` Celery task. Seeds the `instruments` table with top-N coins by market cap.

## Endpoints used

| Endpoint              | Purpose                          | Notes                                                        |
| --------------------- | -------------------------------- | ------------------------------------------------------------ |
| `/coins/markets`      | Top-N coins ranked by market cap | Max 250 per page                                             |
| `/coins/market_chart` | OHLCV per coin                   | `days` maps to granularity: 1=hourly, 2–90=daily, 91+=weekly |
| `/coins/list`         | Full coin list (~10k entries)    | Used only for symbol-ID lookup; prefer `/coins/markets`      |

The `/ohlc` endpoint exists but omits volume — we use `/market_chart` to preserve the volume field. See module docstring for details.

## No API key

Free tier requires no key. Rate limit is 10–30 req/min depending on endpoint; exceeding it returns HTTP 429. The `BaseIntegrationClient` retry/backoff handles transient 429s, but sustained overflow blocks the IP.

## Usage

```python
from src.integrations.coingecko import CoinGeckoClient

async with CoinGeckoClient() as client:
    # Top 20 coins for instruments seed
    top = await client.get_top_coins_by_market_cap(limit=20)

    # 365 days of daily OHLCV for Bitcoin
    bars = await client.get_ohlcv(
        coin_id="bitcoin",
        vs_currency="usd",
        days=365,
    )
```

## Output shape

Each bar is an `OHLCVRow` with `source="coingecko"`, `timeframe="1D"`. Because `/market_chart` returns a single closing price per day (no intraday OHLC), `open==high==low==close` for daily bars. For true candles use `/ohlc` (no volume). The trade-off is documented in the module — we prefer volume over intraday range for Phase 1 crypto.

## Configuration

| Setting                          | Default                            | Meaning                                |
| -------------------------------- | ---------------------------------- | -------------------------------------- |
| `COINGECKO_BASE_URL`             | `https://api.coingecko.com/api/v3` | Overridable for tests                  |
| `COINGECKO_REQUESTS_PER_MINUTE`  | 30                                 | Self-imposed cap within free-tier band |
| `COINGECKO_TIMEOUT_SECONDS`      | 15.0                               | Per-request timeout                    |
| `COINGECKO_MARKETS_PER_PAGE_MAX` | 250                                | Hard cap from CoinGecko API docs       |
| `COINGECKO_TOP_COINS_LIMIT`      | 20                                 | Phase 1 scope: top 20 coins            |

## Risks

- **Free-tier variability.** CoinGecko can and does reduce free-tier limits without notice. The redis-backed quota key `api_quota("coingecko", period)` tracks usage; daily quota report task logs trends.
- **Weekly granularity surprise.** `days > 90` silently switches to weekly bars. The ingest task clamps `days` to ≤ 90 to guarantee daily output.
