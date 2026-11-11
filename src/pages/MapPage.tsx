import Header from "@/layouts/Header";
import { MapViewProvider } from "@/features/map/contexts/MapViewContext";
import MapView from "@/features/map/ui/components/MapView";
import { EarthquakesProvider } from "@/features/map/contexts/EarthquakesContext";

export default function MapPage() {
    return <>
        <Header />
        <MapViewProvider>
            <MapView />
        </MapViewProvider>
    </>
}