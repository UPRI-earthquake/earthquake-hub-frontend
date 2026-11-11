import { sendAPIRequestThrowsException } from "@/shared/api";
import moment from "@/shared/utils/time";
import { EarthquakesDataFilter, EarthquakeShortInfo } from "../../types/earthquake";

export default class RemoteEventsDataHandler {
  async fetchEarthquakes(filters: EarthquakesDataFilter): Promise<EarthquakeShortInfo[]> {
    const startTs = filters.startDate ? moment(filters.startDate).startOf('day').format('YYYY-MM-DD HH:mm:ss') : '1900-01-01 00:00:00';
    const endTs = moment(filters.endDate).endOf('day').format('YYYY-MM-DD HH:mm:ss');

    const response = await sendAPIRequestThrowsException({
      host: "backend",
      path: "/eq-events",
      responseType: "json",
      params: {
        startTime: startTs,
        endTime: endTs,
      }
    });

    return response.data.payload || [];

  }
}