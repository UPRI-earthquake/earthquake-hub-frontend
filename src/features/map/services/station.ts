import { getFDSNWS } from "@/config/env";
import { sendAPIRequestThrowsException } from "@/shared/api";

export default async function downloadStationMetadata(network: string, stationCode: string, logDownload: (args: any) => void){
  // Download station metadata (XML) from the configured FDSNWS only,
  // saving with a custom filename.
  try {
    const resp = await sendAPIRequestThrowsException({
      host: "fdsnws",
      path: "/station/1/query",
      params: {
        network: "AM",
        station: stationCode,
        level: "resp",
        format: "sc3ml",
        nodata: 404
      },
      responseType: "blob",
      headers: { Accept: 'application/xml, text/xml; q=0.9, */*; q=0.1' },
      
    });


    if (resp.status !== 200) {
      logDownload({ type: 'metadata', format: 'xml', status: 'fallback' });
      try { window.open(getFDSNWS("primary"), '_blank', 'noreferrer'); } catch (_) {}
      return;
    }

    const blob = resp.data instanceof Blob ? resp.data : new Blob([resp.data]);
    const ct = (resp.headers && resp.headers['content-type']) || '';
    const looksXml = typeof ct === 'string' && ct.toLowerCase().includes('xml');
    if (!blob || blob.size === 0 || (!looksXml && blob.size < 64)) {
      logDownload({ type: 'metadata', format: 'xml', status: 'fallback' });
      return;
    }

    const filename = `${network.toUpperCase()}.${stationCode.toUpperCase()}.00.MULTI.xml`;
    const objUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objUrl);
    logDownload({
      type: 'metadata',
      format: 'xml',
      status: 'success',
      size_bytes: blob.size || 0,
    });
  } catch (_) {
    logDownload({ type: 'metadata', format: 'xml', status: 'error' });
  }
}