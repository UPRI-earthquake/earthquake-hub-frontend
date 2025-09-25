import React, { useState, useEffect, useMemo, useRef } from 'react';
import moment from 'moment';
import SidebarItem from './SidebarItem';
import { FixedSizeList as List } from 'react-window';

/**
 * Scrollable list of earthquake sidebar items with filtering and sorting.
 * @param {{initData: Array, filters?: Object, sort?: {by:'time'|'mag', order:'asc'|'desc'}, sseEnabled?: boolean}} props
 */
function SidebarItems({
  initData,
  filters,
  sort = { by: 'time', order: 'desc' },
  sseEnabled: _sseEnabled = true,
}) {
  const [items, setItems] = useState(() => (initData || []).slice());
  const containerRef = useRef(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

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
    if (Number.isFinite(magMin) && item.magnitude_value < magMin) return false;
    if (Number.isFinite(magMax) && item.magnitude_value > magMax) return false;
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

  if (!sorted.length) {
    // Empty-state indicator shown inside the scroll area
    return (
      <div className="sidebar-empty" ref={containerRef}>
        <div className="sidebar-empty-inner">
          <div className="sidebar-empty-title">No results</div>
          <div className="sidebar-empty-desc">Try adjusting search or filters.</div>
        </div>
      </div>
    );
  }

  const Row = ({ index, style, data }) => {
    const item = data[index];
    return (
      <div style={style}>
        <SidebarItem
          key={item.publicID}
          publicID={item.publicID}
          title={magText(item.magnitude_value)}
          description={
            ['Unavailable', 'Unable to geocode', ''].includes(item.place) ? item.text : item.place
          }
          subDescription={moment(item.OT).fromNow()}
          status={item.eventType ? item.eventType : null}
          last_modification={item.last_modification}
        />
      </div>
    );
  };

  const shouldVirtualize = sorted.length >= 100 && height > 0;
  if (!shouldVirtualize) {
    return (
      <div ref={containerRef} style={{ height: '100%' }}>
        {sorted.map((item) => (
          <SidebarItem
            key={item.publicID}
            publicID={item.publicID}
            title={magText(item.magnitude_value)}
            description={
              ['Unavailable', 'Unable to geocode', ''].includes(item.place) ? item.text : item.place
            }
            subDescription={moment(item.OT).fromNow()}
            status={item.eventType ? item.eventType : null}
            last_modification={item.last_modification}
          />
        ))}
      </div>
    );
  }

  // Virtualized list for large datasets
  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <List
        height={height}
        itemCount={sorted.length}
        itemSize={68}
        width={'100%'}
        itemData={sorted}
      >
        {Row}
      </List>
    </div>
  );
}

export default SidebarItems;
