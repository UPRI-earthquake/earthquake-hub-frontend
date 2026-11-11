import { sendAPIRequestThrowsException } from "@/shared/api";
import { Station } from "../../types/station";

interface StationStatusResponse {
  status: string;
  statusSince: string;
  activity?: "active" | "inactive" | null;
}

export default class RemoteStationsDataHandler {
  async fetchAllStations(): Promise<Station[]> {
    const response = await sendAPIRequestThrowsException({
      host: "backend",
      path: "/device/all",
      responseType: "json"
    });

    return response.data.payload || [];
  }

  async getStationStatus(stationCode: string, network: string): Promise<StationStatusResponse> {
    const response = await sendAPIRequestThrowsException({
      host: "backend",
      path: `/device/status?network=${network.toUpperCase()}&station=${stationCode.toUpperCase()}`,
      responseType: "json"
    });

    return response.data.payload;
  }
}