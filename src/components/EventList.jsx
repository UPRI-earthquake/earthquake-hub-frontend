import React, { useMemo } from 'react';
import moment from '../utils/time';
import { filterAndSortEvents } from '../utils/eventFilters';
import { getEventSourceLabel, isLegacyEvent } from '../utils/eventProvenance';
import SidebarItem from './SidebarItem';

function EventList({ events, filters, sort, loading }) {
  const items = useMemo(
    () => filterAndSortEvents(events || [], filters, sort),
    [events, filters, sort],
  );

  const magText = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : String(v ?? '-');
  };

  if (loading) {
    return (
      <div className="sidebar-loader" role="status" aria-live="polite" aria-label="Loading results">
        <div className="sidebar-spinner" aria-hidden />
        <div className="sidebar-loader-text">Fetching earthquakes…</div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="sidebar-empty">
        <div className="sidebar-empty-inner">
          <div className="sidebar-empty-title">No results</div>
          <div className="sidebar-empty-desc">Try adjusting search or filters.</div>
        </div>
      </div>
    );
  }

  return items.map((item) => (
    <SidebarItem
      key={item.publicID}
      publicID={item.publicID}
      title={magText(item.magnitude_value)}
      depthKm={
        Number(
          item.depth_km ?? item.depthKm ?? item.depth_value ?? item.depthValue ?? item.depth ?? NaN,
        )
      }
      description={
        item && item.place && !['Unavailable', 'Unable to geocode', ''].includes(item.place)
          ? item.place
          : item?.text || ''
      }
      subDescription={moment(item.OT).fromNow()}
      status={item.eventType ? item.eventType : null}
      last_modification={item.last_modification}
      isLegacyRecord={isLegacyEvent(item)}
      sourceLabel={getEventSourceLabel(item)}
    />
  ));
}

export default EventList;
