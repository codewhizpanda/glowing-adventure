import { state, saveInv } from './state.js';
import { ik } from './utils.js';
import { toast } from './toast.js';
import { tryPush } from './sync.js';

export const IMEI_CATS = new Set(['Smart Phone', 'Bar Phone', 'Tablet']);
export const isImeiProduct = p => p && IMEI_CATS.has(p.category);

export function saveUnitsLocal() {
  localStorage.setItem('kt_units', JSON.stringify(state.units));
}

export function initUnits() {
  try { state.units = JSON.parse(localStorage.getItem('kt_units') || '[]'); } catch { state.units = []; }
  let added = 0;
  state.masterList.forEach(p => {
    if (!isImeiProduct(p)) return;
    const key = ik(p);
    const stockCount = (state.inventory[key] || {}).stock || 0;
    const existing = state.units.filter(u => u.productKey === key && u.status === 'available').length;
    for (let i = 0; i < stockCount - existing; i++) {
      state.units.push(_dummy(p, key));
      added++;
    }
  });
  if (added) saveUnitsLocal();
}

function _dummy(p, key) {
  const n = state.units.filter(u => u.productKey === key).length + 1;
  const colors = (p.colors || '').split(',').map(c => c.trim()).filter(Boolean);
  return {
    imei: 'DUMMY-' + key.replace(/[^A-Za-z0-9]/g, '') + '-' + String(n).padStart(3, '0'),
    productKey: key,
    productName: p.name,
    color: colors[0] || '',
    status: 'available',
    drNumber: 'INITIAL',
    receivedDate: new Date().toLocaleDateString('en-PH'),
    soNumber: null,
    soldDate: null,
    isDummy: true,
  };
}

export function getAvailableUnits(productKey) {
  return state.units.filter(u => u.productKey === productKey && u.status === 'available');
}

export function markUnitSold(imei, soNumber) {
  const unit = state.units.find(u => u.imei === imei);
  if (!unit) return;
  unit.status = 'sold';
  unit.soNumber = soNumber;
  unit.soldDate = new Date().toLocaleDateString('en-PH');
  if (state.inventory[unit.productKey]) {
    state.inventory[unit.productKey].stock = getAvailableUnits(unit.productKey).length;
  }
  saveUnitsLocal();
  tryPush('updateUnitStatus', { imei, soNumber, soldDate: unit.soldDate });
}

export function receiveUnits(imeiItems, nonImeiItems, dr) {
  const newUnits = imeiItems.map(item => ({
    imei: item.imei,
    productKey: item.productKey,
    productName: item.productName,
    color: item.color,
    status: 'available',
    drNumber: dr.number,
    receivedDate: dr.date,
    soNumber: null,
    soldDate: null,
    isDummy: false,
  }));
  state.units.push(...newUnits);

  const imeiKeys = [...new Set(newUnits.map(u => u.productKey))];
  imeiKeys.forEach(key => {
    if (!state.inventory[key]) state.inventory[key] = { stock: 0, reorder: 1 };
    state.inventory[key].stock = getAvailableUnits(key).length;
  });

  nonImeiItems.forEach(item => {
    if (!state.inventory[item.productKey]) state.inventory[item.productKey] = { stock: 0, reorder: 1 };
    state.inventory[item.productKey].stock += item.qty;
  });

  saveUnitsLocal();
  saveInv();

  const allKeys = [...new Set([...imeiKeys, ...nonImeiItems.map(i => i.productKey)])];
  if (newUnits.length) tryPush('saveUnits', { units: newUnits });
  tryPush('updateInventoryItems', {
    items: allKeys.map(key => ({
      productKey: key,
      stock: (state.inventory[key] || {}).stock || 0,
      reorder: (state.inventory[key] || {}).reorder || 1,
    })),
  });
}

// ─── IMEI Picker UI ───────────────────────────────────────────────────────────
export function renderIMEIPicker() {
  const p = state.selectedProduct;
  if (!p) return;
  const key = ik(p);
  const selectedSet = new Set((state.selectedIMEIs || []).map(u => u.imei));
  const available = getAvailableUnits(key).filter(u => !selectedSet.has(u.imei));
  const countEl = document.getElementById('imeiAvailCount');
  if (countEl) {
    const n = available.length;
    countEl.textContent = n + ' unit' + (n !== 1 ? 's' : '') + ' available';
  }
  _renderIMEIDropdown(available, '');
  renderSelectedIMEIs();
}

function _renderIMEIDropdown(units, query) {
  const dd = document.getElementById('imeiDropdown');
  if (!dd) return;
  const show = query
    ? units.filter(u => u.imei.toLowerCase().includes(query.toLowerCase()) || u.color.toLowerCase().includes(query.toLowerCase()))
    : units;
  if (!show.length) { dd.style.display = 'none'; return; }
  dd.style.display = 'block';
  dd.innerHTML = show.slice(0, 8).map(u => `
    <div onclick="selectIMEI('${u.imei.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}');"
         style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;"
         onmouseover="this.style.background='var(--accent-light)'" onmouseout="this.style.background=''">
      <div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;color:var(--accent);">${u.imei}</div>
        <div style="font-size:11px;color:var(--muted);">${u.color}${u.isDummy ? ' &middot; placeholder' : ''}</div>
      </div>
      <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:var(--muted);flex-shrink:0;" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`).join('');
}

export function renderSelectedIMEIs() {
  const el = document.getElementById('selectedIMEIList');
  if (!el) return;
  const sel = state.selectedIMEIs || [];
  if (!sel.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">No units selected yet.</div>';
    return;
  }
  el.innerHTML = sel.map((u, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--accent-light);border-radius:8px;margin-bottom:6px;border:1.5px solid var(--accent);">
      <div style="flex:1;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:600;">${u.imei}${u.isDummy ? ' <span style="font-size:10px;color:var(--muted);font-weight:400;">(placeholder)</span>' : ''}</div>
        <div style="font-size:11px;color:var(--muted);">${u.color}</div>
      </div>
      <span onclick="removeSelectedIMEI(${i})" style="cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:0 4px;">&times;</span>
    </div>`).join('');
}

export function filterIMEIList(query) {
  const p = state.selectedProduct;
  if (!p) return;
  const selectedSet = new Set((state.selectedIMEIs || []).map(u => u.imei));
  const available = getAvailableUnits(ik(p)).filter(u => !selectedSet.has(u.imei));
  _renderIMEIDropdown(available, query || '');
}

export function selectIMEI(imei) {
  const unit = state.units.find(u => u.imei === imei && u.status === 'available');
  if (!unit) { toast('Unit not available', 'error'); return; }
  if (!state.selectedIMEIs) state.selectedIMEIs = [];
  if (state.selectedIMEIs.find(u => u.imei === imei)) { toast('Already selected', 'error'); return; }
  state.selectedIMEIs.push(unit);
  const inp = document.getElementById('imeiInput');
  if (inp) inp.value = '';
  const dd = document.getElementById('imeiDropdown');
  if (dd) dd.style.display = 'none';
  renderIMEIPicker();
  if (window.recalc) window.recalc();
}

export function removeSelectedIMEI(i) {
  if (!state.selectedIMEIs) return;
  state.selectedIMEIs.splice(i, 1);
  renderIMEIPicker();
  if (window.recalc) window.recalc();
}

export function selectIMEIFromInput() {
  const inp = document.getElementById('imeiInput');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  const p = state.selectedProduct;
  if (!p) return;
  const selectedSet = new Set((state.selectedIMEIs || []).map(u => u.imei));
  const available = getAvailableUnits(ik(p)).filter(u => !selectedSet.has(u.imei));
  const unit = available.find(u => u.imei === val)
    || available.find(u => u.imei.includes(val) || val.includes(u.imei));
  if (unit) {
    selectIMEI(unit.imei);
  } else if (state.units.find(u => u.imei === val && u.productKey === ik(p) && u.status === 'sold')) {
    toast('This unit has already been sold', 'error');
  } else {
    toast('IMEI not found — receive this stock first', 'error');
  }
  inp.value = '';
}

// ─── Receive Stock page ───────────────────────────────────────────────────────
export function initRestockPage() {
  const dateEl = document.getElementById('rs-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];
  const dl = document.getElementById('rs-product-list');
  if (dl) {
    dl.innerHTML = state.masterList.filter(p => !p.obsolete).map(p => {
      const v = p.ram && p.storage ? ' ' + p.ram + '/' + p.storage : '';
      return `<option value="${p.name + v}">`;
    }).join('');
  }
  state.receiveDraftItems = state.receiveDraftItems || [];
  state.restockProduct = null;
  const inp = document.getElementById('rs-product-input');
  if (inp) inp.value = '';
  const imeiSec = document.getElementById('rs-imei-sec');
  const qtySec = document.getElementById('rs-qty-sec');
  if (imeiSec) imeiSec.style.display = 'none';
  if (qtySec) qtySec.style.display = 'none';
  renderRestockDraft();
}

export function updateRestockProductSelection() {
  const inp = document.getElementById('rs-product-input');
  if (!inp) return;
  const val = inp.value.trim();
  const p = state.masterList.find(x => {
    const v = x.ram && x.storage ? ' ' + x.ram + '/' + x.storage : '';
    return (x.name + v) === val;
  });
  state.restockProduct = p || null;
  const colorSel = document.getElementById('rs-color');
  const imeiSec = document.getElementById('rs-imei-sec');
  const qtySec = document.getElementById('rs-qty-sec');
  if (p) {
    const colors = (p.colors || '').split(',').map(c => c.trim()).filter(Boolean);
    colorSel.innerHTML = colors.length
      ? colors.map(c => `<option value="${c}">${c}</option>`).join('')
      : '<option value="Assorted">Assorted</option>';
    const isImei = isImeiProduct(p);
    if (imeiSec) imeiSec.style.display = isImei ? 'block' : 'none';
    if (qtySec) qtySec.style.display = isImei ? 'none' : 'block';
  } else {
    if (imeiSec) imeiSec.style.display = 'none';
    if (qtySec) qtySec.style.display = 'none';
  }
}

export function addRestockUnit() {
  const p = state.restockProduct;
  if (!p) { toast('Select a product first', 'error'); return; }
  const imeiVal = document.getElementById('rs-imei').value.trim();
  const color = document.getElementById('rs-color').value;
  if (!imeiVal) { toast('Enter or scan an IMEI', 'error'); return; }
  const draft = state.receiveDraftItems || [];
  if (state.units.find(u => u.imei === imeiVal) || draft.find(i => i.imei === imeiVal)) {
    toast('This IMEI already exists in the system', 'error'); return;
  }
  if (!state.receiveDraftItems) state.receiveDraftItems = [];
  state.receiveDraftItems.push({ imei: imeiVal, productKey: ik(p), productName: p.name, color, isImei: true });
  document.getElementById('rs-imei').value = '';
  renderRestockDraft();
  toast('Unit added', 'success');
}

export function addRestockQty() {
  const p = state.restockProduct;
  if (!p) { toast('Select a product first', 'error'); return; }
  const qty = parseInt(document.getElementById('rs-qty').value) || 0;
  const color = document.getElementById('rs-color').value;
  if (qty <= 0) { toast('Enter a valid quantity', 'error'); return; }
  if (!state.receiveDraftItems) state.receiveDraftItems = [];
  state.receiveDraftItems.push({ productKey: ik(p), productName: p.name, color, qty, isImei: false });
  document.getElementById('rs-qty').value = '1';
  renderRestockDraft();
  toast(qty + ' unit' + (qty !== 1 ? 's' : '') + ' staged', 'success');
}

export function removeRestockItem(i) {
  if (state.receiveDraftItems) state.receiveDraftItems.splice(i, 1);
  renderRestockDraft();
}

export function renderRestockDraft() {
  const el = document.getElementById('restockDraftList');
  const btn = document.getElementById('restockConfirmBtn');
  const items = state.receiveDraftItems || [];
  if (!el) return;
  const cnt = document.getElementById('restockDraftCount');
  if (cnt) cnt.textContent = items.length ? items.length + ' item' + (items.length !== 1 ? 's' : '') + ' staged' : '';
  if (!items.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:8px 0;">No items staged yet.</div>';
    if (btn) btn.disabled = true;
    return;
  }
  if (btn) btn.disabled = false;
  el.innerHTML = items.map((item, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;margin-bottom:8px;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${item.productName}</div>
        <div style="font-size:12px;color:var(--muted);">${item.color}${item.isImei ? ' &mdash; <span style="font-family:\'JetBrains Mono\',monospace;">' + item.imei + '</span>' : ' &times; ' + item.qty}</div>
      </div>
      <span onclick="removeRestockItem(${i})" style="cursor:pointer;color:var(--muted);font-size:18px;padding:0 4px;">&times;</span>
    </div>`).join('');
}

export function confirmRestock() {
  const items = state.receiveDraftItems || [];
  if (!items.length) { toast('No items to receive', 'error'); return; }
  const drNumber = document.getElementById('rs-dr').value.trim() || 'DR-UNKNOWN';
  const drDate = document.getElementById('rs-date').value || new Date().toLocaleDateString('en-PH');
  const supplier = document.getElementById('rs-supplier').value.trim() || 'Tecnix Trading';
  receiveUnits(items.filter(i => i.isImei), items.filter(i => !i.isImei), { number: drNumber, date: drDate, supplier });
  state.receiveDraftItems = [];
  state.restockProduct = null;
  const inp = document.getElementById('rs-product-input');
  if (inp) inp.value = '';
  document.getElementById('rs-dr').value = '';
  const imeiSec = document.getElementById('rs-imei-sec');
  const qtySec = document.getElementById('rs-qty-sec');
  if (imeiSec) imeiSec.style.display = 'none';
  if (qtySec) qtySec.style.display = 'none';
  renderRestockDraft();
  toast('Stock received successfully!', 'success');
}

window.filterIMEIList = filterIMEIList;
window.selectIMEI = selectIMEI;
window.removeSelectedIMEI = removeSelectedIMEI;
window.selectIMEIFromInput = selectIMEIFromInput;
window.updateRestockProductSelection = updateRestockProductSelection;
window.addRestockUnit = addRestockUnit;
window.addRestockQty = addRestockQty;
window.removeRestockItem = removeRestockItem;
window.confirmRestock = confirmRestock;
