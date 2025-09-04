import React, { useMemo } from 'react';
import { LayersControl, TileLayer } from 'react-leaflet';
import { BASEMAPS, OVERLAYS, styles } from '../config/mapLayers';
import './mapLayers.css';
import RemoteGeoJSONOverlay from './RemoteGeoJSONOverlay';

const { BaseLayer, Overlay } = LayersControl;

export default function MapLayersControl({ children }) {
  // Memoize basemap provider props so layers are not recreated
  const bases = useMemo(
    () => ({
      osm: BASEMAPS.OSM_Standard(),
      positron: BASEMAPS.Carto_Positron(),
      dark: BASEMAPS.Carto_DarkMatter(),
      esri: BASEMAPS.Esri_WorldImagery(),
    }),
    []
  );

  const pop = useMemo(() => OVERLAYS.PopulationDensity_XYZ(), []);

  return (
    <LayersControl position="topright" collapsed>
      {/* Basemaps */}
      <BaseLayer name="OSM Standard">
        <TileLayer url={bases.osm.url} {...bases.osm.options} />
      </BaseLayer>

      <BaseLayer checked name="CartoDB Positron">
        <TileLayer url={bases.positron.url} {...bases.positron.options} />
      </BaseLayer>

      <BaseLayer name="CartoDB DarkMatter">
        <TileLayer url={bases.dark.url} {...bases.dark.options} />
      </BaseLayer>

      <BaseLayer name="Esri WorldImagery">
        <TileLayer url={bases.esri.url} {...bases.esri.options} />
      </BaseLayer>

      {/* Overlays */}
      <Overlay name="Fault Lines">
        <RemoteGeoJSONOverlay
          url="https://cdn.jsdelivr.net/gh/GEMScienceTools/gem-global-active-faults@master/geojson/gem_active_faults_harmonized.geojson"
          style={styles.faults}
          // Philippines bbox (lon/lat): 116..127E, 4.5..21.5N
          filterBbox={[116, 4.5, 127, 21.5]}
          lineOnly
        />
      </Overlay>

      <Overlay name="Plate Boundaries">
        <RemoteGeoJSONOverlay
          url="https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json"
          style={styles.plates}
          lineOnly
        />
      </Overlay>

      {pop && pop.url ? (
        <Overlay name="Population Density">
          <TileLayer url={pop.url} {...(pop.options || {})} />
        </Overlay>
      ) : null}

      {/* Inject external overlays from parent (e.g., Stations, Earthquakes) */}
      {children}
    </LayersControl>
  );
}
