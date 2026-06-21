import { state } from './state.js';
import { toast } from './toast.js';
import { buildCatFilter, renderProducts } from './products.js';
import { syncPricingFromSheet, syncInventoryFromSheet } from './setup.js';
import { showPage, showS } from './nav.js';

// SHA-256 of "1234" — used only when no Apps Script is connected yet
const DEFAULT_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

async function localHash(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function login(user) {
  state.currentUser = user;
  document.getElementById('lockScreen').style.display = 'none';
  document.getElementById('userPill').textContent = '👤 ' + user + ' — Switch';
  const adminTabs = ['tab-inventory', 'tab-po', 'tab-ml', 'tab-settings', 'tab-setup'];
  adminTabs.forEach(id => {
    document.getElementById(id).style.display = user === 'Admin' ? '' : 'none';
  });
  buildCatFilter();
  renderProducts();
  if (state.scriptUrl) {
    setTimeout(() => {
      syncPricingFromSheet().catch(() => {});
      syncInventoryFromSheet().catch(() => {});
    }, 800);
  }
  toast('Welcome, ' + user + '!', 'success');
}

export function logout() {
  state.currentUser = null;
  document.getElementById('lockScreen').style.display = 'flex';
  showPage('sales', null);
  showS('picker');
}

export function promptAdminPin() {
  const modal = document.getElementById('pinModal');
  const input = document.getElementById('pinInput');
  modal.style.display = 'flex';
  input.value = '';
  document.getElementById('pinError').textContent = '';
  setTimeout(() => input.focus(), 50);
}

export function closePinModal() {
  document.getElementById('pinModal').style.display = 'none';
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').textContent = '';
}

export async function submitAdminPin() {
  const input = document.getElementById('pinInput');
  const errorEl = document.getElementById('pinError');
  const pin = input.value.trim();
  if (!pin) return;

  const unlockBtn = document.querySelector('#pinModal .btn-primary');
  unlockBtn.textContent = 'Checking…';
  unlockBtn.disabled = true;

  try {
    let valid = false;
    if (state.scriptUrl) {
      const res = await fetch(state.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyPin', pin }),
      });
      const data = await res.json();
      valid = data.valid === true;
    } else {
      // No sheet connected yet — fall back to local hash of the default PIN
      valid = (await localHash(pin)) === DEFAULT_PIN_HASH;
    }

    if (valid) {
      closePinModal();
      login('Admin');
    } else {
      errorEl.textContent = 'Incorrect PIN. Try again.';
      input.value = '';
      input.focus();
    }
  } catch (e) {
    errorEl.textContent = 'Could not reach server. Check your connection.';
    console.error(e);
  } finally {
    unlockBtn.textContent = 'Unlock';
    unlockBtn.disabled = false;
  }
}

export async function changeAdminPin() {
  const current = document.getElementById('pin-current').value.trim();
  const next = document.getElementById('pin-new').value.trim();
  const confirm = document.getElementById('pin-confirm').value.trim();
  const statusEl = document.getElementById('pinChangeStatus');

  statusEl.style.color = 'var(--red)';

  if (!current || !next || !confirm) { statusEl.textContent = 'All fields are required.'; return; }
  if (next.length < 4) { statusEl.textContent = 'New PIN must be at least 4 digits.'; return; }
  if (next !== confirm) { statusEl.textContent = 'New PIN and confirmation do not match.'; return; }
  if (!state.scriptUrl) { statusEl.textContent = 'Connect Google Sheets first (Setup tab) to manage the Admin PIN.'; return; }

  try {
    const res = await fetch(state.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setPin', current, next }),
    });
    const data = await res.json();
    if (data.error) { statusEl.textContent = data.error; return; }
    document.getElementById('pin-current').value = '';
    document.getElementById('pin-new').value = '';
    document.getElementById('pin-confirm').value = '';
    statusEl.style.color = 'var(--green)';
    statusEl.textContent = 'PIN updated successfully.';
    toast('Admin PIN updated!', 'success');
  } catch (e) {
    statusEl.textContent = 'Could not reach server. Check your connection.';
  }
}

window.login = login;
window.logout = logout;
window.promptAdminPin = promptAdminPin;
window.closePinModal = closePinModal;
window.submitAdminPin = submitAdminPin;
window.changeAdminPin = changeAdminPin;
