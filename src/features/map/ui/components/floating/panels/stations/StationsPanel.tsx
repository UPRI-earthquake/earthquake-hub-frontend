import styles from '../../../../styles/floating/panels/Panel.module.css';
import StationListItem from './StationListItem';
import useStations from '../../../../../hooks/useStations';
import SidePanel from '../SidePanel';
import SearchIcon from '@/shared/icons/SearchIcon';


export default function StationsPanel() {
  const { 
    viewableStations, counts, 
    filters: { searchText, statusFilter },
    updateFilters
  } = useStations();

  const onSearchInput = (value) => {
    updateFilters({ searchText: value });
  };

  const setFilter = (value) => {
    updateFilters({ statusFilter: value });
  };

  const pills = [
    { label: 'All', value: null, count: (counts.active || 0) + (counts.inactive || 0) },
    { label: 'Online', value: 'active', count: counts.active || 0 },
    { label: 'Offline', value: 'inactive', count: counts.inactive || 0 },
  ];


  const header = (
    <div className={styles.panelShell}>
      <div className={styles.panelHeader}>
        <div className={styles.titleGroup}>
          <p className={styles.title}>Stations</p>
          <p className={styles.subtitle}>Deployed seismic sensors</p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.searchRow}>
          <div className={styles.searchInput}>
            <SearchIcon />
            <input
              type="text"
              placeholder="Search by ID or name"
              value={searchText}
              onChange={(e) => onSearchInput && onSearchInput(e.target.value)}
              aria-label="Search stations"
            />
          </div>
        </div>
        <div className={styles.pillRow} role="group" aria-label="Filter by station status">
          {pills.map((pill) => {
            const isActive = statusFilter === pill.value;
            return (
              <button
                key={pill.label}
                type="button"
                className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
                onClick={() => setFilter(pill.value)}
                aria-pressed={isActive}
              >
                {pill.label}
                {Number.isFinite(pill.count) && (
                  <span className={styles.muted}>{pill.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  


  const scrollKey = `${statusFilter || 'all'}-${searchText}`;

  return (
    <SidePanel scrollResetKey={scrollKey} className="panelCard">
      {header}
      <div className={styles.listArea}>
        { viewableStations.length > 0 ? viewableStations.map((station) => (
          <StationListItem
            key={`station:${(station.network || 'AM').toUpperCase()}:${(station.code || '').toUpperCase()}`}
            station={station}
          />
        )) : <div className="sidebar-empty">
          <div className="sidebar-empty-inner">
            <div className="sidebar-empty-title">No results</div>
            <div className="sidebar-empty-desc">Try adjusting search.</div>
          </div>
        </div> }
      </div>
    </SidePanel>
  );
}