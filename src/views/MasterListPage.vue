<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '@/stores/state.js';
import { ik, vl, fmt } from '@/utils.js';
import { COLORS } from '@/data.js';
import { useToast } from '@/composables/useToast.js';
import { tryPush } from '@/composables/useSync.js';

const store = useAppStore();
const { toast } = useToast();

const mlSearch     = ref('');
const filterStatus = ref('All');
const filterOpen   = ref(false);
const filterOptions = ['All', 'Active', 'Obsolete'];

// Filtered master list rows (with original indices)
const filteredRows = computed(() => {
  const q = mlSearch.value.toLowerCase();
  return store.masterList
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      const matchSearch = !q || (p.name + ' ' + vl(p) + ' ' + p.category).toLowerCase().includes(q);
      const matchFilter =
        filterStatus.value === 'All' ||
        (filterStatus.value === 'Active'   && !p.obsolete) ||
        (filterStatus.value === 'Obsolete' &&  p.obsolete);
      return matchSearch && matchFilter;
    });
});

function toggleObs(i) {
  store.masterList[i].obsolete = !store.masterList[i].obsolete;
}

// Save master list
function saveMasterList() {
  localStorage.setItem('kt_ml', JSON.stringify(store.masterList));
  store.masterList.forEach(p => {
    if (!store.inventory[ik(p)]) store.inventory[ik(p)] = { stock: 0, reorder: 1 };
  });
  store.saveInv();
  const productRows = store.masterList.map(p => [
    ik(p), p.category, p.name, p.ram || '', p.storage || '',
    p.colors || '', p.unitPrice, p.srp, p.obsolete ? 'Obsolete' : 'Active',
  ]);
  tryPush('saveProducts', { rows: productRows });
  const inventoryRows = store.masterList.map(p => ({
    productKey: ik(p),
    stock: (store.inventory[ik(p)] || {}).stock || 0,
    reorder: (store.inventory[ik(p)] || {}).reorder || 1,
  }));
  tryPush('saveInventory', { rows: inventoryRows });
  toast('Master list saved!', 'success');
}

// ── New Product modal ──────────────────────────────────────────────────────
const newItemModal = ref(false);
const niCat     = ref('Smart Phone');
const niName    = ref('');
const niRam     = ref('');
const niStorage = ref('');
const niPrice   = ref('');
const niSrp     = ref('');
const niColors  = ref('');

const CAT_OPTIONS = ['Bar Phone', 'Smart Phone', 'Tablet', 'Earbuds', 'Smart Watch', 'Power Bank', 'Others'];

function openNewItem() {
  niCat.value = 'Smart Phone'; niName.value = ''; niRam.value = ''; niStorage.value = '';
  niPrice.value = ''; niSrp.value = ''; niColors.value = '';
  newItemModal.value = true;
}

function saveNewItem() {
  const name = niName.value.trim();
  if (!name) { toast('Product name required', 'error'); return; }
  const newP = {
    category: niCat.value, name,
    ram: niRam.value.trim(), storage: niStorage.value.trim(),
    unitPrice: parseFloat(niPrice.value) || 0,
    srp: parseFloat(niSrp.value) || 0,
    colors: niColors.value.trim() || (COLORS[niCat.value] || []).join(', '),
    obsolete: false,
  };
  store.masterList.push(newP);
  if (!store.inventory[ik(newP)]) store.inventory[ik(newP)] = { stock: 0, reorder: 1 };
  newItemModal.value = false;
  toast('Product added — remember to Save Changes', 'success');
}

// ── Bundle (Promotion) modal ───────────────────────────────────────────────
const bundleModal = ref(false);
const nbName    = ref('');
const nbPrice   = ref('');
const nbMainKey = ref('');
const nbAddonKey= ref('');

const phoneProducts = computed(() =>
  store.masterList.filter(p => !p.obsolete && ['Smart Phone', 'Tablet', 'Bar Phone'].includes(p.category))
);
const accessoryProducts = computed(() =>
  store.masterList.filter(p => !p.obsolete && ['Earbuds', 'Smart Watch', 'Power Bank', 'Others'].includes(p.category))
);

function openBundleModal() {
  nbName.value = ''; nbPrice.value = ''; nbMainKey.value = ''; nbAddonKey.value = '';
  bundleModal.value = true;
}

function saveBundle() {
  const name = nbName.value.trim();
  const price = parseFloat(nbPrice.value) || 0;
  if (!name)          { toast('Bundle name required', 'error'); return; }
  if (!nbMainKey.value) { toast('Select a main item', 'error'); return; }
  if (!nbAddonKey.value){ toast('Select an accessory', 'error'); return; }
  if (!price)         { toast('Bundle price required', 'error'); return; }
  const mainP  = store.masterList.find(p => ik(p) === nbMainKey.value);
  const addonP = store.masterList.find(p => ik(p) === nbAddonKey.value);
  store.predefinedBundles.push({
    id:       'BND-' + String(Date.now()).slice(-5),
    name, price,
    mainKey:  nbMainKey.value,
    mainName: mainP.name + (vl(mainP) ? ' (' + vl(mainP) + ')' : ''),
    addonKey: nbAddonKey.value,
    addonName: addonP.name,
  });
  localStorage.setItem('kt_bundles', JSON.stringify(store.predefinedBundles));
  tryPush('savePromotions', { bundles: store.predefinedBundles });
  bundleModal.value = false;
  toast('Promotion saved!', 'success');
}

function deleteBundle(id) {
  store.predefinedBundles = store.predefinedBundles.filter(b => b.id !== id);
  localStorage.setItem('kt_bundles', JSON.stringify(store.predefinedBundles));
  tryPush('savePromotions', { bundles: store.predefinedBundles });
  toast('Promotion deleted', 'success');
}

// ── Freebie modal ──────────────────────────────────────────────────────────
const freebieModal = ref(false);
const frMain  = ref('');
const frAddon = ref('');

function openFreebieModal() {
  frMain.value = ''; frAddon.value = '';
  freebieModal.value = true;
}

function saveFreebie() {
  if (!frMain.value)  { toast('Select a main product', 'error'); return; }
  if (!frAddon.value) { toast('Select a freebie item', 'error'); return; }
  store.productFreebies[frMain.value] = frAddon.value;
  localStorage.setItem('kt_freebies', JSON.stringify(store.productFreebies));
  const freebies = Object.entries(store.productFreebies).map(([mainKey, freebieKey]) => {
    const mp = store.masterList.find(p => ik(p) === mainKey);
    const fp = store.masterList.find(p => ik(p) === freebieKey);
    return { mainKey, freebieKey, mainName: mp?.name || '', freebieName: fp?.name || '' };
  });
  tryPush('saveFreebies', { freebies });
  freebieModal.value = false;
  toast('Freebie saved!', 'success');
}

function deleteFreebie(mainKey) {
  delete store.productFreebies[mainKey];
  localStorage.setItem('kt_freebies', JSON.stringify(store.productFreebies));
  tryPush('saveFreebies', { freebies: [] });
  toast('Freebie removed', 'success');
}

const freebieEntries = computed(() =>
  Object.entries(store.productFreebies).map(([mk, fk]) => ({
    mk, fk,
    mainP:  store.masterList.find(p => ik(p) === mk),
    addonP: store.masterList.find(p => ik(p) === fk),
  })).filter(e => e.mainP && e.addonP)
);
</script>

<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <h2 style="font-size:20px;font-weight:800;margin:0;">Master List</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" @click="openNewItem">+ New Product</button>
        <button class="btn btn-primary btn-sm" @click="saveMasterList">Save Changes</button>
      </div>
    </div>

    <!-- Search + Filter -->
    <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">
      <div class="sw" style="margin-bottom:0;flex:1;">
        <span class="si"><svg class="ic" aria-hidden="true"><use href="#ic-search"/></svg></span>
        <input v-model="mlSearch" type="text" placeholder="Search products…" />
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

    <!-- Master list table -->
    <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:var(--accent);color:#fff;">
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Category</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Name</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Variant</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Colors</th>
              <th style="padding:10px 12px;text-align:right;white-space:nowrap;">Unit Price</th>
              <th style="padding:10px 12px;text-align:right;white-space:nowrap;">SRP</th>
              <th style="padding:10px 12px;text-align:center;white-space:nowrap;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="{ p, i } in filteredRows"
              :key="i"
              style="border-bottom:1px solid var(--border);"
              :style="{ opacity: p.obsolete ? '0.55' : '1' }"
            >
              <td style="padding:7px 12px;color:var(--muted);">{{ p.category }}</td>
              <td style="padding:7px 12px;font-weight:600;">{{ p.name }}</td>
              <td style="padding:7px 12px;color:var(--muted);">{{ vl(p) || '—' }}</td>
              <td style="padding:7px 12px;">
                <input
                  v-model="store.masterList[i].colors"
                  type="text"
                  style="min-width:150px;padding:5px 8px;font-size:12px;border:1.5px solid var(--border);border-radius:6px;background:var(--bg);outline:none;"
                />
              </td>
              <td style="padding:7px 12px;">
                <input
                  v-model.number="store.masterList[i].unitPrice"
                  type="number"
                  style="width:85px;padding:5px 8px;font-size:12px;border:1.5px solid var(--border);border-radius:6px;background:var(--bg);outline:none;"
                />
              </td>
              <td style="padding:7px 12px;">
                <input
                  v-model.number="store.masterList[i].srp"
                  type="number"
                  style="width:85px;padding:5px 8px;font-size:12px;border:1.5px solid var(--border);border-radius:6px;background:var(--bg);outline:none;"
                />
              </td>
              <td style="padding:7px 12px;text-align:center;">
                <button
                  :class="['toggle-obs', !p.obsolete && 'avail']"
                  @click="toggleObs(i)"
                >{{ p.obsolete ? 'Obsolete' : 'Available' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Promotions (predefined bundles) -->
    <div class="card" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="font-size:15px;font-weight:700;margin:0;">Promotions</h3>
        <button class="btn btn-outline btn-sm" @click="openBundleModal">+ New Promotion</button>
      </div>
      <div v-if="!store.predefinedBundles.length" style="font-size:13px;color:var(--muted);padding:8px 0;">No promotions defined yet.</div>
      <div
        v-for="b in store.predefinedBundles"
        :key="b.id"
        style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;margin-bottom:8px;"
      >
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--accent);">{{ b.name }}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">{{ b.mainName }} + {{ b.addonName }}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:15px;font-weight:700;color:var(--accent);font-family:monospace;">{{ fmt(b.price) }}</div>
          <span @click="deleteBundle(b.id)" style="cursor:pointer;color:var(--red);display:inline-flex;align-items:center;" title="Delete">
            <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-trash"/></svg>
          </span>
        </div>
      </div>
    </div>

    <!-- Freebies -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="font-size:15px;font-weight:700;margin:0;">Freebies</h3>
        <button class="btn btn-outline btn-sm" @click="openFreebieModal">+ Add Freebie</button>
      </div>
      <div v-if="!freebieEntries.length" style="font-size:13px;color:var(--muted);padding:8px 0;">No freebies defined yet.</div>
      <div
        v-for="e in freebieEntries"
        :key="e.mk"
        style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;margin-bottom:8px;"
      >
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--accent);">{{ e.mainP.name }}{{ vl(e.mainP) ? ' (' + vl(e.mainP) + ')' : '' }}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:4px;">
            <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;" aria-hidden="true"><use href="#ic-gift"/></svg>
            {{ e.addonP.name }}
          </div>
        </div>
        <span @click="deleteFreebie(e.mk)" style="cursor:pointer;color:var(--red);display:inline-flex;align-items:center;">
          <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-trash"/></svg>
        </span>
      </div>
    </div>

    <!-- New Product Modal -->
    <Teleport to="body">
      <div v-if="newItemModal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;" @click.self="newItemModal = false">
        <div style="background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:480px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <h3 style="font-size:16px;font-weight:800;margin:0;">New Product</h3>
            <span @click="newItemModal = false" style="cursor:pointer;font-size:22px;color:var(--muted);">&times;</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Category</label>
              <select v-model="niCat" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;">
                <option v-for="c in CAT_OPTIONS" :key="c">{{ c }}</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Name</label>
              <input v-model="niName" type="text" placeholder="Model name" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
            </div>
            <div class="g2">
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">RAM</label>
                <input v-model="niRam" type="text" placeholder="e.g. 4GB" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Storage</label>
                <input v-model="niStorage" type="text" placeholder="e.g. 128GB" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
              </div>
            </div>
            <div class="g2">
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Unit Price (₱)</label>
                <input v-model="niPrice" type="number" placeholder="Cost" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
              </div>
              <div>
                <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">SRP (₱)</label>
                <input v-model="niSrp" type="number" placeholder="Retail" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
              </div>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Colors (comma-separated)</label>
              <input v-model="niColors" type="text" :placeholder="(COLORS[niCat] || []).join(', ')" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
            <button class="btn btn-outline" @click="newItemModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveNewItem">Add Product</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New Bundle Modal -->
    <Teleport to="body">
      <div v-if="bundleModal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;" @click.self="bundleModal = false">
        <div style="background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:440px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <h3 style="font-size:16px;font-weight:800;margin:0;">New Promotion</h3>
            <span @click="bundleModal = false" style="cursor:pointer;font-size:22px;color:var(--muted);">&times;</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Promotion Name</label>
              <input v-model="nbName" type="text" placeholder="e.g. A50C + Earbuds Promo" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Bundle Price (₱)</label>
              <input v-model="nbPrice" type="number" placeholder="0" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Main Item (Phone/Tablet)</label>
              <select v-model="nbMainKey" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;">
                <option value="">— Select main item —</option>
                <option v-for="p in phoneProducts" :key="ik(p)" :value="ik(p)">{{ p.name }}{{ vl(p) ? ' (' + vl(p) + ')' : '' }}</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Accessory</label>
              <select v-model="nbAddonKey" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;">
                <option value="">— Select accessory —</option>
                <option v-for="p in accessoryProducts" :key="ik(p)" :value="ik(p)">{{ p.name }}</option>
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
            <button class="btn btn-outline" @click="bundleModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveBundle">Save Promotion</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Freebie Modal -->
    <Teleport to="body">
      <div v-if="freebieModal" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;" @click.self="freebieModal = false">
        <div style="background:var(--surface);border-radius:16px;padding:24px;width:100%;max-width:400px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <h3 style="font-size:16px;font-weight:800;margin:0;">Add Freebie</h3>
            <span @click="freebieModal = false" style="cursor:pointer;font-size:22px;color:var(--muted);">&times;</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Main Product</label>
              <select v-model="frMain" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;">
                <option value="">— Select product —</option>
                <option v-for="p in phoneProducts" :key="ik(p)" :value="ik(p)">{{ p.name }}{{ vl(p) ? ' (' + vl(p) + ')' : '' }}</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px;display:block;">Freebie Item</label>
              <select v-model="frAddon" style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);outline:none;">
                <option value="">— Select freebie —</option>
                <option v-for="p in accessoryProducts" :key="ik(p)" :value="ik(p)">{{ p.name }}</option>
              </select>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
            <button class="btn btn-outline" @click="freebieModal = false">Cancel</button>
            <button class="btn btn-primary" @click="saveFreebie">Save Freebie</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
