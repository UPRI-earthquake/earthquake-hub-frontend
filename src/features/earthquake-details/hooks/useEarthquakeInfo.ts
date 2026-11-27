import { useContext } from "react";
import { EarthquakeInfoContext } from "../contexts/EarthquakeInfoContext";

export default function useEarthquakeInfo() {
    const context = useContext(EarthquakeInfoContext);

    if(!context) {
        throw new Error("useEarthquakeInfo must be used inside EarthquakeInfoProvider");
    }

    return context;
};