import { toFiniteNumber } from "@/shared/utils/earthquakeFormat";
import moment from "@/shared/utils/time";
import { WAVEFORM_AMPLITUDE_Y, WAVEFORM_BASELINE_Y, WAVEFORM_CHANNEL_COLORS, WAVEFORM_PLOT_LEFT, WAVEFORM_PLOT_WIDTH, WAVEFORM_TIME_TICK_COUNT, WAVEFORM_VIEW_WIDTH } from "../constants/recordings";
import { trackEvent } from "@/analytics";
import axios from "axios";
import { parseEventTimeUtc } from "./earthquake";
import { getFDSNWS } from "@/config/env";

export function buildStationLocationLookup(backendStations) {
  if (!Array.isArray(backendStations)) return {};

  return backendStations.reduce((acc, station) => {
    const code = String(station?.code || station?.station || '').toUpperCase();
    const latitude = toFiniteNumber(station?.latitude);
    const longitude = toFiniteNumber(station?.longitude);

    if (code && latitude != null && longitude != null) {
      acc[code] = { latitude, longitude };
    }

    return acc;
  }, {});
}


export function getPreferredChannelCode(channels) {
  if (!Array.isArray(channels) || channels.length === 0) return '';
  const preferred = channels.find((channel) => formatChannelLabel(channel.code).toUpperCase() === 'EHZ');
  return (preferred || channels[0]).code;
}


export function getEventMarkerX(eventTime) {
  const eventMoment = moment.utc(eventTime);

  if (!eventMoment.isValid()) {
    return null;
  }

  const start = eventMoment.clone().add(-60, 'second');
  const end = eventMoment.clone().add(600, 'second');
  const totalMs = end.diff(start);
  const elapsedMs = eventMoment.diff(start);

  if (totalMs <= 0 || elapsedMs < 0 || elapsedMs > totalMs) {
    return null;
  }

  return WAVEFORM_PLOT_LEFT + (elapsedMs / totalMs) * WAVEFORM_PLOT_WIDTH;
}

export function getStationTraceColor(stationIndex) {
  const colors = ['#45b58f', '#5aa3e8', '#e37357'];
  return colors[stationIndex % colors.length];
}

export function buildWaveformPaths(channels, eventTime) {
  const waveformWindow = getWaveformWindow(eventTime);
  const preparedChannels = channels
    .map((channel) => prepareWaveformChannel(channel, waveformWindow))
    .filter((channel) => channel.values.length >= 2 || channel.segments.some((segment) => segment.values.length >= 2));
  const sharedMax = preparedChannels.reduce(
    (largest, channel) => Math.max(largest, getMaxAbs(channel.values)),
    0
  );

  if (!sharedMax) {
    return { paths: [], maxAmplitude: 0 };
  }

  return {
    maxAmplitude: sharedMax,
    paths: preparedChannels
      .flatMap((channel) => {
        if (channel.segments.length > 0) {
          return channel.segments.map((segment) => ({
            code: channel.code,
            color: channel.color,
            points: buildTimedWaveformPath(segment.values, sharedMax, waveformWindow),
          }));
        }

        return [{
          code: channel.code,
          color: channel.color,
          points: buildWaveformPath(channel.values, sharedMax),
        }];
      })
      .filter((channel) => channel.points),
  };
}


export function formatChannelLabel(code) {
  const parts = String(code || '').split('.');
  return parts[parts.length - 1] || String(code || 'Channel');
}


function getWaveformWindow(eventTime) {
  const eventMoment = moment.utc(eventTime);
  if (!eventMoment.isValid()) return null;

  const start = eventMoment.clone().subtract(60, 'second');
  const end = eventMoment.clone().add(600, 'second');
  const startMs = start.valueOf();
  const endMs = end.valueOf();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { startMs, endMs, totalMs: endMs - startMs };
}

function prepareWaveformChannel(channel, waveformWindow) {
  const rawValues = Array.isArray(channel.samples)
    ? channel.samples.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  const mean = rawValues.length > 0
    ? rawValues.reduce((sum, value) => sum + value, 0) / rawValues.length
    : 0;
  const timedSegments = Array.isArray(channel.segments) && waveformWindow
    ? channel.segments
      .map((segment) => prepareTimedWaveformSegment(segment, mean, waveformWindow))
      .filter((segment) => segment.values.length >= 2)
    : [];

  return {
    code: channel.code,
    color: channel.color,
    values: timedSegments.length > 0 ? timedSegments.flatMap((segment) => segment.values.map((point) => point.value)) : prepareWaveformValues(channel.samples),
    segments: timedSegments,
  };
}

function prepareTimedWaveformSegment(segment, mean, waveformWindow) {
  const sampleRate = Number(segment?.sampleRate);
  const startTimeMs = Number(segment?.startTimeMs);
  const samples = Array.isArray(segment?.samples) ? segment.samples : [];

  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || !Number.isFinite(startTimeMs)) {
    return { values: [] };
  }

  const samplePeriodMs = 1000 / sampleRate;
  const values = samples
    .map((sample, index) => ({
      timeMs: startTimeMs + (index * samplePeriodMs),
      value: Number(sample) - mean,
    }))
    .filter((point) => (
      Number.isFinite(point.timeMs) &&
      Number.isFinite(point.value) &&
      point.timeMs >= waveformWindow.startMs &&
      point.timeMs <= waveformWindow.endMs
    ));
  const segmentDurationMs = values.length >= 2
    ? values[values.length - 1].timeMs - values[0].timeMs
    : 0;
  const bucketCount = Math.max(
    4,
    Math.ceil((segmentDurationMs / waveformWindow.totalMs) * 420)
  );

  return { values: minMaxDownsampleTimed(values, bucketCount) };
}

function prepareWaveformValues(samples) {
  if (!Array.isArray(samples) || samples.length < 2) {
    return [];
  }

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const centeredSamples = samples.map((value) => value - mean);
  return minMaxDownsample(centeredSamples, 420);
}

function buildWaveformPath(values, sharedMax) {
  if (!Array.isArray(values) || values.length < 2 || !sharedMax) {
    return '';
  }

  return values
    .map((value, index) => {
      const x = WAVEFORM_PLOT_LEFT + (index / (values.length - 1)) * WAVEFORM_PLOT_WIDTH;
      const y = WAVEFORM_BASELINE_Y - (value / sharedMax) * WAVEFORM_AMPLITUDE_Y;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildTimedWaveformPath(values, sharedMax, waveformWindow) {
  if (!Array.isArray(values) || values.length < 2 || !sharedMax || !waveformWindow) {
    return '';
  }

  return values
    .map((point, index) => {
      const ratio = (point.timeMs - waveformWindow.startMs) / waveformWindow.totalMs;
      const x = WAVEFORM_PLOT_LEFT + ratio * WAVEFORM_PLOT_WIDTH;
      const y = WAVEFORM_BASELINE_Y - (point.value / sharedMax) * WAVEFORM_AMPLITUDE_Y;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function formatAmplitudeLabel(value) {
  if (!Number.isFinite(value)) return '';
  const absValue = Math.abs(value);
  if (absValue >= 1000) {
    return value.toExponential(1);
  }
  if (absValue >= 100) {
    return Math.round(value).toLocaleString();
  }
  if (absValue >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

export function buildWaveformTimeTicks(eventTime) {
  const eventMoment = moment.utc(eventTime);
  const start = eventMoment.isValid()
    ? eventMoment.clone().subtract(60, 'second')
    : null;

  return Array.from({ length: WAVEFORM_TIME_TICK_COUNT }, (_, index) => {
    const ratio = index / (WAVEFORM_TIME_TICK_COUNT - 1);
    const x = WAVEFORM_PLOT_LEFT + ratio * WAVEFORM_PLOT_WIDTH;
    const shouldLabel = index > 0 && index < WAVEFORM_TIME_TICK_COUNT - 1 && index % 2 === 0;
    const label = shouldLabel && start
      ? start.clone().add(Math.round(ratio * 660), 'second').format('HH:mm:ss')
      : '';

    return { x, label, percent: toWaveformPercent(x), isSecondary: index !== 4 };
  });
}

export function toWaveformPercent(x) {
  return `${((x / WAVEFORM_VIEW_WIDTH) * 100).toFixed(3)}%`;
}

function getMaxAbs(values) {
  return values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
}

function minMaxDownsample(samples, bucketCount) {
  if (samples.length <= bucketCount * 2) {
    return samples;
  }

  const result = [];
  const bucketSize = samples.length / bucketCount;

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor(bucketIndex * bucketSize);
    const end = Math.min(samples.length, Math.floor((bucketIndex + 1) * bucketSize));
    if (end <= start) continue;

    let min = samples[start];
    let max = samples[start];
    let minIndex = start;
    let maxIndex = start;

    for (let index = start + 1; index < end; index += 1) {
      const value = samples[index];
      if (value < min) {
        min = value;
        minIndex = index;
      }
      if (value > max) {
        max = value;
        maxIndex = index;
      }
    }

    if (minIndex < maxIndex) {
      result.push(min, max);
    } else if (maxIndex < minIndex) {
      result.push(max, min);
    } else {
      result.push(samples[start]);
    }
  }

  return result;
}

function minMaxDownsampleTimed(points, bucketCount) {
  if (!Array.isArray(points) || points.length <= bucketCount * 2) {
    return points;
  }

  const result = [];
  const bucketSize = points.length / bucketCount;

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor(bucketIndex * bucketSize);
    const end = Math.min(points.length, Math.floor((bucketIndex + 1) * bucketSize));
    if (end <= start) continue;

    let min = points[start];
    let max = points[start];
    let minIndex = start;
    let maxIndex = start;

    for (let index = start + 1; index < end; index += 1) {
      const point = points[index];
      if (point.value < min.value) {
        min = point;
        minIndex = index;
      }
      if (point.value > max.value) {
        max = point;
        maxIndex = index;
      }
    }

    if (minIndex < maxIndex) {
      result.push(min, max);
    } else if (maxIndex < minIndex) {
      result.push(max, min);
    } else {
      result.push(min);
    }
  }

  return result;
}

export function buildStationFdsnDownloads(stationCode, earthquakeInfo) {
  const network = 'AM';
  const baseUrl = getFDSNWS();
  const stationCodeUpper = String(stationCode || '').toUpperCase();
  const eventTime = earthquakeInfo?.eventTime || earthquakeInfo?.OT;
  const startTime = formatFdsnDateTime(eventTime, -60);
  const endTime = formatFdsnDateTime(eventTime, 60 * 10);
  const dateSuffix = parseEventTimeUtc(eventTime).format('MMDDYY');
  const startSuffix = parseEventTimeUtc(eventTime).add(-60, 'second').format('YYYYMMDDTHHmmss') + 'Z';
  const endSuffix = parseEventTimeUtc(eventTime).add(60 * 10, 'second').format('YYYYMMDDTHHmmss') + 'Z';
  const common = `starttime=${startTime}&endtime=${endTime}&network=${network}&station=${stationCodeUpper}&location=00`;

  return {
    metadataUrl: `${baseUrl}/station/1/query?level=response&${common}&formatted=true&nodata=404`,
    waveformUrl: `${baseUrl}/dataselect/1/query?${common}&channel=*&nodata=404`,
    metadataFilename: `${network}.${stationCodeUpper}.00.MULTI.xml`,
    waveformFilename: `${network}.${stationCodeUpper}.00.MULTI.${dateSuffix}.${startSuffix}-${endSuffix}.mseed`,
  };
}


export function formatFdsnDateTime(dateString, secondsToAdd = 0) {
  return parseEventTimeUtc(dateString)
    .add(secondsToAdd, 'second')
    .format('YYYY-MM-DDTHH:mm:ss')
    .replace(/:/g, '%3A');
}

export async function fetchAndDownload(url, filename, kind, acceptHeader) {
  try {
    trackEvent('download_data', {
      type: kind,
      source: 'waveform_visualization',
      station_code: filename.split('.')[1],
    });
  } catch (_) {}

  try {
    const response = await axios.get(url, {
      responseType: 'blob',
      withCredentials: false,
      validateStatus: () => true,
      headers: acceptHeader ? { Accept: acceptHeader } : undefined,
      timeout: 15000,
    });

    if (response.status !== 200) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }

    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    if (!blob || blob.size === 0) {
      window.open(url, '_blank', 'noreferrer');
      return;
    }

    const objUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objUrl);
  } catch (_) {
    try {
      window.open(url, '_blank', 'noreferrer');
    } catch (_) {}
  }
}



export function parseMiniSeedRecords(sp, arrayBuffer) {
  const ms = sp.miniseed || {};
  try {
    if (typeof ms.parseDataRecords === 'function') return ms.parseDataRecords(arrayBuffer);
    if (typeof ms.parseMiniseed === 'function') return ms.parseMiniseed(arrayBuffer);
    if (typeof ms.parse === 'function') return ms.parse(arrayBuffer);
  } catch (_) {
    return [];
  }
  return [];
}



export function createWaveformDisplay(sp, records) {
  const ms = sp.miniseed || {};
  let seismograms = [];

  if (typeof ms.seismogramPerChannel === 'function') {
    seismograms = ms.seismogramPerChannel(records);
  } else if (typeof ms.merge === 'function') {
    seismograms = [ms.merge(records)];
  } else {
    const seg = ms.createSeismogramSegment(records);
    seismograms = [new sp.seismogram.Seismogram([seg])];
  }

  const channelOrder = { Z: 0, N: 1, E: 2, '1': 3, '2': 4, '3': 5 };
  const selectedSeismograms = seismograms
    .slice()
    .sort((a, b) => {
      const aChannel = String(a?.channelCode || '').toUpperCase();
      const bChannel = String(b?.channelCode || '').toUpperCase();
      const aSuffix = aChannel.slice(-1);
      const bSuffix = bChannel.slice(-1);
      const aOrder = channelOrder[aSuffix] ?? 99;
      const bOrder = channelOrder[bSuffix] ?? 99;
      return aOrder === bOrder
        ? aChannel.localeCompare(bChannel)
        : aOrder - bOrder;
    });

  const dataList = selectedSeismograms
    .map((seis) => {
      const seisData = sp.seismogram.SeismogramDisplayData.fromSeismogram(seis);
      seisData.alignmentTime = seis.startTime || sp.luxon.DateTime.utc();
      return seisData;
    })
    .filter(Boolean);

  if (dataList.length === 0) {
    throw new Error('No displayable MiniSEED channels parsed');
  }

  const config = new sp.seismographconfig.SeismographConfig();
  config.wheelZoom = false;
  config.doGain = true;
  config.isRelativeTime = true;
  config.linkedAmplitudeScale = new sp.scale.IndividualAmplitudeScale();
  config.lineColors = selectedSeismograms.map((_, index) => WAVEFORM_CHANNEL_COLORS[index % WAVEFORM_CHANNEL_COLORS.length]);

  return {
    dataList,
    config,
    channels: selectedSeismograms.map((seis) => seis.codes()),
    channelSamples: selectedSeismograms
      .map((seis, index) => {
        const series = extractSeismogramSeries(seis);
        return {
          code: seis.codes(),
          samples: series.samples,
          segments: series.segments,
          color: WAVEFORM_CHANNEL_COLORS[index % WAVEFORM_CHANNEL_COLORS.length],
        };
      })
      .filter((channel) => channel.samples.length > 0),
  };
}

function extractSeismogramSeries(seismogram) {
  const segments = Array.isArray(seismogram?.segments) ? seismogram.segments : [];
  const samples = [];
  const timedSegments = [];

  segments.forEach((segment) => {
    try {
      const yValues = segment?.y;
      if (yValues && typeof yValues.length === 'number') {
        const segmentSamples = Array.from(yValues)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        samples.push(...segmentSamples);

        const startTimeMs = toEpochMillis(segment?.startTime || segment?.start);
        const sampleRate = Number(segment?.sampleRate);
        if (Number.isFinite(startTimeMs) && Number.isFinite(sampleRate) && sampleRate > 0) {
          timedSegments.push({
            startTimeMs,
            sampleRate,
            samples: segmentSamples,
          });
        }
      }
    } catch (_) {
      // Skip a segment if seisplotjs cannot decode it.
    }
  });

  return { samples, segments: timedSegments };
}

function toEpochMillis(value) {
  if (!value) return NaN;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = moment.utc(value);
  return parsed.isValid() ? parsed.valueOf() : NaN;
}
