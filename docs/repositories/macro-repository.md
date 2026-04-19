# MacroRepository

**Module:** `services/api/src/repositories/macro_repository.py` (mirrored in worker)
**Table:** `terminal.macro_series` (ClickHouse)
**Status:** Phase 1 ✅ operational

## Purpose

Read/write access to macro series observations (FRED data) in ClickHouse. Keeps all query logic in one place so the service layer is testable by mocking the repository, and enforces the `router → service → repository` layer boundary (CLAUDE.md Part VIII).

No business logic lives here — only SQL.

## Table schema

Schema in `infrastructure/init/clickhouse/02_create_macro_series.sql`:

```sql
CREATE TABLE IF NOT EXISTS terminal.macro_series (
    series_id String,
    ts        DateTime64(3, 'UTC'),
    value     Float64,
    source    String
) ENGINE = ReplacingMergeTree()
ORDER BY (series_id, ts);
```

**ReplacingMergeTree on `(series_id, ts)`** means:

- Re-inserting the same `(series_id, ts)` pair is safe — the last write wins
- FRED data revisions (common for GDP, CPI) are picked up on re-ingest without deduplication logic in application code
- Merges happen asynchronously; reads may see duplicate rows briefly until the next merge. Use `FINAL` modifier sparingly; Phase 6 optimization will evaluate.

## Public methods

```python
class MacroRepository:
    def __init__(self, client: AsyncClient) -> None: ...

    async def insert_rows(self, rows: list[MacroRow]) -> None: ...

    async def get_series(
        self,
        series_id: str,
        from_date: datetime,
        to_date: datetime,
    ) -> list[MacroRow]: ...

    async def get_latest_ts(self, series_id: str) -> datetime | None: ...

    async def get_all_series_latest(self) -> dict[str, tuple[float, datetime] | None]: ...
```

### `insert_rows`

Bulk insert, column-named. Empty list is a no-op (skipping avoids spurious ClickHouse round-trip). Each row must have a UTC-aware `ts`.

### `get_series`

Inclusive date-range fetch, ordered by `ts ASC`. Parameterized query — never string concatenation (CLAUDE.md Part X).

### `get_latest_ts`

Used by the ingestion task to drive incremental fetch:

```python
# inside refresh_macro_series task
latest_ts = await repo.get_latest_ts(series_id)
fetched = await client.get_series(
    series_id,
    observation_start=latest_ts.date() if latest_ts else None,
)
fetched = [r for r in fetched if r.ts > latest_ts] if latest_ts else fetched
```

This pattern makes the task **idempotent**: re-running after a partial failure picks up where it stopped. Combined with ReplacingMergeTree, double-ingestion is safe.

### `get_all_series_latest`

Single-query snapshot of the most recent `(value, ts)` per series — used by the macro dashboard (Phase 6) to avoid N round-trips for N series. Uses `argMax(value, ts)` aggregation.

## UTC handling

ClickHouse stores `DateTime64(3, 'UTC')`. The driver may return naive `datetime` objects in some code paths. Every read method re-attaches `tzinfo=UTC` defensively:

```python
if ts.tzinfo is None:
    ts = ts.replace(tzinfo=UTC)
```

This is not optional. Naive timestamps propagating into the API layer break Pydantic v2 validation downstream.

## Column ordering

`_MACRO_COLUMNS = ("series_id", "ts", "value", "source")` is the single source of truth for column order. Both `_SELECT_COLS` (read) and `column_names` (write) derive from it. Never use `SELECT *` (CLAUDE.md Part X).

## Testing

`services/api/tests/unit/test_macro_repository.py` covers every public method with a mocked `AsyncClient`. No real ClickHouse connection needed — mocks return canned `result_rows`. Includes edge cases:

- Empty insert is a no-op
- Naive `ts` gets UTC attached on read
- `get_latest_ts` returns `None` for empty result, empty first column, non-datetime values

## Future

Phase 4+ will add `MacroService` that sits between routers and this repository (unit conversion, forecasting overlays). The repository itself should stay thin — no business logic below this line.
