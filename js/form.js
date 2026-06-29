import { state } from './state.js';
import { COLORS } from './data.js';
import { isImeiProduct } from './units.js';

export function renderColorFields(qty) {
  const cat = state.selectedProduct ? state.selectedProduct.category : '';
  const colorOpts = (COLORS[cat] || []).map(c => `<option value="${c}">`).join('');
  document.getElementById('colorOptions').innerHTML = colorOpts;
  const container = document.getElementById('colorFields');
  if (!container) return;
  if (qty <= 1) {
    container.innerHTML = '<input type="text" class="cf-input" data-unit="0" placeholder="e.g. Midnight Black" list="colorOptions" style="width:100%;">';
  } else {
    let html = '';
    for (let i = 0; i < qty; i++) {
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span style="font-size:12px;color:var(--muted);min-width:48px;">Unit ${i + 1}</span>
        <input type="text" class="cf-input" data-unit="${i}" placeholder="e.g. Midnight Black" list="colorOptions"
          style="flex:1;border:1.5px solid var(--border);border-radius:8px;padding:9px 12px;font-size:14px;outline:none;">
      </div>`;
    }
    container.innerHTML = html;
  }
  const first = container.querySelector('.cf-input');
  if (first) setTimeout(() => first.focus(), 100);
}

export function getColors() {
  const inputs = document.querySelectorAll('#colorFields .cf-input');
  if (!inputs.length) return [''];
  return Array.from(inputs).map(i => i.value.trim());
}

export function allColorsEntered() {
  return getColors().every(c => c.length > 0);
}

export function onSoldTypeChange() {
  const isPasa = document.getElementById('f-soldtype').value === 'Pasa';
  document.getElementById('promoterField').style.display = isPasa ? 'block' : 'none';
  document.getElementById('pasaField').style.display = isPasa ? 'block' : 'none';
  if (!isPasa) document.getElementById('f-pasa').value = '';
  recalc();
}

export function recalc() {
  if (!state.selectedProduct) return;
  const srp = state.selectedProduct.srp;
  const qty = isImeiProduct(state.selectedProduct)
    ? (state.selectedIMEIs || []).length
    : (parseInt(document.getElementById('f-qty').value) || 1);
  const isPasa = document.getElementById('f-soldtype').value === 'Pasa';
  const pasa = isPasa ? (parseFloat(document.getElementById('f-pasa').value) || 0) : 0;
  const displayPrice = isPasa ? srp + pasa : srp;
  const addonT = state.selectedAddon ? state.selectedAddon.soldPrice : 0;
  const tot = displayPrice * qty + addonT;
  const srpEl = document.getElementById('d-srp');
  if (srpEl && !document.getElementById('f-bundle').dataset.bundlePrice) {
    srpEl.textContent = isPasa && pasa > 0 ? '₱' + (srp + pasa).toLocaleString() : '₱' + srp.toLocaleString();
  }
  const lbl = document.getElementById('c-total-label');
  if (lbl) lbl.textContent = isPasa && pasa > 0 ? 'Customer Total (incl. Pasa)' : 'Total Amount';
  document.getElementById('c-total').textContent = tot > 0 ? '₱' + tot.toLocaleString() : '—';
}

window.onSoldTypeChange = onSoldTypeChange;
window.recalc = recalc;
window.renderColorFields = renderColorFields;
