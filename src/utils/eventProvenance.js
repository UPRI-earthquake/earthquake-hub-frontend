export const LEGACY_CATALOG_KEYS = new Set([
  'upri-legacy',
  'legacy',
  'legacy-old-server',
  'old-server',
]);

export function isLegacyEvent(event) {
  if (!event || typeof event !== 'object') return false;
  if (event.isLegacyRecord === true) return true;

  const catalog = String(event.sourceCatalog || event.catalogSource || '').trim().toLowerCase();
  return LEGACY_CATALOG_KEYS.has(catalog);
}

export function getEventSourceLabel(event) {
  if (!event || typeof event !== 'object') return '';

  if (isLegacyEvent(event)) {
    return event.sourceLabel || 'Legacy';
  }

  return event.sourceLabel || '';
}
