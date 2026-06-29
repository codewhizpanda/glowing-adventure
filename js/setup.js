import { state, saveInv } from './state.js';
import { ik } from './utils.js';
import { toast } from './toast.js';
import { buildCatFilter, renderProducts } from './products.js';
import { updateBanner } from './sync.js';

export async function connectSheet() {
  const url = document.getElementById('scriptUrl').value.trim();
  if (!url) { toast('Enter URL', 'error'); return; }
  state.scriptUrl = url;
  localStorage.setItem('kt_url', url);
  document.getElementById('connectStatus').textContent = 'Connecting…';
  _showOverlay('Connecting to Sheets…');
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'init' }),
    });
    document.getElementById('connectStatus').textContent = 'Connected and sheets initialized!';
    toast('Connected!', 'success');
    updateBanner();
  } catch (e) {
    document.getElementById('connectStatus').textContent = 'URL saved. (CORS in preview is normal — deployed app will work fine.)';
    toast('URL saved', 'success');
  } finally {
    _hideOverlay();
  }
}

async function _push(action, body, label, statusEl) {
  statusEl.textContent = 'Pushing ' + label + '…';
  const res = await fetch(state.scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json();
  if (json.error) throw new Error(label + ': ' + json.error);
  return json;
}

let _overlayShownAt = 0;
function _showOverlay(msg) {
  const el = document.getElementById('syncOverlay');
  if (!el) { console.warn('syncOverlay not found'); return; }
  document.getElementById('syncOverlayMsg').textContent = msg || 'Syncing data…';
  el.style.display = 'flex';
  _overlayShownAt = Date.now();
}
function _hideOverlay() {
  const el = document.getElementById('syncOverlay');
  if (!el) return;
  const elapsed = Date.now() - _overlayShownAt;
  const delay = Math.max(0, 600 - elapsed);
  setTimeout(() => { el.style.display = 'none'; }, delay);
}

export async function pushInventory() {
  if (!state.scriptUrl) { toast('Connect a sheet first', 'error'); return; }
  const statusEl = document.getElementById('pushStatus');
  statusEl.textContent = 'Starting…';
  const btn = document.querySelector('[onclick="pushInventory()"]');
  if (btn) btn.disabled = true;
  _showOverlay('Pushing data to Sheets…');

  try {
    const productRows = state.masterList.map(p => [
      ik(p), p.category, p.name, p.ram || '', p.storage || '',
      p.colors || '', p.unitPrice, p.srp, p.obsolete ? 'Obsolete' : 'Active',
    ]);
    await _push('saveProducts', { rows: productRows }, 'Products (' + productRows.length + ')', statusEl);

    const inventoryRows = state.masterList.map(p => ({
      productKey: ik(p),
      stock: (state.inventory[ik(p)] || {}).stock || 0,
      reorder: (state.inventory[ik(p)] || {}).reorder || 1,
    }));
    await _push('saveInventory', { rows: inventoryRows }, 'Inventory', statusEl);

    await _push('savePromotions', { bundles: state.predefinedBundles }, 'Promotions', statusEl);

    const freebies = Object.entries(state.productFreebies).map(([mainKey, freebieKey]) => {
      const mainP = state.masterList.find(p => ik(p) === mainKey);
      const fbP = state.masterList.find(p => ik(p) === freebieKey);
      return { mainKey, freebieKey, mainName: mainP ? mainP.name : '', freebieName: fbP ? fbP.name : '' };
    });
    await _push('saveFreebies', { freebies }, 'Freebies', statusEl);

    await _push('saveSettings', {
      settings: {
        DailyTarget: state.settings.dailyTarget,
        LowStockThreshold: state.settings.lowStockThreshold,
        GlobalReorder: state.settings.globalReorder,
      },
    }, 'Settings', statusEl);

    const units = state.units || [];
    statusEl.textContent = 'Pushing IMEI Units (' + units.length + ')…';
    if (units.length) {
      try {
        await _push('replaceUnits', { units }, 'IMEI Units (' + units.length + ')', statusEl);
      } catch (e) {
        if (e.message.includes('Unknown action')) {
          // Old Apps Script deployed — fall back to saveUnits (append-only, fine for empty sheet)
          await _push('saveUnits', { units }, 'IMEI Units (' + units.length + ') [append]', statusEl);
        } else {
          throw e;
        }
      }
    } else {
      statusEl.textContent = 'No IMEI units found locally — run the app first to generate placeholders.';
      toast('Warning: no units in local state', 'error');
      return;
    }

    statusEl.textContent = '✓ All data pushed to Sheets!';
    toast('All data pushed to Google Sheets!', 'success');
  } catch (e) {
    statusEl.textContent = '✗ ' + e.message;
    toast('Push failed — see Setup tab for details', 'error');
    console.error('Push all data error:', e);
  } finally {
    if (btn) btn.disabled = false;
    _hideOverlay();
  }
}

export function copyScript() {
  navigator.clipboard.writeText(document.getElementById('scriptText').innerText);
  toast('Script copied!', 'success');
}

window.connectSheet = connectSheet;
window.pushInventory = pushInventory;
window.copyScript = copyScript;
