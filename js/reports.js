import { state } from './state.js';
import { fmt } from './utils.js';
import { showSyncOverlay, hideSyncOverlay } from './sync.js';
import { toast } from './toast.js';

async function fetchSales() {
  if (!state.scriptUrl) return null;
  const res = await fetch(state.scriptUrl + '?action=getSales');
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.sales || [];
}

function startOf(unit) {
  const d = new Date();
  if (unit === 'week') d.setDate(d.getDate() - d.getDay());
  if (unit === 'month') d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function setActivePeriodBtn(period) {
  ['today', 'week', 'month'].forEach(p => {
    const btn = document.getElementById('rp-btn-' + p);
    if (btn) btn.className = 'btn btn-sm ' + (p === period ? 'btn-primary' : 'btn-outline');
  });
}

export async function loadReportPeriod(period) {
  setActivePeriodBtn(period);
  const tbody = document.getElementById('rp-body');
  tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:28px;">Loading…</td></tr>';

  let rows = null;

  if (state.scriptUrl) {
    showSyncOverlay('Loading report data…');
    try {
      rows = await fetchSales();
    } catch (e) {
      toast('Could not load from Sheets — showing local data', 'error');
    } finally {
      hideSyncOverlay();
    }
  }

  // Fall back to local saleRows for today
  if (!rows) {
    if (period !== 'today') {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:28px;">Connect Google Sheets to view historical reports.</td></tr>';
      ['rp-total', 'rp-net', 'rp-count'].forEach(id => { document.getElementById(id).textContent = '—'; });
      return;
    }
    rows = state.saleRows.map(r => ({
      Date: new Date().toLocaleDateString('en-PH'),
      SO: r.so, ItemName: r.itemName, Variant: r.variant, Color: r.color,
      Qty: r.qty, SoldPrice: r.soldPrice * r.qty, NetSales: r.netSales,
      Payment: r.payment, Staff: r.staff,
    }));
  }

  const todayLocale = new Date().toLocaleDateString('en-PH');
  const cutoff = period === 'today' ? null : startOf(period === 'week' ? 'week' : 'month');

  const filtered = rows.filter(r => {
    if (period === 'today') return r.Date === todayLocale;
    const d = new Date(r.Date); d.setHours(0, 0, 0, 0);
    return d >= cutoff;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:28px;">No transactions for this period.</td></tr>';
    ['rp-total', 'rp-net', 'rp-count'].forEach(id => { document.getElementById(id).textContent = '0'; });
    return;
  }

  let totalSold = 0, totalNet = 0;
  tbody.innerHTML = filtered.map(r => {
    const sold = Number(r.SoldPrice) || 0;
    const net = Number(r.NetSales) || 0;
    totalSold += sold; totalNet += net;
    return `<tr>
      <td style="padding:8px 12px;font-size:12px;color:var(--muted);">${r.Date || '—'}</td>
      <td style="padding:8px 12px;font-size:11px;font-family:monospace;">${r.SO || '—'}</td>
      <td style="padding:8px 12px;font-weight:600;">${r.ItemName || '—'}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--muted);">${r.Variant || '—'}</td>
      <td style="padding:8px 12px;font-size:12px;">${r.Color || '—'}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;">${r.Qty || 0}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;">₱${sold.toLocaleString()}</td>
      <td style="padding:8px 12px;text-align:right;font-family:monospace;color:var(--green);">₱${net.toLocaleString()}</td>
      <td style="padding:8px 12px;font-size:12px;">${r.Payment || '—'}</td>
      <td style="padding:8px 12px;font-size:12px;">${r.Staff || '—'}</td>
    </tr>`;
  }).join('');

  document.getElementById('rp-total').textContent = fmt(totalSold);
  document.getElementById('rp-net').textContent = fmt(totalNet);
  document.getElementById('rp-count').textContent = filtered.length;
}

export function initReportsPage() {
  loadReportPeriod('today');
}

window.loadReportPeriod = loadReportPeriod;
