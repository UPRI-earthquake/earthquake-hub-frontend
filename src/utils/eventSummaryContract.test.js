import { eventSummaryProjection } from './eventSummaryContract';

describe('eventSummaryProjection', () => {
  it('merges canonical public summary fields and can clear an old custom override', () => {
    expect(eventSummaryProjection({
      effectiveSummary: 'Generated summary.',
      eventSummary: 'Generated summary.',
      generatedSummary: 'Generated summary.',
      summaryPublication: { source: 'generated' },
    })).toEqual({
      effectiveSummary: 'Generated summary.',
      eventSummary: 'Generated summary.',
      generatedSummary: 'Generated summary.',
      summaryOverride: undefined,
      summaryPublication: { source: 'generated' },
    });
  });

  it('does not clear summary fields for legacy SSE payloads', () => {
    expect(eventSummaryProjection({ publicID: 'legacy-event' })).toEqual({});
  });
});
