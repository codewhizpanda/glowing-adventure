export const state = {
  currentUser: null,
  masterList: [],
  PRODUCTS: [],
  predefinedBundles: [],
  productFreebies: {},
  settings: { dailyTarget: 3000, lowStockThreshold: 2, globalReorder: 1 },
  inventory: {},
  saleRows: [],
  pendingItems: [],
  currentSO: null,
  soCounter: parseInt(localStorage.getItem('kt_so') || '0'),
  selectedProduct: null,
  selectedAddon: null,
  activeCat: 'Smart Phone',
  searchQ: '',
  addonCat: 'All',
  bundleCounter: parseInt(localStorage.getItem('kt_pc') || '0'),
  purchaseOrders: JSON.parse(localStorage.getItem('kt_pos') || '[]'),
  scriptUrl: localStorage.getItem('kt_url') || '',
  editingPOId: null,
  syncQueue: [],
  units: [],
  selectedIMEIs: [],
  receiveDraftItems: [],
  restockProduct: null,
};

export function saveInv() {
  localStorage.setItem('kt_inv', JSON.stringify(state.inventory));
}
