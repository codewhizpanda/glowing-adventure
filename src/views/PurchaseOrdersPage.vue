<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '@/stores/state.js';
import { ik, vl } from '@/utils.js';
import { useToast } from '@/composables/useToast.js';
import { tryPush } from '@/composables/useSync.js';

const store = useAppStore();
const { toast } = useToast();

const searchQ      = ref('');
const filterStatus = ref('All');
const filterOpen   = ref(false);
const filterOptions = ['All', 'Pending', 'Sent'];

const filteredPOs = computed(() => {
  const q = searchQ.value.toLowerCase();
  return store.purchaseOrders.filter(po => {
    const matchSearch = !q || po.id.toLowerCase().includes(q) || po.supplier.toLowerCase().includes(q) || po.items.some(i => i.name.toLowerCase().includes(q));
    const matchFilter = filterStatus.value === 'All' || po.status === filterStatus.value.toLowerCase();
    return matchSearch && matchFilter;
  });
});

// PO edit modal state
const editModal  = ref(false);
const editingPO  = ref(null);   // deep copy of PO being edited
const newItem    = ref('');
const newQty     = ref(1);
const newColor   = ref('');

const productDatalist = computed(() =>
  store.masterList.filter(p => !p.obsolete).map(p => {
    const v = (p.ram && p.storage) ? ' (' + p.ram + '/' + p.storage + ')' : '';
    return p.name + v;
  })
);

function openEdit(po) {
  editingPO.value = { ...po, items: po.items.map(i => ({ ...i })) };
  newItem.value  = '';
  newQty.value   = 1;
  newColor.value = '';
  editModal.value = true;
}

function closeEdit() {
  editModal.value = false;
  editingPO.value = null;
}

function addLine() {
  const name = newItem.value.trim();
  if (!name) { toast('Enter item name', 'error'); return; }
  editingPO.value.items.push({ name, qty: newQty.value || 1, color: newColor.value.trim() || 'Assorted' });
  newItem.value  = '';
  newQty.value   = 1;
  newColor.value = '';
  toast('Line item added', 'success');
}

function removeLine(i) {
  editingPO.value.items.splice(i, 1);
}

function saveEdit() {
  const po = store.purchaseOrders.find(p => p.id === editingPO.value.id);
  if (po) {
    po.items = editingPO.value.items;
    store.savePOs();
    tryPush('savePO', { id: po.id, date: po.date, supplier: po.supplier, approver: po.approver, status: po.status, items: po.items });
    toast('PO updated!', 'success');
  }
  closeEdit();
}

function markSent(po) {
  po.status = 'sent';
  store.savePOs();
  tryPush('updatePOStatus', { id: po.id, status: 'sent' });
  toast('PO marked as sent', 'success');
}

function printPO(po) {
  const statusColor = po.status === 'sent' ? '#16a34a' : '#d97706';
  const statusBg    = po.status === 'sent' ? '#dcfce7' : '#fef3c7';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${po.id}</title><style>
body{font-family:Arial,sans-serif;padding:32px;font-size:12px;color:#111;}
.sub{color:#666;font-size:11px;margin-bottom:0;}h1{font-size:15px;margin-bottom:2px;}
table{width:100%;border-collapse:collapse;margin:16px 0;}
th{background:#1b2e6b;color:#fff;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
td{padding:8px;border-bottom:1px solid #eee;font-size:12px;}
.meta{margin:12px 0;padding:12px;background:#f0f2f7;border-radius:6px;font-size:12px;line-height:2;}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${statusBg};color:${statusColor};}
.sig{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
.sig-line{border-top:1px solid #000;padding-top:4px;color:#666;font-size:11px;margin-top:30px;}
.footer{margin-top:20px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px;}
@media print{body{padding:16px;}}
</style></head><body>
<h1>KHONSU ELECTRONIC GADGETS TRADING (ITEL MOBILE)</h1>
<div class="sub">Space No. K424.6 Festival Mall, FCC, Alabang, Muntinlupa City</div>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin:16px 0 0;">
<div></div>
<div style="text-align:right;"><strong style="font-size:14px;">PURCHASE ORDER</strong><br><span style="color:#666;font-size:12px;">${po.date}</span></div>
</div>
<div class="meta"><strong>PO Number:</strong> ${po.id} &nbsp; <span class="badge">${po.status.toUpperCase()}</span><br><strong>Supplier:</strong> ${po.supplier}<br><strong>Approver:</strong> ${po.approver}</div>
<table><thead><tr><th>Item</th><th>Color / Notes</th><th style="text-align:right;">Qty</th></tr></thead><tbody>`);
  po.items.forEach(i => {
    win.document.write(`<tr><td>${i.name}</td><td style="color:#666;">${i.color || 'Assorted'}</td><td style="text-align:right;font-weight:600;font-family:monospace;">${i.qty}</td></tr>`);
  });
  win.document.write(`</tbody></table>
<div style="padding:10px 12px;background:#f0f2f7;border-radius:6px;display:flex;justify-content:space-between;margin-top:8px;"><span>Total Line Items</span><strong>${po.items.length}</strong></div>
<div class="sig"><div><div class="sig-line">Prepared by — Signature / Date</div></div><div><div class="sig-line">Received by — Signature / Date</div></div></div>
<div class="footer">Generated by Khonsu Tech OPS</div>
<scr`+'ipt>window.onload=()=>window.print();<\/scr'+'ipt></body></html>');
  win.document.close();
}
</script>

<template>
  <div>
    <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">Purchase Orders</h2>

    <!-- Search + Filter -->
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">
      <div class="sw" style="margin-bottom:0;flex:1;">
        <span class="si"><svg class="ic" aria-hidden="true"><use href="#ic-search"/></svg></span>
        <input v-model="searchQ" type="text" placeholder="Search POs…" />
      </div>
      <button @click="filterOpen = true"
        :style="filterStatus !== 'All' ? 'background:var(--accent);border-color:var(--accent);color:#fff;' : 'color:var(--text);'"
        style="flex-shrink:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);cursor:pointer;"
        :title="filterStatus">
        <svg class="ic" aria-hidden="true"><use href="#ic-filter"/></svg>
      </button>
    </div>
    <div v-if="filterStatus !== 'All'" style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
      <span style="font-size:12px;color:var(--muted);">Showing:</span>
      <span style="font-size:12px;font-weight:600;color:var(--accent);background:var(--accent-light);padding:2px 10px;border-radius:20px;">{{ filterStatus }}</span>
      <button @click="filterStatus = 'All'" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;padding:0;">✕ Clear</button>
    </div>
    <Teleport to="body">
      <div v-if="filterOpen" style="position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;" @click.self="filterOpen = false">
        <div style="background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 20px 32px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <span style="font-size:15px;font-weight:700;">Filter by Status</span>
            <button @click="filterOpen = false" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--muted);line-height:1;">&times;</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <button v-for="f in filterOptions" :key="f" @click="filterStatus = f; filterOpen = false"
              style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:10px;border:none;cursor:pointer;font-size:14px;font-family:inherit;text-align:left;"
              :style="filterStatus === f ? 'background:var(--accent);color:#fff;font-weight:600;' : 'background:var(--surface2);color:var(--text);'">
              {{ f }}
              <svg v-if="filterStatus === f" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-check"/></svg>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div v-if="!filteredPOs.length" style="text-align:center;padding:60px;color:var(--muted);">
      {{ store.purchaseOrders.length ? 'No results match your filter.' : 'No purchase orders yet.' }}
    </div>

    <div v-for="po in filteredPOs" :key="po.id" class="card" style="margin-bottom:16px;">
      <!-- PO header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
        <div>
          <div style="font-size:16px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--accent);margin-bottom:6px;">{{ po.id }}</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.9;">
            <strong style="color:var(--text);">Date:</strong> {{ po.date }}<br>
            <strong style="color:var(--text);">Supplier:</strong> {{ po.supplier }}<br>
            <strong style="color:var(--text);">Approver:</strong> {{ po.approver }}
          </div>
        </div>
        <span
          :style="{ background: po.status === 'sent' ? '#dcfce7' : '#fef3c7', color: po.status === 'sent' ? '#16a34a' : '#d97706' }"
          style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;"
        >
          <svg v-if="po.status === 'sent'" style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-check"/></svg>
          <svg v-else style="width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-clock"/></svg>
          {{ po.status === 'sent' ? 'Sent' : 'Pending' }}
        </span>
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:13px;">
        <thead>
          <tr>
            <th style="background:var(--accent);color:#fff;padding:8px;text-align:left;font-size:10px;">Item</th>
            <th style="background:var(--accent);color:#fff;padding:8px;font-size:10px;">Color/Notes</th>
            <th style="background:var(--accent);color:#fff;padding:8px;font-size:10px;text-align:right;">Qty</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, i) in po.items" :key="i" style="border-bottom:1px solid var(--border);">
            <td style="padding:8px;">{{ item.name }}</td>
            <td style="padding:8px;color:var(--muted);font-size:12px;">{{ item.color || '—' }}</td>
            <td style="padding:8px;font-weight:600;text-align:right;font-family:monospace;">{{ item.qty }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Actions -->
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <template v-if="po.status === 'pending'">
          <button class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:4px;" @click="openEdit(po)">
            <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-edit"/></svg>
            Edit
          </button>
          <button class="btn btn-success btn-sm" @click="markSent(po)">✓ Mark as Sent</button>
        </template>
        <button class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:4px;" @click="printPO(po)">
          <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-printer"/></svg>
          Print
        </button>
      </div>
    </div>

    <!-- Edit PO Modal -->
    <Teleport to="body">
      <div v-if="editModal && editingPO" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto;" @click.self="closeEdit">
        <div style="background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:560px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <h3 style="font-size:16px;font-weight:800;margin:0;">Edit PO — <span style="font-family:monospace;color:var(--accent);">{{ editingPO.id }}</span></h3>
            <span @click="closeEdit" style="cursor:pointer;font-size:22px;color:var(--muted);">&times;</span>
          </div>

          <!-- Existing items -->
          <datalist id="poItemList">
            <option v-for="n in productDatalist" :key="n" :value="n" />
          </datalist>

          <div style="margin-bottom:16px;">
            <div
              v-for="(item, i) in editingPO.items"
              :key="i"
              style="display:grid;grid-template-columns:2fr 80px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);"
            >
              <div style="font-size:13px;font-weight:600;">{{ item.name }}</div>
              <input v-model.number="item.qty" type="number" min="1" style="padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;" />
              <input v-model="item.color" type="text" placeholder="Color/Notes" style="padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;" />
              <span @click="removeLine(i)" style="cursor:pointer;color:var(--red);display:inline-flex;align-items:center;padding:0 4px;">
                <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-trash"/></svg>
              </span>
            </div>
          </div>

          <!-- Add new line item -->
          <div style="background:var(--bg);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">Add Line Item</div>
            <div style="display:grid;grid-template-columns:2fr 80px 1fr auto;gap:8px;align-items:center;">
              <input v-model="newItem" type="text" list="poItemList" placeholder="Item name" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;" />
              <input v-model.number="newQty" type="number" min="1" placeholder="Qty" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;" />
              <input v-model="newColor" type="text" placeholder="Color" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;" />
              <button class="btn btn-outline btn-sm" @click="addLine">+ Add</button>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button class="btn btn-outline" @click="closeEdit">Cancel</button>
            <button class="btn btn-primary" @click="saveEdit">Save PO</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
