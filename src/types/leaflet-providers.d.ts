import 'leaflet';

declare module 'leaflet' {
  namespace tileLayer {
    function provider(
      providerName: string,
      options?: L.TileLayerOptions
    ): L.TileLayer;
  }
}