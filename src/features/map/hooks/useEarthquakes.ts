import { useContext } from "react";
import { EarthquakesContext } from "../contexts/EarthquakesContext";

export default function useEarthquakes() {
    const context = useContext(EarthquakesContext);

    if(!context) {
        throw new Error("useEarthquakes must be used inside EarthquakesProvider");
    }

    return context;
};