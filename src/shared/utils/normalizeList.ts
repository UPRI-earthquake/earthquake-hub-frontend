/**
 * Normalize backend list fields that may arrive as an Array or a bracketed CSV string.
 * @param {*} value - The value to normalize.
 * @returns {string[]} An array of trimmed, non-empty strings.
 */
export function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const stripped =
      trimmed.startsWith('[') && trimmed.endsWith(']')
        ? trimmed.slice(1, -1)
        : trimmed;
    return stripped
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
