import React, { useMemo } from 'react';
import { LayersControl } from 'react-leaflet';
import L from 'leaflet';
import RemoteGeoJSONOverlay from '../RemoteGeoJSONOverlay';
import {
  buildFaultTooltip,
  buildPlateTooltip,
  buildFaultTitle,
  buildPlateTitle,
} from './overlayTooltips';
import { DATASETS } from '../../config/datasets';

const { Overlay } = LayersControl;

/**
 * Overlay layers: faults and plates.
 * Expects refs setters and helpers from the parent MapLayersControl to keep
 * style and legend state in sync.
 */
export default function OverlayLayers({
  setFaultsRef,
  setPlatesRef,
  faultsStyleFor,
  platesStyleFor,
  makeOnEachWith,
}) {
  // Use a single shared Canvas renderer with a higher click/hover tolerance
  // so both Faults and Plates participate in the same hit-testing layer.
  const vectorRenderer = useMemo(() => L.canvas({ padding: 0.5, tolerance: 12 }), []);

  return (
    <>
      <Overlay name="Fault Lines" checked>
        <RemoteGeoJSONOverlay
          ref={setFaultsRef}
          url={DATASETS.FAULTS.url}
          style={faultsStyleFor}
          renderer={vectorRenderer}
          // Philippines bbox (lon/lat): 116..127E, 4.5..21.5N
          filterBbox={[116, 4.5, 127, 21.5]}
          lineOnly
          interactive
          onEachFeature={makeOnEachWith(
            faultsStyleFor,
            buildFaultTooltip,
            null,
            { usePopup: true, nativeTitleFn: buildFaultTitle, disableHoverStyling: true }
          )}
        />
      </Overlay>

      <Overlay name="Plate Boundaries" checked>
        <RemoteGeoJSONOverlay
          ref={setPlatesRef}
          url={DATASETS.PLATES.url}
          style={platesStyleFor}
          renderer={vectorRenderer}
          worldCopies
          lineOnly
          interactive
          onEachFeature={makeOnEachWith(
            platesStyleFor,
            buildPlateTooltip,
            null,
            { usePopup: true, nativeTitleFn: buildPlateTitle, disableHoverStyling: true }
          )}
        />
      </Overlay>

      {/* Population overlay removed */}
    </>
  );
}
