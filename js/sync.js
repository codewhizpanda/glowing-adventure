import { state, saveInv } from './state.js';
import { toast } from './toast.js';

const QUEUE_KEY = 'kt_queue';

let _overlayShownAt = 0;
export function showSyncOverlay(msg) {
  const el = document.getElementById('syncOverlay');
  if (!el) return;
  document.getElementById('syncOverlayMsg').textContent = msg || 'Syncing…';
  el.style.display = 'flex';
  _overlayShownAt = Date.now();
}
export function hideSyncOverlay() {
  const el = document.getElementById('syncOverlay');
  if (!el) return;
  const delay = Math.max(0, 600 - (Date.now() - _overlayShownAt));
  setTimeout(() => { el.style.display = 'none'; }, delay);
}

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  state.syncQueue = q;
  updateBanner();
}

export function enqueue(action, payload) {
  const q = getQueue();
  q.push({
    id: 'q' + Date.now() + Math.random().toString(36).slice(2, 6),
    action,
    payload,
    addedAt: new Date().toISOString(),
    attempts: 0,
  });
  saveQueue(q);
}

export async function tryPush(action, payload) {
  if (!state.scriptUrl) { enqueue(action, payload); return; }
  try {
    const res = await fetch(state.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
  } catch {
    enqueue(action, payload);
  }
}

export async function processQueue() {
  const q = getQueue();
  if (!q.length) { toast('Nothing to sync', 'success'); return; }
  if (!state.scriptUrl) { toast('Connect Google Sheets first in Setup', 'error'); return; }

  showSyncOverlay('Syncing to Google Sheets…');
  updateBanner(true);
  const failed = [];

  for (const item of q) {
    try {
      const res = await fetch(state.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: item.action, ...item.payload }),
      });
      await res.json();
    } catch {
      item.attempts = (item.attempts || 0) + 1;
      failed.push(item);
    }
  }

  saveQueue(failed);
  hideSyncOverlay();

  if (!failed.length) {
    toast('All data synced to Google Sheets', 'success');
  } else {
    toast(failed.length + ' item(s) failed — will retry when online', 'error');
  }
}

export function updateBanner(syncing = false) {
  const banner = document.getElementById('syncBanner');
  if (!banner) return;
  const count = getQueue().length;
  if (!count && !syncing) { banner.style.display = 'none'; return; }

  banner.style.display = 'flex';
  const msg = document.getElementById('syncBannerMsg');
  const btn = document.getElementById('syncBannerBtn');
  if (msg) msg.textContent = syncing
    ? 'Syncing…'
    : count + ' unsynced item' + (count !== 1 ? 's' : '') + ' — data saved locally';
  if (btn) { btn.disabled = syncing; btn.textContent = syncing ? 'Syncing…' : 'Sync Now'; }
}

export async function pullFromSheets() {
  if (!state.scriptUrl) return;
  showSyncOverlay('Loading data from Sheets…');
  try {
    const res = await fetch(state.scriptUrl + '?action=getAllData');
    const data = await res.json();
    if (data.error) return;

    if (data.products && data.products.length) {
      state.masterList = data.products.map(r => ({
        category: String(r.Category || ''),
        name: String(r.Name || ''),
        ram: String(r.RAM || ''),
        storage: String(r.Storage || ''),
        colors: String(r.Colors || ''),
        unitPrice: Number(r.UnitPrice) || 0,
        srp: Number(r.SRP) || 0,
        obsolete: String(r.Status || '').toLowerCase() === 'obsolete',
      }));
      state.PRODUCTS = state.masterList.filter(p => !p.obsolete);
      localStorage.setItem('kt_ml', JSON.stringify(state.masterList));
      window.masterList = state.masterList;
      if (window.buildCatFilter) window.buildCatFilter();
      if (window.renderProducts) window.renderProducts();
    }

    if (data.inventory && data.inventory.length) {
      data.inventory.forEach(r => {
        if (r.ProductKey) {
          state.inventory[String(r.ProductKey)] = {
            stock: Number(r.Stock) || 0,
            reorder: Number(r.ReorderPoint) || 1,
          };
        }
      });
      saveInv();
    }

    if (data.promotions && data.promotions.length) {
      state.predefinedBundles = data.promotions.map(r => ({
        id: String(r.BundleID || ''),
        name: String(r.Name || ''),
        price: Number(r.Price) || 0,
        mainKey: String(r.MainProductKey || ''),
        mainName: String(r.MainProductName || ''),
        addonKey: String(r.AddonProductKey || ''),
        addonName: String(r.AddonProductName || ''),
      }));
      localStorage.setItem('kt_bundles', JSON.stringify(state.predefinedBundles));
    }

    if (data.freebies && data.freebies.length) {
      state.productFreebies = {};
      data.freebies.forEach(r => {
        if (r.MainProductKey) state.productFreebies[String(r.MainProductKey)] = String(r.FreebieProductKey);
      });
      localStorage.setItem('kt_freebies', JSON.stringify(state.productFreebies));
    }

    if (data.settings && Object.keys(data.settings).length) {
      if (data.settings.DailyTarget) state.settings.dailyTarget = Number(data.settings.DailyTarget);
      if (data.settings.LowStockThreshold) state.settings.lowStockThreshold = Number(data.settings.LowStockThreshold);
      if (data.settings.GlobalReorder) state.settings.globalReorder = Number(data.settings.GlobalReorder);
      localStorage.setItem('kt_settings', JSON.stringify(state.settings));
    }

    if (data.purchaseOrders && data.purchaseOrders.length) {
      state.purchaseOrders = data.purchaseOrders.map(r => ({
        id: String(r.POID || ''),
        date: String(r.Date || ''),
        supplier: String(r.Supplier || ''),
        approver: String(r.Approver || ''),
        status: String(r.Status || 'pending').toLowerCase(),
        items: Array.isArray(r.items) ? r.items : [],
      }));
      localStorage.setItem('kt_pos', JSON.stringify(state.purchaseOrders));
    }

    toast('Data synced from Google Sheets', 'success');
  } catch (e) {
    console.warn('Pull from Sheets failed:', e.message);
  } finally {
    hideSyncOverlay();
  }
}

window.addEventListener('online', () => {
  if (getQueue().length > 0 && state.scriptUrl) processQueue();
});

window.syncNow = processQueue;
