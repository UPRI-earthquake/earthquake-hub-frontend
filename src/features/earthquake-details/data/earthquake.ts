import { sendAPIRequestFromReactQuery } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { EarthquakeInfo, RelatedEarthquakeEntry } from "../types/earthquake";

interface RemoteGetEarthquakeInfoResponse {
  status: number;
  message: string;
  payload: EarthquakeInfo;
}

export function useRemoteGetEartquakeInfo(eventPublicId: string) {
  return useQuery({
    queryKey: [ "earthquake-info", eventPublicId ],
    queryFn: async () => {
      const response = await sendAPIRequestFromReactQuery<any, RemoteGetEarthquakeInfoResponse>({ 
        host: "backend",
        path: `/eq-events/${encodeURIComponent(eventPublicId)}`
      });

      return response.payload;
    }
  })
}


interface RemoteGetRelatedEarthquakesResponse {
  status: number;
  message: string;
  payload: RelatedEarthquakeEntry[];
}

export function useRemoteGetRelatedEarthquakesInfo(startTime: string, endTime: string) {
  return useQuery({
    queryKey: [ "related-earthquakes", startTime, endTime ],
    queryFn: async () => {
      const response = await sendAPIRequestFromReactQuery<any, RemoteGetRelatedEarthquakesResponse>({ 
        host: "backend",
        path: `/eq-events/?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
      });

      return response.payload;
    }
  })
}
