import React, { useMemo } from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { BASEMAPS } from '../../config/mapLayers';

const { BaseLayer } = LayersControl;

/**
 * Basemap options for the map. Uses leaflet-providers via config to render OSM,
 * CARTO light/dark (auto-selected), and Esri World Imagery.
 */
export default function BasemapLayers({
  bases: basesProp,
  registerBaseLayer,
  activeTheme = 'light',
  activeBase = 'default',
}) {
  const bases = useMemo(
    () =>
      basesProp || {
        defaultLight: BASEMAPS.Carto_Positron(),
        defaultDark: BASEMAPS.Carto_DarkMatter(),
        streets: BASEMAPS.OSM_Standard(),
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
      <BaseLayer checked={activeBase === 'default'} name="Default">
        <TileLayer
          ref={attach('default')}
          url={defaultProps.url}
          {...defaultProps.options}
          key={`default-${defaultVariant}`}
        />
      </BaseLayer>
      <BaseLayer checked={activeBase === 'streets'} name="Streets">
        <TileLayer ref={attach('streets')} url={bases.streets.url} {...bases.streets.options} />
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
