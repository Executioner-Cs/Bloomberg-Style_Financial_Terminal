# Runbook: Adding a New UI Panel

Every new terminal panel must follow this checklist exactly.
The panel system has strict conventions — deviating breaks keyboard navigation and layout persistence.

---

## Anatomy of a Panel

A panel is a self-contained React component that:
1. Fetches its own data via TanStack Query hooks
2. Manages its own keyboard shortcuts (when focused)
3. Renders a skeleton during loading and an error state on failure
4. Participates in the global panel grid (resizable, closeable)

---

## Step 1: Define the Data Contract First

Answer before writing any UI:

- What REST endpoints does this panel consume?
- Does it need WebSocket subscriptions? (live price, alerts, news?)
- What parameters define the panel state? (e.g., `symbol` for chart panel)

If the required endpoints don't exist, build them first (backend → frontend, always).

---

## Step 2: Create the Panel Directory

```
apps/web/src/panels/<panel-name>-panel/
├── index.tsx                    # Barrel export — only file other code imports from
├── <PanelName>Panel.tsx         # Root panel component
├── <PanelName>Panel.test.tsx    # Component tests
└── use<PanelName>Data.ts        # TanStack Query data hook
```

Naming rules:
- Directory: `kebab-case-panel` (e.g., `chart-panel`, `macro-panel`)
- Component: `PascalCase` (e.g., `ChartPanel`, `MacroPanel`)
- Hook: `use<PanelName>Data` (e.g., `useChartData`, `useMacroData`)

---

## Step 3: Implement the Panel Component Interface

ALL panels MUST accept and correctly implement these props:

```typescript
interface PanelProps {
  panelId: string;    // Unique instance ID — passed to layout state manager
  isActive: boolean;  // Whether this panel has keyboard focus
  onClose: () => void;
}

export function ExamplePanel({ panelId, isActive, onClose }: PanelProps): JSX.Element {
  // ...
}
```

---

## Step 4: Implement Data Fetching Hook

The hook lives in the panel directory, not in `src/hooks/`.
It wraps TanStack Query — no raw `fetch()` calls in hooks.

```typescript
// use<PanelName>Data.ts
import { useQuery } from '@tanstack/react-query';
import { getExampleData } from '@/api/example.api';

export function useExamplePanelData(symbol: string) {
  return useQuery({
    queryKey: ['example', symbol],
    queryFn: () => getExampleData(symbol),
    staleTime: 30_000,
    enabled: symbol.length > 0,
  });
}
```

---

## Step 5: Implement Keyboard Navigation

When `isActive === true`, the panel registers its shortcuts.
When `isActive === false`, shortcuts must be unregistered.

```typescript
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

// Inside the panel component:
useKeyboardShortcuts(
  {
    'ArrowUp': () => selectPreviousRow(),
    'ArrowDown': () => selectNextRow(),
    'Enter': () => openSelectedItem(),
  },
  { enabled: isActive }
);
```

---

## Step 6: Loading and Error States

Every panel MUST handle these states — never show a blank or broken panel.

```tsx
import { PanelSkeleton, PanelError } from '@terminal/ui-components';

export function ExamplePanel({ panelId, isActive, onClose }: PanelProps) {
  const { data, isLoading, error } = useExamplePanelData(symbol);

  if (isLoading) return <PanelSkeleton panelId={panelId} />;
  if (error) return <PanelError panelId={panelId} error={error} onRetry={() => refetch()} />;

  return (
    // actual panel content
  );
}
```

---

## Step 7: Register in Panel Registry

File: `apps/web/src/panels/index.ts`

```typescript
export { ExamplePanel } from './example-panel';
export type { ExamplePanelProps } from './example-panel';
```

---

## Step 8: Register in Command Palette

The panel must be openable via Ctrl+K.

In the command registry (location TBD in Phase 2), add:
```typescript
{
  id: 'open-example-panel',
  label: 'Open Example Panel',
  shortcut: null,       // or 'Ctrl+Shift+E' for frequently used panels
  action: () => layout.openPanel('example-panel'),
}
```

---

## Step 9: Add E2E Test

File: `apps/web/e2e/specs/<panel-name>.spec.ts`

Required test cases:
```typescript
test('panel loads and displays data', async ({ page }) => { ... });
test('panel handles loading state', async ({ page }) => { ... });
test('panel handles error state', async ({ page }) => { ... });
test('panel is keyboard navigable', async ({ page }) => { ... });
test('panel closes when onClose called', async ({ page }) => { ... });
```

---

## Step 10: Update This Runbook

Add the panel to the table below with its data sources and keyboard shortcuts.

---

## Existing Panels

| Panel | Directory | Data Sources | Key Shortcuts |
|-------|-----------|--------------|---------------|
| Chart | `chart-panel` | `GET /market-data/{symbol}/ohlcv`, WS prices | Timeframe keys: 1/D/W/M |
| Watchlist | `watchlist-panel` | `GET /watchlists`, WS prices | Up/Down, Enter to chart |
| Quote | `quote-panel` | `GET /market-data/{symbol}/quote` | — |
| News | `news-panel` | `GET /news` | Up/Down, Enter to open |
| Filing | `filing-panel` | `GET /filings/{symbol}` | Up/Down, Enter to open |
| Screener | `screener-panel` | `POST /screener` | Tab between filter fields |
| Macro | `macro-panel` | `GET /macro/series/{id}` | — |
| Alert | `alert-panel` | `GET /alerts` | — |
| Portfolio | `portfolio-panel` | `GET /portfolios` | — |
