import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import styles from './SidebarInfo.module.css';
import { trackEvent } from '../analytics';

// Simple inline icons to avoid adding dependencies
const CaretIcon = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden
  >
    <path d="M5.5 7l4.5 6 4.5-6H5.5z" />
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387-1.414 1.414-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z" />
  </svg>
);
const FunnelIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
  </svg>
);
const SortIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 3h2v14h3l-4 4-4-4h3V3zm7 2h8v2h-8V5zm0 6h6v2h-6v-2zm0 6h4v2h-4v-2z" />
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.3 5.71L12 12.01l6.3 6.28-1.42 1.42L10.6 13.4l-6.3 6.31-1.42-1.42 6.3-6.3-6.3-6.28 1.42-1.42 6.3 6.3 6.29-6.3z" />
  </svg>
);

/**
 * Sidebar header: dataset selector, search, filters and sort controls.
 * TODO(frontend-team): Split datasets, filters, and sort into subcomponents — this file is dense.
 */
function SidebarInfo({
  title = 'Latest Earthquakes, Past 30 Days',
  collapsed = false,
  // onToggle now opens dataset dropdown
  onToggle: _onToggle = () => {},
  searchText,
  onSearch,
  defaultFilters,
  filterBounds,
  onFiltersChange,
  onDatasetChange,
  selectedDatasetKey,
  // Controls visibility for future dataset options
  showFilter = true,
  showSort = true,
  // Sorting state is owned by the parent (e.g., HomePage)
  sortBy = 'time', // 'time' | 'mag'
  sortOrder = 'desc', // 'asc' | 'desc'
  onSortChange,
  // Stations-specific UI
  stationCounts, // {active:number, inactive:number}
  stationStatusFilter = null, // 'active' | 'inactive' | null
  onStationStatusFilterChange,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Tooltip text state for header icon buttons (match site pattern)
  const [sortTip, setSortTip] = useState('Sort list by time, magnitude, or depth');
  const [filterTip, setFilterTip] = useState('Filter earthquakes by magnitude and date');
  const rootRef = useRef(null);
  const filterEventTimerRef = useRef(null);
  const pendingFilterPayloadRef = useRef(null);
  const flushFilterEvent = useCallback(() => {
    if (!pendingFilterPayloadRef.current) return;
    const payload = pendingFilterPayloadRef.current;
    pendingFilterPayloadRef.current = null;
    try {
      trackEvent('filter_apply', payload);
    } catch (_) {}
  }, []);
  const scheduleFilterTelemetry = useCallback(
    (nextFilters, reason = 'unknown') => {
      const toNumber = (val, fallback) => {
        const parsed = typeof val === 'number' ? val : parseFloat(val);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      pendingFilterPayloadRef.current = {
        source: reason,
        mag_min: toNumber(nextFilters.magMin, 0),
        mag_max: toNumber(nextFilters.magMax, 10),
        start_date: nextFilters.startDate || '',
        end_date: nextFilters.endDate || '',
        search_len: (searchText || '').trim().length,
      };
      if (filterEventTimerRef.current) clearTimeout(filterEventTimerRef.current);
      filterEventTimerRef.current = setTimeout(() => {
        flushFilterEvent();
        filterEventTimerRef.current = null;
      }, 320);
    },
    [flushFilterEvent, searchText],
  );
  useEffect(
    () => () => {
      if (filterEventTimerRef.current) clearTimeout(filterEventTimerRef.current);
    },
    [],
  );

  // Measure the slider width so bubbles can align with the actual thumb center
  const rangeWrapRef = useRef(null);
  const [wrapWidth, setWrapWidth] = useState(0);
  // Measure when the popover opens (element exists) and on resize
  useEffect(() => {
    if (!filtersOpen) return;
    const el = rangeWrapRef.current;
    if (!el) return;
    const measure = () => setWrapWidth(el.getBoundingClientRect().width);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }
    measure();
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [filtersOpen]);

  // No local filter copy; inputs are controlled by parent via defaultFilters

  // Close menus on outside interactions
  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) {
        setMenuOpen(false);
        setFiltersOpen(false);
        setSortOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setFiltersOpen(false);
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('touchstart', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('touchstart', onDoc, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);

  // Helper: clamp and forward changes directly to parent
  const clampAndSend = (patch, reason = 'unknown') => {
    if (!onFiltersChange) return;
    const current = defaultFilters || {};
    const nextState = { ...current, ...patch };
    const clampDate = (d, lo, hi) => {
      if (!d) return d;
      if (lo && d < lo) return lo;
      if (hi && d > hi) return hi;
      return d;
    };
    const minDate = filterBounds?.minDate || null;
    const maxDate = filterBounds?.maxDate || null;
    const next = {
      ...nextState,
      startDate: clampDate(nextState.startDate, minDate, maxDate),
      endDate: clampDate(nextState.endDate, minDate, maxDate),
    };
    onFiltersChange(next);
    scheduleFilterTelemetry(next, reason);
  };

  const clamp01 = (n) => Math.max(0, Math.min(10, n));
  const setMagMin = (val) => {
    const v = clamp01(val);
    const max = typeof defaultFilters?.magMax === 'number' ? defaultFilters.magMax : 10;
    clampAndSend({ magMin: Math.min(v, max) }, 'magnitude_range');
  };
  const setMagMax = (val) => {
    const v = clamp01(val);
    const min = typeof defaultFilters?.magMin === 'number' ? defaultFilters.magMin : 0;
    clampAndSend({ magMax: Math.max(v, min) }, 'magnitude_range');
  };

  // Reset to dataset bounds and full magnitude range
  const resetFilters = () => {
    clampAndSend({
      magMin: 0,
      magMax: 10,
      startDate: filterBounds?.minDate || '',
      endDate: filterBounds?.maxDate || '',
    }, 'reset');
  };

  const containerCls = useMemo(
    () => `${styles.sidebarInfo} ${collapsed ? styles.collapsed : ''}`,
    [collapsed],
  );

  const min = typeof defaultFilters?.magMin === 'number' ? defaultFilters.magMin : 0;
  const max = typeof defaultFilters?.magMax === 'number' ? defaultFilters.magMax : 10;
  const pct = (v) => (v / 10) * 100;
  const minPct = pct(min);
  const maxPct = pct(max);
  // Keep JS constants in sync with CSS: --thumb-size:16px -> radius 8
  const thumbRadius = 8; // px
  const effectiveTrackWidth = Math.max(0, wrapWidth - 2 * thumbRadius);
  const bubbleCenterPxNum = (v) => thumbRadius + (v / 10) * effectiveTrackWidth;
  const bubbleLeftPx = (v) => `${bubbleCenterPxNum(v)}px`;

  // Measure bubble widths and avoid overlap by collapsing to a combined bubble
  const minBubbleRef = useRef(null);
  const maxBubbleRef = useRef(null);
  const comboBubbleRef = useRef(null);
  const [bubbleSizes, setBubbleSizes] = useState({ min: 0, max: 0, combo: 0 });
  useEffect(() => {
    const m = minBubbleRef.current;
    const x = maxBubbleRef.current;
    const c = comboBubbleRef.current;
    if (!m || !x || !c) return;
    const measure = () =>
      setBubbleSizes({
        min: m.getBoundingClientRect().width,
        max: x.getBoundingClientRect().width,
        combo: c.getBoundingClientRect().width,
      });
    // Measure after layout; requestAnimationFrame avoids reading mid-update
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [min, max, wrapWidth, filtersOpen]);

  const bubbleGap = 6; // px minimum gap between two bubbles
  const minCenter = bubbleCenterPxNum(min);
  const maxCenter = bubbleCenterPxNum(max);
  const overlap = minCenter + bubbleSizes.min / 2 + bubbleGap > maxCenter - bubbleSizes.max / 2;
  const midCenter = (minCenter + maxCenter) / 2;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  // Text values used below (and to detect same-value case)
  const minTxt = min.toFixed(1);
  const maxTxt = max.toFixed(1);
  const sameValue = minTxt === maxTxt;
  // Compute where to place the combined bubble:
  // - Centered between handles by default
  // - If it would overflow left, anchor to the min handle center and nudge right
  // - If it would overflow right, anchor to the max handle center and nudge left
  const trackLeft = thumbRadius;
  const trackRight = wrapWidth - thumbRadius;
  const comboWidth = bubbleSizes.combo || 0;
  const desiredCenter = midCenter;
  const leftEdge = desiredCenter - comboWidth / 2;
  const rightEdge = desiredCenter + comboWidth / 2;
  let comboAnchor = 'center';
  if (leftEdge < trackLeft) comboAnchor = 'min';
  else if (rightEdge > trackRight) comboAnchor = 'max';
  const sideMargin = 6; // keep off container edges
  const edgeNudge = 6; // aesthetic nudge away from the extreme
  // If both handles are equal and at an extreme, revert to center anchor,
  // then clamp within the container so it won't overflow.
  const sameAtMin = sameValue && min <= 0.0001;
  const sameAtMax = sameValue && max >= 9.9999;
  let anchorCenter;
  if (sameAtMin) {
    // Exact match to the single-bubble placement at the left edge
    anchorCenter = minCenter;
  } else if (sameAtMax) {
    // Exact match to the single-bubble placement at the right edge
    anchorCenter = maxCenter;
  } else {
    anchorCenter = desiredCenter;
    if (comboAnchor === 'min') anchorCenter = minCenter + edgeNudge;
    else if (comboAnchor === 'max') anchorCenter = maxCenter - edgeNudge;
    // Clamp within container to avoid overflow only when not at extremes
    const minCenterAllowed = sideMargin + comboWidth / 2;
    const maxCenterAllowed = wrapWidth - sideMargin - comboWidth / 2;
    anchorCenter = clamp(anchorCenter, minCenterAllowed, maxCenterAllowed);
  }

  // Track is full-width; we rely on pointer-events: none on the inputs
  // (re-enabled on thumbs) so we don't need artificial left/right padding.

  // Click-to-jump on the track: move nearest handle to clicked value
  const valueFromClientX = (clientX) => {
    if (!rangeWrapRef.current) return null;
    const rect = rangeWrapRef.current.getBoundingClientRect();
    const total = rect.width - 2 * thumbRadius;
    if (total <= 0) return null;
    const x = clientX - rect.left;
    const pos = clamp(x - thumbRadius, 0, total);
    const frac = pos / total;
    const v = +(frac * 10).toFixed(1);
    return clamp01(v);
  };
  const jumpNearest = (clientX) => {
    const v = valueFromClientX(clientX);
    if (v == null) return;
    const dMin = Math.abs(v - min);
    const dMax = Math.abs(v - max);
    if (dMin <= dMax) setMagMin(v);
    else setMagMax(v);
  };
  const onTrackMouseDown = (e) => {
    jumpNearest(e.clientX);
  };
  const onTrackTouchStart = (e) => {
    if (e.touches && e.touches[0]) jumpNearest(e.touches[0].clientX);
    // e.preventDefault();
  };

  const displayTitle = title;

  return (
    <div className={containerCls} ref={rootRef}>
      <div className={styles.headerRow}>
        <button
          className={styles.titleBtn}
          onClick={() => {
            setFiltersOpen(false); // collapse filter when opening dataset menu
            setSortOpen(false); // also hide sort panel when dataset menu open
            setMenuOpen((v) => !v);
          }}
          aria-expanded={menuOpen ? 'true' : 'false'}
          title="Change dataset"
        >
          <span className={styles.titleText}>{displayTitle}</span>
          <CaretIcon className={styles.caret} />
        </button>
        <div className={styles.tools}>{/* Reserved for future buttons if needed */}</div>
      </div>

      {/* Dataset dropdown */}
      {menuOpen && (
        <div className={styles.menu} role="menu">
          {[
            {
              key: 'latest-30d',
              label: 'Latest Earthquakes (30 days)',
              tip: 'Earthquakes from the past 30 days',
            },
            { key: 'all-eqs', label: 'All Earthquakes', tip: 'All recorded earthquakes in the network' },
            {
              key: 'all-stations',
              label: `All Stations`,
              tip: 'View all monitoring stations in the network',
            },
          ].map((opt) => (
            <button
              key={opt.key}
              className={`${styles.menuItem} ${
                selectedDatasetKey === opt.key ? styles.menuItemSelected : ''
              }`}
              role="menuitemradio"
              aria-checked={selectedDatasetKey === opt.key ? 'true' : 'false'}
              title={opt.tip}
              onClick={() => {
                onDatasetChange && onDatasetChange(opt.key);
                // Hide all other panels when a dataset is chosen
                setMenuOpen(false);
                setFiltersOpen(false);
                setSortOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Search + Filter row (now above counters) */}
      {!collapsed && (
          <div className={styles.searchWrap}>
            <div className={styles.search}>
              <SearchIcon />
              <input
                type="text"
                id="sidebar-search"
                name="search"
                placeholder={
                  selectedDatasetKey === 'all-stations'
                    ? 'Search by ID or name'
                    : 'Search earthquakes'
                }
                value={searchText || ''}
                onChange={(e) => onSearch && onSearch(e.target.value)}
                onBlur={() => {
                  if ((searchText || '').trim()) {
                    scheduleFilterTelemetry(defaultFilters || {}, 'search_blur');
                  }
                }}
                aria-label={
                  selectedDatasetKey === 'all-stations'
                    ? 'Search stations by ID or name'
                    : 'Search earthquakes'
                }
                title={
                  selectedDatasetKey === 'all-stations'
                    ? 'Search stations by ID or name'
                    : 'Search earthquakes'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    try { e.currentTarget.blur(); } catch (_) {}
                  }
                }}
              />
            </div>
          {showSort && selectedDatasetKey !== 'all-stations' && (
            <button
              className={styles.iconBtn}
              onClick={() => {
                setMenuOpen(false);
                setFiltersOpen(false);
                setSortOpen((v) => {
                  const next = !v;
                  setSortTip(next ? 'Sort list by time, magnitude, or depth' : 'Close sort options');
                  try { trackEvent('sort_toggle', { state: next ? 'open' : 'closed' }); } catch (_) {}
                  return next;
                });
              }}
              aria-expanded={sortOpen ? 'true' : 'false'}
              aria-label="Open sorting options"
              title={sortTip}
            >
              {sortOpen ? <CloseIcon /> : <SortIcon />}
            </button>
          )}
          {showFilter && selectedDatasetKey !== 'all-stations' && (
            <button
              className={styles.iconBtn}
              onClick={() => {
                setMenuOpen(false);
                setSortOpen(false);
                setFiltersOpen((v) => {
                  const next = !v;
                  setFilterTip(next ? 'Filter earthquakes by magnitude and date' : 'Close filters');
                  try { trackEvent('filter_toggle', { state: next ? 'open' : 'closed' }); } catch (_) {}
                  return next;
                });
              }}
              aria-expanded={filtersOpen ? 'true' : 'false'}
              aria-label="Open filters"
              title={filterTip}
            >
              {filtersOpen ? <CloseIcon /> : <FunnelIcon />}
            </button>
          )}
        </div>
      )}

      {/* Stations online row with pill toggles (only for stations dataset) */}
      {selectedDatasetKey === 'all-stations' && !collapsed && (
        <div className={styles.stationStatsRow}>
          <div className={styles.pillGroup} role="group" aria-label="Filter stations by status">
            <button
              className={`${styles.pill} ${styles.pillOnline} ${
                stationStatusFilter === 'active' ? styles.pillActive : ''
              }`}
              aria-pressed={stationStatusFilter === 'active'}
              onClick={() => {
                const next = stationStatusFilter === 'active' ? null : 'active';
                onStationStatusFilterChange && onStationStatusFilterChange(next);
                try { trackEvent('online_filter', { enabled: next === 'active' }); } catch (_) {}
              }}
              title="Show online stations"
            >
              <span className={styles.pillDot} aria-hidden>●</span>
              <span className={styles.pillLabel}>Online</span>
              <span className={styles.pillCount}>{stationCounts?.active ?? 0}</span>
            </button>
            <button
              className={`${styles.pill} ${styles.pillOffline} ${
                stationStatusFilter === 'inactive' ? styles.pillActive : ''
              }`}
              aria-pressed={stationStatusFilter === 'inactive'}
              onClick={() => {
                const next = stationStatusFilter === 'inactive' ? null : 'inactive';
                onStationStatusFilterChange && onStationStatusFilterChange(next);
                try { trackEvent('offline_filter', { enabled: next === 'inactive' }); } catch (_) {}
              }}
              title="Show offline stations"
            >
              <span className={styles.pillDot} aria-hidden>●</span>
              <span className={styles.pillLabel}>Offline</span>
              <span className={styles.pillCount}>{stationCounts?.inactive ?? 0}</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter popover */}
      {filtersOpen && (
        <div className={styles.popover} role="dialog" aria-modal="true">
          <div className={styles.popHeader}>
            <div>Filter by</div>
            <button
              className={`${styles.iconBtn} ${styles.closeBtn}`}
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
              title="Close"
            >
              ×
            </button>
          </div>
          <div className={styles.popBody}>
            <div className={styles.field}>
              <div className={styles.label} title="Adjust magnitude range">Magnitude</div>
              <div className={styles.rangeWrap} ref={rangeWrapRef}>
                <div
                  className={styles.rangeTrack}
                  onMouseDown={onTrackMouseDown}
                  onTouchStart={onTrackTouchStart}
                  title="Drag to select magnitude range"
                >
                  {/* Paint highlight exactly between min and max using a gradient */}
                  <div
                    className={styles.rangeHighlight}
                    style={{
                      background: `linear-gradient(to right, 
                        transparent ${minPct}%,
                        var(--accent) ${minPct}%,
                        var(--accent) ${maxPct}%,
                        transparent ${maxPct}%
                      )`,
                    }}
                  />
                </div>
                <input
                  id="mag-min"
                  name="magMin"
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={min}
                  onChange={(e) => setMagMin(parseFloat(e.target.value))}
                  style={{ zIndex: min === max && max === 10 ? 3 : 2 }}
                  aria-label="Minimum magnitude"
                  title="Minimum magnitude"
                />
                <input
                  id="mag-max"
                  name="magMax"
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={max}
                  onChange={(e) => setMagMax(parseFloat(e.target.value))}
                  style={{ zIndex: min === max && min === 0 ? 3 : 2 }}
                  aria-label="Maximum magnitude"
                  title="Maximum magnitude"
                />
                {/* Individual bubbles (kept in DOM for measurement) */}
                <div
                  ref={minBubbleRef}
                  className={styles.bubble}
                  style={{
                    left: bubbleLeftPx(min),
                    visibility: overlap ? 'hidden' : 'visible',
                    opacity: overlap ? 0 : 1,
                  }}
                >
                  {minTxt}
                </div>
                <div
                  ref={maxBubbleRef}
                  className={styles.bubble}
                  style={{
                    left: bubbleLeftPx(max),
                    visibility: overlap ? 'hidden' : 'visible',
                    opacity: overlap ? 0 : 1,
                  }}
                >
                  {maxTxt}
                </div>
                {/* Combined bubble when the two would overlap */}
                <div
                  ref={comboBubbleRef}
                  className={styles.bubble}
                  style={{
                    left: `${anchorCenter}px`,
                    visibility: overlap ? 'visible' : 'hidden',
                    opacity: overlap ? 1 : 0,
                  }}
                >
                  {sameValue ? minTxt : `${minTxt} – ${maxTxt}`}
                </div>
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.label} title="Filter start date">Start date</div>
              <input
                className={styles.dateInput}
                id="filter-start-date"
                name="startDate"
                type="date"
                value={defaultFilters?.startDate || ''}
                min={filterBounds?.minDate || undefined}
                max={filterBounds?.maxDate || undefined}
                aria-label="Filter start date"
                title="Filter start date"
                onChange={(e) => {
                  const minD = filterBounds?.minDate;
                  const maxD = filterBounds?.maxDate;
                  let v = e.target.value;
                  if (minD && v < minD) v = minD;
                  if (maxD && v > maxD) v = maxD;
                  clampAndSend({ startDate: v }, 'start_date');
                }}
              />
            </div>
            <div className={styles.field}>
              <div className={styles.label} title="Filter end date">End date</div>
              <input
                className={styles.dateInput}
                id="filter-end-date"
                name="endDate"
                type="date"
                value={defaultFilters?.endDate || ''}
                min={filterBounds?.minDate || undefined}
                max={filterBounds?.maxDate || undefined}
                aria-label="Filter end date"
                title="Filter end date"
                onChange={(e) => {
                  const minD = filterBounds?.minDate;
                  const maxD = filterBounds?.maxDate;
                  let v = e.target.value;
                  if (minD && v < minD) v = minD;
                  if (maxD && v > maxD) v = maxD;
                  clampAndSend({ endDate: v }, 'end_date');
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className={styles.primaryBtn}
                onClick={resetFilters}
                aria-label="Reset filters to defaults"
                title="Reset filters to defaults"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort popover */}
      {sortOpen && (
        <div className={styles.popover} role="dialog" aria-modal="true" aria-label="Sort options">
          <div className={styles.popHeader}>
            <div>Sort By</div>
            <button
              className={`${styles.iconBtn} ${styles.closeBtn}`}
              onClick={() => setSortOpen(false)}
              aria-label="Close sort options"
              title="Close"
            >
              ×
            </button>
          </div>
          <div className={styles.popBody}>
            {/** Helper to humanize order labels */}
            {(() => null)()}
            {/** List of criteria with order toggles */}
            <div className={styles.sortList} role="menu" aria-label="Sort criteria">
              {[
                { key: 'time', label: 'Event time' },
                { key: 'mag', label: 'Magnitude' },
                { key: 'depth', label: 'Depth' },
              ].map((opt) => {
                const active = sortBy === opt.key;
                const nextOrder = active ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
                const arrow = active
                  ? sortOrder === 'asc'
                    ? '↑'
                    : '↓'
                  : nextOrder === 'asc'
                  ? '↑'
                  : '↓';
                const orderLabel = (k, ord) => {
                  if (k === 'time') return ord === 'asc' ? 'Oldest First' : 'Newest First';
                  if (k === 'depth') return ord === 'asc' ? 'Shallowest First' : 'Deepest First';
                  return ord === 'asc' ? 'Lowest First' : 'Highest First';
                };
                const labelText = active
                  ? orderLabel(opt.key, sortOrder)
                  : orderLabel(opt.key, nextOrder);
                return (
                  <div
                    key={opt.key}
                    className={`${styles.sortRow} ${active ? styles.sortRowActive : ''}`}
                    role="menuitemradio"
                    aria-checked={active}
                    aria-label={`Sort criterion: ${opt.label}`}
                  >
                    <button
                      onClick={() =>
                        onSortChange &&
                        onSortChange({ by: opt.key, order: active ? sortOrder : sortOrder })
                      }
                      aria-label={`Sort by ${opt.label}`}
                      title={`Sort by ${opt.label}`}
                      className={styles.sortLeftBtn}
                    >
                      {opt.label}
                    </button>
                    <div className={styles.sortRight}>
                      <button
                        className={`${styles.orderText} ${styles.orderTextBtn}`}
                        onClick={() =>
                          onSortChange && onSortChange({ by: opt.key, order: nextOrder })
                        }
                        aria-label={`Flip order: ${orderLabel(opt.key, nextOrder)}`}
                        title={`Flip order: ${orderLabel(opt.key, nextOrder)}`}
                      >
                        {labelText}
                      </button>
                      <button
                        className={styles.sortToggleBtn}
                        aria-label={`Flip order: ${orderLabel(opt.key, nextOrder)}`}
                        onClick={() =>
                          onSortChange && onSortChange({ by: opt.key, order: nextOrder })
                        }
                        title={`Flip order: ${orderLabel(opt.key, nextOrder)}`}
                      >
                        <span aria-hidden>{arrow}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.sortFooter}>
              <button
                className={styles.primaryBtn}
                onClick={() => {
                  onSortChange && onSortChange({ by: 'time', order: 'desc' });
                }}
                aria-label="Reset sort to default"
                title="Reset sort to default"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SidebarInfo;
