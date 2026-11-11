const normalize = (value) => String(value || '').trim().toLowerCase();

/**
 * Normalizes activity/status strings into canonical device activity values.
 * Canonical values: 'active' | 'inactive' | 'unlinked' | '' (unknown/empty).
 */
export function normalizeDeviceActivity(value: StationActivity): StationActivityCanonical {
  const v: StationActivity = normalize(value) as StationActivity;
  if (!v) return '';
  if (v === 'active' || v === 'streaming' || v === 'online') return 'active';
  if (v === 'inactive' || v === 'offline' || v === 'not streaming') return 'inactive';
  if (v === 'unlinked') return 'unlinked';
  return v;
};

export const isStreamingActivity = (value: StationActivity) => normalizeDeviceActivity(value) === 'active';

export const isUnlinkedActivity = (value: StationActivity) => normalizeDeviceActivity(value) === 'unlinked';

export const toMarkerActivity = (value: StationActivity) => (isStreamingActivity(value) ? 'active' : 'inactive');

export const toPublicOnlineLabel = (value: StationActivity) => (isStreamingActivity(value) ? 'Online' : 'Offline');

export const toDashboardStatusLabel = ({ activity, status }: { activity?: StationActivity, status?: any } = {}) => {
  const norm = normalizeDeviceActivity(activity || status);
  if (norm === 'unlinked') return 'Unlinked';
  if (norm === 'active') return 'Streaming';
  if (norm === 'inactive') return 'Not Streaming';

  const raw = normalize(status);
  if (raw.includes('not yet linked')) return 'Not Yet Linked';
  if (raw.includes('not streaming')) return 'Not Streaming';
  if (raw.includes('streaming')) return 'Streaming';

  return status || 'Not Streaming';
};
