import React, { useMemo } from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { BASEMAPS } from '@/config/mapLayers';
import { useOverlayState } from '@/features/map/hooks/useOverlayState';

const { BaseLayer } = LayersControl;

/**
 * Basemap options for the map. Uses leaflet-providers via config to render
 * CARTO light/dark (auto-selected), Esri World Topo Map, and Esri World Imagery.
 */
export default function BasemapLayer() {
  const bases = useMemo(
    () =>
      ({
        defaultLight: BASEMAPS.Carto_Positron(),
        defaultDark: BASEMAPS.Carto_DarkMatter(),
        terrain: BASEMAPS.Esri_WorldTopoMap(),
        satellite: BASEMAPS.Esri_WorldImagery(),
      }),
    []
  );

  const { registerBaseLayer, activeBase } = useOverlayState();

  const attach = (key) => (layer) => {
    if (typeof registerBaseLayer === 'function') {
      registerBaseLayer(key, layer);
    }
  };

  return (
    <>
      <BaseLayer checked={activeBase === 'terrain'} name="Terrain">
        <TileLayer ref={attach('terrain')} url={bases.terrain.url} {...bases.terrain.options} />
      </BaseLayer>
      <BaseLayer checked={activeBase === 'satellite'} name="Satellite">
        <TileLayer
          ref={attach('satellite')}
          url={bases.satellite.url}
          {...bases.satellite.options}
        />
      </BaseLayer>
    </>
  );
}