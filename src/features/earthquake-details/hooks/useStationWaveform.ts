import { useCallback, useEffect, useMemo, useState } from "react";
import { useRemoteGetWaveform, useRemoteGetWaveformRS } from "../data/waveform";
import { createWaveformDisplay, parseMiniSeedRecords } from "../services/recordings";

interface UseStationWaveformProps {
  stationCodeUpper: string;
  startTime: string;
  endTime: string;
}

interface UseStationWaveformReturn {
  isLoading: boolean;
  waveformData?: {
    dataList: any;
    config: any;
    timestamp: string;
    isDemoData: boolean;
    source: "primary" | "rs";
    channels: any;
    channelSamples: {
      code: any;
      samples: any;
      segments: any;
      color: any;
    }[];
  } | null;
}

export default function useStationWaveform(params: UseStationWaveformProps): UseStationWaveformReturn {
  const { stationCodeUpper, startTime, endTime } = params;

  const remote = useRemoteGetWaveform({ stationCodeUpper, startTime, endTime });
  const remoteBackup = useRemoteGetWaveformRS({ stationCodeUpper, startTime, endTime });
  const [sp, setSP] = useState();
  const [provider, setProvider] = useState<"primary" | "rs">("primary");

  useEffect(() => {(async () => {
    setSP(await import('seisplotjs'));
  })()}, []);


  useEffect(() => {
    // If primary provider fails to load waveform, try raspberryshake (rs)
    if(!remote.isLoading && !remote.data) {
      setProvider("rs");
      remoteBackup.refetch();
    }
  }, [remote.isLoading, remote.data])

  const fetchedData = useMemo(() => provider === "primary" ? remote.data : remoteBackup.data, [provider]);

  const waveformData = useMemo(() => {
    if(!sp || !fetchedData) return null;

    const records = parseMiniSeedRecords(sp, fetchedData);
    const preparedWaveform = createWaveformDisplay(sp, records);
    return {
      dataList: preparedWaveform.dataList,
      config: preparedWaveform.config,
      timestamp: new Date().toISOString(),
      isDemoData: false,
      source: provider,
      channels: preparedWaveform.channels,
      channelSamples: preparedWaveform.channelSamples,
    };
  }, [sp, fetchedData, provider]);

  return {
    isLoading: provider === "primary" ? remote.isLoading : remoteBackup.isLoading,
    waveformData
  };
}