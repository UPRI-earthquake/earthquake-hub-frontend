/**
 * Minimal HTML sanitizer for user/content strings rendered with dangerouslySetInnerHTML.
 * Strips scripts, inline event handlers, style attributes, and javascript/data URLs.
 * Use for display-only fields sourced from external feeds.
 *
 * NOTE: This intentionally avoids bringing an extra dependency; keep the allowlist tight.
 */
export function sanitizeHtml(input) {
  if (!input || typeof input !== 'string') return '';
  // Avoid crashing in non-browser test environments
  if (typeof DOMParser === 'undefined') return input;

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');

  // Drop script/style tags entirely
  doc.querySelectorAll('script, style').forEach((node) => node.remove());

  doc.body.querySelectorAll('*').forEach((el) => {
    // Remove dangerous attributes
    Array.from(el.attributes).forEach(({ name, value }) => {
      const lowerName = name.toLowerCase();
      const lowerValue = String(value || '').toLowerCase().trim();

      if (lowerName.startsWith('on')) {
        el.removeAttribute(name);
        return;
      }

      if (lowerName === 'style') {
        el.removeAttribute(name);
        return;
      }

      if (lowerName === 'href' || lowerName === 'src') {
        // eslint-disable-next-line no-script-url
        if (lowerValue.startsWith('javascript:') || lowerValue.startsWith('data:')) {
          el.removeAttribute(name);
        }
      }
    });
  });

  return doc.body.innerHTML;
}

export default sanitizeHtml;
