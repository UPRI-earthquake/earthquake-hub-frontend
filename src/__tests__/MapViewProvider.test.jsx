import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MapViewProvider } from '@/features/map/contexts/MapViewContext';
import RemoteEarthquakesDataHandler from '@/features/map/data/remote/RemoteEarthquakesDataHandler';
import RemoteStationsDataHandler from '@/features/map/data/remote/RemoteStationsDataHandler';
import useMapView from '@/features/map/hooks/useMapView';

function BasemapControl() {
  const { activeBase, setActiveBase } = useMapView();
  return <button onClick={() => setActiveBase('default')}>{activeBase}</button>;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('keeps one stream and interval across a basemap change and disposes both on unmount', async () => {
  vi.spyOn(RemoteEarthquakesDataHandler.prototype, 'fetchEarthquakes').mockResolvedValue([]);
  vi.spyOn(RemoteStationsDataHandler.prototype, 'fetchAllStations').mockResolvedValue([]);

  const close = vi.fn();
  const EventSource = vi.fn(function () {
    this.addEventListener = vi.fn();
    this.close = close;
  });
  vi.stubGlobal('EventSource', EventSource);
  const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
  const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

  const queryClient = new QueryClient({ defaultOptions: { queries: { cacheTime: Infinity } } });
  const { unmount } = render(
    <QueryClientProvider client={queryClient}>
      <MapViewProvider>
        <BasemapControl />
      </MapViewProvider>
    </QueryClientProvider>,
  );
  await act(async () => {});

  expect(EventSource).toHaveBeenCalledTimes(1);
  expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  const interval = setIntervalSpy.mock.results[0].value;

  fireEvent.click(screen.getByRole('button', { name: 'satellite' }));
  expect(screen.getByRole('button', { name: 'default' })).toBeInTheDocument();
  expect(EventSource).toHaveBeenCalledTimes(1);
  expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  expect(clearIntervalSpy).not.toHaveBeenCalledWith(interval);

  unmount();
  expect(close).toHaveBeenCalledTimes(1);
  expect(clearIntervalSpy).toHaveBeenCalledWith(interval);
});
