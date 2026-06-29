import { state, saveInv } from './state.js';
import { ik, vl, fmt } from './utils.js';
import { toast } from './toast.js';
import { getColors, allColorsEntered, renderColorFields, recalc } from './form.js';
import { renderAddonList } from './addon.js';
import { showS } from './nav.js';
import { openDetail } from './products.js';
import { renderSalesTable, renderSummary } from './report.js';
import { getCustomerInfo, resetCustomerInfo } from './customer.js';
import { tryPush } from './sync.js';
import { isImeiProduct, markUnitSold } from './units.js';

export function buildPendingItem() {
  if (!state.selectedProduct) return null;
  const p = state.selectedProduct;
  const imei = isImeiProduct(p);

  let colors, qty;
  if (imei) {
    if (!(state.selectedIMEIs || []).length) { toast('Please scan or select at least one unit', 'error'); return null; }
    colors = state.selectedIMEIs.map(u => u.color);
    qty = state.selectedIMEIs.length;
  } else {
    if (!allColorsEntered()) { toast('Please enter a color for each unit', 'error'); return null; }
    colors = getColors();
    qty = parseInt(document.getElementById('f-qty').value) || 1;
  }

  const color = colors.join(', ');
  const soldType = document.getElementById('f-soldtype').value;
  const promoter = document.getElementById('f-promoter').value.trim();
  const fb = document.getElementById('f-bundle');
  const bundlePrice = parseFloat(fb.dataset.bundlePrice || '0');
  const pasa = parseFloat(document.getElementById('f-pasa').value) || 0;
  const payment = document.getElementById('f-payment').value;
  const bundleCode = fb.value;
  const promoAddonKey = fb.dataset.promoAddonKey || '';
  const promoAddonName = fb.dataset.promoAddonName || '';
  const bundleName = fb.dataset.bundleName || '';

  if (soldType === 'Pasa' && !promoter) { toast('Please enter promoter name', 'error'); return null; }

  const srp = p.srp;
  const isPromo = bundlePrice > 0;
  const sp = isPromo ? bundlePrice : (soldType === 'Pasa' ? srp + pasa : srp);
  const freebieKey = state.productFreebies[ik(p)];
  const freebieP = freebieKey ? state.masterList.find(x => ik(x) === freebieKey) : null;

  return {
    id: Date.now() + Math.random(),
    isPromo,
    bundleCode,
    bundleName,
    product: p,
    colors,
    color,
    qty,
    imeis: imei ? state.selectedIMEIs.map(u => u.imei) : [],
    soldType,
    promoter: soldType === 'Pasa' ? promoter : '',
    pasa: pasa || 0,
    payment,
    srp,
    sp,
    unitPrice: p.unitPrice,
    net: (sp - p.unitPrice) * qty,
    addon: state.selectedAddon ? { ...state.selectedAddon } : null,
    freebie: freebieP ? { name: freebieP.name, key: freebieKey } : null,
    promoAddon: promoAddonKey ? { key: promoAddonKey, name: promoAddonName } : null,
    customer: state.pendingItems.length === 0 ? getCustomerInfo() : null,
  };
}

export function addAnotherItem() {
  const item = buildPendingItem();
  if (!item) return;
  state.pendingItems.push(item);
  toast(item.product.name + ' added — select next item', 'success');
  state.selectedProduct = null;
  state.selectedAddon = null;
  state.selectedIMEIs = [];
  showS('picker');
}

export function goToReview() {
  if (state.selectedProduct) {
    const item = buildPendingItem();
    if (!item) return;
    state.pendingItems.push(item);
    state.selectedProduct = null;
    state.selectedAddon = null;
  }
  if (!state.pendingItems.length) { toast('No items to review', 'error'); return; }
  if (!state.currentSO) {
    state.soCounter++;
    localStorage.setItem('kt_so', state.soCounter);
    const d = new Date();
    state.currentSO = 'SO-' + String(d.getFullYear()).slice(2) +
      String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      '-' + String(state.soCounter).padStart(4, '0');
  }
  renderReview();
  showS('review');
}

export function renderReview() {
  const grandTotal = state.pendingItems.reduce((s, item) => {
    const addonT = item.addon ? item.addon.soldPrice : 0;
    return s + item.sp * item.qty + addonT;
  }, 0);

  const custInfo = state.pendingItems.find(i => i.customer)?.customer || null;
  let html = '';

  html += '<div style="background:var(--accent);border-radius:12px;padding:16px 20px;margin-bottom:14px;color:#fff;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
  html += `<div><div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:1px;">Sales Order</div>
    <div style="font-size:18px;font-weight:800;font-family:monospace;">${state.currentSO}</div></div>`;
  const firstItem = state.pendingItems[0];
  html += `<div style="text-align:right;">
    <div class="review-chip" style="background:rgba(255,255,255,.2);">${firstItem.payment}</div>
    <div class="review-chip" style="background:rgba(255,255,255,.2);margin-top:4px;">${firstItem.soldType}${firstItem.promoter ? ' — ' + firstItem.promoter : ''}</div>
  </div>`;
  html += '</div>';
  if (custInfo) {
    html += '<div style="border-top:1px solid rgba(255,255,255,.2);padding-top:8px;margin-top:4px;font-size:12px;opacity:.85;">';
    if (custInfo.name) html += `<svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.1em;" aria-hidden="true"><use href="#ic-user"/></svg> ` + custInfo.name + '&nbsp;&nbsp;';
    if (custInfo.contact) html += `<svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.1em;" aria-hidden="true"><use href="#ic-phone"/></svg> ` + custInfo.contact + '&nbsp;&nbsp;';
    if (custInfo.email) html += `<svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.1em;" aria-hidden="true"><use href="#ic-mail"/></svg> ` + custInfo.email;
    html += '</div>';
  }
  html += '</div>';

  state.pendingItems.forEach((item, idx) => {
    const addonT = item.addon ? item.addon.soldPrice : 0;
    const itemTotal = item.sp * item.qty + addonT;
    html += '<div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden;">';
    html += '<div style="background:var(--accent-light);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">';
    html += '<div style="display:flex;align-items:center;gap:10px;">';
    html += `<div style="background:var(--accent);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${idx + 1}</div>`;
    html += `<div><div style="font-weight:700;font-size:14px;">${item.product.name}</div>
      <div style="font-size:11px;color:var(--muted);">${item.product.category}${vl(item.product) ? ' — ' + vl(item.product) : ''}</div></div></div>`;
    html += `<div style="display:flex;gap:6px;">
      <button class="btn btn-outline btn-sm" onclick="editPendingItem(${idx})" style="padding:4px 10px;font-size:11px;display:inline-flex;align-items:center;"><svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-edit"/></svg></button>
      <button class="btn btn-ghost btn-sm" onclick="removePendingItem(${idx})" style="padding:4px 8px;font-size:13px;color:var(--red);">✕</button>
    </div>`;
    html += '</div>';
    html += '<div style="padding:12px 16px;">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">';
    html += `<div><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;">Color(s)</div><div style="font-size:13px;font-weight:600;">${item.colors.filter(Boolean).join(', ')}</div></div>`;
    html += `<div><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;">Qty</div><div style="font-size:13px;font-weight:600;">${item.qty}</div></div>`;
    html += `<div><div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;">Price</div><div style="font-size:13px;font-weight:700;color:var(--accent);font-family:monospace;">${fmt(item.sp)}</div></div>`;
    html += '</div>';
    if (item.imeis && item.imeis.length) {
      html += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;font-family:'JetBrains Mono',monospace;">IMEI: ${item.imeis.join(' · ')}</div>`;
    }
    if (item.bundleCode) html += `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${item.isPromo ? 'Promo' : 'Bundle'} Code: <span style="font-family:monospace;font-weight:600;color:var(--accent);">${item.bundleCode}</span></div>`;
    if (item.addon) html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--accent-light);border-radius:8px;margin-bottom:8px;"><svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;" aria-hidden="true"><use href="#ic-plus"/></svg><div style="flex:1;font-size:13px;font-weight:600;">${item.addon.product.name}</div><div style="font-size:13px;font-weight:700;color:var(--accent);font-family:monospace;">₱${item.addon.soldPrice.toLocaleString()}</div></div>`;
    if (item.freebie || item.promoAddon) {
      const fn = (item.freebie || item.promoAddon).name;
      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f0fdf4;border-radius:8px;margin-bottom:8px;"><svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;color:var(--green);" aria-hidden="true"><use href="#ic-gift"/></svg><div style="flex:1;font-size:13px;font-weight:600;color:#15803d;">${fn}</div><div style="font-size:11px;font-weight:700;color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:10px;">FREE</div></div>`;
    }
    html += `<div style="display:flex;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border);"><span style="font-size:13px;color:var(--muted);margin-right:10px;">Subtotal</span><span class="mono" style="font-size:15px;font-weight:700;color:var(--accent);">${fmt(itemTotal)}</span></div>`;
    html += '</div></div>';
  });

  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:var(--accent);border-radius:10px;color:#fff;">
    <div><div style="font-size:11px;opacity:.8;">${state.pendingItems.length} item${state.pendingItems.length !== 1 ? 's' : ''}</div><div style="font-size:13px;font-weight:600;">Total Amount</div></div>
    <div class="mono" style="font-size:28px;font-weight:800;">${fmt(grandTotal)}</div>
  </div>`;

  document.getElementById('reviewContent').innerHTML = html;
  const confirmBtn = document.getElementById('confirmSaleBtn');
  if (confirmBtn) confirmBtn.textContent = '✓ Customer Approved — Confirm ' + state.pendingItems.length + ' Item' + (state.pendingItems.length !== 1 ? 's' : '');
}

export function removePendingItem(idx) {
  state.pendingItems.splice(idx, 1);
  if (!state.pendingItems.length) { showS('picker'); return; }
  renderReview();
}

export function editPendingItem(idx) {
  const item = state.pendingItems.splice(idx, 1)[0];
  state.selectedProduct = item.product;
  state.selectedAddon = item.addon;
  const savedIMEIs = item.imeis && item.imeis.length
    ? item.imeis.map(imei => state.units.find(u => u.imei === imei)).filter(Boolean)
    : [];
  showS('detail');
  setTimeout(() => {
    openDetail(ik(item.product)); // resets selectedIMEIs — we restore below
    setTimeout(() => {
      state.selectedIMEIs = savedIMEIs;
      document.getElementById('f-soldtype').value = item.soldType;
      document.getElementById('f-payment').value = item.payment;
      document.getElementById('f-qty').value = item.qty;
      document.getElementById('f-pasa').value = item.pasa || '';
      document.getElementById('f-promoter').value = item.promoter || '';
      document.getElementById('f-bundle').value = item.bundleCode || '';
      if (item.bundleCode) document.getElementById('f-bundle').dataset.bundlePrice = item.isPromo ? item.sp : '';
      renderColorFields(item.qty);
      setTimeout(() => {
        const inputs = document.querySelectorAll('#colorFields .cf-input');
        inputs.forEach((el, i) => { if (item.colors[i]) el.value = item.colors[i]; });
        if (item.addon) state.selectedAddon = item.addon;
        if (item.soldType === 'Pasa') {
          document.getElementById('promoterField').style.display = 'block';
          document.getElementById('pasaField').style.display = 'block';
        }
        renderAddonList();
        if (window.renderIMEIPicker) window.renderIMEIPicker();
        recalc();
      }, 80);
    }, 80);
  }, 50);
}

export function getOrCreateSO() {
  if (!state.currentSO) {
    state.soCounter++;
    localStorage.setItem('kt_so', state.soCounter);
    const d = new Date();
    state.currentSO = 'SO-' + String(d.getFullYear()).slice(2) +
      String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      '-' + String(state.soCounter).padStart(4, '0');
  }
  document.getElementById('soLabel').textContent = state.currentSO;
  document.getElementById('soBanner').style.display = 'flex';
  return state.currentSO;
}

export function clearSO() {
  if ((state.saleRows.length || state.pendingItems.length) &&
    !confirm('Start new Sales Order? Pending items will be discarded.')) return;
  state.currentSO = null;
  state.pendingItems = [];
  document.getElementById('soBanner').style.display = 'none';
  toast('Ready for new Sales Order', 'success');
}

export function confirmSale() {
  if (!state.pendingItems.length) { toast('No items to confirm', 'error'); return; }
  const so = getOrCreateSO();
  const now = Date.now();
  const decrements = [];
  const rowStart = state.saleRows.length;

  state.pendingItems.forEach((item, i) => {
    const p = item.product;
    const freebieKey = item.freebie ? item.freebie.key : null;
    const row = {
      id: now + i * 10, so,
      bundle: item.bundleCode || '',
      itemName: p.name, variant: vl(p), color: item.color,
      qty: item.qty, unitPrice: item.unitPrice, srp: item.srp,
      soldPrice: item.sp, pasaPrice: item.pasa || 0, discount: 0,
      netSales: (item.sp - item.unitPrice) * item.qty,
      payment: item.payment, soldType: item.soldType,
      promoter: item.promoter, staff: state.currentUser,
      productKey: ik(p), isPromotion: item.isPromo || false,
      imeis: item.imeis || [],
      customer: item.customer || null,
    };
    state.saleRows.push(row);
    if (item.imeis && item.imeis.length) {
      item.imeis.forEach(imei => markUnitSold(imei, so));
      decrements.push({ productKey: ik(p), qty: item.qty });
    } else if (state.inventory[ik(p)]) {
      state.inventory[ik(p)].stock = Math.max(0, state.inventory[ik(p)].stock - item.qty);
      decrements.push({ productKey: ik(p), qty: item.qty });
    }

    if (item.addon) {
      const a = item.addon, ak = ik(a.product);
      state.saleRows.push({
        id: now + i * 10 + 1, so, bundle: item.bundleCode || '',
        itemName: a.product.name, variant: vl(a.product), color: '', qty: 1,
        unitPrice: a.product.unitPrice, srp: a.product.srp, soldPrice: a.soldPrice,
        pasaPrice: 0, discount: 0, netSales: a.soldPrice - a.product.unitPrice,
        payment: item.payment, soldType: item.soldType, promoter: item.promoter,
        staff: state.currentUser, productKey: ak, isAddon: true, customer: null,
      });
      if (state.inventory[ak]) {
        state.inventory[ak].stock = Math.max(0, state.inventory[ak].stock - 1);
        decrements.push({ productKey: ak, qty: 1 });
      }
    }

    if (item.promoAddon) {
      const paKey = item.promoAddon.key;
      const paP = state.masterList.find(x => ik(x) === paKey);
      if (paP) {
        state.saleRows.push({
          id: now + i * 10 + 2, so, bundle: item.bundleCode || '',
          itemName: paP.name, variant: vl(paP), color: 'Assorted', qty: item.qty,
          unitPrice: paP.unitPrice, srp: 0, soldPrice: 0, pasaPrice: 0, discount: 0,
          netSales: -(paP.unitPrice * item.qty),
          payment: item.payment, soldType: item.soldType, promoter: '',
          staff: state.currentUser, productKey: paKey, isPromoAddon: true, customer: null,
        });
        if (state.inventory[paKey]) {
          state.inventory[paKey].stock = Math.max(0, state.inventory[paKey].stock - item.qty);
          decrements.push({ productKey: paKey, qty: item.qty });
        }
      }
    }

    if (freebieKey && state.inventory[freebieKey]) {
      state.inventory[freebieKey].stock = Math.max(0, state.inventory[freebieKey].stock - item.qty);
      decrements.push({ productKey: freebieKey, qty: item.qty });
    }
  });

  saveInv();

  const newRows = state.saleRows.slice(rowStart);
  tryPush('logSale', { date: new Date().toISOString(), rows: newRows });
  if (decrements.length) {
    tryPush('updateInventoryItems', {
      items: decrements.map(d => ({
        productKey: d.productKey,
        stock: (state.inventory[d.productKey] || {}).stock || 0,
        reorder: (state.inventory[d.productKey] || {}).reorder || 1,
      })),
    });
  }

  state.pendingItems = [];
  state.selectedIMEIs = [];
  resetCustomerInfo();
  state.currentSO = null;
  document.getElementById('soBanner').style.display = 'none';
  document.getElementById('floatBtn').style.display = 'none';
  toast('Sales Order ' + so + ' confirmed!', 'success');
  showS('picker');
  renderSalesTable();
  renderSummary();
}

export function addItemFromReview() {
  showS('picker');
}

window.goToReview = goToReview;
window.addAnotherItem = addAnotherItem;
window.addItemFromReview = addItemFromReview;
window.editPendingItem = editPendingItem;
window.removePendingItem = removePendingItem;
window.confirmSale = confirmSale;
window.clearSO = clearSO;
