<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '@/stores/state.js';
import { ik, fmt } from '@/utils.js';

const emit = defineEmits(['select', 'remove']);
const store = useAppStore();

const ADDON_PRODUCT_CATS = ['Earbuds', 'Smart Watch', 'Power Bank', 'Others'];
const addonCatOpts = ['All', ...ADDON_PRODUCT_CATS];
const localCat = ref('All');
const pickerOpen = ref(false);

const addonDisplay = ref('');

// Sync display when a new addon is selected or removed (watches the reference, not soldPrice property)
watch(() => store.selectedAddon, (v) => {
  addonDisplay.value = v?.soldPrice > 0 ? v.soldPrice.toFixed(2) : '';
}, { immediate: true });

function onAddonPriceBlur() {
  if (!store.selectedAddon) return;
  const v = parseFloat(addonDisplay.value) || 0;
  store.selectedAddon.soldPrice = v;
  addonDisplay.value = v > 0 ? v.toFixed(2) : '';
}

const addonProducts = computed(() =>
  store.PRODUCTS.filter(p =>
    ADDON_PRODUCT_CATS.includes(p.category) &&
    (localCat.value === 'All' || p.category === localCat.value)
  )
);

function selectAddon(p) {
  emit('select', p);
  pickerOpen.value = false;
}
</script>

<template>
  <div>
    <!-- Show "Add Accessory" button only if no addon and picker closed -->
    <button
      v-if="!store.selectedAddon && !pickerOpen"
      class="btn btn-outline btn-sm"
      style="width:100%;margin-bottom:8px;"
      @click="pickerOpen = true; localCat = 'All';"
    >
      <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.125em;" aria-hidden="true"><use href="#ic-plus"/></svg>
      Add Accessory
    </button>

    <!-- Picker grid -->
    <div v-if="pickerOpen && !store.selectedAddon" style="border:1.5px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:8px;">
      <div style="padding:10px 12px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:13px;font-weight:600;">Select Add-on</span>
        <span @click="pickerOpen = false" style="cursor:pointer;color:var(--muted);font-size:18px;line-height:1;">&times;</span>
      </div>
      <!-- Cat filter -->
      <div style="display:flex;gap:5px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--border);">
        <button
          v-for="c in addonCatOpts"
          :key="c"
          :class="['cat-btn', localCat === c && 'active']"
          style="font-size:11px;padding:4px 10px;"
          @click="localCat = c"
        >{{ c }}</button>
      </div>
      <!-- Grid -->
      <div class="pgrid" style="padding:10px;gap:8px;">
        <div
          v-for="p in addonProducts"
          :key="ik(p)"
          :class="['pc', (store.inventory[ik(p)]?.stock <= 0) && 'oos']"
          style="padding:10px;cursor:pointer;"
          @click="!(store.inventory[ik(p)]?.stock <= 0) && selectAddon(p)"
        >
          <div :class="['sb', store.inventory[ik(p)]?.stock <= 0 ? 'sout' : store.inventory[ik(p)]?.stock <= 1 ? 'slow' : 'sok']">
            {{ store.inventory[ik(p)]?.stock <= 0 ? 'OUT' : store.inventory[ik(p)]?.stock + ' left' }}
          </div>
          <div class="cl">{{ p.category }}</div>
          <div class="pn" style="font-size:12px;">{{ p.name }}</div>
          <div class="pp" style="font-size:13px;">{{ fmt(p.srp) }}</div>
        </div>
        <div v-if="!addonProducts.length" style="padding:20px;text-align:center;color:var(--muted);grid-column:1/-1;">
          No accessories.
        </div>
      </div>
    </div>

    <!-- Selected addon display -->
    <div v-if="store.selectedAddon" style="border:1.5px solid var(--accent);border-radius:8px;padding:10px 14px;background:var(--surface);display:flex;align-items:center;gap:10px;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;color:var(--accent);">{{ store.selectedAddon.product.name }}</div>
        <div style="font-size:11px;color:var(--muted);">Add-on price (editable)</div>
      </div>
      <span style="color:var(--muted);">₱</span>
      <input
        :value="addonDisplay"
        type="text"
        inputmode="decimal"
        placeholder="0.00"
        style="width:90px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;font-family:monospace;font-weight:600;color:var(--accent);background:var(--bg);outline:none;"
        @input="addonDisplay = $event.target.value; if(store.selectedAddon) store.selectedAddon.soldPrice = parseFloat($event.target.value) || 0"
        @blur="onAddonPriceBlur"
      />
      <span @click="emit('remove')" style="cursor:pointer;color:var(--red);display:inline-flex;align-items:center;">
        <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-trash"/></svg>
      </span>
    </div>
  </div>
</template>
