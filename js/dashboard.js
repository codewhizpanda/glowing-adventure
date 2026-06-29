import { state } from './state.js';
import { fmt, sameDay, parseSheetDate } from './utils.js';
import { showSyncOverlay, hideSyncOverlay } from './sync.js';
import { toast } from './toast.js';


async function fetchSales() {
  if (!state.scriptUrl) return null;
  const res = await fetch(state.scriptUrl + '?action=getSales');
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.sales || [];
}

function parseSaleDate(row) {
  // Date column is en-PH locale string e.g. "6/29/2026"
  return new Date(row.Date);
}

function startOf(unit) {
  const d = new Date();
  if (unit === 'week') d.setDate(d.getDate() - d.getDay());
  if (unit === 'month') d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function initDashboard() {
  if (!state.scriptUrl) {
    toast('Connect Google Sheets in Setup first', 'error');
    return;
  }
  showSyncOverlay('Loading dashboard data…');
  try {
    const rows = await fetchSales();
    renderDashboard(rows);
  } catch (e) {
    toast('Could not load dashboard: ' + e.message, 'error');
  } finally {
    hideSyncOverlay();
  }
}

function renderDashboard(rows) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayLocale = todayStr();
  const weekStart = startOf('week');
  const monthStart = startOf('month');

  let todayNet = 0, weekNet = 0, monthNet = 0, todayUnits = 0;
  let cash = 0, card = 0, hc = 0;
  const staffMap = {};

  rows.forEach(r => {
    const net = Number(r.NetSales) || 0;
    const qty = Number(r.Qty) || 0;
    const d = parseSheetDate(r.Date);
    if (!d) return;

    if (sameDay(r.Date)) { todayNet += net; todayUnits += qty; }
    if (d >= weekStart) weekNet += net;
    if (d >= monthStart) monthNet += net;

    const pmt = String(r.Payment || '');
    if (pmt === 'Cash') cash += net;
    else if (pmt === 'Card') card += net;
    else if (pmt === 'Home Credit') hc += net;

    const staff = String(r.Staff || 'Unknown');
    staffMap[staff] = (staffMap[staff] || 0) + net;
  });

  document.getElementById('db-today').textContent = fmt(todayNet);
  document.getElementById('db-week').textContent = fmt(weekNet);
  document.getElementById('db-month').textContent = fmt(monthNet);
  document.getElementById('db-units').textContent = todayUnits;

  const target = state.settings.dailyTarget || 0;
  const met = todayNet >= target;
  const badge = document.getElementById('db-target-badge');
  badge.textContent = fmt(todayNet) + ' / ₱' + target.toLocaleString();
  badge.style.color = met ? 'var(--green)' : 'var(--red)';

  renderBarChart(rows, today);
  renderDonut(cash, card, hc);
  renderStaff(staffMap);
}

function renderBarChart(rows, today) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ date: d, label: d.toLocaleDateString('en-PH', { weekday: 'short' }), net: 0 });
  }

  rows.forEach(r => {
    const net = Number(r.NetSales) || 0;
    const rd = parseSheetDate(r.Date);
    if (!rd) return;
    const day = days.find(d => sameDay(r.Date, d.date));
    if (day) day.net += net;
  });

  const max = Math.max(...days.map(d => d.net), 1);
  const barWrap = document.getElementById('db-bar-chart');
  const labelWrap = document.getElementById('db-bar-labels');
  const colW = `calc((100% - ${6 * 6}px) / 7)`;

  barWrap.innerHTML = days.map(d => {
    const pct = Math.max((d.net / max) * 100, d.net > 0 ? 4 : 0);
    const isToday = sameDay(d.date.toISOString(), today);
    return `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;">
      <span style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;">${d.net > 0 ? '₱' + Math.round(d.net / 1000) + 'k' : ''}</span>
      <div style="width:100%;border-radius:6px 6px 0 0;height:${pct}%;min-height:${d.net > 0 ? 4 : 0}px;background:${isToday ? 'var(--accent)' : 'var(--accent-light)'};transition:height .3s;"></div>
    </div>`;
  }).join('');

  labelWrap.innerHTML = days.map(d => {
    const isToday = sameDay(d.date.toISOString(), today);
    return `<div style="flex:1;text-align:center;font-size:10px;color:${isToday ? 'var(--accent)' : 'var(--muted)'};font-weight:${isToday ? '700' : '400'};">${d.label}</div>`;
  }).join('');
}

function renderDonut(cash, card, hc) {
  const total = cash + card + hc || 1;
  const segments = [
    { label: 'Cash', value: cash, color: '#16a34a' },
    { label: 'Card', value: card, color: '#1b2e6b' },
    { label: 'HC', value: hc, color: '#d97706' },
  ].filter(s => s.value > 0);

  const r = 15.9, cx = 21, cy = 21, circ = 2 * Math.PI * r;
  let offset = 0;
  let paths = '';
  const segs = segments.map(s => ({ ...s, pct: s.value / total }));
  segs.forEach(s => {
    const dash = s.pct * circ;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="8" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
  });

  const svg = document.getElementById('db-donut');
  svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="8"/>${paths}`;

  document.getElementById('db-donut-legend').innerHTML = segs.map(s =>
    `<div style="display:flex;align-items:center;gap:8px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0;"></span>
      <span>${s.label}: <strong class="mono">₱${s.value.toLocaleString()}</strong></span>
    </div>`
  ).join('') || '<span style="color:var(--muted);">No data</span>';
}

function renderStaff(staffMap) {
  const entries = Object.entries(staffMap).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  document.getElementById('db-staff').innerHTML = entries.length
    ? entries.map(([name, val]) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span>${name}</span><span class="mono" style="font-weight:700;">${fmt(val)}</span>
        </div>
        <div style="height:6px;border-radius:4px;background:var(--border);overflow:hidden;">
          <div style="width:${(val/max*100).toFixed(1)}%;height:100%;background:var(--accent);border-radius:4px;"></div>
        </div>
      </div>`).join('')
    : '<span style="color:var(--muted);">No data</span>';
}

window.initDashboard = initDashboard;
