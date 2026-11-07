import moment from '../time';
import { loadLatestPhilippineEvents, selectLatestPhilippineEvents } from '../latestEvents';

const event = (id, date, latitude = 12, longitude = 122) => ({
  publicID: id, OT: `${date}T12:00:00Z`, latitude_value: latitude, longitude_value: longitude,
});

it('keeps the newest 30 regional events without a date cutoff or input mutation', () => {
  const events = Array.from({ length: 35 }, (_, i) =>
    event(`ph-${i}`, moment('2025-01-01').add(i, 'days').format('YYYY-MM-DD')));
  const result = selectLatestPhilippineEvents([
    ...events, event('foreign', '2026-11-05', 35, 140), event('invalid', 'invalid'),
  ]);
  expect(result).toHaveLength(30);
  expect(result[0].publicID).toBe('ph-34');
  expect(result[29].publicID).toBe('ph-5');
  expect(events[0].publicID).toBe('ph-0');
});

it('looks beyond 30 days and stops at 30 distinct Philippine events', async () => {
  const recent = event('recent', '2026-11-01');
  const older = Array.from({ length: 29 }, (_, i) => event(`older-${i}`, '2026-09-01'));
  const fetchRange = jest.fn()
    .mockResolvedValueOnce([recent, event('foreign', '2026-11-02', 35, 140)])
    .mockResolvedValueOnce([recent, ...older]);
  const result = await loadLatestPhilippineEvents(fetchRange, moment('2026-11-05'));
  expect(result).toHaveLength(30);
  expect(result[0]).toEqual(recent);
  expect(fetchRange.mock.calls).toEqual([
    ['2026-10-07', '2026-11-05', { setState: false }],
    ['2026-08-08', '2026-10-06', { setState: false }],
  ]);
});

it('returns available events at the catalogue boundary when fewer than 30 exist', async () => {
  const onlyEvent = event('only', '1900-01-01');
  const fetchRange = jest.fn().mockResolvedValue([onlyEvent]);
  expect(await loadLatestPhilippineEvents(fetchRange, moment('1900-01-05'))).toEqual([onlyEvent]);
  expect(fetchRange).toHaveBeenCalledTimes(1);
  expect(fetchRange).toHaveBeenCalledWith('1900-01-01', '1900-01-05', { setState: false });
});

it('propagates API failures instead of reporting a successful partial load', async () => {
  const fetchRange = jest.fn().mockRejectedValue(new Error('offline'));
  await expect(loadLatestPhilippineEvents(fetchRange)).rejects.toThrow('offline');
});
