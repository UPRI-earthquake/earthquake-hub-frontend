import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { LayersControl, TileLayer, useMap } from 'react-leaflet';
import { BASEMAPS, OVERLAYS, styles } from '../config/mapLayers';
import './mapLayers.css';
import RemoteGeoJSONOverlay from './RemoteGeoJSONOverlay';
import { useOverlayState } from './OverlayStateContext';

const { BaseLayer, Overlay } = LayersControl;

export default function MapLayersControl({ children }) {
  const map = useMap();
  const { registerLayer } = useOverlayState();
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

  // Refs for registering overlays with the legend sync
  const faultsRef = useRef(null);
  const platesRef = useRef(null);
  const popRef = useRef(null);

  const setFaultsRef = useCallback((node) => {
    const layer = node && (node.leafletElement || node);
    faultsRef.current = layer;
    if (layer) registerLayer('faults', layer);
  }, [registerLayer]);

  const setPlatesRef = useCallback((node) => {
    const layer = node && (node.leafletElement || node);
    platesRef.current = layer;
    if (layer) registerLayer('plates', layer);
  }, [registerLayer]);

  const setPopRef = useCallback((node) => {
    const layer = node && (node.leafletElement || node);
    popRef.current = layer;
    if (layer) registerLayer('population', layer);
  }, [registerLayer]);

  // Tooltip for the layers toggle button
  useEffect(() => {
    if (!map) return undefined;
    // Defer to next tick to ensure control is in the DOM
    const id = setTimeout(() => {
      const container = map.getContainer ? map.getContainer() : document;
      const btn = container && container.querySelector('.leaflet-control-layers-toggle');
      if (btn) {
        btn.setAttribute('title', 'Toggle layers');
        btn.setAttribute('aria-label', 'Toggle layers');
      }
    }, 0);
    return () => clearTimeout(id);
  }, [map]);

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
          ref={setFaultsRef}
          url="https://cdn.jsdelivr.net/gh/GEMScienceTools/gem-global-active-faults@master/geojson/gem_active_faults_harmonized.geojson"
          style={styles.faults}
          // Philippines bbox (lon/lat): 116..127E, 4.5..21.5N
          filterBbox={[116, 4.5, 127, 21.5]}
          lineOnly
        />
      </Overlay>

      <Overlay name="Plate Boundaries">
        <RemoteGeoJSONOverlay
          ref={setPlatesRef}
          url="https://cdn.jsdelivr.net/gh/fraxen/tectonicplates@master/GeoJSON/PB2002_boundaries.json"
          style={styles.plates}
          lineOnly
        />
      </Overlay>

      {pop && pop.url ? (
        <Overlay name="Population Density">
          <TileLayer ref={setPopRef} url={pop.url} {...(pop.options || {})} />
        </Overlay>
      ) : null}

      {/* Inject external overlays from parent (e.g., Stations, Earthquakes) */}
      {children}
    </LayersControl>
  );
}
