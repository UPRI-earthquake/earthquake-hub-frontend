import React, { useMemo } from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { BASEMAPS } from '../../config/mapLayers';

const { BaseLayer } = LayersControl;

/**
 * Basemap options for the map. Uses leaflet-providers via config to render OSM,
 * CARTO light/dark, and Esri World Imagery.
 */
export default function BasemapLayers({ bases: basesProp }) {
  const bases = useMemo(
    () =>
      basesProp || {
        osm: BASEMAPS.OSM_Standard(),
        positron: BASEMAPS.Carto_Positron(),
        dark: BASEMAPS.Carto_DarkMatter(),
        esri: BASEMAPS.Esri_WorldImagery(),
      },
    [basesProp],
  );

  return (
    <>
      <BaseLayer name="Standard Map">
        <TileLayer url={bases.osm.url} {...bases.osm.options} />
      </BaseLayer>
      <BaseLayer checked name="Light Map">
        <TileLayer url={bases.positron.url} {...bases.positron.options} />
      </BaseLayer>
      <BaseLayer name="Dark Map">
        <TileLayer url={bases.dark.url} {...bases.dark.options} />
      </BaseLayer>
      <BaseLayer name="Satellite View">
        <TileLayer url={bases.esri.url} {...bases.esri.options} />
      </BaseLayer>
    </>
  );
}
