import { state, saveInv } from './state.js';
import { ik, vl, fmt } from './utils.js';
import { toast } from './toast.js';
import { generatePO } from './purchase-orders.js';
import { renderInv } from './inventory.js';
import { showS } from './nav.js';
import { processQueue, getQueue } from './sync.js';

export function renderSalesTable() {
  const body = document.getElementById('salesBody');
  const foot = document.getElementById('salesFoot');
  const sum = document.getElementById('summarySection');
  if (!state.saleRows.length) {
    body.innerHTML = '<tr><td colspan="14" style="text-align:center;color:var(--muted);padding:28px;">No transactions yet.</td></tr>';
    foot.style.display = 'none';
    sum.style.display = 'none';
    return;
  }
  let tS = 0, tP = 0, tD = 0, tN = 0;
  body.innerHTML = state.saleRows.map(r => {
    tS += r.soldPrice * r.qty;
    tP += r.pasaPrice || 0;
    tD += r.discount || 0;
    tN += r.netSales || 0;
    const tc = r.soldType === 'Pasa'
      ? `<span style="color:var(--accent2);font-weight:600;">Pasa</span>${r.promoter ? '<br><span style="font-size:10px;color:var(--muted);">' + r.promoter + '</span>' : ''}`
      : '<span style="color:var(--green);font-weight:600;">Walk-in</span>';
    const codeStyle = r.isPromotion ? 'color:#15803d;' : 'color:var(--accent2);';
    return `<tr>
      <td style="font-size:11px;" class="mono">${r.so || '—'}</td>
      <td style="font-size:11px;font-family:monospace;font-weight:600;${codeStyle}">${r.bundle || '—'}</td>
      <td style="font-weight:600;">${r.itemName}${r.isAddon ? ' <span style="font-size:10px;background:var(--accent-light);color:var(--accent);padding:1px 5px;border-radius:4px;">add-on</span>' : ''}${r.imeis && r.imeis.length ? '<div style="font-size:10px;font-family:monospace;color:var(--muted);margin-top:2px;">' + r.imeis.join(' · ') + '</div>' : ''}</td>
      <td style="color:var(--muted);font-size:12px;">${r.variant || '—'}</td>
      <td>${r.color || '—'}</td>
      <td class="mono">${r.qty}</td>
      <td class="mono" style="color:var(--muted);">₱${(r.unitPrice||0).toLocaleString()}</td>
      <td class="mono">₱${r.srp.toLocaleString()}</td>
      <td class="mono" style="font-weight:700;color:var(--accent);">₱${(r.soldPrice * r.qty).toLocaleString()}</td>
      <td class="mono">${r.pasaPrice > 0 ? '₱' + r.pasaPrice.toLocaleString() : 'N/A'}</td>
      <td class="mono" style="color:var(--red);">${r.discount > 0 ? '₱' + r.discount.toLocaleString() : 'N/A'}</td>
      <td class="mono" style="color:var(--green);">₱${(r.netSales || 0).toLocaleString()}</td>
      <td>${r.payment}</td>
      <td>${tc}</td>
      <td><span onclick="removeRow(${r.id})" style="cursor:pointer;color:var(--muted);">✕</span></td>
    </tr>`;
  }).join('');
  document.getElementById('tot-sold').textContent = fmt(tS);
  document.getElementById('tot-pasa').textContent = tP > 0 ? fmt(tP) : 'N/A';
  document.getElementById('tot-disc').textContent = tD > 0 ? fmt(tD) : 'N/A';
  document.getElementById('tot-net').textContent = fmt(tN);
  foot.style.display = '';
  sum.style.display = 'block';
}

export function renderSummary() {
  if (!state.saleRows.length) return;
  const gross = state.saleRows.reduce((s, r) => s + r.soldPrice * r.qty, 0);
  const disc = state.saleRows.reduce((s, r) => s + (r.discount || 0), 0);
  const net = state.saleRows.reduce((s, r) => s + (r.netSales || 0), 0);
  const cash = state.saleRows.filter(r => r.payment === 'Cash').reduce((s, r) => s + r.soldPrice * r.qty, 0);
  const card = state.saleRows.filter(r => r.payment === 'Card').reduce((s, r) => s + r.soldPrice * r.qty, 0);
  const hc = state.saleRows.filter(r => r.payment === 'Home Credit').reduce((s, r) => s + r.soldPrice * r.qty, 0);

  document.getElementById('s-gross').textContent = fmt(gross);
  document.getElementById('s-disc').textContent = disc > 0 ? fmt(disc) : 'N/A';
  document.getElementById('s-net').textContent = fmt(net);
  document.getElementById('s-cash').textContent = cash > 0 ? fmt(cash) : 'N/A';
  document.getElementById('s-card').textContent = card > 0 ? fmt(card) : 'N/A';
  document.getElementById('s-hc').textContent = hc > 0 ? fmt(hc) : 'N/A';

  const sm = {};
  state.saleRows.forEach(r => { sm[r.staff] = (sm[r.staff] || 0) + (r.netSales || 0); });
  let sh = '', st = 0;
  Object.entries(sm).forEach(([n, v]) => {
    st += v;
    sh += `<div style="display:flex;justify-content:space-between;"><span>${n}:</span><span class="mono" style="font-weight:700;">${fmt(v)}</span></div>`;
  });
  sh += `<div style="border-top:1px solid var(--border);margin:8px 0;"></div>
    <div style="display:flex;justify-content:space-between;"><span>TOTAL:</span>
    <span class="mono" style="font-weight:700;color:var(--accent);">${fmt(st)}</span></div>`;
  document.getElementById('s-staff').innerHTML = sh;

  const target = state.settings.dailyTarget;
  const met = net >= target;
  const gap = target - net;
  document.getElementById('s-result').innerHTML = met
    ? `<span style="color:var(--green);display:flex;align-items:center;gap:6px;"><svg style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-check-circle"/></svg> Target Met!</span>`
    : `<span style="color:var(--red);display:flex;align-items:center;gap:6px;"><svg style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-x-circle"/></svg> Below Target</span><div style="font-size:13px;color:var(--muted);font-weight:400;margin-top:4px;">${fmt(gap)} to go</div>`;

  const bt = fmt(net) + ' / ₱' + target.toLocaleString();
  const bb = met ? '#dcfce7' : '#fee2e2';
  const bc = met ? '#16a34a' : '#dc2626';
  ['targetBadge', 'targetBadge2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = bt; el.style.background = bb; el.style.color = bc; }
  });
}

export function removeRow(id) {
  const r = state.saleRows.find(x => x.id === id);
  if (r && state.inventory[r.productKey]) state.inventory[r.productKey].stock += r.qty;
  state.saleRows = state.saleRows.filter(x => x.id !== id);
  saveInv();
  renderSalesTable();
  renderSummary();
}

export async function submitDayReport() {
  if (!state.saleRows.length) { toast('No transactions to submit', 'error'); return; }
  if (getQueue().length > 0 && state.scriptUrl) {
    await processQueue();
  } else if (!state.scriptUrl) {
    toast('No sheet connected — data saved locally', 'success');
  }
  const low = [];
  state.PRODUCTS.forEach(p => {
    const k = ik(p);
    const inv = state.inventory[k];
    if (inv && inv.stock <= inv.reorder) low.push({ name: p.name + (vl(p) ? ' ' + vl(p) : ''), qty: 5 });
  });
  if (low.length) generatePO(low);
  state.saleRows = [];
  state.pendingItems = [];
  state.currentSO = null;
  document.getElementById('soBanner').style.display = 'none';
  renderSalesTable();
  renderSummary();
  renderInv();
  showS('picker');
}

export function printReport() {
  const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const gross = state.saleRows.reduce((s, r) => s + r.soldPrice * r.qty, 0);
  const disc = state.saleRows.reduce((s, r) => s + (r.discount || 0), 0);
  const net = state.saleRows.reduce((s, r) => s + (r.netSales || 0), 0);
  const cash = state.saleRows.filter(r => r.payment === 'Cash').reduce((s, r) => s + r.soldPrice * r.qty, 0);
  const card = state.saleRows.filter(r => r.payment === 'Card').reduce((s, r) => s + r.soldPrice * r.qty, 0);
  const hc = state.saleRows.filter(r => r.payment === 'Home Credit').reduce((s, r) => s + r.soldPrice * r.qty, 0);
  const met = net >= state.settings.dailyTarget;
  const sm = {};
  state.saleRows.forEach(r => { sm[r.staff] = (sm[r.staff] || 0) + (r.netSales || 0); });
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Daily Sales Report</title><style>
    body{font-family:Arial,sans-serif;padding:32px;font-size:12px;}h1{font-size:15px;margin-bottom:2px;}.sub{color:#666;font-size:11px;margin-bottom:16px;}
    table{width:100%;border-collapse:collapse;margin:16px 0;}th{background:#1b2e6b;color:#fff;padding:8px;text-align:left;font-size:10px;}
    td{padding:7px 8px;border-bottom:1px solid #eee;font-size:11px;}.tf td{background:#e8ecf4;font-weight:700;}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px;}.box{border:1px solid #d0d7e8;border-radius:6px;padding:12px;}
    .box h3{font-size:12px;font-weight:700;margin-bottom:8px;color:#1b2e6b;}.row{display:flex;justify-content:space-between;margin-bottom:4px;}
    .sig{margin-top:40px;}@media print{body{padding:16px;}}
  </style></head><body>`);
  win.document.write('<h1>KHONSU ELECTRONIC GADGETS TRADING (ITEL MOBILE)</h1>');
  win.document.write('<div class="sub">Space No. K424.6 Festival Mall, FCC, Alabang, Muntinlupa City</div>');
  win.document.write(`<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><div></div><div style="text-align:right;"><strong style="font-size:14px;">DAILY SALES REPORT</strong><br><span style="color:#666;">${date}</span></div></div>`);
  win.document.write('<table><thead><tr><th>SO#</th><th>Code</th><th>Item</th><th>Variant</th><th>Color</th><th>Qty</th><th>Unit Price</th><th>SRP</th><th>Sold Price</th><th>Pasa</th><th>Discount</th><th>Net Sales</th><th>Payment</th><th>Walk-in</th><th>Pasa</th><th>Staff</th></tr></thead><tbody>');
  state.saleRows.forEach(r => {
    win.document.write(`<tr><td>${r.so || '—'}</td><td>${r.bundle || '—'}</td><td>${r.itemName}</td><td>${r.variant || ''}</td><td>${r.color || ''}</td><td>${r.qty}</td><td>P ${(r.unitPrice||0).toLocaleString()}</td><td>P ${r.srp.toLocaleString()}</td><td>P ${(r.soldPrice * r.qty).toLocaleString()}</td><td>${r.pasaPrice > 0 ? 'P ' + r.pasaPrice.toLocaleString() : 'N/A'}</td><td>${r.discount > 0 ? 'P ' + r.discount.toLocaleString() : 'N/A'}</td><td>P ${(r.netSales || 0).toLocaleString()}</td><td>${r.payment}</td><td style="text-align:center;">${r.soldType === 'Walk-in' ? '✓' : ''}</td><td style="text-align:center;">${r.soldType === 'Pasa' ? '✓ ' + (r.promoter || '') : ''}</td><td>${r.staff}</td></tr>`);
  });
  win.document.write(`</tbody><tfoot><tr class="tf"><td colspan="8">TOTAL</td><td>P ${gross.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td></td><td>${disc > 0 ? 'P ' + disc.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : 'N/A'}</td><td>P ${net.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td><td colspan="4"></td></tr></tfoot></table>`);
  win.document.write(`<div class="grid">
    <div class="box"><h3>SALES SUMMARY</h3>
      <div class="row"><span>Gross:</span><span>P ${gross.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
      <div class="row"><span>Discounts:</span><span>${disc > 0 ? 'P ' + disc.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : 'N/A'}</span></div>
      <div class="row"><span>Net Sales:</span><span><strong>P ${net.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></span></div>
      <hr style="margin:8px 0;">
      <div class="row"><span>Cash:</span><span>${cash > 0 ? 'P ' + cash.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : 'N/A'}</span></div>
      <div class="row"><span>Card:</span><span>${card > 0 ? 'P ' + card.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : 'N/A'}</span></div>
      <div class="row"><span>Home Credit:</span><span>${hc > 0 ? 'P ' + hc.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : 'N/A'}</span></div>
    </div>
    <div class="box"><h3>STAFF'S SALES</h3>
      ${Object.entries(sm).map(([n, v]) => `<div class="row"><span>${n}:</span><span>P ${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>`).join('')}
      <hr style="margin:8px 0;">
      <div class="row"><strong>DAILY TARGET: ${state.settings.dailyTarget.toLocaleString()}.00 Php</strong></div>
    </div>
    <div class="box"><h3>RESULT</h3><div style="font-size:14px;font-weight:700;">${met ? 'MET' : 'BELOW TARGET'}</div></div>
  </div>`);
  win.document.write(`<div class="sig"><p><strong>PREPARED BY:</strong></p><p style="margin-top:16px;">Name: ________________________________&nbsp;&nbsp;&nbsp;Date: ${date}</p><p style="margin-top:12px;">Signature: ________________________________</p></div>`);
  win.document.write('<scr' + 'ipt>window.onload=()=>window.print();<\/scr' + 'ipt></body></html>');
  win.document.close();
}

window.removeRow = removeRow;
window.submitDayReport = submitDayReport;
window.printReport = printReport;
