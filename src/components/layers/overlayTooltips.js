/**
 * Tooltip builders for Fault Lines and Plate Boundaries overlays.
 * These return small HTML snippets used by Leaflet's bindTooltip.
 */

function escapeHtml(txt) {
  return String(txt == null ? '' : txt)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Parse a "(center,min,max)"-like triple. Accepts partials.
function parseTriple(val) {
  const s = String(val == null ? '' : val);
  const m = s.match(
    /\(?\s*([+-]?\d*\.?\d+)?\s*,\s*([+-]?\d*\.?\d+)?\s*,\s*([+-]?\d*\.?\d+)?\s*\)?/,
  );
  if (!m) return null;
  const nums = m.slice(1).map((x) => (x == null || x === '' ? null : parseFloat(x)));
  return nums; // [center, min, max]
}

// Normalize text fields: replace underscores/double spaces, trim.
function normalizeLabel(txt) {
  return String(txt == null ? '' : txt)
    .replace(/[\\/_|]+/g, ' - ')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Normalize plate code for lookup (strip non-word, uppercase)
function normalizeCode(txt) {
  return String(txt == null ? '' : txt)
    .replace(/[^\w]/g, '')
    .toUpperCase();
}

// Plate identifier → full name mapping (partial list; fallback to code)
const PLATE_NAME_MAP = {
  AF: 'Africa',
  AM: 'Amur',
  AN: 'Antarctica',
  AP: 'Altiplano',
  AR: 'Arabia',
  AS: 'Aegean Sea',
  AT: 'Anatolia',
  AU: 'Australia',
  BH: 'Birds Head',
  BR: 'Balmoral',
  BS: 'Banda Sea',
  BU: 'Burma',
  CA: 'Caribbean',
  CL: 'Caroline',
  CO: 'Cocos',
  CR: 'Conway Reef',
  CA: 'Caribbean',
  EA: 'Easter',
  EU: 'Eurasia',
  FT: 'Futuna',
  GP: 'Galapagos',
  IN: 'India',
  JF: 'Juan de Fuca',
  JZ: 'Juan Fernandez',
  KE: 'Kermadec',
  MA: 'Mariana',
  MN: 'Manus',
  MO: 'Maoke',
  MS: 'Molucca Sea',
  NA: 'North America',
  NB: 'North Bismarck',
  ND: 'North Andes',
  NH: 'New Hebrides',
  NI: "Niuafo'ou",
  NZ: 'Nazca',
  OK: 'Okhotsk',
  ON: 'Okinawa',
  PA: 'Pacific',
  PM: 'Panama',
  PS: 'Philippine Sea',
  RI: 'Rivera',
  SA: 'South America',
  SB: 'South Bismarck',
  SC: 'Scotia',
  SL: 'Shetland',
  SO: 'Somalia',
  SS: 'Solomon Sea',
  SU: 'Sunda',
  SW: 'Sandwich',
  TI: 'Timor',
  TO: 'Tonga',
  WL: 'Woodlark',
  YA: 'Yangtze',
};

export function buildFaultTooltip(props) {
  if (!props) return '';
  const name = normalizeLabel(props.name || 'Unnamed Fault');
  const slipType = props.slip_type || props.slipType || '';
  const slip = parseTriple(props.net_slip_rate);
  const dip = parseTriple(props.average_dip);
  const rake = parseTriple(props.average_rake);
  const dipDir = props.dip_dir || props.dip_direction || '';
  const usd = parseTriple(props.upper_seis_depth);
  const lsd = parseTriple(props.lower_seis_depth);

  const fmtNum = (n, unit = '') =>
    typeof n === 'number' && !Number.isNaN(n) ? `${n}${unit}` : null;
  const slipCenter = fmtNum(slip && slip[0], ' mm/yr');
  const slipMin = fmtNum(slip && slip[1], '');
  const slipMax = fmtNum(slip && slip[2], '');
  const slipStr = slipCenter
    ? slipMin && slipMax
      ? `${slipCenter} (${slipMin}–${slipMax})`
      : slipCenter
    : null;

  const dipStr = fmtNum(dip && dip[0], '°');
  const rakeStr = fmtNum(rake && rake[0], '°');
  const usdKm = fmtNum(usd && usd[0], ' km');
  const lsdKm = fmtNum(lsd && lsd[0], ' km');
  const depthStr = usdKm && lsdKm ? `${usdKm} – ${lsdKm}` : usdKm || lsdKm;

  const rows = [];
  if (slipType)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Slip Type</span><span class="ft-v">${escapeHtml(
        slipType,
      )}</span></div>`,
    );
  if (slipStr)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Slip Rate</span><span class="ft-v">${escapeHtml(
        slipStr,
      )}</span></div>`,
    );
  if (dipStr || dipDir)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Dip</span><span class="ft-v">${escapeHtml(
        [dipStr, dipDir].filter(Boolean).join(' '),
      )}</span></div>`,
    );
  if (rakeStr)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Rake</span><span class="ft-v">${escapeHtml(
        rakeStr,
      )}</span></div>`,
    );
  if (depthStr)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Seis. Depth</span><span class="ft-v">${escapeHtml(
        depthStr,
      )}</span></div>`,
    );

  return `
    <div class="ft-tip">
      <div class="ft-title">${escapeHtml(name)}</div>
      ${rows.join('')}
    </div>
  `;
}

export function buildFaultTitle(props) {
  if (!props) return '';
  return normalizeLabel(props.name || 'Unnamed Fault');
}

export function buildPlateTooltip(props) {
  if (!props) return '';
  const a = props.PlateA || '';
  const b = props.PlateB || '';
  const nameRaw = props.Name || (a && b ? `${a}-${b}` : 'Plate Boundary');
  const type = props.Type || '';
  const src = props.Source || '';
  const normA = normalizeLabel(a);
  const normB = normalizeLabel(b);
  const codeA = normalizeCode(a);
  const codeB = normalizeCode(b);
  const fullA = PLATE_NAME_MAP[codeA] || normA || a || '';
  const fullB = PLATE_NAME_MAP[codeB] || normB || b || '';
  const codeLabel = [codeA || normA || a, codeB || normB || b].filter(Boolean).join('-');
  const name =
    codeLabel ||
    PLATE_NAME_MAP[normalizeCode(nameRaw)] ||
    normalizeLabel(nameRaw) ||
    (fullA && fullB ? `${fullA} – ${fullB}` : 'Plate Boundary');
  const rows = [];
  if (a || b)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Plates</span><span class="ft-v">${escapeHtml(
        [fullA || normA || a, fullB || normB || b].filter(Boolean).join(' – '),
      )}</span></div>`,
    );
  if (type)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Type</span><span class="ft-v">${escapeHtml(
        type,
      )}</span></div>`,
    );
  if (src)
    rows.push(
      `<div class="ft-row"><span class="ft-k">Source</span><span class="ft-v">${escapeHtml(
        src,
      )}</span></div>`,
    );
  return `
    <div class="ft-tip">
      <div class="ft-title">${escapeHtml(name)}</div>
      ${rows.join('')}
    </div>
  `;
}

export function buildPlateTitle(props) {
  if (!props) return '';
  const a = props.PlateA || '';
  const b = props.PlateB || '';
  const nameRaw = props.Name || '';
  const normA = normalizeLabel(a);
  const normB = normalizeLabel(b);
  const codeA = normalizeCode(a);
  const codeB = normalizeCode(b);
  const fullA = PLATE_NAME_MAP[codeA] || normA || a || '';
  const fullB = PLATE_NAME_MAP[codeB] || normB || b || '';
  const codeLabel = [codeA || normA || a, codeB || normB || b].filter(Boolean).join('-');
  return normalizeLabel(
    codeLabel ||
      PLATE_NAME_MAP[normalizeCode(nameRaw)] ||
      nameRaw ||
      (fullA && fullB ? `${fullA} – ${fullB}` : 'Plate Boundary'),
  );
}
