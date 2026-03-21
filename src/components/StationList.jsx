import React, { useMemo } from 'react';
import { filterAndSortStations } from '../utils/stationFilters';
import StationListItem from './StationListItem';

function StationList({ stations, searchText = '', statusFilter = null }) {
  const items = useMemo(
    () => filterAndSortStations(stations, { searchText, statusFilter }),
    [stations, searchText, statusFilter],
  );

  if (!items.length) {
    return (
      <div className="sidebar-empty">
        <div className="sidebar-empty-inner">
          <div className="sidebar-empty-title">No results</div>
          <div className="sidebar-empty-desc">Try adjusting search.</div>
        </div>
      </div>
    );
  }

  return items.map((station) => (
    <StationListItem
      key={`station:${(station.network || 'AM').toUpperCase()}:${(station.code || '').toUpperCase()}`}
      station={station}
    />
  ));
}

export default StationList;
