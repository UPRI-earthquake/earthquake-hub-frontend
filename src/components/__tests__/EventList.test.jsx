import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import EventList from '../EventList.jsx';

const reducer = (state = null, action) => {
  switch (action.type) {
    case 'SELECT':
      return action.payload;
    case 'DESELECT':
      return null;
    default:
      return state;
  }
};

const makeStore = () => createStore(reducer);

const baseItems = [
  { publicID: 'a', magnitude_value: 2.0, OT: '2025-01-02T10:00:00Z', place: 'Alpha', text: '' },
  { publicID: 'b', magnitude_value: 4.5, OT: '2025-01-03T10:00:00Z', place: 'Bravo', text: '' },
  { publicID: 'c', magnitude_value: 3.2, OT: '2025-01-01T10:00:00Z', place: 'Charlie', text: '' },
];

function getRenderedIds(container) {
  return Array.from(container.querySelectorAll('[data-publicid]')).map((n) =>
    n.getAttribute('data-publicid'),
  );
}

test('sort by magnitude ascending and descending', () => {
  const { container, rerender } = render(
    <Provider store={makeStore()}>
      <EventList events={baseItems} sort={{ by: 'mag', order: 'asc' }} />
    </Provider>,
  );
  expect(getRenderedIds(container)).toEqual(['a', 'c', 'b']);

  rerender(
    <Provider store={makeStore()}>
      <EventList events={baseItems} sort={{ by: 'mag', order: 'desc' }} />
    </Provider>,
  );
  expect(getRenderedIds(container)).toEqual(['b', 'c', 'a']);
});

test('filters by text', () => {
  const { container } = render(
    <Provider store={makeStore()}>
      <EventList events={baseItems} filters={{ searchText: 'bra' }} />
    </Provider>,
  );
  expect(getRenderedIds(container)).toEqual(['b']);
});

test('empty state renders when no results', () => {
  const { container } = render(
    <Provider store={makeStore()}>
      <EventList events={[]} />
    </Provider>,
  );
  expect(container.textContent).toMatch(/No results/i);
});

test('marks migrated legacy primary events', () => {
  const { container } = render(
    <Provider store={makeStore()}>
      <EventList
        events={[
          {
            ...baseItems[0],
            isLegacyRecord: true,
            sourceLabel: 'UPRI Legacy Catalog',
          },
        ]}
      />
    </Provider>,
  );

  expect(container.textContent).toMatch(/Legacy/);
});
