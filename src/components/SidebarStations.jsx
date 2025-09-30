import React, { useEffect, useMemo, useState } from 'react';
import StationListItem from './StationListItem';

/**
 * Scrollable list that renders stations in the sidebar.
 * Sorts by online/active first, then station code ascending. Supports search.
 * @param {{initStations: Array, searchText?: string, activeOnly?: boolean}} props
 */
function SidebarStations({ initStations, searchText = '', activeOnly = false }) {
  const [items, setItems] = useState(() => (initStations || []).slice());

  useEffect(() => {
    setItems((initStations || []).slice());
  }, [initStations]);

  const text = (searchText || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = (items || []).filter((s) => {
      if (activeOnly && (s.activity || '').toLowerCase() !== 'active') return false;
      if (!text) return true;
      const hay = `${s.code || ''} ${s.description || ''}`.toLowerCase(); // search by ID or name
      return hay.includes(text);
    });
    // online/active first, then code asc
    return list
      .slice()
      .sort((a, b) => {
        const aOnline = (a.activity || '').toLowerCase() === 'active' ? 1 : 0;
        const bOnline = (b.activity || '').toLowerCase() === 'active' ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline; // online first
        const ac = String(a.code || '').toUpperCase();
        const bc = String(b.code || '').toUpperCase();
        if (ac < bc) return -1;
        if (ac > bc) return 1;
        return 0;
      });
  }, [items, text, activeOnly]);

  if (!filtered.length) {
    return (
      <div className="sidebar-empty">
        <div className="sidebar-empty-inner">
          <div className="sidebar-empty-title">No results</div>
          <div className="sidebar-empty-desc">Try adjusting search.</div>
        </div>
      </div>
    );
  }

  return filtered.map((s) => (
    <StationListItem key={`station:${s.code}`} station={s} />
  ));
}

export default SidebarStations;
