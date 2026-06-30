<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAppStore } from '@/stores/state.js';

const store  = useAppStore();
const router = useRouter();
const route  = useRoute();

const isAdmin    = computed(() => store.currentUser === 'Admin');
const drawerOpen = ref(false);

const navItems = computed(() => {
  const items = [
    { path: '/sales',      icon: 'ic-cart',      label: 'Log Sale' },
    { path: '/restock',    icon: 'ic-truck',     label: 'Receive Stock' },
  ];
  if (isAdmin.value) {
    items.push(
      { path: '/inventory',  icon: 'ic-box',       label: 'Inventory' },
      { path: '/po',         icon: 'ic-clipboard', label: 'Purchase Orders' },
      { path: '/masterlist', icon: 'ic-list',      label: 'Master List' },
      { path: '/settings',   icon: 'ic-settings',  label: 'Settings' },
      { path: '/setup',      icon: 'ic-zap',       label: 'Setup' },
      { path: '/reports',    icon: 'ic-calendar',  label: 'Reports' },
      { path: '/dashboard',  icon: 'ic-chart',     label: 'Dashboard' },
    );
  }
  return items;
});

function go(path) {
  router.push(path);
  drawerOpen.value = false;
}

function isActive(path) { return route.path === path; }

function logout() {
  store.currentUser = null;
  localStorage.removeItem('kt_user');
  router.push('/sales');
  drawerOpen.value = false;
}
</script>

<template>
  <!-- Sticky top header -->
  <header style="background:var(--surface);border-bottom:1px solid var(--border);padding:0 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;position:sticky;top:0;z-index:100;">
    <div style="font-size:13px;font-weight:800;color:var(--accent);white-space:nowrap;letter-spacing:-.3px;">Khonsu Tech OPS</div>

    <!-- Desktop: user/switch -->
    <button class="btn btn-outline btn-sm nav-user-btn" style="font-size:12px;white-space:nowrap;flex-shrink:0;" @click="logout">
      <svg class="ic" aria-hidden="true"><use href="#ic-user"/></svg>
      {{ store.currentUser }} — Switch
    </button>

    <!-- Mobile: hamburger -->
    <button class="hamburger" @click="drawerOpen = true" aria-label="Open navigation">
      <svg style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-menu"/></svg>
    </button>
  </header>

  <!-- Desktop horizontal nav (hidden on mobile via CSS) -->
  <nav>
    <button
      v-for="item in navItems"
      :key="item.path"
      class="tab"
      :class="{ active: isActive(item.path) }"
      @click="go(item.path)"
    >
      <svg class="ic" aria-hidden="true"><use :href="'#' + item.icon"/></svg>
      {{ item.label }}
    </button>
  </nav>

  <!-- Mobile drawer -->
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="drawerOpen" style="position:fixed;inset:0;z-index:300;" role="dialog" aria-modal="true" aria-label="Navigation">
        <!-- Backdrop -->
        <div style="position:absolute;inset:0;background:rgba(0,0,0,.5);" @click="drawerOpen = false" />

        <!-- Panel -->
        <div class="drawer-panel">
          <!-- Drawer header -->
          <div style="padding:20px 20px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
            <div>
              <div style="font-size:15px;font-weight:800;color:var(--accent);">Khonsu Tech OPS</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px;">
                Logged in as <strong style="color:var(--text);">{{ store.currentUser }}</strong>
              </div>
            </div>
            <button @click="drawerOpen = false" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:6px;border-radius:8px;display:flex;align-items:center;">
              <svg style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" aria-hidden="true"><use href="#ic-x"/></svg>
            </button>
          </div>

          <!-- Nav items -->
          <div style="flex:1;padding:10px 10px;overflow-y:auto;">
            <button
              v-for="item in navItems"
              :key="item.path"
              class="drawer-item"
              :class="{ active: isActive(item.path) }"
              @click="go(item.path)"
            >
              <svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;" aria-hidden="true"><use :href="'#' + item.icon"/></svg>
              {{ item.label }}
            </button>
          </div>

          <!-- Footer -->
          <div style="padding:16px;border-top:1px solid var(--border);flex-shrink:0;">
            <button class="btn btn-outline btn-lg" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;" @click="logout">
              <svg class="ic" aria-hidden="true"><use href="#ic-user"/></svg>
              Switch User
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
