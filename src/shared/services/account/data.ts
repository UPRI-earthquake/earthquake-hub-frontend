import { sendAPIRequestFromReactQuery } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";

interface RemoteGetProfileResponse {
    status: number;
    message: string;
    payload?: {
        username: string;
        email: string;
        roles: ("brgy" | "citizen" | "sensor")[];
        passwordPolicyVersion: number;
        passwordUpdatedAt: string;
        passwordStatus: string;
        alertPreferences: {
            rshakeEmailEnabled: boolean;
            updatedAt: string | null;
        }
    }
}


export default function useRemoteGetProfile(enabled: boolean = true) {
  return useQuery({
    queryKey: [ "profile" ],
    enabled,
    queryFn: async () => {
      const response = await sendAPIRequestFromReactQuery<any, RemoteGetProfileResponse>({ 
        host: "backend",
        path: `/accounts/profile`
      });

      return response.payload || null;
    }
  });
}