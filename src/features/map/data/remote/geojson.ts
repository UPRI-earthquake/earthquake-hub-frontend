import { sendAPIRequestFromReactQuery } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";

interface RemoteGetGeoJSONResponse {
  type: string;
  features: {
    type: string;
    properties: any;
    geometry: any;
  }[];
}

export function useRemoteGetGeoJSON(path: string) {
  return useQuery({
    queryKey: [ "geojson", path ],
    queryFn: async () => {
      return await sendAPIRequestFromReactQuery<any, RemoteGetGeoJSONResponse>({ 
        host: "backend",
        path
      });
    }
  });
}