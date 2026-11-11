import { buildWaveformPaths, buildWaveformTimeTicks, formatAmplitudeLabel, getEventMarkerX, getStationTraceColor, toWaveformPercent } from "@/features/earthquake-details/services/recordings";
import { useMemo } from "react";
import { WAVEFORM_AXIS_LABELS, WAVEFORM_BASELINE_Y, WAVEFORM_MARKER_BOTTOM_Y, WAVEFORM_MARKER_TOP_Y, WAVEFORM_PLOT_BOTTOM, WAVEFORM_PLOT_LEFT, WAVEFORM_PLOT_RIGHT, WAVEFORM_PLOT_TOP, WAVEFORM_VIEW_HEIGHT, WAVEFORM_VIEW_WIDTH } from "@/features/earthquake-details/constants/recordings";
import moment from "@/shared/utils/time";

import styles from '../../../styles/sections/StationRecordingsSection.module.css';

export default function CompactWaveform({ stationCode, stationIndex, channels, isLoading, eventTime, isAvailabilityPending }) {
  const color = getStationTraceColor(stationIndex);
  const waveformDisplay = useMemo(
    () => buildWaveformPaths(channels, eventTime),
    [channels, eventTime]
  );
  const paths = waveformDisplay.paths;
  const eventMarkerX = useMemo(
    () => getEventMarkerX(eventTime),
    [eventTime]
  );
  const maxAmplitudeLabel = formatAmplitudeLabel(waveformDisplay.maxAmplitude);
  const minAmplitudeLabel = formatAmplitudeLabel(-waveformDisplay.maxAmplitude);
  const timeTicks = useMemo(() => buildWaveformTimeTicks(eventTime), [eventTime]);
  const eventMarkerPercent = eventMarkerX == null ? '' : toWaveformPercent(eventMarkerX);

  if (isLoading) {
    return (
      <div className={styles.compactPlaceholder}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (paths.length === 0) {
    return (
      <div className={styles.compactEmpty}>
        <span>{isAvailabilityPending ? 'Checking waveform availability' : 'No waveform data available'}</span>
      </div>
    );
  }

  return (
    <div
      className={styles.waveformPlot}
      style={eventMarkerPercent ? { '--event-marker-left': eventMarkerPercent } as any : undefined}
    >
      <svg
        className={styles.compactWaveform}
        viewBox={`0 0 ${WAVEFORM_VIEW_WIDTH} ${WAVEFORM_VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Recorded waveform for ${stationCode}`}
      >
        <rect
          className={styles.waveformTrackBackground}
          x="0"
          y="0"
          width={WAVEFORM_VIEW_WIDTH}
          height={WAVEFORM_VIEW_HEIGHT}
        />
        <g className={styles.waveformAxisLayer} aria-hidden="true">
          <line
            className={styles.waveformAxisLine}
            x1={WAVEFORM_PLOT_LEFT}
            y1={WAVEFORM_PLOT_TOP}
            x2={WAVEFORM_PLOT_LEFT}
            y2={WAVEFORM_PLOT_BOTTOM}
            vectorEffect="non-scaling-stroke"
          />
          <line
            className={styles.waveformAxisLine}
            x1={WAVEFORM_PLOT_LEFT}
            y1={WAVEFORM_PLOT_BOTTOM}
            x2={WAVEFORM_VIEW_WIDTH - WAVEFORM_PLOT_RIGHT}
            y2={WAVEFORM_PLOT_BOTTOM}
            vectorEffect="non-scaling-stroke"
          />
          {[
            { y: WAVEFORM_PLOT_TOP, label: maxAmplitudeLabel },
            { y: WAVEFORM_BASELINE_Y, label: '0' },
            { y: WAVEFORM_PLOT_BOTTOM, label: minAmplitudeLabel },
          ].map((tick) => (
            <g key={tick.y}>
              <line
                className={styles.waveformAxisTick}
                x1={WAVEFORM_PLOT_LEFT - 8}
                y1={tick.y}
                x2={WAVEFORM_PLOT_LEFT}
                y2={tick.y}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
          <line
            className={styles.waveformBaselineLine}
            x1={WAVEFORM_PLOT_LEFT}
            y1={WAVEFORM_BASELINE_Y}
            x2={WAVEFORM_VIEW_WIDTH - WAVEFORM_PLOT_RIGHT}
            y2={WAVEFORM_BASELINE_Y}
            vectorEffect="non-scaling-stroke"
          />
          {timeTicks.map((tick) => (
            <g key={tick.x}>
              <line
                className={styles.waveformGridLine}
                x1={tick.x}
                y1={WAVEFORM_PLOT_TOP}
                x2={tick.x}
                y2={WAVEFORM_PLOT_BOTTOM}
                vectorEffect="non-scaling-stroke"
              />
              <line
                className={styles.waveformAxisTick}
                x1={tick.x}
                y1={WAVEFORM_PLOT_BOTTOM}
                x2={tick.x}
                y2={WAVEFORM_PLOT_BOTTOM + 7}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
        {paths.map((path, index) => (
          <path
            key={path.code || index}
            d={path.points}
            fill="none"
            stroke={path.color || color}
            strokeWidth={index === 0 ? '2.35' : '1.8'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={index === 0 ? '0.95' : '0.68'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {eventMarkerX != null && (
          <g className={styles.eventTimeMarkerLayer}>
            <title>{`Arrival time: ${moment.utc(eventTime).format('YYYY-MM-DD HH:mm:ss')} UTC`}</title>
            <line
              className={styles.eventTimeMarkerHalo}
              x1={eventMarkerX}
              y1={WAVEFORM_MARKER_TOP_Y}
              x2={eventMarkerX}
              y2={WAVEFORM_MARKER_BOTTOM_Y}
              vectorEffect="non-scaling-stroke"
            />
            <line
              className={styles.eventTimeMarker}
              x1={eventMarkerX}
              y1={WAVEFORM_MARKER_TOP_Y}
              x2={eventMarkerX}
              y2={WAVEFORM_MARKER_BOTTOM_Y}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>
      <div className={styles.waveformAxisLabels} aria-hidden="true">
        {WAVEFORM_AXIS_LABELS.map((label) => {
          const labelText = {
            max: maxAmplitudeLabel,
            zero: '0',
            min: minAmplitudeLabel,
          }[label.key];

          return (
            <span
              key={label.key}
              className={`${styles.waveformAxisLabel} ${styles.waveformYAxisLabel}`}
              style={{ top: label.top }}
            >
              {labelText}
            </span>
          );
        })}
        <span className={`${styles.waveformAxisLabel} ${styles.waveformUtcLabel}`}>UTC</span>
        {timeTicks
          .filter((tick) => tick.label)
          .map((tick) => (
            <span
              key={tick.x}
              className={`${styles.waveformAxisLabel} ${styles.waveformTimeLabel} ${tick.isSecondary ? styles.waveformTimeLabelSecondary : ''}`}
              style={{ left: tick.percent }}
            >
              {tick.label}
            </span>
          ))}
        {eventMarkerPercent ? (
          <span className={`${styles.waveformAxisLabel} ${styles.waveformEventMarkerLabel}`}>
            Event time
          </span>
        ) : null}
      </div>
    </div>
  );
}