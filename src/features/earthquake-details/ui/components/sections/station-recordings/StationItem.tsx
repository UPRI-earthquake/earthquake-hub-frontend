import { DEFAULT_WAVEFORM_CHANNELS } from "@/features/earthquake-details/constants/recordings";
import { buildStationFdsnDownloads, fetchAndDownload, formatChannelLabel, getPreferredChannelCode } from "@/features/earthquake-details/services/recordings";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiDownload } from "react-icons/fi";

import CompactWaveform from "./CompactWaveform";
import Button from "@/shared/ui/components/Button";
import useStationWaveform from "@/features/earthquake-details/hooks/useStationWaveform";

import styles from '../../../styles/sections/StationRecordingsSection.module.css';


export default function StationItem({
  stationCode,
  startTime, 
  endTime,
  stationIndex,
  earthquakeInfo,
  distanceLabel,
  isAvailabilityPending,
}) {
  const { waveformData, isLoading } = useStationWaveform({ stationCodeUpper: stationCode, startTime, endTime });
  const channels = useMemo(
    () => (Array.isArray(waveformData?.channelSamples) ? waveformData.channelSamples : []),
    [waveformData]
  );
  const preferredChannel = useMemo(() => getPreferredChannelCode(channels), [channels]);
  const [selectedChannel, setSelectedChannel] = useState(DEFAULT_WAVEFORM_CHANNELS[0]);
  const activeChannel = selectedChannel || preferredChannel || DEFAULT_WAVEFORM_CHANNELS[0];
  const displayedChannels = activeChannel
    ? channels.filter((channel) => channel.code === activeChannel)
    : channels;

  useEffect(() => {
    if (channels.length === 0) return;
    setSelectedChannel((current) => (
      channels.some((channel) => channel.code === current)
        ? current
        : preferredChannel
    ));
  }, [channels, preferredChannel]);

  return (
    <div className={styles.waveformRow}>
      <div className={styles.waveformHeader}>
        <StationChannelControl
          stationCode={stationCode}
          channels={channels}
          selectedChannel={activeChannel}
          onChange={setSelectedChannel}
          distanceLabel={distanceLabel}
        />
        <div className={styles.rowActions}>
          <MetadataButton stationCode={stationCode} earthquakeInfo={earthquakeInfo} />
          <DownloadButton stationCode={stationCode} earthquakeInfo={earthquakeInfo} />
        </div>
      </div>

      <div className={styles.waveformCanvas}>
        <CompactWaveform
          stationCode={stationCode}
          stationIndex={stationIndex}
          channels={displayedChannels}
          isLoading={isLoading}
          eventTime={earthquakeInfo?.eventTime || earthquakeInfo?.OT}
          isAvailabilityPending={isAvailabilityPending}
        />
      </div>
    </div>
  );
}


function StationChannelControl({ stationCode, channels, selectedChannel, onChange, distanceLabel }) {
  const channelOptions = channels.length > 0
    ? channels.map((channel) => channel.code)
    : DEFAULT_WAVEFORM_CHANNELS;

  return (
    <div className={styles.stationControlGroup}>
      <div className={styles.stationControl}>
        <div className={styles.stationLabel}>{stationCode.toUpperCase()}</div>
        <select
          className={styles.channelSelect}
          aria-label={`Waveform channel for ${stationCode}`}
          value={selectedChannel}
          onChange={(event) => onChange(event.target.value)}
          style={{ '--channel-label-width': `${Math.max(formatChannelLabel(selectedChannel).length, 3)}ch` } as any}
        >
          {channelOptions.map((channelCode) => (
            <option
              key={channelCode}
              value={channelCode}
              title={channelCode}
            >
              {formatChannelLabel(channelCode)}
            </option>
          ))}
        </select>
        {distanceLabel ? (
          <div className={styles.stationDistance}>{distanceLabel}</div>
        ) : null}
      </div>
    </div>
  );
}


/**
 * Download button component
 */
function DownloadButton({ stationCode, earthquakeInfo }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    try {
      setDownloading(true);
      const { waveformUrl, waveformFilename } = buildStationFdsnDownloads(stationCode, earthquakeInfo);
      await fetchAndDownload(
        waveformUrl,
        waveformFilename,
        'waveform',
        'application/vnd.fdsn.mseed, application/octet-stream, */*;q=0.1'
      );
    } catch (_) {
      // Download fallback is handled inside fetchAndDownload.
    } finally {
      setDownloading(false);
    }
  }, [stationCode, earthquakeInfo]);

  return (
    <Button
      onClick={handleDownload}
      disabled={downloading}
      aria-label={`Download waveform for ${stationCode} (MiniSEED)`}
      title={`Download waveform data for ${stationCode}`}
      className={styles.downloadBtn}
    >
      <FiDownload className={styles.actionIcon} aria-hidden="true" focusable="false" />
      {downloading ? 'Downloading...' : 'Waveform'}
    </Button>
  );
}

/**
 * Metadata button component
 */
function MetadataButton({ stationCode, earthquakeInfo }) {
  const [downloading, setDownloading] = useState(false);

  const handleMetadata = useCallback(async () => {
    try {
      setDownloading(true);
      const { metadataUrl, metadataFilename } = buildStationFdsnDownloads(stationCode, earthquakeInfo);
      await fetchAndDownload(
        metadataUrl,
        metadataFilename,
        'metadata',
        'application/xml, text/xml; q=0.9, */*; q=0.1'
      );
    } finally {
      setDownloading(false);
    }
  }, [stationCode, earthquakeInfo]);

  return (
    <Button
      onClick={handleMetadata}
      disabled={downloading}
      variant="secondary"
      aria-label={`Download station metadata for ${stationCode}`}
      title={`Download station metadata for ${stationCode}`}
      className={styles.metadataBtn}
    >
      <FiDownload className={styles.actionIcon} aria-hidden="true" focusable="false" />
      {downloading ? 'Loading...' : 'Metadata'}
    </Button>
  );
}

