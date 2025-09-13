import React, { useMemo, useState, useEffect, useRef } from "react";
import styles from "./SidebarInfo.module.css";

// Simple inline icons to avoid adding dependencies
const CaretIcon = ({ className }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
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

function SidebarInfo({
  title = "Latest Earthquakes, Past 30 Days",
  collapsed = false,
  // onToggle now opens presets dropdown
  onToggle = () => {},
  searchText,
  onSearch,
  defaultFilters,
  onFiltersChange,
  onPresetChange,
  selectedPresetKey,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef(null);
  const [local, setLocal] = useState(() => ({
    magMin: 0,
    startDate: '',
    endDate: ''
  }));

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

  // Initialize local filter defaults from parent
  useEffect(() => {
    if (defaultFilters) {
      setLocal(prev => ({ ...prev, ...defaultFilters }));
    }
  }, [defaultFilters]);

  // Close menus on outside interactions
  useEffect(() => {
    const onDoc = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) {
        setMenuOpen(false);
        setFiltersOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenuOpen(false); setFiltersOpen(false); }
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

  const applyFilters = () => {
    onFiltersChange && onFiltersChange(local);
    setFiltersOpen(false);
  };

  const clamp01 = (n) => Math.max(0, Math.min(10, n));
  const handleLocalChange = (patch) => setLocal(prev => ({ ...prev, ...patch }));
  const setMagMin = (val) => setLocal(prev => {
    const v = clamp01(val);
    const max = typeof prev.magMax === 'number' ? prev.magMax : 10;
    return { ...prev, magMin: Math.min(v, max) };
  });
  const setMagMax = (val) => setLocal(prev => {
    const v = clamp01(val);
    const min = typeof prev.magMin === 'number' ? prev.magMin : 0;
    return { ...prev, magMax: Math.max(v, min) };
  });

  const containerCls = useMemo(() => (
    `${styles.sidebarInfo} ${collapsed ? styles.collapsed : ''}`
  ), [collapsed]);

  const min = typeof local.magMin === 'number' ? local.magMin : 0;
  const max = typeof local.magMax === 'number' ? local.magMax : 10;
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
    const measure = () => setBubbleSizes({
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
  const overlap = (minCenter + bubbleSizes.min / 2 + bubbleGap) > (maxCenter - bubbleSizes.max / 2);
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
  const sideMargin = 6;   // keep off container edges
  const edgeNudge = 6;    // aesthetic nudge away from the extreme
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
    if (dMin <= dMax) setMagMin(v); else setMagMax(v);
  };
  const onTrackMouseDown = (e) => { jumpNearest(e.clientX); };
  const onTrackTouchStart = (e) => {
    if (e.touches && e.touches[0]) jumpNearest(e.touches[0].clientX);
    e.preventDefault();
  };

  return (
    <div className={containerCls} ref={rootRef}>
      <div className={styles.headerRow}>
        <button
          className={styles.titleBtn}
          onClick={() => {
            setFiltersOpen(false); // collapse filter when opening presets
            setMenuOpen(v => !v);
          }}
          aria-expanded={menuOpen ? 'true' : 'false'}
        >
          <CaretIcon className={styles.caret} />
          <span>{title}</span>
        </button>
        <div className={styles.tools}>
          {/* Reserved for future buttons if needed */}
        </div>
      </div>

      {/* Preset dropdown */}
      {menuOpen && (
        <div className={styles.menu} role="menu">
          {[
            { key: 'latest-30d', label: 'Latest Earthquakes (30 days)', tip: 'Past 30 days, all magnitudes' },
            { key: 'major-2022-2023', label: 'Major Earthquakes (2022–2023)', tip: 'Curated top significant earthquakes from 2022–2023' },
            { key: 'year-2025', label: '2025 Earthquakes', tip: 'All earthquakes in 2025' },
            { key: 'year-2024', label: '2024 Earthquakes', tip: 'All earthquakes in 2024' },
          ].map(opt => (
            <button
              key={opt.key}
              className={`${styles.menuItem} ${selectedPresetKey === opt.key ? styles.menuItemSelected : ''}`}
              role="menuitemradio"
              aria-checked={selectedPresetKey === opt.key ? 'true' : 'false'}
              data-tip={opt.tip}
              onClick={() => {
              onPresetChange && onPresetChange(opt.key);
              setMenuOpen(false);
            }}
            >{opt.label}</button>
          ))}
        </div>
      )}

      {/* Search + Filter row */}
      {!collapsed && (
        <div className={styles.searchWrap}>
          <div className={styles.search}>
            <SearchIcon />
            <input
              type="text"
              placeholder="Search"
              value={searchText || ''}
              onChange={(e) => onSearch && onSearch(e.target.value)}
              aria-label="Search earthquakes"
            />
          </div>
          <button
            className={styles.iconBtn}
            onClick={() => { setMenuOpen(false); setFiltersOpen(v => !v); }}
            aria-expanded={filtersOpen ? 'true' : 'false'}
            aria-label="Open filters"
          >
            <FunnelIcon />
          </button>
        </div>
      )}

      {/* Filter popover */}
      {filtersOpen && (
        <div className={styles.popover} role="dialog" aria-modal="true">
          <div className={styles.popHeader}>
            <div>Filter</div>
            <button className={styles.iconBtn} onClick={() => setFiltersOpen(false)} aria-label="Close filters">
              <FunnelIcon />
            </button>
          </div>
          <div className={styles.popBody}>
            <div className={styles.field}>
              <div className={styles.label}>Magnitude</div>
              <div className={styles.rangeWrap} ref={rangeWrapRef}>
                <div className={styles.rangeTrack} onMouseDown={onTrackMouseDown} onTouchStart={onTrackTouchStart}>
                  {/* Paint highlight exactly between min and max using a gradient */}
                  <div
                    className={styles.rangeHighlight}
                    style={{
                      background: `linear-gradient(to right, 
                        transparent ${minPct}%,
                        var(--accent) ${minPct}%,
                        var(--accent) ${maxPct}%,
                        transparent ${maxPct}%
                      )`
                    }}
                  />
                </div>
                <input type="range" min="0" max="10" step="0.1"
                  value={min}
                  onChange={(e) => setMagMin(parseFloat(e.target.value))}
                  style={{ zIndex: (min === max && max === 10) ? 3 : 2 }}
                  aria-label="Minimum magnitude"
                />
                <input type="range" min="0" max="10" step="0.1"
                  value={max}
                  onChange={(e) => setMagMax(parseFloat(e.target.value))}
                  style={{ zIndex: (min === max && min === 0) ? 3 : 2 }}
                  aria-label="Maximum magnitude"
                />
                {/* Individual bubbles (kept in DOM for measurement) */}
                <div
                  ref={minBubbleRef}
                  className={styles.bubble}
                  style={{ left: bubbleLeftPx(min), visibility: overlap ? 'hidden' : 'visible', opacity: overlap ? 0 : 1 }}
                >{minTxt}</div>
                <div
                  ref={maxBubbleRef}
                  className={styles.bubble}
                  style={{ left: bubbleLeftPx(max), visibility: overlap ? 'hidden' : 'visible', opacity: overlap ? 0 : 1 }}
                >{maxTxt}</div>
                {/* Combined bubble when the two would overlap */}
                <div
                  ref={comboBubbleRef}
                  className={styles.bubble}
                  style={{ left: `${anchorCenter}px`, visibility: overlap ? 'visible' : 'hidden', opacity: overlap ? 1 : 0 }}
                >{sameValue ? minTxt : `${minTxt} – ${maxTxt}`}</div>
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.label}>Start date</div>
              <input className={styles.dateInput} type="date"
                value={local.startDate}
                onChange={(e) => handleLocalChange({ startDate: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <div className={styles.label}>End date</div>
              <input className={styles.dateInput} type="date"
                value={local.endDate}
                onChange={(e) => handleLocalChange({ endDate: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className={styles.primaryBtn} onClick={applyFilters} aria-label="Apply filters">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SidebarInfo;
