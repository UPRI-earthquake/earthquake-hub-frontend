// Check whether a given timestamp is considered "latest" based on a maximum duration (ms) til present
export function isLatest(timestamp: string, maxDuration: number) {
  return Date.now() >= new Date(timestamp).getTime() && Date.now() <= new Date(timestamp).getTime() + maxDuration;
}