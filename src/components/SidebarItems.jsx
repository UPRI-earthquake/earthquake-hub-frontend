import React, { useState, useEffect, useMemo } from 'react';
import moment from 'moment';
import SidebarItem from './SidebarItem';

/**
 * Scrollable list of earthquake sidebar items with filtering and sorting.
 * @param {{initData: Array, filters?: Object, sort?: {by:'time'|'mag'|'depth', order:'asc'|'desc'}, sseEnabled?: boolean}} props
 */
function SidebarItems({ initData, filters, sort = { by: 'time', order: 'desc' }, sseEnabled: _sseEnabled = true, loading = false }) {
  const [items, setItems] = useState(() => (initData || []).slice());

  // Keep items in sync when initData changes (e.g., preset switch)
  useEffect(() => {
    const next = (initData || []).slice();
    setItems(next);
  }, [initData]);

  // Client-side filtering (frontend only for now)
  const f = filters || {};
  const text = (f.searchText || '').trim().toLowerCase();
  const magMin = typeof f.magMin === 'number' ? f.magMin : -Infinity;
  const magMax = typeof f.magMax === 'number' ? f.magMax : Infinity;
  const start = f.startDate ? moment(f.startDate, 'YYYY-MM-DD') : null;
  const end = f.endDate ? moment(f.endDate, 'YYYY-MM-DD').endOf('day') : null;

  const filtered = items.filter((item) => {
    const mag = Number(item.magnitude_value);
    const isClosedRange =
      Number.isFinite(magMin) && Number.isFinite(magMax) && Math.abs(magMax - magMin) < 1e-9;
    if (isClosedRange) {
      const target = Math.round(magMin * 10) / 10;
      const roundedMag = Math.round((Number.isFinite(mag) ? mag : 0) * 10) / 10;
      if (roundedMag !== target) return false;
    } else {
      if (Number.isFinite(magMin) && (Number.isFinite(mag) ? mag : -Infinity) < magMin) return false;
      if (Number.isFinite(magMax) && (Number.isFinite(mag) ? mag : Infinity) > magMax) return false;
    }
    if (start && moment(item.OT).isBefore(start)) return false;
    if (end && moment(item.OT).isAfter(end)) return false;
    if (text) {
      const str = `${item.place || ''} ${item.text || ''}`.toLowerCase();
      if (!str.includes(text)) return false;
    }
    return true;
  });

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    const by = sort?.by || 'time';
    const order = sort?.order || 'desc';
    const dir = order === 'asc' ? 1 : -1;
    const cmp = (a, b) => {
      if (by === 'mag') {
        const av = Number(a.magnitude_value) || 0;
        const bv = Number(b.magnitude_value) || 0;
        return (av - bv) * dir;
      } else if (by === 'depth') {
        const getDepth = (it) =>
          Number(
            it.depth_km ?? it.depthKm ?? it.depth_value ?? it.depthValue ?? it.depth ?? Infinity,
          );
        const av = getDepth(a);
        const bv = getDepth(b);
        return (av - bv) * dir;
      }
      // default: time
      const at = new Date(a.OT).getTime();
      const bt = new Date(b.OT).getTime();
      return (at - bt) * dir;
    };
    arr.sort(cmp);
    return arr;
  }, [filtered, sort]);

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

  if (!sorted.length) {
    // Empty-state indicator shown inside the scroll area (direct child for mobile flex)
    return (
      <div className="sidebar-empty">
        <div className="sidebar-empty-inner">
          <div className="sidebar-empty-title">No results</div>
          <div className="sidebar-empty-desc">Try adjusting search or filters.</div>
        </div>
      </div>
    );
  }

  // Render items directly (no nested scroll wrappers). This keeps
  // desktop to a single vertical scrollbar, and on mobile the
  // Sidebar CSS displays each item as a horizontal card scroller.
  return sorted.map((item) => (
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
        // Prefer geocoded place; if missing or unusable, fall back to raw text
        item && item.place && !['Unavailable', 'Unable to geocode', ''].includes(item.place)
          ? item.place
          : (item?.text || '')
      }
      subDescription={moment(item.OT).fromNow()}
      status={item.eventType ? item.eventType : null}
      last_modification={item.last_modification}
    />
  ));
}

export default SidebarItems;
