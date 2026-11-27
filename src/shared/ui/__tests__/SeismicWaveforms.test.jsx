import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import StationRecordingsSection from '@/features/earthquake-details/ui/components/sections/station-recordings/StationRecordingsSection';

vi.mock('@/features/earthquake-details/hooks/useEarthquakeInfo', () => ({
  default: () => ({ earthquakeInfo: { OT: '2025-01-02T10:00:00Z' } }),
}));

vi.mock('@/features/earthquake-details/hooks/useStationsList', () => ({
  default: () => ({
    allStations: ['R1382', 'R8728', 'R257C', 'R1234'].map((code) => ({ code })),
    stationLocationsByCode: {},
  }),
}));

vi.mock('@/features/earthquake-details/hooks/useStationWaveform', () => ({
  default: () => ({ waveformData: null, isLoading: true }),
}));

describe('StationRecordingsSection', () => {
  it('renders a bounded station preview and opens the all-stations action', () => {
    const onViewAllStations = vi.fn();

    render(
      <StationRecordingsSection
        initialVisibleCount={2}
        onViewAllStations={onViewAllStations}
      />
    );

    expect(screen.getByText('R1382')).toBeInTheDocument();
    expect(screen.getByText('R8728')).toBeInTheDocument();
    expect(screen.queryByText('R257C')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view all 4 stations/i }));

    expect(onViewAllStations).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('R257C')).not.toBeInTheDocument();
  });

  it('renders all stations when used inside the focused recordings view', () => {
    render(
      <StationRecordingsSection
        showAllByDefault
        showStationToggle={false}
      />
    );

    expect(screen.getByText('R1382')).toBeInTheDocument();
    expect(screen.getByText('R8728')).toBeInTheDocument();
    expect(screen.getByText('R257C')).toBeInTheDocument();
    expect(screen.getByText('R1234')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view all/i })).not.toBeInTheDocument();
  });
});
