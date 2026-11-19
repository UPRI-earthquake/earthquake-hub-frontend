# Styling Guide

This guide explains how styles are organized and how to extend them safely.

## Approach

- Prefer CSS Modules for component-specific styles. Example imports: `import styles from './Header.module.css'`.
- Use plain `.css` files only for:
  - Third‑party overrides (Leaflet controls, tooltips)
  - Page‑level layout where global selectors are unavoidable
- Define global tokens in `src/index.css` (fonts, color tokens) and keep third‑party control overrides in targeted selectors.

## Structure

- Global base and control overrides: `src/index.css`
- Page‑level styles: `src/pages/*.css`
- Component styles (scoped): `src/components/*/*.module.css` and `src/components/*.module.css`
- Intentional global component overrides (Leaflet): `src/components/mapLayers.css`, `src/components/legend.css`

## Theming

- Map theme uses a data attribute on the Leaflet container: `data-basemap-theme="light|dark|imagery"`.
- Theme-aware selectors in `index.css`, `mapLayers.css`, and `legend.css` respond to that attribute.

## Conventions

- Name module classes semantically (e.g., `header`, `headerRight`, `cardTitle`).
- Keep component CSS limited to component DOM; avoid global tags or IDs.
- Prefer CSS-only swatches and symbols in legends to avoid coupling to the map runtime.
- Use CSS custom properties sparingly for shared tokens; define in `:root`.

## When to use global CSS

- Overriding Leaflet control DOM (classes created by Leaflet) where module scoping won’t match.
- Page-wide layout shells when route transitions shouldn’t remount containers.

## Adding new styles

1. For a new component, create `ComponentName.module.css` next to it and import as `styles`.
2. For a new Leaflet control or map override, extend `mapLayers.css` or `legend.css` with specific selectors.
3. For shared tokens or universal tweaks, update `src/index.css`.

