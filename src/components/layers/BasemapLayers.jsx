import React, { useMemo } from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { BASEMAPS } from '../../config/mapLayers';

const { BaseLayer } = LayersControl;

/**
 * Basemap options for the map. Uses leaflet-providers via config to render
 * optional CARTO light/dark, Esri World Topo Map, and Esri World Imagery.
 */
export default function BasemapLayers({
  bases: basesProp,
  registerBaseLayer,
  activeTheme = 'light',
  activeBase = 'default',
  defaultBasemapEnabled = true,
}) {
  const bases = useMemo(
    () =>
      basesProp || {
        defaultLight: BASEMAPS.Carto_Positron(),
        defaultDark: BASEMAPS.Carto_DarkMatter(),
        terrain: BASEMAPS.Esri_WorldTopoMap(),
        satellite: BASEMAPS.Esri_WorldImagery(),
      },
    [basesProp],
  );

  const resolvedTheme = String(activeTheme || '').toLowerCase() === 'dark' ? 'dark' : 'light';
  const defaultVariant = resolvedTheme === 'dark' ? 'defaultDark' : 'defaultLight';
  const defaultProps =
    defaultVariant === 'defaultDark' ? bases.defaultDark || {} : bases.defaultLight || {};

  const attach = (key) => (layer) => {
    if (typeof registerBaseLayer === 'function') {
      registerBaseLayer(key, layer);
    }
  };

  return (
    <>
      {defaultBasemapEnabled ? (
        <BaseLayer checked={activeBase === 'default'} name="Default">
          <TileLayer
            ref={attach('default')}
            url={defaultProps.url}
            {...defaultProps.options}
            key={`default-${defaultVariant}`}
          />
        </BaseLayer>
      ) : null}
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
