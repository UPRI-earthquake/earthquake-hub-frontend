import { sendAPIRequestFromReactQuery } from "@/shared/api";
import { useQuery } from "@tanstack/react-query";

interface UseRemoteGetWaveformProps {
  stationCodeUpper: string;
  startTime: string;
  endTime: string;
}

export function useRemoteGetWaveform({ stationCodeUpper, startTime, endTime }: UseRemoteGetWaveformProps) {
  return useQuery({
    retry: false,
    queryKey: [ "waveform", stationCodeUpper, startTime, endTime ],
    queryFn: async () => {
      const response = await sendAPIRequestFromReactQuery({ 
        host: "fdsnws",
        path: `/dataselect/1/query`,
        params: {
          starttime: startTime,
          endtime: endTime,
          network: "AM",
          station: stationCodeUpper,
          location: "00",
          channel: "*",
          nodata: 404
        }
      });

      return response.payload;
    }
  })
}



interface UseRemoteGetWaveformRSProps {
  stationCodeUpper: string;
  startTime: string;
  endTime: string;
}

export function useRemoteGetWaveformRS({ stationCodeUpper, startTime, endTime }: UseRemoteGetWaveformRSProps) {
  return useQuery({
    retry: false,
    enabled: false,
    queryKey: [ "waveform-rs", stationCodeUpper, startTime, endTime ],
    queryFn: async () => {
      const response = await sendAPIRequestFromReactQuery({ 
        host: "fdsnws-rs",
        path: `/dataselect/1/query`,
        params: {
          starttime: startTime,
          endtime: endTime,
          network: "AM",
          station: stationCodeUpper,
          location: "00",
          channel: "*",
          nodata: 404
        }
      });

      return response.payload;
    }
  })
}