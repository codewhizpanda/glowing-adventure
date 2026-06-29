import { state, saveInv } from './state.js';
import { DEF, COLORS } from './data.js';
import { ik } from './utils.js';
import { renderInv } from './inventory.js';
import { renderPOs } from './purchase-orders.js';
import { renderML } from './master-list.js';
import { renderSettings } from './settings.js';
import { renderSalesTable, renderSummary } from './report.js';
import { buildCatFilter, renderProducts } from './products.js';
import { getQueue, updateBanner } from './sync.js';
import { initUnits, initRestockPage } from './units.js';
import { initDashboard } from './dashboard.js';
import { initReportsPage } from './reports.js';

// Side-effect imports to register window.* handlers not reachable via above imports
import './auth.js';
import './customer.js';
import './sales.js';
import './setup.js';
import './sync.js';
import './scanner.js';

function init() {
  const saved = localStorage.getItem('kt_ml');
  if (saved) {
    state.masterList = JSON.parse(saved);
  } else {
    state.masterList = DEF.map(p => ({
      ...p,
      obsolete: false,
      colors: (COLORS[p.category] || ['Black', 'White']).join(', '),
    }));
    localStorage.setItem('kt_ml', JSON.stringify(state.masterList));
  }
  state.PRODUCTS = state.masterList.filter(p => !p.obsolete);

  const inv = localStorage.getItem('kt_inv');
  if (inv) {
    state.inventory = JSON.parse(inv);
  } else {
    state.masterList.forEach(p => { state.inventory[ik(p)] = { stock: 4, reorder: 1 }; });
    saveInv();
  }

  state.predefinedBundles = JSON.parse(localStorage.getItem('kt_bundles') || '[]');
  state.productFreebies = JSON.parse(localStorage.getItem('kt_freebies') || '{}');

  const savedSettings = localStorage.getItem('kt_settings');
  if (savedSettings) Object.assign(state.settings, JSON.parse(savedSettings));

  if (state.scriptUrl) {
    const el = document.getElementById('scriptUrl');
    if (el) el.value = state.scriptUrl;
  }

  // Restore sync queue from localStorage
  state.syncQueue = getQueue();
  updateBanner();

  // Init IMEI unit records (generates dummies for existing phone/tablet stock)
  initUnits();

  // Keep window.masterList in sync after reassignment (used by inline oninput handlers in renderML)
  window.masterList = state.masterList;

  document.addEventListener('page:change', e => {
    const name = e.detail;
    if (name === 'inventory') renderInv();
    if (name === 'po') renderPOs();
    if (name === 'masterlist') renderML();
    if (name === 'settings') renderSettings();
    if (name === 'restock') initRestockPage();
    if (name === 'dashboard') initDashboard();
    if (name === 'reports') initReportsPage();
  });

  document.addEventListener('screen:change', e => {
    const name = e.detail;
    if (name === 'report') { renderSalesTable(); renderSummary(); }
    if (name === 'picker') renderProducts();
  });
}

init();
