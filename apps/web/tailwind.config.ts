/**
 * Tailwind CSS v4 configuration for the Bloomberg Terminal SPA.
 *
 * Content paths: explicit list prevents tailwind from scanning node_modules
 * or build artifacts, keeping purge fast and deterministic.
 *
 * Theme tokens: In Tailwind v4, design tokens live in CSS via `@theme inline`
 * in index.css rather than `theme.extend` here. The terminal's color palette
 * (#0a0a0f base, #f59e0b accent, JetBrains Mono) is defined as CSS custom
 * properties (--color-*) in src/index.css and consumed in components via
 * Tailwind's arbitrary value syntax: `bg-[var(--color-bg-primary)]`.
 *
 * Why arbitrary values instead of @theme tokens: The terminal's CSS vars are
 * also consumed by lightweight-charts (which requires resolved hex values),
 * dockview, and global stylesheets. Keeping them in `:root` as CSS custom
 * properties ensures a single source of truth accessible to all consumers.
 * @theme inline would duplicate them as Tailwind tokens with no other benefit.
 *
 * See: src/index.css for the full token list.
 * See: ADR-010 for the visual design token decision.
 */

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};
