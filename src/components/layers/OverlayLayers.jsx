import React, { useMemo } from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import RemoteGeoJSONOverlay from '../RemoteGeoJSONOverlay';
import { buildFaultTooltip, buildPlateTooltip } from './overlayTooltips';
import { DATASETS } from '../../config/datasets';
import { OVERLAYS } from '../../config/mapLayers';

const { Overlay } = LayersControl;

/**
 * Overlay layers: faults, plates, and optional population density.
 * Expects refs setters and helpers from the parent MapLayersControl to keep
 * style and legend state in sync.
 */
export default function OverlayLayers({
  setFaultsRef,
  setPlatesRef,
  setPopRef,
  faultsStyleFor,
  platesStyleFor,
  makeOnEachWith,
}) {
  const pop = useMemo(() => OVERLAYS.PopulationDensity_XYZ(), []);
  // Use a single shared Canvas renderer with a higher click/hover tolerance
  // so both Faults and Plates participate in the same hit-testing layer.
  const vectorRenderer = useMemo(() => L.canvas({ padding: 0.5, tolerance: 12 }), []);

  return (
    <>
      <Overlay name="Fault Lines">
        <RemoteGeoJSONOverlay
          ref={setFaultsRef}
          url={DATASETS.FAULTS.cdnUrl}
          style={faultsStyleFor}
          renderer={vectorRenderer}
          // Philippines bbox (lon/lat): 116..127E, 4.5..21.5N
          filterBbox={[116, 4.5, 127, 21.5]}
          lineOnly
          interactive
          onEachFeature={makeOnEachWith(
            faultsStyleFor,
            buildFaultTooltip,
            'fault-hovering',
            { usePopup: true }
          )}
        />
      </Overlay>

      <Overlay name="Plate Boundaries">
        <RemoteGeoJSONOverlay
          ref={setPlatesRef}
          url={DATASETS.PLATES.cdnUrl}
          style={platesStyleFor}
          renderer={vectorRenderer}
          worldCopies
          lineOnly
          interactive
          onEachFeature={makeOnEachWith(platesStyleFor, buildPlateTooltip, null, { usePopup: true })}
        />
      </Overlay>

      {pop && pop.url ? (
        <Overlay name="Population Density">
          <TileLayer ref={setPopRef} url={pop.url} {...(pop.options || {})} />
        </Overlay>
      ) : null}
    </>
  );
}
