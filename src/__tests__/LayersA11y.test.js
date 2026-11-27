import { fireEvent, screen } from '@testing-library/react';
import { renderMap } from './renderMap';

test('Layers control toggles via keyboard and sets aria-expanded', async () => {
  const { container } = renderMap();
  const toggle = await screen.findByRole('button', { name: 'Layers' });
  const panel = container.querySelector('.leaflet-control-layers');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');

  fireEvent.keyDown(window, { key: 'L' });

  expect(panel).toHaveClass('leaflet-control-layers-expanded');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');

  panel.querySelector('input').focus();
  fireEvent.keyDown(window, { key: 'Escape' });

  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveFocus();
});
