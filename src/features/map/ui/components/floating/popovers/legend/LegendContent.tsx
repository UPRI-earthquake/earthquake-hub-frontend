import { useEffect, useMemo, useRef, useState } from "react";
import InfoTooltip from "@/shared/ui/components/InfoTooltip";
import META from "../../../../../configs/meta";
import { getLastUpdated, partsForCdnUrl } from "../../../../../services/lastUpdated";
import { useMap } from "react-leaflet";
import { DEPTH_RAMP, themeFromMapContainer } from "../../../../../services/mapStyles";
import { buildTriangleSVG } from "@/shared/utils/triangleMarker";

interface LegendContentProps {
  active: Set<"faults" | "plates" | "par" | "stations" | "earthquakes">;
  tokens: any;
}

export default function LegendContent({ active, tokens }: LegendContentProps) {
  // Build a small map of active overlays we support
  const shown = useMemo(
    () => ({
      faults: active.has('faults'),
      plates: active.has('plates'),
      par: active.has('par'),
      // Population overlay removed
      stations: active.has('stations'),
      earthquakes: active.has('earthquakes'),
    }),
    [active],
  );

  // Try to compute last-updated for each where possible
  // Population overlay removed

  const faultsLU = useLastUpdatedGitHubFirst(shown.faults ? META.faults.lastUpdateHintUrl : null);
  const platesLU = useLastUpdatedGitHubFirst(shown.plates ? META.plates.lastUpdateHintUrl : null);
  // Population overlay removed

  // Legend is display-only; no overlay toggling here for clarity

  const anyShown = shown.faults || shown.plates || shown.par || shown.stations || shown.earthquakes;
  const renderLastUpdated = (meta) => {
    if (!meta) return 'Last updated: Unknown';
    const base = meta.displayDate ? `Last updated: ${meta.displayDate}` : 'Last updated: Unknown';
    if (meta.source === 'cdn') return `${base} (CDN header)`;
    return base;
  };
  const renderMetaTooltip = (meta, lastUpdated) => (
    <InfoTooltip label={`${meta.label} details`} title="Dataset details" variant="inline">
      <>
        Source: {meta.source}
        <br />
        {renderLastUpdated(lastUpdated)}
      </>
    </InfoTooltip>
  );

  return (
    <div className="map-legend" role="region" aria-label="Map legend">
      {!anyShown && <div className="legend-empty">No overlays enabled</div>}
      {shown.faults && (
        <div className="legend-section" data-key="faults">
          <div className="legend-meta">
            <div className="legend-label-row">
              <div className="legend-label">{META.faults.label}</div>
              {renderMetaTooltip(META.faults, faultsLU)}
            </div>
            <div className="legend-symbol-row">
              <span
                className="swatch-line"
                style={{
                  background: tokens.faults.color,
                  opacity: tokens.faults.opacity,
                  height: 0,
                  borderTop: `${Math.max(2, (tokens.faults.weight || 1) * 2)}px ${
                    tokens.faults.dashArray ? 'dashed' : 'solid'
                  } ${tokens.faults.color}`,
                }}
              />
            </div>
          </div>
        </div>
      )}
      {shown.plates && (
        <div className="legend-section" data-key="plates">
          <div className="legend-meta">
            <div className="legend-label-row">
              <div className="legend-label">{META.plates.label}</div>
              {renderMetaTooltip(META.plates, platesLU)}
            </div>
            <div className="legend-symbol-row">
              <span
                className="swatch-line"
                style={{
                  borderTop: `${Math.max(2, (tokens.plates.weight || 1) * 2)}px ${
                    tokens.plates.dashArray ? 'dashed' : 'solid'
                  } ${tokens.plates.color}`,
                  opacity: tokens.plates.opacity,
                }}
              />
            </div>
          </div>
        </div>
      )}
      {shown.par && (
        <div className="legend-section" data-key="par">
          <div className="legend-meta">
            <div className="legend-label-row">
              <div className="legend-label">{META.par.label}</div>
              <InfoTooltip label={`${META.par.label} details`} title="Dataset details" variant="inline">
                <>
                  Source: {META.par.source}
                  <br />
                  Geometry follows official PAGASA PAR coordinates.
                </>
              </InfoTooltip>
            </div>
            <div className="legend-symbol-row">
              <span
                className="swatch-line"
                style={{
                  borderTop: `${Math.max(2, (tokens.par.weight || 1) * 2)}px ${
                    tokens.par.dashArray ? 'dashed' : 'solid'
                  } ${tokens.par.color}`,
                  opacity: tokens.par.opacity,
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Population overlay removed */}
      {shown.stations && (
        <div className="legend-section" data-key="stations">
          <div className="legend-meta">
            <div className="legend-label-row">
              <div className="legend-label">Stations</div>
            </div>
            <div className="legend-symbol-row">
              <div className="legend-depth">
                <div className="legend-subtitle">Status</div>
                <div className="legend-chip-row">
                  <span className="legend-chip">
                    <StationTriangleSwatch color={tokens.stations.fill} size={12} /> Online
                  </span>
                  <span className="legend-chip">
                    <StationTriangleSwatch color={tokens.stations.offlineFill} size={12} /> Offline
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {shown.earthquakes && (
        <div className="legend-section" data-key="earthquakes">
          <div className="legend-meta">
            <div className="legend-label-row">
              <div className="legend-label">Earthquakes</div>
              <InfoTooltip label="Earthquake marker details" title="Earthquake markers" variant="inline">
                Marker size reflects magnitude. Color reflects depth.
              </InfoTooltip>
            </div>
            <div className="legend-symbol-row">
              <DepthRampLegend />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Commit-first last updated for GitHub-backed CDN sources; falls back to HEAD Last-Modified
function useLastUpdatedGitHubFirst(url) {
  const [res, setRes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) return undefined;

    const controller = new AbortController();

    async function resolveLastModified() {
      try {
        const res = await getLastUpdated(partsForCdnUrl(url));
        if (!cancelled) setRes(res);
      } catch (e) {
        if (!cancelled) setRes(null);
      }
    }

    resolveLastModified();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  return res;
}

// Population HEAD Last-Modified helper removed

function DepthRampLegend() {
  const map = useMap();
  let theme = 'light';
  try {
    theme = themeFromMapContainer(map?.getContainer?.());
  } catch (_) {}
  const [c1, c2, c3] = (DEPTH_RAMP && DEPTH_RAMP[theme]) || DEPTH_RAMP.light;
  return (
    <div className="legend-depth">
      <div className="legend-subtitle">Depth (km)</div>
      <div className="legend-chip-row legend-chip-row-eq">
        <span className="legend-chip">
          <i style={{ background: c1 }} /> 0-70 km
        </span>
        <span className="legend-chip">
          <i style={{ background: c2 }} /> 70-300 km
        </span>
        <span className="legend-chip">
          <i style={{ background: c3 }} /> 300+ km
        </span>
      </div>
    </div>
  );
}

function StationTriangleSwatch({ color, size = 16 }) {
  const idRef = useRef(`legend-tri-${Math.random().toString(36).slice(2, 10)}`);
  const markup = useMemo(() => buildTriangleSVG(color, idRef.current), [color]);
  const height = Math.round(size * 0.92);
  return (
    <span
      className="station-triangle-swatch"
      aria-hidden="true"
      style={{ width: `${size}px`, height: `${height}px` }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

