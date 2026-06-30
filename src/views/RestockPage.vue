<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/state.js';
import { ik, vl } from '@/utils.js';
import { useToast } from '@/composables/useToast.js';
import { tryPush } from '@/composables/useSync.js';
import { isImeiProduct } from '@/composables/useSales.js';
import Scanner from '@/components/Scanner.vue';

const store     = useAppStore();
const { toast } = useToast();

// ── DR form ───────────────────────────────────────────────────────────────────
const drNumber  = ref('');
const drDate    = ref(new Date().toISOString().split('T')[0]);
const supplier  = ref('Tecnix Trading');

// ── Product selector ──────────────────────────────────────────────────────────
const productInput  = ref('');
const selectedProd  = ref(null);
const colorSel      = ref('');
const imeiInput     = ref('');
const qtyInput      = ref(1);

const isImei = computed(() => isImeiProduct(selectedProd.value));

const productOptions = computed(() =>
  store.PRODUCTS.map(p => {
    const v = p.ram && p.storage ? ' ' + p.ram + '/' + p.storage : '';
    return p.name + v;
  })
);

const colorOptions = computed(() => {
  if (!selectedProd.value) return [];
  return (selectedProd.value.colors || '').split(',').map(c => c.trim()).filter(Boolean);
});

watch(productInput, val => {
  const match = store.PRODUCTS.find(p => {
    const v = p.ram && p.storage ? ' ' + p.ram + '/' + p.storage : '';
    return (p.name + v) === val.trim();
  });
  selectedProd.value = match || null;
  colorSel.value = colorOptions.value[0] || '';
  imeiInput.value = '';
  qtyInput.value  = 1;
});

// ── Draft list ────────────────────────────────────────────────────────────────
const draft = ref(store.receiveDraftItems);

// ── Scanner ───────────────────────────────────────────────────────────────────
const scannerOpen = ref(false);

function onScanDetected(val) {
  imeiInput.value = val;
  scannerOpen.value = false;
  addUnit();
}

// ── Actions ───────────────────────────────────────────────────────────────────
function addUnit() {
  const p = selectedProd.value;
  if (!p) { toast('Select a product first', 'error'); return; }
  const imei = imeiInput.value.trim();
  if (!imei) { toast('Enter or scan an IMEI', 'error'); return; }
  if (store.units.find(u => u.imei === imei) || draft.value.find(i => i.imei === imei)) {
    toast('This IMEI already exists', 'error'); return;
  }
  draft.value.push({
    imei, productKey: ik(p), productName: p.name,
    color: colorSel.value || 'Assorted', isImei: true,
  });
  store.receiveDraftItems = draft.value;
  imeiInput.value = '';
  toast('Unit staged', 'success');
}

function addQty() {
  const p = selectedProd.value;
  if (!p) { toast('Select a product first', 'error'); return; }
  const qty = parseInt(qtyInput.value) || 0;
  if (qty <= 0) { toast('Enter a valid quantity', 'error'); return; }
  draft.value.push({
    productKey: ik(p), productName: p.name,
    color: colorSel.value || 'Assorted', qty, isImei: false,
  });
  store.receiveDraftItems = draft.value;
  qtyInput.value = 1;
  toast(qty + ' unit' + (qty !== 1 ? 's' : '') + ' staged', 'success');
}

function removeDraftItem(i) {
  draft.value.splice(i, 1);
  store.receiveDraftItems = draft.value;
}

function confirmRestock() {
  const items = draft.value;
  if (!items.length) { toast('No items to receive', 'error'); return; }

  const dr = {
    number: drNumber.value.trim() || 'DR-UNKNOWN',
    date:   drDate.value || new Date().toLocaleDateString('en-PH'),
    supplier: supplier.value.trim() || 'Tecnix Trading',
  };

  const imeiItems    = items.filter(i => i.isImei);
  const nonImeiItems = items.filter(i => !i.isImei);

  // Add new IMEI units
  const newUnits = imeiItems.map(item => ({
    imei: item.imei,
    productKey: item.productKey,
    productName: item.productName,
    color: item.color,
    status: 'available',
    drNumber: dr.number,
    receivedDate: dr.date,
    soNumber: null, soldDate: null, isDummy: false,
  }));
  store.units.push(...newUnits);

  // Recalculate IMEI stock from available units
  const imeiKeys = [...new Set(newUnits.map(u => u.productKey))];
  imeiKeys.forEach(key => {
    if (!store.inventory[key]) store.inventory[key] = { stock: 0, reorder: 1 };
    store.inventory[key].stock = store.units.filter(u => u.productKey === key && u.status === 'available').length;
  });

  // Add non-IMEI stock
  nonImeiItems.forEach(item => {
    if (!store.inventory[item.productKey]) store.inventory[item.productKey] = { stock: 0, reorder: 1 };
    store.inventory[item.productKey].stock += item.qty;
  });

  // Save locally
  localStorage.setItem('kt_units', JSON.stringify(store.units));
  store.saveInv();

  // Sync to Sheets
  const allKeys = [...new Set([...imeiKeys, ...nonImeiItems.map(i => i.productKey)])];
  if (newUnits.length) tryPush('saveUnits', { units: newUnits });
  tryPush('updateInventoryItems', {
    items: allKeys.map(key => ({
      productKey: key,
      stock:   (store.inventory[key] || {}).stock   || 0,
      reorder: (store.inventory[key] || {}).reorder || 1,
    })),
  });

  // Reset
  draft.value = [];
  store.receiveDraftItems = [];
  store.restockProduct    = null;
  productInput.value  = '';
  selectedProd.value  = null;
  drNumber.value  = '';
  supplier.value  = 'Tecnix Trading';
  drDate.value    = new Date().toISOString().split('T')[0];
  toast('Stock received successfully!', 'success');
}
</script>

<template>
  <div>
    <h2 style="font-size:20px;font-weight:800;margin-bottom:16px;">Receive Stock</h2>

    <!-- DR details -->
    <div class="card" style="margin-bottom:16px;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:6px;">
        <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:var(--accent);" aria-hidden="true"><use href="#ic-truck"/></svg>
        Delivery Details
      </h3>
      <div class="g3" style="gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">DR Number</label>
          <input v-model="drNumber" type="text" placeholder="e.g. DR-240001" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Date</label>
          <input v-model="drDate" type="date" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Supplier</label>
          <input v-model="supplier" type="text" placeholder="Supplier name" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
        </div>
      </div>
    </div>

    <!-- Product selector -->
    <div class="card" style="margin-bottom:16px;">
      <h3 style="font-size:14px;font-weight:700;margin-bottom:14px;">Add Item</h3>

      <datalist id="rs-product-list">
        <option v-for="n in productOptions" :key="n" :value="n" />
      </datalist>

      <div class="g2" style="margin-bottom:12px;gap:10px;">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Product</label>
          <input
            v-model="productInput"
            type="text"
            list="rs-product-list"
            placeholder="Type or select product…"
            style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;"
          />
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Color</label>
          <select
            v-model="colorSel"
            :disabled="!selectedProd"
            style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;"
          >
            <option v-if="!selectedProd" value="">— Select product first —</option>
            <option v-for="c in colorOptions" :key="c" :value="c">{{ c }}</option>
            <option v-if="!colorOptions.length && selectedProd" value="Assorted">Assorted</option>
          </select>
        </div>
      </div>

      <!-- IMEI mode (Smart Phone / Bar Phone / Tablet) -->
      <div v-if="selectedProd && isImei">
        <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">IMEI</label>
        <div style="display:flex;gap:8px;">
          <input
            v-model="imeiInput"
            type="text"
            placeholder="Scan or type IMEI…"
            style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;font-family:'JetBrains Mono',monospace;"
            @keydown.enter.prevent="addUnit"
          />
          <button class="btn btn-outline btn-sm" style="padding:9px 12px;" title="Scan barcode" @click="scannerOpen = true">
            <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-scan"/></svg>
          </button>
          <button class="btn btn-primary btn-sm" @click="addUnit">+ Add</button>
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:4px;">Press Enter or click Add after scanning/typing each IMEI.</p>
      </div>

      <!-- Qty mode (accessories) -->
      <div v-else-if="selectedProd && !isImei">
        <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Quantity</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input
            v-model.number="qtyInput"
            type="number"
            min="1"
            style="width:90px;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg);color:var(--text);outline:none;"
          />
          <button class="btn btn-primary btn-sm" @click="addQty">+ Add {{ qtyInput }} unit{{ qtyInput !== 1 ? 's' : '' }}</button>
        </div>
      </div>

      <div v-else style="font-size:13px;color:var(--muted);padding:8px 0;">
        Select a product above to add items.
      </div>
    </div>

    <!-- Draft list -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="font-size:14px;font-weight:700;margin:0;">
          Staged Items
          <span v-if="draft.length" style="font-size:12px;color:var(--muted);font-weight:400;margin-left:6px;">({{ draft.length }})</span>
        </h3>
        <button
          v-if="draft.length"
          class="btn btn-success"
          @click="confirmRestock"
        >✓ Confirm Receipt</button>
      </div>

      <div v-if="!draft.length" style="font-size:13px;color:var(--muted);padding:8px 0;">No items staged yet.</div>

      <div
        v-for="(item, i) in draft"
        :key="i"
        style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;margin-bottom:8px;"
      >
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">{{ item.productName }}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">
            {{ item.color }}
            <template v-if="item.isImei">
              &mdash; <span style="font-family:'JetBrains Mono',monospace;">{{ item.imei }}</span>
            </template>
            <template v-else>
              &times; {{ item.qty }}
            </template>
          </div>
        </div>
        <span @click="removeDraftItem(i)" style="cursor:pointer;color:var(--red);display:inline-flex;align-items:center;padding:0 4px;">
          <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-trash"/></svg>
        </span>
      </div>
    </div>

    <Scanner :show="scannerOpen" @detected="onScanDetected" @close="scannerOpen = false" />
  </div>
</template>
