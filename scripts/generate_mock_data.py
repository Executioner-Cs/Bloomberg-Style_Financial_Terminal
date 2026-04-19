#!/usr/bin/env python3
"""
Mock data generator for Bloomberg Terminal development.

Generates realistic static JSON files in mock_data/ without any project imports.
All data is deterministic (seed=42) so output is reproducible across machines.

Usage:
    python scripts/generate_mock_data.py

Output structure:
    mock_data/
    ├── instruments.json         # All instrument metadata
    ├── quotes.json              # Latest quote snapshot per symbol
    ├── ohlcv/
    │   ├── BTC_1D.json          # 365 daily bars
    │   ├── AAPL_1D.json
    │   └── ...
    └── macro/
        ├── GDP.json
        ├── CPIAUCSL.json
        └── ...

ADR-006: Mock data lives in mock_data/ and is committed to git so the
project works out of the box without any API keys or network access.
"""

from __future__ import annotations

import json
import math
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Seed — must never change. Output must be reproducible. ADR-006.
# ---------------------------------------------------------------------------
_SEED = 42
_RNG = random.Random(_SEED)

# ---------------------------------------------------------------------------
# Project root — walk up from this file until .git/ found. ADR-006.
# ---------------------------------------------------------------------------

def _find_project_root() -> Path:
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    return Path(__file__).resolve().parents[1]


_PROJECT_ROOT = _find_project_root()
_MOCK_DATA_DIR = _PROJECT_ROOT / "mock_data"

# ---------------------------------------------------------------------------
# Instrument definitions
# ---------------------------------------------------------------------------

# Top 20 crypto by approximate 2024–2025 market cap.
# Price ranges are approximate historical mid-ranges for 2024–2025.
_CRYPTO: list[dict[str, object]] = [
    {"symbol": "BTC", "name": "Bitcoin",          "price_mid": 85_000.0,  "price_range": 40_000.0},
    {"symbol": "ETH", "name": "Ethereum",         "price_mid": 3_200.0,   "price_range": 1_500.0},
    {"symbol": "BNB", "name": "BNB",              "price_mid": 580.0,     "price_range": 200.0},
    {"symbol": "SOL", "name": "Solana",           "price_mid": 165.0,     "price_range": 100.0},
    {"symbol": "XRP", "name": "XRP",              "price_mid": 0.65,      "price_range": 0.40},
    {"symbol": "ADA", "name": "Cardano",          "price_mid": 0.48,      "price_range": 0.25},
    {"symbol": "AVAX","name": "Avalanche",        "price_mid": 38.0,      "price_range": 20.0},
    {"symbol": "DOGE","name": "Dogecoin",         "price_mid": 0.14,      "price_range": 0.08},
    {"symbol": "DOT", "name": "Polkadot",         "price_mid": 7.5,       "price_range": 4.0},
    {"symbol": "MATIC","name":"Polygon",          "price_mid": 0.78,      "price_range": 0.40},
    {"symbol": "LINK","name": "Chainlink",        "price_mid": 14.0,      "price_range": 8.0},
    {"symbol": "UNI", "name": "Uniswap",          "price_mid": 8.5,       "price_range": 5.0},
    {"symbol": "LTC", "name": "Litecoin",         "price_mid": 80.0,      "price_range": 30.0},
    {"symbol": "BCH", "name": "Bitcoin Cash",     "price_mid": 380.0,     "price_range": 150.0},
    {"symbol": "ATOM","name": "Cosmos",           "price_mid": 9.0,       "price_range": 5.0},
    {"symbol": "XLM", "name": "Stellar",          "price_mid": 0.12,      "price_range": 0.06},
    {"symbol": "NEAR","name": "NEAR Protocol",    "price_mid": 5.5,       "price_range": 3.5},
    {"symbol": "ICP", "name": "Internet Computer","price_mid": 13.0,      "price_range": 7.0},
    {"symbol": "APT", "name": "Aptos",            "price_mid": 9.5,       "price_range": 5.0},
    {"symbol": "ARB", "name": "Arbitrum",         "price_mid": 1.1,       "price_range": 0.6},
]

# Top 30 S&P 500 constituents — approximate 2024–2025 price ranges.
_EQUITIES: list[dict[str, object]] = [
    {"symbol": "AAPL", "name": "Apple Inc.",                    "price_mid": 195.0,  "price_range": 40.0},
    {"symbol": "MSFT", "name": "Microsoft Corporation",         "price_mid": 415.0,  "price_range": 80.0},
    {"symbol": "GOOGL","name": "Alphabet Inc.",                 "price_mid": 175.0,  "price_range": 40.0},
    {"symbol": "AMZN", "name": "Amazon.com Inc.",               "price_mid": 195.0,  "price_range": 50.0},
    {"symbol": "NVDA", "name": "NVIDIA Corporation",            "price_mid": 850.0,  "price_range": 450.0},
    {"symbol": "META", "name": "Meta Platforms Inc.",           "price_mid": 520.0,  "price_range": 150.0},
    {"symbol": "TSLA", "name": "Tesla Inc.",                    "price_mid": 235.0,  "price_range": 120.0},
    {"symbol": "JPM",  "name": "JPMorgan Chase & Co.",          "price_mid": 210.0,  "price_range": 50.0},
    {"symbol": "V",    "name": "Visa Inc.",                     "price_mid": 280.0,  "price_range": 50.0},
    {"symbol": "JNJ",  "name": "Johnson & Johnson",             "price_mid": 155.0,  "price_range": 20.0},
    {"symbol": "PG",   "name": "Procter & Gamble Co.",          "price_mid": 165.0,  "price_range": 20.0},
    {"symbol": "UNH",  "name": "UnitedHealth Group Inc.",       "price_mid": 530.0,  "price_range": 80.0},
    {"symbol": "MA",   "name": "Mastercard Inc.",               "price_mid": 490.0,  "price_range": 70.0},
    {"symbol": "HD",   "name": "The Home Depot Inc.",           "price_mid": 380.0,  "price_range": 60.0},
    {"symbol": "CVX",  "name": "Chevron Corporation",           "price_mid": 155.0,  "price_range": 25.0},
    {"symbol": "MRK",  "name": "Merck & Co. Inc.",              "price_mid": 128.0,  "price_range": 20.0},
    {"symbol": "ABBV", "name": "AbbVie Inc.",                   "price_mid": 170.0,  "price_range": 30.0},
    {"symbol": "KO",   "name": "The Coca-Cola Company",         "price_mid": 62.0,   "price_range": 8.0},
    {"symbol": "PEP",  "name": "PepsiCo Inc.",                  "price_mid": 178.0,  "price_range": 20.0},
    {"symbol": "WMT",  "name": "Walmart Inc.",                  "price_mid": 68.0,   "price_range": 15.0},
    {"symbol": "BAC",  "name": "Bank of America Corporation",   "price_mid": 38.0,   "price_range": 10.0},
    {"symbol": "XOM",  "name": "Exxon Mobil Corporation",       "price_mid": 110.0,  "price_range": 20.0},
    {"symbol": "LLY",  "name": "Eli Lilly and Company",         "price_mid": 780.0,  "price_range": 250.0},
    {"symbol": "AVGO", "name": "Broadcom Inc.",                 "price_mid": 1350.0, "price_range": 450.0},
    {"symbol": "COST", "name": "Costco Wholesale Corporation",  "price_mid": 880.0,  "price_range": 150.0},
    {"symbol": "DIS",  "name": "The Walt Disney Company",       "price_mid": 98.0,   "price_range": 20.0},
    {"symbol": "ADBE", "name": "Adobe Inc.",                    "price_mid": 510.0,  "price_range": 80.0},
    {"symbol": "NFLX", "name": "Netflix Inc.",                  "price_mid": 680.0,  "price_range": 200.0},
    {"symbol": "CRM",  "name": "Salesforce Inc.",               "price_mid": 295.0,  "price_range": 70.0},
    {"symbol": "AMD",  "name": "Advanced Micro Devices Inc.",   "price_mid": 165.0,  "price_range": 80.0},
]

# FRED macro series — 5 core Phase 1 series.
# Observation frequencies and value ranges from FRED documentation.
_MACRO_SERIES: list[dict[str, object]] = [
    {
        "series_id": "GDP",
        "name": "Gross Domestic Product",
        "unit": "Billions of Dollars",
        "frequency_months": 3,        # Quarterly
        "start_value": 24_000.0,
        "drift_per_period": 300.0,    # Approximate quarterly GDP growth
        "volatility": 150.0,
    },
    {
        "series_id": "CPIAUCSL",
        "name": "Consumer Price Index for All Urban Consumers",
        "unit": "Index 1982-1984=100",
        "frequency_months": 1,        # Monthly
        "start_value": 305.0,
        "drift_per_period": 0.3,      # Approximate monthly CPI increase
        "volatility": 0.2,
    },
    {
        "series_id": "FEDFUNDS",
        "name": "Federal Funds Effective Rate",
        "unit": "Percent",
        "frequency_months": 1,        # Monthly
        "start_value": 5.33,
        "drift_per_period": 0.0,      # Rate held flat, then cut — reflected by volatility
        "volatility": 0.08,
    },
    {
        "series_id": "DGS10",
        "name": "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity",
        "unit": "Percent",
        "frequency_months": 1,        # Monthly (daily data, we use monthly snapshots)
        "start_value": 4.10,
        "drift_per_period": 0.02,
        "volatility": 0.15,
    },
    {
        "series_id": "UNRATE",
        "name": "Unemployment Rate",
        "unit": "Percent",
        "frequency_months": 1,        # Monthly
        "start_value": 3.7,
        "drift_per_period": 0.01,
        "volatility": 0.1,
    },
]

# ---------------------------------------------------------------------------
# Random walk helpers
# ---------------------------------------------------------------------------

def _random_walk_prices(
    start_price: float,
    n_days: int,
    daily_vol: float = 0.015,
) -> list[float]:
    """
    Generate a list of close prices using a geometric random walk.

    The walk is deterministic given _RNG's state (seeded once at module level).
    daily_vol: daily log-return standard deviation (0.015 = ~1.5% daily vol).
    """
    prices: list[float] = [start_price]
    for _ in range(n_days - 1):
        log_return = _RNG.gauss(0.0, daily_vol)
        prices.append(prices[-1] * math.exp(log_return))
    return prices


def _ohlcv_from_closes(closes: list[float], volumes_base: float) -> list[dict[str, object]]:
    """
    Generate synthetic OHLCV bars from a list of daily close prices.

    Open is yesterday's close (first open = close * (1 ± small noise).
    High and low are derived from close with a random spread.
    Volume follows a random walk around volumes_base.
    """
    bars: list[dict[str, object]] = []
    start_date = date.today() - timedelta(days=len(closes) - 1)

    prev_close = closes[0] * (1.0 + _RNG.uniform(-0.005, 0.005))
    for i, close in enumerate(closes):
        open_price = prev_close
        # Intraday spread: high and low are within ±2% of max(open, close).
        spread = abs(close - open_price) + _RNG.uniform(0, max(open_price, close) * 0.01)
        high = max(open_price, close) + spread * _RNG.uniform(0.1, 0.5)
        low = min(open_price, close) - spread * _RNG.uniform(0.1, 0.5)
        low = max(low, close * 0.001)  # Price cannot go to zero or negative.

        volume = volumes_base * _RNG.uniform(0.5, 2.0)
        bar_date = start_date + timedelta(days=i)
        ts = datetime(bar_date.year, bar_date.month, bar_date.day, 0, 0, 0, tzinfo=timezone.utc)

        bars.append({
            "ts": ts.isoformat(),
            "open": round(open_price, 6),
            "high": round(high, 6),
            "low": round(low, 6),
            "close": round(close, 6),
            "volume": round(volume, 2),
            "adj_close": round(close, 6),  # For equities; crypto will have adj_close=null.
        })
        prev_close = close
    return bars


def _macro_observations(
    series_id: str,
    start_value: float,
    drift_per_period: float,
    volatility: float,
    frequency_months: int,
    n_periods: int,
) -> list[dict[str, object]]:
    """
    Generate macro series observations with a simple drift + noise model.

    frequency_months: how many months between observations (1=monthly, 3=quarterly).
    """
    observations: list[dict[str, object]] = []
    # Start 2 years back from today.
    today = date.today()
    start_offset_months = n_periods * frequency_months
    start_year = today.year
    start_month = today.month - start_offset_months
    while start_month <= 0:
        start_month += 12
        start_year -= 1

    value = start_value
    for i in range(n_periods):
        obs_month = start_month + i * frequency_months
        obs_year = start_year
        while obs_month > 12:
            obs_month -= 12
            obs_year += 1

        # Clamp to valid day for the month.
        obs_day = 1
        ts = datetime(obs_year, obs_month, obs_day, 0, 0, 0, tzinfo=timezone.utc)

        observations.append({
            "ts": ts.isoformat(),
            "value": round(value, 4),
        })

        value += drift_per_period + _RNG.gauss(0.0, volatility)
        # Clamp rates to reasonable bounds.
        if series_id in ("FEDFUNDS", "DGS10", "UNRATE"):
            value = max(0.01, min(value, 20.0))
        elif series_id == "CPIAUCSL":
            value = max(200.0, value)
        elif series_id == "GDP":
            value = max(10_000.0, value)

    return observations


# ---------------------------------------------------------------------------
# Writer helpers
# ---------------------------------------------------------------------------

def _write_json(path: Path, data: object) -> None:
    """Write JSON to *path*, creating parent directories as needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"  wrote {path.relative_to(_PROJECT_ROOT)}")


# ---------------------------------------------------------------------------
# Main generation logic
# ---------------------------------------------------------------------------

def generate() -> None:
    """Generate all mock data files into mock_data/."""
    print(f"Generating mock data in: {_MOCK_DATA_DIR}")
    print(f"Seed: {_SEED} (deterministic — do not change)")

    instruments: list[dict[str, object]] = []
    quotes: dict[str, dict[str, object]] = {}

    # ── Crypto OHLCV ──────────────────────────────────────────────────────
    print("\n[crypto OHLCV]")
    for coin in _CRYPTO:
        symbol: str = str(coin["symbol"])
        price_mid: float = float(str(coin["price_mid"]))
        price_range: float = float(str(coin["price_range"]))

        # Start price: random within ±range/2 of mid.
        start_price = price_mid + _RNG.uniform(-price_range / 2, price_range / 2)
        closes = _random_walk_prices(start_price, n_days=365, daily_vol=0.025)
        bars = _ohlcv_from_closes(closes, volumes_base=price_mid * 1_000)

        # Crypto: adj_close is null (no corporate actions).
        for bar in bars:
            bar["adj_close"] = None

        _write_json(
            _MOCK_DATA_DIR / "ohlcv" / f"{symbol}_1D.json",
            {"symbol": symbol, "timeframe": "1D", "source": "mock", "bars": bars},
        )

        last_bar = bars[-1]
        prev_bar = bars[-2] if len(bars) >= 2 else bars[-1]
        change_24h = (float(str(last_bar["close"])) - float(str(prev_bar["close"]))) / float(str(prev_bar["close"]))

        quotes[symbol] = {
            "symbol": symbol,
            "price": last_bar["close"],
            "change_24h": round(change_24h, 6),
            "volume_24h": last_bar["volume"],
            "ts": last_bar["ts"],
        }
        instruments.append({
            "symbol": symbol,
            "name": coin["name"],
            "asset_class": "crypto",
            "exchange": None,
            "currency": "USD",
            "is_active": True,
        })

    # ── Equity OHLCV ──────────────────────────────────────────────────────
    print("\n[equity OHLCV]")
    for equity in _EQUITIES:
        symbol = str(equity["symbol"])
        price_mid = float(str(equity["price_mid"]))
        price_range = float(str(equity["price_range"]))

        start_price = price_mid + _RNG.uniform(-price_range / 2, price_range / 2)
        closes = _random_walk_prices(start_price, n_days=365, daily_vol=0.013)
        bars = _ohlcv_from_closes(closes, volumes_base=10_000_000.0)

        # Equities: adj_close ≈ close with a small adjustment factor.
        adj_factor = 1.0 - _RNG.uniform(0.0, 0.02)
        for bar in bars:
            bar["adj_close"] = round(float(str(bar["close"])) * adj_factor, 6)

        _write_json(
            _MOCK_DATA_DIR / "ohlcv" / f"{symbol}_1D.json",
            {"symbol": symbol, "timeframe": "1D", "source": "mock", "bars": bars},
        )

        last_bar = bars[-1]
        prev_bar = bars[-2] if len(bars) >= 2 else bars[-1]
        change_24h = (float(str(last_bar["close"])) - float(str(prev_bar["close"]))) / float(str(prev_bar["close"]))

        quotes[symbol] = {
            "symbol": symbol,
            "price": last_bar["close"],
            "change_24h": round(change_24h, 6),
            "volume_24h": last_bar["volume"],
            "ts": last_bar["ts"],
        }
        instruments.append({
            "symbol": symbol,
            "name": equity["name"],
            "asset_class": "equity",
            "exchange": "NASDAQ" if symbol in ("AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
                                                "META", "TSLA", "AVGO", "COST", "ADBE",
                                                "NFLX", "CRM", "AMD") else "NYSE",
            "currency": "USD",
            "is_active": True,
        })

    # ── Macro series ──────────────────────────────────────────────────────
    print("\n[macro series]")
    for series in _MACRO_SERIES:
        series_id: str = str(series["series_id"])
        frequency_months: int = int(str(series["frequency_months"]))
        # Monthly: 24 periods (2 years). Quarterly: 8 periods (2 years).
        n_periods = 24 if frequency_months == 1 else 8

        obs = _macro_observations(
            series_id=series_id,
            start_value=float(str(series["start_value"])),
            drift_per_period=float(str(series["drift_per_period"])),
            volatility=float(str(series["volatility"])),
            frequency_months=frequency_months,
            n_periods=n_periods,
        )
        _write_json(
            _MOCK_DATA_DIR / "macro" / f"{series_id}.json",
            {
                "series_id": series_id,
                "name": series["name"],
                "unit": series["unit"],
                "source": "mock",
                "bars": obs,
            },
        )

    # ── Instruments + quotes ──────────────────────────────────────────────
    print("\n[instruments + quotes]")
    _write_json(_MOCK_DATA_DIR / "instruments.json", instruments)
    _write_json(_MOCK_DATA_DIR / "quotes.json", quotes)

    total_files = (
        len(_CRYPTO) + len(_EQUITIES) + len(_MACRO_SERIES) + 2  # +2 for instruments + quotes
    )
    print(f"\nDone. {total_files} files written to {_MOCK_DATA_DIR}")
    print(f"  {len(_CRYPTO)} crypto OHLCV files")
    print(f"  {len(_EQUITIES)} equity OHLCV files")
    print(f"  {len(_MACRO_SERIES)} macro series files")
    print(f"  1 instruments.json ({len(instruments)} instruments)")
    print(f"  1 quotes.json ({len(quotes)} symbols)")


if __name__ == "__main__":
    generate()
