# Testing Guide

How to run and extend tests in this repo.

## Running

- `npm test` — runs jest with CRA config

## Current coverage

- A11y and behavior tests for Layers control:
  - `src/__tests__/LayersA11y.test.js`
  - `src/__tests__/MapLayersControl.test.js`
- Component tests:
  - `src/components/__tests__/SidebarItems.test.jsx`
- Utility tests:
  - `src/utils/__tests__/lastUpdated.test.js`

## Adding tests

- Co-locate in `__tests__` near code if practical; otherwise under `src/__tests__`
- Use `@testing-library/react` and `@testing-library/jest-dom` assertions
- Prefer testing observable behavior (DOM, events) over implementation details

