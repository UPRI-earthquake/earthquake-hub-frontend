# Sidebar

The sidebar hosts search, filters, presets, and the live event list.

## Components

- `Sidebar` shell and layout: `src/components/Sidebar.jsx`
- `SidebarInfo` (header, search, filters, presets): `src/components/SidebarInfo.jsx`
- `SidebarItems` (virtualized-ready list): `src/components/SidebarItems.jsx`
- `SidebarItem` (row with select/focus behavior): `src/components/SidebarItem.jsx`

## State & Props

- Text search: `searchText` from `HomePage`
- Filters: `{ magMin, magMax, startDate, endDate }`
- Sorting: `{ by: 'time'|'mag', order: 'asc'|'desc' }`
- Presets: keys like `latest-30d`, `year-2025` update filters and whether SSE stays live

## Selection Flow

- Clicking a row dispatches `SELECT(publicID)` to Redux
- Map markers listen with `useSelector`; if matching, they open the popup and fly to location

See also: `docs/SELECTION_STATE_FLOW.md`

## Extending

- Add new preset options in `HomePage.jsx` alongside `onPresetChange` handler.
- Consider list virtualization (e.g., `react-window`) for very large datasets.
- Keep row height accessible (min 44px) and ensure focus ring visibility.

