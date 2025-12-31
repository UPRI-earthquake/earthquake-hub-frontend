import React from 'react';
import Sidebar from './Sidebar';
import EventList from './EventList';
import styles from './PanelStyles.module.css';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387-1.414 1.414-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" />
  </svg>
);

const ChevronIcon = ({ className }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M6 8.5l4 4 4-4" />
  </svg>
);

const ACCORDION_MS = 260; // Keep in sync with panel slide duration/easing

const useDelayedRender = (open) => {
  const [shouldRender, setShouldRender] = React.useState(open);
  React.useEffect(() => {
    let timer;
    if (open) {
      setShouldRender(true);
    } else {
      timer = setTimeout(() => setShouldRender(false), ACCORDION_MS);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open]);
  return shouldRender;
};

const AccordionHeader = ({ label, expanded, onToggle, ariaLabel }) => (
  <button
    type="button"
    className={`${styles.collapseHeader} ${expanded ? styles.collapseHeaderOpen : ''}`}
    onClick={onToggle}
    aria-expanded={expanded}
    aria-label={ariaLabel || `${expanded ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
  >
    <span className={`${styles.fieldLabel} ${styles.collapseLabel}`}>{label}</span>
    <ChevronIcon className={`${styles.collapseCaret} ${expanded ? styles.collapseCaretOpen : ''}`} />
  </button>
);

const Collapsible = ({ expanded, children }) => {
  const shouldRender = useDelayedRender(expanded);
  return (
    <div
      className={`${styles.collapseBody} ${expanded ? styles.collapseBodyOpen : styles.collapseBodyClosed}`}
      aria-hidden={!expanded}
    >
      <div className={styles.collapseInner}>{shouldRender ? children : null}</div>
    </div>
  );
};

function EventsPanel({
  events,
  scope,
  onScopeChange,
  searchText,
  onSearchText,
  filters,
  onFiltersChange,
  filterBounds,
  sort,
  onSortChange,
  loading = false,
  scrollKey,
}) {
  const [showFilters, setShowFilters] = React.useState(false);
  const [showSort, setShowSort] = React.useState(true);

  const clampMag = (value) => {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, n));
  };

  const updateFilters = (patch) => {
    if (typeof onFiltersChange !== 'function') return;
    onFiltersChange({ ...filters, ...patch });
  };

  const updateMagnitude = (field, value) => {
    const min = field === 'magMin' ? clampMag(value) : filters?.magMin ?? 0;
    const max = field === 'magMax' ? clampMag(value) : filters?.magMax ?? 10;
    const nextMin = Math.min(min, max);
    const nextMax = Math.max(max, min);
    updateFilters({ magMin: nextMin, magMax: nextMax });
  };

  const updateDate = (field, value) => {
    const minDate = filterBounds?.minDate;
    const maxDate = filterBounds?.maxDate;
    let next = value || '';
    if (minDate && next && next < minDate) next = minDate;
    if (maxDate && next && next > maxDate) next = maxDate;
    updateFilters({ [field]: next });
  };

  const resetFilters = () => {
    updateFilters({
      magMin: 0,
      magMax: 10,
      startDate: filterBounds?.minDate || '',
      endDate: filterBounds?.maxDate || '',
    });
  };

  const handleSortField = (by) => {
    if (typeof onSortChange !== 'function') return;
    const next = { by, order: sort?.order || 'desc' };
    if (sort?.by !== by) {
      next.order = by === 'time' ? 'desc' : 'asc';
    }
    onSortChange(next);
  };

  const toggleSortOrder = () => {
    if (typeof onSortChange !== 'function') return;
    const order = sort?.order === 'asc' ? 'desc' : 'asc';
    onSortChange({ ...sort, order });
  };

  const scopeLabel =
    scope === 'all' ? 'All recorded earthquakes' : 'Latest earthquakes (30 days)';

  const header = (
    <div className={styles.panelShell}>
      <div className={styles.panelHeader}>
        <div className={styles.titleGroup}>
          <p className={styles.title}>Events</p>
          <p className={styles.subtitle}>{scopeLabel}</p>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Event datasets">
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'latest'}
            className={`${styles.tab} ${scope === 'latest' ? styles.tabActive : ''}`}
            onClick={() => onScopeChange && onScopeChange('latest')}
          >
            Latest
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'all'}
            className={`${styles.tab} ${scope === 'all' ? styles.tabActive : ''}`}
            onClick={() => onScopeChange && onScopeChange('all')}
          >
            All
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.searchRow}>
          <div className={styles.searchInput}>
            <SearchIcon />
            <input
              type="text"
              placeholder="Search place or description"
              value={searchText}
              onChange={(e) => onSearchText && onSearchText(e.target.value)}
              aria-label="Search earthquakes"
            />
          </div>
          <button type="button" className={styles.linkButton} onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className={styles.accordionBlock}>
          <AccordionHeader
            label="Filters"
            expanded={showFilters}
            onToggle={() => setShowFilters((v) => !v)}
            ariaLabel={`${showFilters ? 'Hide' : 'Show'} filters`}
          />

          <Collapsible expanded={showFilters}>
            <div className={styles.dualRow}>
              <div>
                <div className={styles.fieldLabel}>Magnitude</div>
                <div className={styles.dualRow}>
                  <input
                    className={styles.input}
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={filters?.magMin ?? 0}
                    onChange={(e) => updateMagnitude('magMin', e.target.value)}
                    aria-label="Minimum magnitude"
                  />
                  <input
                    className={styles.input}
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={filters?.magMax ?? 10}
                    onChange={(e) => updateMagnitude('magMax', e.target.value)}
                    aria-label="Maximum magnitude"
                  />
                </div>
                <p className={styles.hint}>Range 0.0 — 10.0</p>
              </div>
              <div>
                <div className={styles.fieldLabel}>Date range</div>
                <div className={styles.dualRow}>
                  <input
                    className={styles.input}
                    type="date"
                    value={filters?.startDate || ''}
                    min={filterBounds?.minDate}
                    max={filters?.endDate || filterBounds?.maxDate}
                    onChange={(e) => updateDate('startDate', e.target.value)}
                    aria-label="Start date"
                  />
                  <input
                    className={styles.input}
                    type="date"
                    value={filters?.endDate || ''}
                    min={filters?.startDate || filterBounds?.minDate}
                    max={filterBounds?.maxDate}
                    onChange={(e) => updateDate('endDate', e.target.value)}
                    aria-label="End date"
                  />
                </div>
                <p className={styles.hint}>
                  {filterBounds?.minDate || '—'} to {filterBounds?.maxDate || '—'}
                </p>
              </div>
            </div>
          </Collapsible>
        </div>

        <div className={styles.accordionBlock}>
          <AccordionHeader
            label="Sort"
            expanded={showSort}
            onToggle={() => setShowSort((v) => !v)}
            ariaLabel={`${showSort ? 'Hide' : 'Show'} sort options`}
          />

          <Collapsible expanded={showSort}>
            <div className={styles.sortRow}>
              <div className={styles.sortGroup}>
                <button
                  type="button"
                  className={`${styles.sortButton} ${sort?.by === 'time' ? styles.sortButtonActive : ''}`}
                  onClick={() => handleSortField('time')}
                >
                  Time
                </button>
                <button
                  type="button"
                  className={`${styles.sortButton} ${sort?.by === 'mag' ? styles.sortButtonActive : ''}`}
                  onClick={() => handleSortField('mag')}
                >
                  Magnitude
                </button>
                <button
                  type="button"
                  className={`${styles.sortButton} ${sort?.by === 'depth' ? styles.sortButtonActive : ''}`}
                  onClick={() => handleSortField('depth')}
                >
                  Depth
                </button>
                <button
                  type="button"
                  className={`${styles.sortButton} ${styles.sortButtonActive}`}
                  onClick={toggleSortOrder}
                  aria-label="Toggle sort order"
                >
                  {sort?.order === 'asc' ? 'Asc ↑' : 'Desc ↓'}
                </button>
              </div>
            </div>
          </Collapsible>
        </div>
      </div>
    </div>
  );

  return (
    <Sidebar scrollResetKey={scrollKey} className="panelCard">
      {header}
      <div className={styles.listArea}>
        <EventList events={events} filters={{ ...filters, searchText }} sort={sort} loading={loading} />
      </div>
    </Sidebar>
  );
}

export default EventsPanel;
