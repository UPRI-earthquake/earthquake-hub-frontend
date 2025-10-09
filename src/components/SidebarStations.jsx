import React, { useEffect, useMemo, useState } from 'react';
import StationListItem from './StationListItem';

/**
 * Scrollable list that renders stations in the sidebar.
 * Live-refreshes from backend and sorts so newly-active appear first.
 * @param {{
 *   initStations: Array,
 *   searchText?: string,
 *   statusFilter?: 'active' | 'inactive' | null
 * }} props
 */
function SidebarStations({ initStations, searchText = '', statusFilter = null }) {
  const [items, setItems] = useState(() => (initStations || []).slice());

  useEffect(() => {
    setItems((initStations || []).slice());
  }, [initStations]);

  const text = (searchText || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = (items || []).filter((s) => {
      const isActive = (s.activity || '').toLowerCase() === 'active';
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
      if (!text) return true;
      const hay = `${s.code || ''} ${s.description || ''}`.toLowerCase(); // search by ID or name
      return hay.includes(text);
    });
    // Sort: online/active first, and among active sort by most-recently active
    // (statusSince descending) so newly-active bubble to the top; fallback by code asc.
    return list
      .slice()
      .sort((a, b) => {
        const aOnline = (a.activity || '').toLowerCase() === 'active';
        const bOnline = (b.activity || '').toLowerCase() === 'active';
        if (aOnline !== bOnline) return bOnline - aOnline; // online first
        if (aOnline && bOnline) {
          const at = new Date(a.statusSince || a.activityToggleTime || a.lastActive || 0).getTime();
          const bt = new Date(b.statusSince || b.activityToggleTime || b.lastActive || 0).getTime();
          if (isFinite(at) && isFinite(bt) && at !== bt) return bt - at; // recent first
        }
        const ac = String(a.code || '').toUpperCase();
        const bc = String(b.code || '').toUpperCase();
        if (ac < bc) return -1;
        if (ac > bc) return 1;
        return 0;
      });
  }, [items, text, statusFilter]);

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
    <StationListItem key={`station:${(s.network || 'AM').toUpperCase()}:${(s.code || '').toUpperCase()}`} station={s} />
  ));
}

export default SidebarStations;
