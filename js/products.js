import { state } from './state.js';
import { ik, vl } from './utils.js';
import { toast } from './toast.js';
import { renderColorFields, recalc } from './form.js';
import { buildAddonCatFilter, renderAddonList } from './addon.js';
import { showS } from './nav.js';
import { ADDON_CATS, COLORS } from './data.js';
import { isImeiProduct, renderIMEIPicker } from './units.js';

export function buildCatFilter() {
  const cats = ['All', ...new Set(state.PRODUCTS.map(p => p.category))];
  if (state.predefinedBundles.length) cats.splice(1, 0, 'Promotions');
  const el = document.getElementById('catFilter');
  el.innerHTML = cats.map(c =>
    `<button class="cat-btn${c === state.activeCat ? ' active' : ''}" data-c="${encodeURIComponent(c)}">${c}</button>`
  ).join('');
  el.onclick = function (e) {
    const b = e.target.closest('.cat-btn');
    if (!b) return;
    state.activeCat = decodeURIComponent(b.dataset.c);
    el.querySelectorAll('.cat-btn').forEach(x => x.classList.toggle('active', x === b));
    renderProducts();
  };
}

export function filterProducts() {
  state.searchQ = document.getElementById('searchInput').value.toLowerCase();
  renderProducts();
}

export function renderProducts() {
  const grid = document.getElementById('productGrid');

  if (state.activeCat === 'Promotions') {
    grid.innerHTML = state.predefinedBundles.map((b, i) => {
      const mainInv = state.inventory[b.mainKey] || { stock: 0 };
      const addonInv = state.inventory[b.addonKey] || { stock: 0 };
      const isOut = mainInv.stock <= 0 || addonInv.stock <= 0;
      return `<div class="pc${isOut ? ' oos' : ''}" data-bi="${i}" style="grid-column:span 1;">
        <div class="sb ${isOut ? 'sout' : 'sok'}">${isOut ? 'OUT' : 'In Stock'}</div>
        <div class="cl">Promotion</div>
        <div class="pn">${b.name}</div>
        <div class="pv" style="font-size:11px;line-height:1.7;margin-bottom:6px;"><span style="font-weight:600;color:var(--accent2);">Phone:</span> ${b.mainName}<br><span style="font-weight:600;color:var(--accent2);">Accessory:</span> ${b.addonName}</div>
        <div class="pp">₱${b.price.toLocaleString()}</div>
      </div>`;
    }).join('') || '<div style="padding:40px;text-align:center;color:var(--muted);">No promotions defined. Create one in Master List.</div>';
    grid.onclick = function (e) {
      const c = e.target.closest('.pc');
      if (!c || c.classList.contains('oos')) return;
      const b = state.predefinedBundles[parseInt(c.dataset.bi)];
      if (b) openBundleDetail(b);
    };
    _updateFloatBtn();
    return;
  }

  const filtered = state.PRODUCTS.filter(p =>
    (state.activeCat === 'All' || p.category === state.activeCat) &&
    (p.name + ' ' + vl(p)).toLowerCase().includes(state.searchQ)
  );
  const map = {};
  grid.innerHTML = filtered.map((p, i) => {
    const key = ik(p);
    map[i] = key;
    const inv = state.inventory[key] || { stock: 0, reorder: 1 };
    const isOut = inv.stock <= 0;
    const isLow = !isOut && inv.stock <= state.settings.lowStockThreshold;
    let sc = 'sok', sl = inv.stock + ' left';
    if (isOut) { sc = 'sout'; sl = 'OUT'; } else if (isLow) { sc = 'slow'; sl = 'LOW:' + inv.stock; }
    return `<div class="pc${isOut ? ' oos' : ''}" data-i="${i}">
      <div class="sb ${sc}">${sl}</div>
      <div class="cl">${p.category}</div>
      <div class="pn">${p.name}</div>
      <div class="pv">${vl(p) || '—'}</div>
      <div class="pp">₱${p.srp.toLocaleString()}</div>
    </div>`;
  }).join('') || '<div style="padding:40px;text-align:center;color:var(--muted);">No products found.</div>';
  grid.onclick = function (e) {
    const c = e.target.closest('.pc');
    if (!c || c.classList.contains('oos')) return;
    const k = map[parseInt(c.dataset.i)];
    if (k) openDetail(k);
  };
  _updateFloatBtn();
}

function _updateFloatBtn() {
  const fb = document.getElementById('floatBtn');
  const fbBtn = document.getElementById('floatBtnInner');
  const totalPending = state.pendingItems.length;
  if (totalPending > 0) {
    fb.style.display = 'block';
    if (fbBtn) {
      fbBtn.innerHTML = '<svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.125em;" aria-hidden="true"><use href="#ic-cart"/></svg> Review (' + totalPending + ' item' + (totalPending !== 1 ? 's' : '') + ')';
      fbBtn.onclick = () => window.goToReview();
    }
  } else if (state.saleRows.length > 0) {
    fb.style.display = 'block';
    if (fbBtn) {
      fbBtn.innerHTML = '<svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.125em;" aria-hidden="true"><use href="#ic-clipboard"/></svg> View Report (' + state.saleRows.length + ')';
      fbBtn.onclick = () => showS('report');
    }
  } else {
    fb.style.display = 'none';
  }
}

export function openBundleDetail(b) {
  const mainP = state.PRODUCTS.find(p => ik(p) === b.mainKey);
  const addonP = state.PRODUCTS.find(p => ik(p) === b.addonKey);
  if (!mainP || !addonP) { toast('Promotion items not found in active products', 'error'); return; }
  openDetail(b.mainKey);
  setTimeout(() => {
    state.bundleCounter++;
    localStorage.setItem('kt_pc', state.bundleCounter);
    const d = new Date();
    const dp = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const fb = document.getElementById('f-bundle');
    fb.value = 'PRO-' + dp + '-' + String(state.bundleCounter).padStart(3, '0');
    fb.dataset.bundlePrice = b.price;
    fb.dataset.bundleName = b.name;
    fb.dataset.promoAddonKey = b.addonKey;
    fb.dataset.promoAddonName = addonP.name;
    state.selectedAddon = null;
    document.getElementById('addonSec').style.display = 'none';
    document.getElementById('freebieSec').style.display = 'flex';
    document.getElementById('freebieItemName').textContent = addonP.name + ' — included in Promotion';
    document.getElementById('d-srp').textContent = '₱' + b.price.toLocaleString();
    document.getElementById('d-cat').textContent = 'Promotion';
    document.getElementById('c-total-label').textContent = 'Promotion Price';
    document.getElementById('c-total').textContent = '₱' + b.price.toLocaleString();
  }, 50);
}

export function openDetail(key) {
  const p = state.PRODUCTS.find(x => ik(x) === key);
  if (!p) { toast('Not found', 'error'); return; }
  state.selectedProduct = p;
  state.selectedAddon = null;
  state.selectedIMEIs = [];

  document.getElementById('d-title').textContent = p.name;
  document.getElementById('d-sub').textContent = p.category + (vl(p) ? ' — ' + vl(p) : '');
  document.getElementById('d-cat').textContent = p.category;
  document.getElementById('d-name').textContent = p.name;
  document.getElementById('d-vdisplay').textContent = vl(p) || 'No variant';
  document.getElementById('d-srp').textContent = '₱' + p.srp.toLocaleString();
  document.getElementById('f-vro').value = vl(p) || '—';
  document.getElementById('f-qty').value = '1';
  renderColorFields(1);
  document.getElementById('f-soldtype').value = 'Walk-in';
  document.getElementById('f-promoter').value = '';
  document.getElementById('f-pasa').value = '';
  document.getElementById('f-payment').value = 'Cash';

  const fb = document.getElementById('f-bundle');
  fb.value = '';
  fb.dataset.bundlePrice = '';
  fb.dataset.bundleName = '';
  fb.dataset.promoAddonKey = '';
  fb.dataset.promoAddonName = '';
  document.getElementById('promoterField').style.display = 'none';
  document.getElementById('pasaField').style.display = 'none';

  const dl = document.getElementById('colorOptions');
  dl.innerHTML = (COLORS[p.category] || []).map(c => `<option value="${c}">`).join('');

  const freebieKey = state.productFreebies[ik(p)];
  const freebieP = freebieKey ? state.masterList.find(x => ik(x) === freebieKey) : null;
  const freebieEl = document.getElementById('freebieSec');
  if (freebieEl) freebieEl.style.display = freebieP ? 'flex' : 'none';
  const fnEl = document.getElementById('freebieItemName');
  if (fnEl) fnEl.textContent = freebieP ? freebieP.name + ' (' + freebieP.category + ')' : '';

  const hasAddon = ADDON_CATS.includes(p.category);
  document.getElementById('addonSec').style.display = hasAddon ? 'block' : 'none';
  document.getElementById('addonPicker').style.display = 'none';
  document.getElementById('addonList').style.display = 'none';
  document.getElementById('addonItems').innerHTML = '';
  document.getElementById('addonPickerBtn').style.display = '';
  state.addonCat = 'All';
  buildAddonCatFilter();

  const custSec = document.getElementById('custInfoSection');
  if (custSec) custSec.style.display = state.saleRows.length > 0 ? 'none' : 'block';

  const isImei = isImeiProduct(p);
  document.getElementById('imeiSection').style.display = isImei ? 'block' : 'none';
  document.getElementById('qtyColorRow').style.display = isImei ? 'none' : 'block';
  document.getElementById('colorFieldsWrapper').style.display = isImei ? 'none' : 'block';
  if (isImei) renderIMEIPicker();

  recalc();
  showS('detail');
}

window.filterProducts = filterProducts;
window.buildCatFilter = buildCatFilter;
window.renderProducts = renderProducts;
