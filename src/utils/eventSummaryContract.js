export function eventSummaryProjection(event) {
  if (!event || typeof event !== 'object') return {};

  const hasCanonicalContract = Object.prototype.hasOwnProperty.call(event, 'effectiveSummary')
    || Object.prototype.hasOwnProperty.call(event, 'summaryPublication');
  if (!hasCanonicalContract) return {};

  return {
    effectiveSummary: event.effectiveSummary,
    eventSummary: event.eventSummary,
    generatedSummary: event.generatedSummary,
    summaryOverride: event.summaryOverride,
    summaryPublication: event.summaryPublication,
  };
}
