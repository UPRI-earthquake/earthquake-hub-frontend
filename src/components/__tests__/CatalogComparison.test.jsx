import React from 'react';
import { render, screen } from '@testing-library/react';
import CatalogComparison from '../CatalogComparison';

const baseEvent = {
  OT: '2026-05-04T06:09:52.000Z',
  latitude_value: 11.614,
  longitude_value: 125.112,
  depth_value: 10,
  magnitude_value: 6.1,
  place: 'Samar, Philippines',
};

test('keeps the catalog panel but omits empty source placeholders', () => {
  const { container } = render(
    <CatalogComparison
      earthquakeInfo={{
        ...baseEvent,
        additionalInformation: {
          phivolcs: {},
          usgs: {},
        },
      }}
    />,
  );

  expect(screen.getByText('Other catalog records')).toBeInTheDocument();
  expect(container.querySelectorAll('.source-compact-row:not(.source-compact-header)')).toHaveLength(1);
  expect(container.querySelectorAll('.source-compact-name')[0]).toHaveTextContent('UPRI');
});

test('renders only catalog sources with available match data', () => {
  const { container } = render(
    <CatalogComparison
      earthquakeInfo={{
        ...baseEvent,
        additionalInformation: {
          phivolcs: {
            source: 'phivolcs',
            magnitude: 6.2,
            time: '2026-05-04T06:10:00.000Z',
            distanceKm: 42,
            magnitudeDifference: 0.1,
          },
          usgs: {},
        },
      }}
    />,
  );

  expect(screen.getByText('Other catalog records')).toBeInTheDocument();
  expect(screen.getByText('PHIVOLCS')).toBeInTheDocument();
  expect(container.querySelectorAll('.source-compact-row:not(.source-compact-header)')).toHaveLength(2);
  expect(container.querySelectorAll('.source-compact-name')[1]).toHaveTextContent('PHIVOLCS');
});

test('renders migrated legacy catalog records with a stable UPRI label', () => {
  render(
    <CatalogComparison
      earthquakeInfo={{
        ...baseEvent,
        additionalInformation: [
          {
            source: 'upri-legacy',
            sourceLabel: 'UPRI Legacy Catalog',
            id: 'old-public-id',
            magnitude: 6,
            time: '2026-05-04T06:09:50.000Z',
          },
        ],
      }}
    />,
  );

  expect(screen.getByText('UPRI Legacy Catalog')).toBeInTheDocument();
});
