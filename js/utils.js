export function ic(name, size = 15) {
  return `<svg style="width:${size}px;height:${size}px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.125em;display:inline-block;" aria-hidden="true"><use href="#ic-${name}"/></svg>`;
}

export function ik(p) {
  let k = p.name;
  if (p.ram) k += ' ' + p.ram;
  if (p.storage) k += '/' + p.storage;
  return k;
}

export function vl(p) {
  return (p.ram && p.storage) ? p.ram + ' / ' + p.storage : '';
}

// Parse a date value from Google Sheets — may be a locale string ("6/29/2026"),
// an ISO string ("2026-06-28T16:00:00.000Z"), or a Date object.
// Returns a Date in the browser's local timezone, or null on failure.
export function parseSheetDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d) ? null : d;
}

export function sameDay(raw, ref = new Date()) {
  const d = parseSheetDate(raw);
  return d &&
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();
}

export function fmtSheetDate(raw) {
  const d = parseSheetDate(raw);
  return d ? d.toLocaleDateString('en-PH') : String(raw || '—');
}

export function fmt(n) {
  return n === 0 || !n
    ? 'N/A'
    : '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}
