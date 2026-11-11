import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SeismicWaveforms from '../SeismicWaveforms';

jest.mock('../../hooks/useStations', () => ({
  useStations: () => ({
    fetchStations: jest.fn(() => new Promise(() => {})),
  }),
}));

const stations = ['R1382', 'R8728', 'R257C', 'R1234'];

describe('SeismicWaveforms', () => {
  it('renders a bounded station preview and opens the all-stations action', () => {
    const onViewAllStations = jest.fn();

    render(
      <SeismicWaveforms
        earthquakeInfo={{}}
        stations={stations}
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
      <SeismicWaveforms
        earthquakeInfo={{}}
        stations={stations}
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
