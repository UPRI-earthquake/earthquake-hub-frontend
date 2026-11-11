
export const WAVEFORM_VIEW_WIDTH = 820;
export const WAVEFORM_VIEW_HEIGHT = 98;
export const WAVEFORM_PLOT_LEFT = 82;
export const WAVEFORM_PLOT_RIGHT = 16;
export const WAVEFORM_PLOT_TOP = 12;
export const WAVEFORM_PLOT_BOTTOM = 74;
export const WAVEFORM_PLOT_WIDTH = WAVEFORM_VIEW_WIDTH - WAVEFORM_PLOT_LEFT - WAVEFORM_PLOT_RIGHT;
export const WAVEFORM_BASELINE_Y = 43;
export const WAVEFORM_AMPLITUDE_Y = 25;
export const WAVEFORM_MARKER_TOP_Y = WAVEFORM_PLOT_TOP;
export const WAVEFORM_MARKER_BOTTOM_Y = WAVEFORM_PLOT_BOTTOM;
export const WAVEFORM_TIME_TICK_COUNT = 7;
export const WAVEFORM_AXIS_LABELS = [
  { key: 'max', top: `${(WAVEFORM_PLOT_TOP / WAVEFORM_VIEW_HEIGHT) * 100}%` },
  { key: 'zero', top: `${(WAVEFORM_BASELINE_Y / WAVEFORM_VIEW_HEIGHT) * 100}%` },
  { key: 'min', top: `${(WAVEFORM_PLOT_BOTTOM / WAVEFORM_VIEW_HEIGHT) * 100}%` },
];


export const DEFAULT_WAVEFORM_CHANNELS = ['EHZ', 'ENZ', 'ENN', 'ENE'];
export const WAVEFORM_CHANNEL_COLORS = [
  '#0284c7',
  '#16a34a',
  '#ea580c',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#be185d',
];

export const DEFAULT_VISIBLE_STATION_COUNT = 3;
