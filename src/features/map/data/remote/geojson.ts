import { sendAPIRequestFromReactQuery } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";

import type { FeatureCollection } from "geojson";

export function useRemoteGetGeoJSON(path: string) {
  return useQuery({
    queryKey: [ "geojson", path ],
    queryFn: async () => {
      return await sendAPIRequestFromReactQuery<never, FeatureCollection>({
        host: "backend",
        path
      });
    }
  });
}