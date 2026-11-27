import { useContext } from "react";
import { MapViewContext } from "../contexts/MapViewContext";

export default function useMapView() {
    const context = useContext(MapViewContext);

    if(!context) {
        throw new Error("useMapView must be used inside MapViewProvider");
    }

    return context;
};