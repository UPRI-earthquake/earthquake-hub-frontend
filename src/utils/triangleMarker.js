export function tintHex(hex, amt) {
  const h = String(hex || '').replace('#', '');
  if (![3, 6].includes(h.length)) return hex;
  const n =
    h.length === 3
      ? h.split('').map((c) => parseInt(c + c, 16))
      : [
          parseInt(h.slice(0, 2), 16),
          parseInt(h.slice(2, 4), 16),
          parseInt(h.slice(4, 6), 16),
        ];
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const res = n.map((v) => clamp(v + 255 * amt));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(res[0])}${toHex(res[1])}${toHex(res[2])}`;
}

export function buildTriangleSVG(baseHex = '#2e8b57', idSuffix = 'tri') {
  const safeId = String(idSuffix || 'tri').replace(/[^a-zA-Z0-9_-]/g, '') || 'tri';
  const prefix = `tri-${safeId}`;
  const leftId = `${prefix}-left`;
  const rightId = `${prefix}-right`;
  const baseId = `${prefix}-base`;
  const shadowId = `${prefix}-shadow`;
  const facet1 = tintHex(baseHex, 0.18);
  const facet2 = tintHex(baseHex, -0.12);
  const facet3 = tintHex(baseHex, -0.28);
  const shadow = 'rgba(0,0,0,0.22)';
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110" role="img" aria-label="Station marker">
  <defs>
    <linearGradient id="${leftId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${facet1}"/>
      <stop offset="100%" stop-color="${facet2}"/>
    </linearGradient>
    <linearGradient id="${rightId}" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${facet2}"/>
      <stop offset="100%" stop-color="${facet3}"/>
    </linearGradient>
    <linearGradient id="${baseId}" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="${facet2}"/>
      <stop offset="100%" stop-color="${facet3}"/>
    </linearGradient>
    <filter id="${shadowId}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${shadow}"/>
    </filter>
  </defs>
  <g filter="url(#${shadowId})">
    <polygon points="60 6 6 104 60 84" fill="url(#${leftId})"/>
    <polygon points="60 6 114 104 60 84" fill="url(#${rightId})"/>
    <polygon points="6 104 114 104 60 84" fill="url(#${baseId})"/>
  </g>
</svg>`;
}
