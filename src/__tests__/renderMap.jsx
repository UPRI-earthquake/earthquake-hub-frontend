import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { vi } from 'vitest';
import MapCanvas from '@/features/map/ui/components/canvas/MapCanvas';
import { MapViewContext } from '@/features/map/contexts/MapViewContext';

vi.mock('@/features/map/ui/components/canvas/overlays/MapOverlays', () => ({
  default: () => null,
}));

export function renderMap() {
  return render(
    <Provider store={createStore((state = null) => state)}>
      <MapViewContext.Provider value={{ activeBase: 'satellite', setActiveBase: vi.fn() }}>
        <MapCanvas />
      </MapViewContext.Provider>
    </Provider>,
  );
}
