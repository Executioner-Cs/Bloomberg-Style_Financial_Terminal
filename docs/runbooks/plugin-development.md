# Runbook: Plugin Development Guide

Plugins extend the terminal with custom analytics, indicators, and panels.
They are sandboxed — a plugin crash cannot crash the terminal.

---

## Plugin Architecture

```
plugins/<plugin-name>/
├── manifest.json          # Plugin metadata and permissions
├── package.json           # npm package
├── src/
│   └── index.ts           # Plugin entry point
├── dist/
│   └── bundle.js          # Self-contained bundle (checked in or CI-generated)
└── README.md              # Plugin documentation (required)
```

---

## manifest.json Schema

```json
{
  "id": "my-indicator",
  "name": "My Custom Indicator",
  "version": "1.0.0",
  "minApiVersion": "1.0.0",
  "description": "A custom moving average indicator",
  "author": "Mayank Khandelwal",
  "permissions": [
    "market-data:read",
    "watchlist:read"
  ],
  "entryPoint": "dist/bundle.js",
  "panels": [
    {
      "id": "my-indicator-panel",
      "label": "My Indicator",
      "defaultSize": { "width": 400, "height": 300 }
    }
  ],
  "commands": [
    {
      "id": "open-my-indicator",
      "label": "Open My Indicator Panel"
    }
  ]
}
```

## Available Permissions

| Permission | Description |
|------------|-------------|
| `market-data:read` | Read OHLCV bars and quotes |
| `watchlist:read` | Read user's watchlists |
| `fundamentals:read` | Read fundamentals data |
| `news:read` | Read news articles |
| `alerts:write` | Create price alerts |
| `storage:read` | Read plugin's namespaced storage |
| `storage:write` | Write to plugin's namespaced storage |

---

## Plugin API Reference

```typescript
// Available at runtime as the global `PluginAPI` object
interface PluginAPI {
  data: {
    getOHLCV(symbol: string, timeframe: string, from: Date, to: Date): Promise<OHLCVBar[]>;
    getQuote(symbol: string): Promise<Quote>;
    getFundamentals(symbol: string): Promise<Fundamentals>;
    subscribeToPrice(symbol: string, callback: (price: PriceUpdate) => void): () => void;
  };
  ui: {
    registerPanel(manifest: PanelManifest): void;
    registerCommand(command: CommandDefinition): void;
    registerShortcut(shortcut: KeyboardShortcut): void;
    showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void;
  };
  storage: {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
  };
  plugin: {
    id: string;
    version: string;
    apiVersion: string;
  };
}
```

---

## Development Workflow

1. Create plugin directory in `plugins/<plugin-name>/`
2. Write `manifest.json` — declare all required permissions
3. Implement plugin logic consuming only `PluginAPI` (no direct imports from app)
4. Build self-contained bundle: `pnpm build` → `dist/bundle.js`
5. Test in development: place bundle in `apps/web/public/plugins/`
6. Write plugin README.md (required for PR)
7. Submit PR with: manifest review checklist + performance test results

---

## Rules (from CLAUDE.md — enforced)

- Plugins CANNOT import from the main application source
- `eval()`, `Function()` constructor, dynamic script injection are FORBIDDEN
- Plugin crash must NOT crash terminal — runs in React Error Boundary
- Performance: must not drop page below 30fps for > 500ms
- Storage keys are namespaced automatically — no cross-plugin data access
- Declare all permissions in manifest.json — undeclared permissions are refused at load time
