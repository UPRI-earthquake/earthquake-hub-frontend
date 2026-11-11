import { useMemo } from "react";
import { buildTriangleSVG } from "@/shared/utils/triangleMarker";

interface MiniMapStationPinProps {
  stationCode?: string;
  style?: React.CSSProperties;
}

export default function MiniMapStationPin({ stationCode = 'station', style = null }: MiniMapStationPinProps) {
  const triangleMarkup = useMemo(
    () => buildTriangleSVG('#22c55e', `metric-${stationCode || 'station'}`),
    [stationCode]
  );

  return (
    <span
      className="metric-map-pin metric-map-pin-station"
      style={style || undefined}
      dangerouslySetInnerHTML={{ __html: triangleMarkup }}
    />
  );
}