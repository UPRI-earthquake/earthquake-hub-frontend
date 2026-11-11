import { useSearchParams } from "react-router-dom";
import Header from "@/layouts/Header";
import EarthquakeDetailsView from "@/features/earthquake-details/ui/components/EarthquakeDetailsView";
import { EarthquakeInfoProvider } from "@/features/earthquake-details/contexts/EarthquakeInfoContext";

export default function EarthquakeDetailsPage() {
    const [searchParams] = useSearchParams();
    const eventPublicId = searchParams.get('id');

    return <>
        <Header />
        <EarthquakeInfoProvider eventPublicId={eventPublicId}>
            <EarthquakeDetailsView />
        </EarthquakeInfoProvider>
    </>
}