<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '@/stores/state.js';
import { vl, fmt } from '@/utils.js';

const emit = defineEmits(['confirm', 'add-item', 'edit', 'remove']);
const store = useAppStore();

const items = computed(() => store.pendingItems);

const grandTotal = computed(() =>
  items.value.reduce((s, item) => s + item.sp * item.qty + (item.addon ? item.addon.soldPrice : 0), 0)
);

const custInfo = computed(() => items.value.find(i => i.customer)?.customer || null);

const confirmed = ref(false);
</script>

<template>
  <div>
    <!-- SO header -->
    <div style="background:var(--accent);border-radius:12px;padding:16px 20px;margin-bottom:14px;color:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div>
          <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:1px;">Sales Order</div>
          <div style="font-size:18px;font-weight:800;font-family:monospace;">{{ store.currentSO }}</div>
        </div>
        <div v-if="items.length" style="background:rgba(255,255,255,.2);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">
          {{ items[0].payment }}
        </div>
      </div>
      <div v-if="custInfo" style="border-top:1px solid rgba(255,255,255,.2);padding-top:8px;margin-top:4px;font-size:12px;opacity:.85;display:flex;gap:14px;flex-wrap:wrap;">
        <span v-if="custInfo.name">
          <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.1em;" aria-hidden="true"><use href="#ic-user"/></svg>
          {{ custInfo.name }}
        </span>
        <span v-if="custInfo.contact">
          <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.1em;" aria-hidden="true"><use href="#ic-phone"/></svg>
          {{ custInfo.contact }}
        </span>
        <span v-if="custInfo.email">
          <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.1em;" aria-hidden="true"><use href="#ic-mail"/></svg>
          {{ custInfo.email }}
        </span>
      </div>
    </div>

    <!-- Pending items -->
    <div
      v-for="(item, idx) in items"
      :key="item.id"
      style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;margin-bottom:10px;overflow:hidden;"
    >
      <!-- Item header -->
      <div style="background:var(--accent-light);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="background:var(--accent);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">{{ idx + 1 }}</div>
          <div>
            <div style="font-weight:700;font-size:14px;">{{ item.product.name }}</div>
            <div style="font-size:11px;color:var(--muted);">{{ item.product.category }}{{ vl(item.product) ? ' — ' + vl(item.product) : '' }}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" style="padding:4px 10px;font-size:11px;display:inline-flex;align-items:center;gap:4px;" @click="emit('edit', idx)">
            <svg style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-edit"/></svg>
          </button>
          <button class="btn btn-sm" style="padding:4px 8px;color:var(--red);background:transparent;border:1.5px solid var(--border);border-radius:6px;display:inline-flex;align-items:center;" @click="emit('remove', idx)">
            <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-trash"/></svg>
          </button>
        </div>
      </div>

      <!-- Item body -->
      <div style="padding:12px 16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;">Color(s)</div>
            <div style="font-size:13px;font-weight:600;">{{ item.colors.filter(Boolean).join(', ') || '—' }}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;">Qty</div>
            <div style="font-size:13px;font-weight:600;">{{ item.qty }}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;">Price</div>
            <div style="font-size:13px;font-weight:700;color:var(--accent);font-family:monospace;">{{ fmt(item.sp) }}</div>
          </div>
        </div>

        <!-- IMEIs -->
        <div v-if="item.imeis && item.imeis.length" style="font-size:11px;color:var(--muted);margin-bottom:8px;font-family:'JetBrains Mono',monospace;">
          IMEI: {{ item.imeis.join(' · ') }}
        </div>

        <!-- Bundle/promo code -->
        <div v-if="item.bundleCode" style="font-size:11px;color:var(--muted);margin-bottom:8px;">
          {{ item.isPromo ? 'Promo' : 'Bundle' }} Code:
          <span style="font-family:monospace;font-weight:600;color:var(--accent);">{{ item.bundleCode }}</span>
        </div>

        <!-- Addon -->
        <div v-if="item.addon" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--accent-light);border-radius:8px;margin-bottom:8px;">
          <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;" aria-hidden="true"><use href="#ic-plus"/></svg>
          <div style="flex:1;font-size:13px;font-weight:600;">{{ item.addon.product.name }}</div>
          <div style="font-size:13px;font-weight:700;color:var(--accent);font-family:monospace;">{{ fmt(item.addon.soldPrice) }}</div>
        </div>

        <!-- Freebie / promo addon -->
        <div v-if="item.freebie || item.promoAddon" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f0fdf4;border-radius:8px;margin-bottom:8px;">
          <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;color:var(--green);" aria-hidden="true"><use href="#ic-gift"/></svg>
          <div style="flex:1;font-size:13px;font-weight:600;color:#15803d;">{{ (item.freebie || item.promoAddon).name }}</div>
          <div style="font-size:11px;font-weight:700;color:#15803d;background:#dcfce7;padding:2px 8px;border-radius:10px;">FREE</div>
        </div>

        <!-- Subtotal -->
        <div style="display:flex;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border);">
          <span style="font-size:13px;color:var(--muted);margin-right:10px;">Subtotal</span>
          <span class="mono" style="font-size:15px;font-weight:700;color:var(--accent);">{{ fmt(item.sp * item.qty + (item.addon ? item.addon.soldPrice : 0)) }}</span>
        </div>
      </div>
    </div>

    <!-- Grand total -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:var(--accent);border-radius:10px;color:#fff;margin-bottom:16px;">
      <div>
        <div style="font-size:11px;opacity:.8;">{{ items.length }} item{{ items.length !== 1 ? 's' : '' }}</div>
        <div style="font-size:13px;font-weight:600;">Total Amount</div>
      </div>
      <div class="mono" style="font-size:28px;font-weight:800;">{{ fmt(grandTotal) }}</div>
    </div>

    <!-- Confirmation checkbox -->
    <label style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;margin-bottom:12px;cursor:pointer;"
      :style="confirmed ? 'border-color:var(--green);background:#f0fdf4;' : ''">
      <input type="checkbox" v-model="confirmed" style="width:18px;height:18px;margin-top:1px;accent-color:var(--green);flex-shrink:0;cursor:pointer;" />
      <span style="font-size:13px;font-weight:600;" :style="confirmed ? 'color:#15803d;' : 'color:var(--text);'">
        Customer has reviewed and approved all items, prices, and the total amount shown above.
      </span>
    </label>

    <!-- Actions -->
    <div style="display:flex;gap:10px;margin-bottom:10px;">
      <button class="btn btn-outline btn-lg" style="flex:1;" @click="emit('add-item')">
        <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.125em;" aria-hidden="true"><use href="#ic-plus"/></svg>
        Add Item
      </button>
      <button class="btn btn-success btn-lg" style="flex:2;"
        :disabled="!confirmed"
        :style="!confirmed ? 'opacity:.45;cursor:not-allowed;' : ''"
        @click="confirmed && emit('confirm')">
        ✓ Confirm {{ items.length }} Item{{ items.length !== 1 ? 's' : '' }}
      </button>
    </div>
  </div>
</template>
