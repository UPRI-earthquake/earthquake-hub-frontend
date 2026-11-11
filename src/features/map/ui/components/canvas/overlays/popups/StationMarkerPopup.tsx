import { Popup } from "react-leaflet";
import styles from '../../../../styles/canvas/overlays/markers/StationMarkerItem.module.css';
import InfoTooltip from "@/shared/ui/components/InfoTooltip";
import moment from "@/shared/utils/time";
import axios from "axios";
import { normalizeDeviceActivity } from "@/shared/services/stations/deviceStatus";
import usePopupAutoPanPadding from "../../../../../hooks/usePopupAutoPanPadding";
import { DEFAULT_POPUP_AUTOPAN } from "@/config/popupAutoPan";
import { trackEvent } from "@/analytics";
import { useCallback } from "react";
import { getFDSNWS } from "@/config/env";
import downloadStationMetadata from "@/features/map/services/station";

interface StationMarkerPopupProps {
  network: string;
  code: string;
  markerDesc: string;
  statusChange: any;
  statusState: any;
  realtimeDivRef: any;
}

export default function StationMarkerPopup({ network, code, markerDesc, statusChange, statusState, realtimeDivRef }: StationMarkerPopupProps) {
  const popupAutoPanPadding = usePopupAutoPanPadding();

  const { topLeft: popupPaddingTopLeft, bottomRight: popupPaddingBottomRight } =
      popupAutoPanPadding || DEFAULT_POPUP_AUTOPAN;

  
  const FDSNWS = getFDSNWS();
  

  
  const start_time = moment().subtract(1, 'days');

  // Build common query strings (without host) for reuse
  const dataQuery =
    '/dataselect/1/query?' +
    'starttime=' +
    start_time.format('YYYY-MM-DDTHH:mm:ss') +
    '&endtime=' +
    moment().format('YYYY-MM-DDTHH:mm:ss') +
    '&network=AM&station=' +
    code +
    '&location=00&channel=E*&nodata=404';
  const stationMetaQuery =
    '/station/1/query?' +
    'network=AM&station=' +
    code +
    '&level=resp&format=sc3ml&nodata=404';

  
  const data_download_URL = `${FDSNWS}${dataQuery}`;
  const metadata_download_URL = `${FDSNWS}${stationMetaQuery}`;

  const logDownload = useCallback(
    (payload) => {
      try {
        trackEvent('download_data', {
          station_code: code,
          network: String(network || 'AM').toUpperCase(),
          source: 'station_popup',
          ...payload,
        });
      } catch (_) {}
    },
    [code, network],
  );

  const handleDownloadMetadata = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    downloadStationMetadata(network, code, logDownload);
  };

  const handleDownloadData = async (e) => {
    // Download past 24h MiniSEED with a specific filename from FDSNWS only.
    try {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();

      const url = `${FDSNWS}${dataQuery}`;
      const resp = await axios.get(url, {
        responseType: 'blob',
        withCredentials: false,
        validateStatus: () => true,
        headers: { Accept: 'application/vnd.fdsn.mseed, application/octet-stream, */*;q=0.1' },
        timeout: 15000,
      });

      if (resp.status !== 200) {
        logDownload({ type: 'waveform', format: 'mseed', status: 'fallback' });
        try { window.open(url, '_blank', 'noreferrer'); } catch (_) {}
        return;
      }

      const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data]);
      const ct = (resp.headers && resp.headers['content-type']) || '';
      const looksMseed = typeof ct === 'string' && (ct.toLowerCase().includes('vnd.fdsn.mseed') || ct.toLowerCase().includes('application/octet-stream'));
      if (!blob || blob.size === 0 || (!looksMseed && blob.size < 64)) {
        logDownload({ type: 'waveform', format: 'mseed', status: 'fallback' });
        try { window.open(url, '_blank', 'noreferrer'); } catch (_) {}
        return;
      }

      const dateSuffix = moment().format('MMDDYY');
      const filename = `${network.toUpperCase()}.${code.toUpperCase()}.00.MULTI.${dateSuffix}.mseed`;
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
      logDownload({
        type: 'waveform',
        format: 'mseed',
        status: 'success',
        size_bytes: blob.size || 0,
      });
    } catch (_) {
      logDownload({ type: 'waveform', format: 'mseed', status: 'error' });
      try { window.open(data_download_URL, '_blank', 'noreferrer'); } catch (_) {}
    }
  };

  return (<Popup
    className={styles.popUp}
    autoPan
    // autoPanPaddingTopLeft={popupPaddingTopLeft}
    // autoPanPaddingBottomRight={popupPaddingBottomRight}
  >
    <div className={styles.popUpBody}>
      <div className={styles.popupHeader}>
        <div className={styles.popupTitleRow}>
          <div className={styles.popupTitle}>Station {code}</div>
          <InfoTooltip label="Station location info" title="Approximate location" variant="inline">
            Location is intentionally offset to protect device privacy.
          </InfoTooltip>
        </div>
        {markerDesc ? <div className={styles.popupSubtitle}>{markerDesc}</div> : null}
      </div>
      <div className={styles.popupSection}>
        <div ref={realtimeDivRef} className={styles.realtimeGraphDiv}></div>
      </div>
      <div className={styles.popupSection}>
        <div className={styles.statusRow}>
          <span
            className={`
              ${styles.statusIndicator}
              ${normalizeDeviceActivity(statusState.activity || statusState.status) === 'active' ? styles['streaming'] : styles['not-streaming']}
              ${statusChange ? styles[statusChange] : ''}
            `}
          ></span>
          <span className={styles.statusText}>
            {(() => {
              const state = normalizeDeviceActivity(statusState.activity || statusState.status);
              if (state === 'unlinked') return 'Device Offline';
              const label = statusState.status || (state === 'active' ? 'Streaming' : 'Inactive');
              if (!statusState.statusSince) return label;
              if (state === 'active' || moment(statusState.statusSince) > moment().subtract(1, 'month')) {
                return `${label} since ${moment(statusState.statusSince).fromNow()}`;
              }
              return 'Device Offline';
            })()}
          </span>
        </div>
      </div>
      <div className={`${styles.popupSection} ${styles.popupActions}`}>
        <a
          href={data_download_URL}
          target="_blank"
          rel="noreferrer"
          onClick={handleDownloadData}
          className={styles.actionLink}
        >
          Get past 24hrs data
        </a>
        <a
          href={metadata_download_URL}
          target="_blank"
          rel="noreferrer"
          onClick={handleDownloadMetadata}
          className={styles.actionLink}
        >
          Get station metadata
        </a>
      </div>
    </div>
  </Popup>);
}