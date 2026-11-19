# Data Hooks

Hooks centralize data fetching and live updates.

## `useAppData`

- File: `src/hooks/useAppData.js`
- Responsibilities:
  - Perform initial fetch for stations (`/device/all`) and events (`/eq-events`)
  - Wire SSE `EventSource` for live `SC_EVENT` and `SC_PICK`
  - Expose `eventSourceRef`, `performInitialLoad`, `fetchEventsForRange(start, end)`
- Consumers: `src/pages/HomePage.jsx`

## `useEventsFeed`

- File: `src/hooks/useEventsFeed.js`
- Normalizes inbound SSE event payloads and sifts NEW/UPDATE for UI animations

## `useStations`

- File: `src/hooks/useStations.js`
- Fetches stations and shapes data for `StationMarkers`

## SSE Context

- File: `src/SSEContext.js`
- React context that provides the active `EventSource` to listeners

## Tips

- Keep SSE listeners lean; debounce heavy updates and avoid synchronous layouts
- Store large arrays in refs when possible to reduce re-renders

