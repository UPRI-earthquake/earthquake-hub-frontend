import React from 'react';
import Sidebar from './Sidebar';
import StationList from './StationList';
import styles from './PanelStyles.module.css';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387-1.414 1.414-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" />
  </svg>
);

function StationsPanel({
  stations,
  searchText,
  onSearchText,
  statusFilter,
  onStatusFilterChange,
  counts = { active: 0, inactive: 0 },
  scrollKey,
}) {
  const setFilter = (value) => {
    if (typeof onStatusFilterChange === 'function') onStatusFilterChange(value);
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
              onChange={(e) => onSearchText && onSearchText(e.target.value)}
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

  return (
    <Sidebar scrollResetKey={scrollKey} className="panelCard">
      {header}
      <div className={styles.listArea}>
        <StationList stations={stations} searchText={searchText} statusFilter={statusFilter} />
      </div>
    </Sidebar>
  );
}

export default StationsPanel;
