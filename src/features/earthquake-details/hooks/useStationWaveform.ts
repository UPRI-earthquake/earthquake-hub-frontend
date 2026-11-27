import { useEffect, useMemo, useState } from "react";
import { useRemoteGetWaveform, useRemoteGetWaveformRS } from "../data/waveform";
import { createWaveformDisplay, parseMiniSeedRecords } from "../services/recordings";

interface UseStationWaveformProps {
  stationCodeUpper: string;
  startTime: string;
  endTime: string;
}

interface UseStationWaveformReturn {
  isLoading: boolean;
  waveformData?: ReturnType<typeof createWaveformDisplay> & {
    timestamp: string;
    isDemoData: boolean;
    source: "primary" | "rs";
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


  const { refetch: refetchBackup } = remoteBackup;
  useEffect(() => {
    // If primary provider fails to load waveform, try raspberryshake (rs)
    if(!remote.isLoading && !remote.data) {
      setProvider("rs");
      refetchBackup();
    }
  }, [remote.isLoading, remote.data, refetchBackup])

  const fetchedData = provider === "primary" ? remote.data : remoteBackup.data;

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