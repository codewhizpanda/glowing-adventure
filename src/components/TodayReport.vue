<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/state.js';
import { fmt } from '@/utils.js';
import { useSales } from '@/composables/useSales.js';

const emit = defineEmits(['close-day', 'back']);
const store = useAppStore();
const { removeRow, closeDayReport, printReport } = useSales();

const rows = computed(() => store.saleRows);

const gross = computed(() => rows.value.reduce((s, r) => s + r.soldPrice * r.qty, 0));
const disc  = computed(() => rows.value.reduce((s, r) => s + (r.discount || 0), 0));
const net   = computed(() => rows.value.reduce((s, r) => s + (r.netSales || 0), 0));
const cash  = computed(() => rows.value.filter(r => r.payment === 'Cash').reduce((s, r) => s + r.soldPrice * r.qty, 0));
const card  = computed(() => rows.value.filter(r => r.payment === 'Card').reduce((s, r) => s + r.soldPrice * r.qty, 0));
const hc    = computed(() => rows.value.filter(r => r.payment === 'Home Credit').reduce((s, r) => s + r.soldPrice * r.qty, 0));

const metTarget = computed(() => net.value >= store.settings.dailyTarget);
const targetGap = computed(() => store.settings.dailyTarget - net.value);

const staffSales = computed(() => {
  const sm = {};
  rows.value.forEach(r => { sm[r.staff] = (sm[r.staff] || 0) + (r.netSales || 0); });
  return Object.entries(sm);
});

function handleCloseDay() {
  if (closeDayReport()) emit('close-day');
}
</script>

<template>
  <div>
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <button class="btn btn-outline btn-sm" @click="emit('back')">
          <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.125em;" aria-hidden="true"><use href="#ic-arrow-left"/></svg>
          Back
        </button>
        <h2 style="font-size:16px;font-weight:800;margin:0;">Today's Report</h2>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" @click="printReport">
          <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.1em;" aria-hidden="true"><use href="#ic-printer"/></svg>
          Print
        </button>
        <button class="btn btn-danger btn-sm" @click="handleCloseDay">Close Day</button>
      </div>
    </div>

    <!-- Summary cards -->
    <div v-if="rows.length" class="g3" style="margin-bottom:14px;">
      <div class="sc">
        <div class="sc-label">Gross Sales</div>
        <div class="sc-val mono">{{ fmt(gross) }}</div>
      </div>
      <div class="sc">
        <div class="sc-label">Net Sales</div>
        <div class="sc-val mono" style="color:var(--green);">{{ fmt(net) }}</div>
      </div>
      <div class="sc" :style="{ borderColor: metTarget ? 'var(--green)' : 'var(--red)' }">
        <div class="sc-label">Target</div>
        <div class="sc-val" :style="{ color: metTarget ? 'var(--green)' : 'var(--red)' }">
          <svg v-if="metTarget" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.2em;" aria-hidden="true"><use href="#ic-check-circle"/></svg>
          <svg v-else style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.2em;" aria-hidden="true"><use href="#ic-x-circle"/></svg>
          {{ metTarget ? 'Met!' : fmt(targetGap) + ' to go' }}
        </div>
      </div>
    </div>

    <!-- Payment breakdown + staff -->
    <div v-if="rows.length" class="g2" style="margin-bottom:14px;">
      <div class="sc">
        <div class="sc-label" style="margin-bottom:10px;">Payment Breakdown</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;"><span>Cash</span><span class="mono">{{ cash > 0 ? fmt(cash) : 'N/A' }}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;"><span>Card</span><span class="mono">{{ card > 0 ? fmt(card) : 'N/A' }}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;"><span>Home Credit</span><span class="mono">{{ hc > 0 ? fmt(hc) : 'N/A' }}</span></div>
      </div>
      <div class="sc">
        <div class="sc-label" style="margin-bottom:10px;">Staff Performance</div>
        <div v-for="[name, val] in staffSales" :key="name" style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;">
          <span>{{ name }}</span><span class="mono" style="font-weight:700;">{{ fmt(val) }}</span>
        </div>
        <div style="border-top:1px solid var(--border);margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:13px;">
          <span>Target:</span><span class="mono">{{ fmt(store.settings.dailyTarget) }}</span>
        </div>
      </div>
    </div>

    <!-- Transactions table -->
    <div v-if="rows.length" style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:var(--accent);color:#fff;">
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">SO#</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Code</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Item</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Variant</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Color</th>
              <th style="padding:10px 12px;text-align:right;white-space:nowrap;">Qty</th>
              <th style="padding:10px 12px;text-align:right;white-space:nowrap;">SRP</th>
              <th style="padding:10px 12px;text-align:right;white-space:nowrap;">Sold</th>
              <th style="padding:10px 12px;text-align:right;white-space:nowrap;">Net</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Payment</th>
              <th style="padding:10px 12px;text-align:left;white-space:nowrap;">Type</th>
              <th style="padding:10px 12px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.id" style="border-bottom:1px solid var(--border);">
              <td style="padding:9px 12px;font-size:11px;font-family:monospace;white-space:nowrap;">{{ r.so || '—' }}</td>
              <td style="padding:9px 12px;font-family:monospace;font-size:11px;font-weight:600;" :style="{ color: r.isPromotion ? '#15803d' : 'var(--accent2)' }">{{ r.bundle || '—' }}</td>
              <td style="padding:9px 12px;font-weight:600;white-space:nowrap;">
                {{ r.itemName }}
                <span v-if="r.isAddon" style="font-size:10px;background:var(--accent-light);color:var(--accent);padding:1px 5px;border-radius:4px;margin-left:4px;">add-on</span>
                <div v-if="r.imeis && r.imeis.length" style="font-size:10px;font-family:monospace;color:var(--muted);margin-top:2px;">{{ r.imeis.join(' · ') }}</div>
              </td>
              <td style="padding:9px 12px;color:var(--muted);font-size:11px;">{{ r.variant || '—' }}</td>
              <td style="padding:9px 12px;">{{ r.color || '—' }}</td>
              <td style="padding:9px 12px;text-align:right;font-family:monospace;">{{ r.qty }}</td>
              <td style="padding:9px 12px;text-align:right;font-family:monospace;">{{ fmt(r.srp) }}</td>
              <td style="padding:9px 12px;text-align:right;font-family:monospace;font-weight:700;color:var(--accent);">{{ fmt(r.soldPrice * r.qty) }}</td>
              <td style="padding:9px 12px;text-align:right;font-family:monospace;" :style="{ color: (r.netSales || 0) >= 0 ? 'var(--green)' : 'var(--red)' }">{{ fmt(r.netSales) }}</td>
              <td style="padding:9px 12px;">{{ r.payment }}</td>
              <td style="padding:9px 12px;white-space:nowrap;">
                <span v-if="r.soldType === 'Walk-in'" style="color:var(--green);font-weight:600;">Walk-in</span>
                <span v-else style="color:var(--accent2);font-weight:600;">Pasa<br><span v-if="r.promoter" style="font-size:10px;color:var(--muted);font-weight:400;">{{ r.promoter }}</span></span>
              </td>
              <td style="padding:9px 12px;">
                <span @click="removeRow(r.id)" style="cursor:pointer;color:var(--red);display:inline-flex;align-items:center;">
                  <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-trash"/></svg>
                </span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background:var(--accent-light);font-weight:700;">
              <td colspan="7" style="padding:10px 12px;font-size:12px;">TOTAL</td>
              <td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--accent);">{{ fmt(gross) }}</td>
              <td style="padding:10px 12px;text-align:right;font-family:monospace;color:var(--green);">{{ fmt(net) }}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div v-else style="padding:40px;text-align:center;color:var(--muted);">
      No transactions yet.
    </div>
  </div>
</template>
