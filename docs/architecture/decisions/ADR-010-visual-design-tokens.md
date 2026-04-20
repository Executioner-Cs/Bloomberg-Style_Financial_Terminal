# ADR-010 — Visual Design Tokens: CSS Custom Properties in `:root`, Not Tailwind Theme

**Status:** Accepted  
**Date:** 2026-04-19  
**Deciders:** Mayank Khandelwal

---

## Context

The Bloomberg Terminal SPA uses Tailwind CSS v4 for layout and spacing utilities.
The terminal requires a consistent dark color palette and monospace typography
that must be accessible from:

1. **Tailwind utility classes** (React component classNames)
2. **JavaScript objects** (lightweight-charts `ChartOptions`, which requires resolved hex values — it does not evaluate CSS variable references)
3. **Global CSS** (scrollbar styling, focus rings, dockview panel backgrounds)
4. **Third-party libraries** (dockview, cmdk, other components that apply their own styles)

Two approaches were evaluated for defining the terminal's design tokens:

1. **Tailwind `@theme` directive** — define tokens in `@theme { --color-accent: #f59e0b; }` so they become both CSS custom properties AND Tailwind utility classes (e.g., `bg-accent`, `text-text-primary`)

2. **CSS custom properties in `:root`** — define tokens as standard CSS custom properties accessible to all CSS consumers; use Tailwind's arbitrary value syntax (`bg-[var(--color-accent)]`) in component classNames

---

## Decision

**CSS custom properties in `:root`. Tailwind arbitrary value syntax in components.**

Design tokens are defined in `apps/web/src/index.css` under `:root {}` and
consumed in components via `bg-[var(--color-bg-panel)]`, `text-[var(--color-text-secondary)]`,
etc. (Tailwind v4 arbitrary value syntax).

For lightweight-charts and any third-party library that requires resolved values,
hex constants are maintained in a `CHART_THEME` constant in the component file,
with a comment explaining why CSS variables cannot be used.

---

## Rationale

**CSS custom properties are universally accessible.**  
`:root` custom properties are readable by JavaScript (`getComputedStyle`),
third-party libraries, global stylesheets, and PostCSS plugins without any
framework-specific tooling. Tailwind `@theme` tokens are only accessible as
Tailwind utility classes — they do not produce `:root` variables visible to
non-Tailwind consumers.

**lightweight-charts cannot use CSS variable references.**  
The charting library's `applyOptions()` API accepts color values as resolved
strings (e.g., `"#22c55e"`). Passing `"var(--color-positive)"` renders as
an invalid color. A separate `CHART_THEME` constant is therefore unavoidable
regardless of which token strategy is chosen. Duplicating tokens in `@theme`
would not eliminate this constant.

**Single source of truth.**  
`:root` custom properties are the canonical source. `CHART_THEME` constants
reference the same values with a documented comment. If `@theme` were also
used, there would be three copies of each color value to maintain: `:root`,
`@theme`, and `CHART_THEME`.

**Tailwind v4 arbitrary value syntax is ergonomic.**  
`bg-[var(--color-bg-panel)]` is verbose but explicit. It makes clear that the
value comes from a CSS custom property, which aids debugging (DevTools shows
the resolved value on hover). The alternative, `bg-bg-panel`, reads naturally
but hides this indirection.

**Content paths are explicit in `tailwind.config.ts`.**  
Even without `@theme` token extension, `tailwind.config.ts` exists to declare
explicit content paths (`./index.html`, `./src/**/*.{ts,tsx}`). This prevents
tailwind from scanning `node_modules` or `coverage` during purge and makes the
configuration auditable. See `apps/web/tailwind.config.ts`.

---

## Token List

All tokens are defined in `apps/web/src/index.css` `:root {}`:

| CSS Variable             | Value                     | Usage                           |
| ------------------------ | ------------------------- | ------------------------------- |
| `--color-bg-primary`     | `#0a0a0f`                 | Terminal shell background       |
| `--color-bg-secondary`   | `#111118`                 | Status bar, secondary surfaces  |
| `--color-bg-panel`       | `#14141c`                 | Individual panel backgrounds    |
| `--color-bg-hover`       | `#1a1a24`                 | Hover states                    |
| `--color-border`         | `#2a2a3a`                 | Default borders                 |
| `--color-border-focus`   | `#4a4a6a`                 | Focused element borders         |
| `--color-text-primary`   | `#e8e8f0`                 | Primary text                    |
| `--color-text-secondary` | `#9090a8`                 | Labels, captions                |
| `--color-text-muted`     | `#5a5a72`                 | Disabled, placeholder text      |
| `--color-accent`         | `#f59e0b`                 | Bloomberg-inspired orange-amber |
| `--color-accent-dim`     | `#92610a`                 | Pressed/active accent           |
| `--color-positive`       | `#22c55e`                 | Price up, positive delta        |
| `--color-negative`       | `#ef4444`                 | Price down, negative delta      |
| `--color-neutral`        | `#6b7280`                 | Unchanged price                 |
| `--font-mono`            | `'JetBrains Mono', ...`   | All terminal text               |
| `--font-sans`            | `'Inter', system-ui, ...` | Non-terminal UI text            |

---

## Consequences

**Positive:**

- Single source of truth for all design tokens (`:root`)
- All CSS consumers (global stylesheets, third-party libs) read the same values
- No framework lock-in for design tokens
- Easy to override tokens per panel or theme (scoped `:root` overrides)

**Negative:**

- Tailwind class names are more verbose: `bg-[var(--color-bg-panel)]` vs `bg-bg-panel`
- IDE autocomplete does not suggest arbitrary values — developers must know the token names
- `CHART_THEME` constant is a necessary but maintained duplicate for lightweight-charts

**Accepted trade-off:**  
The verbosity of arbitrary value syntax is a reasonable cost for universal token
accessibility and a single source of truth. If a future third-party library can
consume CSS variables natively, no migration is required.

---

## Alternatives Considered

**Tailwind `@theme inline` (rejected):**  
`@theme inline { --color-accent: #f59e0b; }` would expose tokens as both `:root`
vars AND Tailwind utilities (`bg-accent`). Rejected because:

- `@theme inline` in Tailwind v4 requires the `@tailwindcss/vite` plugin or PostCSS
  plugin; the current integration uses `@import "tailwindcss"` via PostCSS without
  an explicit Vite integration — adding the plugin would require vite.config.ts changes
  and a new dependency
- Does not solve the lightweight-charts problem (still needs `CHART_THEME`)
- The ergonomic gain (shorter class names) is minor vs. the added complexity

**Styled-components or CSS Modules (rejected):**  
Scoped styling solutions add build complexity and break Tailwind's purge analysis.
The project is Tailwind-first; mixing paradigms would create inconsistency.
