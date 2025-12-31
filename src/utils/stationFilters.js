const normalizeCode = (val) => String(val || '').toUpperCase();

export function filterStations(stations, { searchText = '', statusFilter = null } = {}) {
  const text = searchText.trim().toLowerCase();
  return (stations || []).filter((station) => {
    const isActive = (station?.activity || '').toLowerCase() === 'active';
    if (statusFilter === 'active' && !isActive) return false;
    if (statusFilter === 'inactive' && isActive) return false;
    if (!text) return true;
    const hay = `${station?.code || ''} ${station?.description || ''}`.toLowerCase();
    return hay.includes(text);
  });
}

export function sortStations(stations) {
  return (stations || [])
    .slice()
    .sort((a, b) => {
      const aOnline = (a?.activity || '').toLowerCase() === 'active';
      const bOnline = (b?.activity || '').toLowerCase() === 'active';
      if (aOnline !== bOnline) return bOnline - aOnline;
      if (aOnline && bOnline) {
        const at = new Date(a?.statusSince || a?.activityToggleTime || a?.lastActive || 0).getTime();
        const bt = new Date(b?.statusSince || b?.activityToggleTime || b?.lastActive || 0).getTime();
        if (isFinite(at) && isFinite(bt) && at !== bt) return bt - at;
      }
      const ac = normalizeCode(a?.code);
      const bc = normalizeCode(b?.code);
      if (ac < bc) return -1;
      if (ac > bc) return 1;
      return 0;
    });
}

export const filterAndSortStations = (stations, options) =>
  sortStations(filterStations(stations, options));
