import { sendAPIRequestFromReactQuery } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";
import { Station } from "../types/station";

interface RemoteGetStationsResponse {
  status: number;
  message: string;
  payload: Station[];
}

export function useRemoteGetStations() {
  return useQuery({
    queryKey: [ "all-stations" ],
    queryFn: async () => {
      const response = await sendAPIRequestFromReactQuery<any, RemoteGetStationsResponse>({ 
        host: "backend",
        path: `/device/all`
      });

      return response.payload;
    }
  })
}