/* ============================================================
   i-DASH — Web-Based Inventory & Sales Management System v1.1
   RGCA Interior Design Supplies
   Changes:
     - Inventory Staff: no Orders/Queue; QR count comparison + logs
     - Production Staff: material requests + finished goods submission
     - Admin/Inventory: confirm/cancel incoming finished goods
     - Stock alert popup on entry
     - Password show/hide toggle
     - Product images
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const LS_KEY = 'idash.v3';
  const LS_SESSION = 'idash.session.v3';
  const LS_NOTIF = 'idash.notifications.v3';
  const COOLDOWN_MS = 1500;
  const MAX_QTY = 500;
  const PAGE_MARGIN = 10;
  const GAP = 1;
  const PAPER = {
    a4:     { w: 210,   h: 297,   css: 'A4' },
    letter: { w: 215.9, h: 279.4, css: 'Letter' }
  };
  const ROLE_LABELS = {
    admin: 'Administrator', sales: 'Sales Staff', inventory: 'Inventory Staff',
    production: 'Production Staff', marketing: 'Marketing Staff'
  };
  const STATUS_BADGE = {
    'in stock': 'outline', 'low stock': 'filled', 'out of stock': 'solid', 'overstock': 'dashed',
    'Pending': 'filled', 'In Production': 'g700', 'Ready for Delivery': 'outline',
    'Completed': 'solid', 'Cancelled': 'solid', 'Waiting': 'filled', 'Being Served': 'g700'
  };

  /* ============================================================
     UTILITIES
     ============================================================ */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const uid = (p = '') => p + Math.random().toString(36).slice(2, 10).toUpperCase();
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? '' : dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }); };
  const fmtDateTime = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? '' : dt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }); };
  const monthName = (m) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
  const sanitizeSku = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const makeUnitId = (sku, n) => sku + '-' + String(n).padStart(4, '0');

  let toastTimer;
  function toast(msg, kind) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast ' + (kind || '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ============================================================
     DOWNLOAD HELPERS
     ============================================================ */
  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const downloadText = (text, name, mime) => downloadBlob(new Blob([text], { type: mime }), name);
  const canvasToBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));
  const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const csvRow = (arr) => arr.map(csvCell).join(',');

  /* ============================================================
     PRODUCT IMAGE LIBRARY (Unsplash direct links)
     ============================================================ */
  const IMG = {
    blinds: [
      'https://images.unsplash.com/photo-1595872018818-97555653a011?w=600&q=80',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&q=80',
      'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=600&q=80'
    ],
    roller: [
      'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=600&q=80',
      'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=600&q=80',
      'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=600&q=80'
    ],
    curtains: [
      'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=600&q=80',
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80'
    ],
    doors: [
      'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&q=80',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&q=80'
    ],
    cabinets: [
      'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=600&q=80',
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&q=80',
      'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?w=600&q=80'
    ]
  };
  const pickImg = (category, sku) => {
    const key = (category || '').toLowerCase();
    let pool = IMG.blinds;
    if (key.includes('roller')) pool = IMG.roller;
    else if (key.includes('curtain')) pool = IMG.curtains;
    else if (key.includes('door')) pool = IMG.doors;
    else if (key.includes('cabinet')) pool = IMG.cabinets;
    let h = 0; for (const c of String(sku || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return pool[h % pool.length];
  };

  /* ============================================================
     SEED DATA
     ============================================================ */
  const SEED_PRODUCTS = [
    { name: 'Natural Basic Color Window Blind', sku: 'B500', category: 'Window Blinds', price: 1450, cost: 950, stock: 24, reorder: 8, featured: true, isNew: false },
    { name: 'Primewood Window Blind', sku: 'W300', category: 'Window Blinds', price: 1620, cost: 1100, stock: 18, reorder: 6, featured: false, isNew: false },
    { name: 'Woodlook Eluxe', sku: 'W800', category: 'Window Blinds', price: 1780, cost: 1200, stock: 12, reorder: 6, featured: true, isNew: false },
    { name: 'Vega Window Blind', sku: 'V500', category: 'Window Blinds', price: 1350, cost: 900, stock: 4, reorder: 8, featured: false, isNew: false },
    { name: 'Silk Window Blind', sku: 'S300', category: 'Window Blinds', price: 1520, cost: 1000, stock: 0, reorder: 5, featured: false, isNew: false },
    { name: 'Natural Linen', sku: 'L700', category: 'Window Blinds', price: 1490, cost: 980, stock: 22, reorder: 8, featured: false, isNew: false },
    { name: 'Trilogy', sku: 'T620', category: 'Window Blinds', price: 1550, cost: 1020, stock: 16, reorder: 6, featured: false, isNew: false },
    { name: 'Timber', sku: 'T500', category: 'Window Blinds', price: 1680, cost: 1120, stock: 30, reorder: 8, featured: false, isNew: false },
    { name: 'Kingswood', sku: 'K500', category: 'Window Blinds', price: 1750, cost: 1180, stock: 9, reorder: 6, featured: false, isNew: false },
    { name: 'Trinity', sku: 'T800', category: 'Window Blinds', price: 1420, cost: 940, stock: 14, reorder: 6, featured: false, isNew: true },
    { name: 'Pinova', sku: 'P100', category: 'Window Blinds', price: 1390, cost: 920, stock: 20, reorder: 8, featured: false, isNew: false },
    { name: 'Sunscreen A4501', sku: 'A4501', category: 'Roller Blinds', price: 1250, cost: 820, stock: 35, reorder: 10, featured: true, isNew: false },
    { name: 'Sunscreen T3501', sku: 'T3501', category: 'Roller Blinds', price: 1180, cost: 780, stock: 28, reorder: 10, featured: false, isNew: false },
    { name: 'Blackout S2600', sku: 'S2600', category: 'Roller Blinds', price: 1420, cost: 950, stock: 15, reorder: 8, featured: false, isNew: false },
    { name: 'Blackout R8210', sku: 'R8210', category: 'Roller Blinds', price: 1380, cost: 920, stock: 6, reorder: 8, featured: false, isNew: true },
    { name: 'Aphrodite Curtain', sku: 'AP100', category: 'Curtains', price: 1850, cost: 1200, stock: 10, reorder: 5, featured: true, isNew: false },
    { name: 'Athena Curtain', sku: 'AT200', category: 'Curtains', price: 1950, cost: 1280, stock: 8, reorder: 5, featured: false, isNew: false },
    { name: 'Victoria Curtain', sku: 'VT300', category: 'Curtains', price: 2100, cost: 1400, stock: 12, reorder: 5, featured: false, isNew: false },
    { name: 'Oxford Curtain', sku: 'OX1300', category: 'Curtains', price: 1750, cost: 1150, stock: 0, reorder: 5, featured: false, isNew: false },
    { name: 'Accordion Door Standard', sku: 'ACC-STD', category: 'Accordion Doors', price: 3200, cost: 2100, stock: 8, reorder: 3, featured: true, isNew: false },
    { name: 'Accordion Door Premium', sku: 'ACC-PRM', category: 'Accordion Doors', price: 4200, cost: 2800, stock: 5, reorder: 3, featured: false, isNew: true },
    { name: 'Modular Cabinet Small', sku: 'CAB-S', category: 'Modular Cabinets', price: 5500, cost: 3800, stock: 4, reorder: 2, featured: false, isNew: false },
    { name: 'Modular Cabinet Medium', sku: 'CAB-M', category: 'Modular Cabinets', price: 7800, cost: 5400, stock: 3, reorder: 2, featured: false, isNew: false },
    { name: 'Modular Cabinet Large', sku: 'CAB-L', category: 'Modular Cabinets', price: 10500, cost: 7300, stock: 2, reorder: 2, featured: true, isNew: false }
  ];

  const SEED_CUSTOMERS = [
    { name: 'Maria Santos', phone: '0917-555-0101', email: 'maria.santos@email.com', leadSource: 'Facebook', totalOrders: 3, lifetimeValue: 45800 },
    { name: 'San Jose Elementary School', phone: '(044) 555-0202', email: 'admin@sjes.edu.ph', leadSource: 'Referral', totalOrders: 2, lifetimeValue: 128500 },
    { name: 'Interior by Design Co.', phone: '0918-555-0303', email: 'hello@interiorbydesign.ph', leadSource: 'Referral', totalOrders: 5, lifetimeValue: 312000 },
    { name: 'Brgy. San Isidro Hall', phone: '(044) 555-0404', email: 'sanisidro@bgry.gov.ph', leadSource: 'Walk-in', totalOrders: 1, lifetimeValue: 89000 },
    { name: 'John Reyes', phone: '0920-555-0505', email: 'jreyes@gmail.com', leadSource: 'Facebook', totalOrders: 1, lifetimeValue: 15600 }
  ];

  const SEED_USERS = [
    { id: 'U1', name: 'Hans David Cruz', email: 'admin@rgca.ph', password: 'admin', role: 'admin', active: true },
    { id: 'U2', name: 'Robert Sales', email: 'sales@rgca.ph', password: 'sales', role: 'sales', active: true },
    { id: 'U3', name: 'Anna Inventory', email: 'inv@rgca.ph', password: 'inventory', role: 'inventory', active: true },
    { id: 'U4', name: 'Pedro Production', email: 'prod@rgca.ph', password: 'production', role: 'production', active: true },
    { id: 'U5', name: 'Grace Marketing', email: 'mkt@rgca.ph', password: 'marketing', role: 'marketing', active: true }
  ];

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    products: [], customers: [], users: [], orders: [], stockMovements: [],
    queue: [], promotions: [], expenses: [],
    units: [], unitCounters: {}, labelSheet: [],
    countSessions: [],                 // new: { id, started, finished, startedBy, rows, countedIds, missing, unknown, duplicates, submitted }
    materialRequests: [],              // production: { id, date, product, sku, materials:[{name, qty}], status, requestedBy }
    finishedGoods: [],                 // production submissions: { id, date, name, sku, category, qty, notes, status: pending|confirmed|cancelled, submittedBy, confirmedBy }
    notifications: []                  // { id, date, role, message, read }
  };
  let session = null;
  let unitIndex = new Map();

  /* ============================================================
     PERSISTENCE
     ============================================================ */
  function seed() {
    state.products = SEED_PRODUCTS.map((p, i) => ({
      id: 'P' + (i + 1), ...p, unit: 'pc', description: '',
      image: pickImg(p.category, p.sku),
      isActive: true, createdAt: new Date().toISOString()
    }));
    state.customers = SEED_CUSTOMERS.map((c, i) => ({ id: 'C' + (i + 1), clientCode: 'CL-' + String(i + 1).padStart(4, '0'), ...c, isActive: true, createdAt: new Date().toISOString() }));
    state.users = [...SEED_USERS];
    state.promotions = [
      { id: 'PR1', name: 'Summer Sale', type: 'percentage', value: 10, start: '2026-01-01', end: '2026-12-31', active: true, products: ['P1', 'P3', 'P12'] },
      { id: 'PR2', name: 'New Customer Bundle', type: 'bundle', value: 500, start: '2026-01-01', end: '2026-12-31', active: true, products: ['P20', 'P21'] }
    ];
    state.expenses = [
      { id: 'E1', date: '2026-06-01', category: 'Utilities', description: 'Electricity', amount: 8500 },
      { id: 'E2', date: '2026-06-05', category: 'Rent', description: 'Warehouse rent', amount: 25000 }
    ];
    save();
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { toast('Storage full', 'bad'); }
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        Object.assign(state, JSON.parse(raw));
        // migrate older data: ensure new arrays exist and products have images
        state.countSessions = state.countSessions || [];
        state.materialRequests = state.materialRequests || [];
        state.finishedGoods = state.finishedGoods || [];
        state.notifications = state.notifications || [];
        state.products.forEach(p => { if (!p.image) p.image = pickImg(p.category, p.sku); });
        rebuildUnitIndex();
        return;
      }
    } catch (e) { console.warn(e); }
    seed();
    rebuildUnitIndex();
  }

  function rebuildUnitIndex() { unitIndex = new Map(state.units.map(u => [u.id, u])); }

  /* ============================================================
     HELPERS
     ============================================================ */
  function productById(id) { return state.products.find(p => p.id === id); }
  function customerById(id) { return state.customers.find(c => c.id === id); }
  function userById(id) { return state.users.find(u => u.id === id); }
  function orderById(id) { return state.orders.find(o => o.id === id); }
  function unitById(id) { return unitIndex.get(id); }
  function productStock(p) { return Number(p.stock || 0); }
  function productStatus(p) {
    const s = productStock(p);
    if (s <= 0) return 'out of stock';
    if (s <= p.reorder) return 'low stock';
    if (s >= (p.reorder * 4) || s >= 50) return 'overstock';
    return 'in stock';
  }
  function nextOrderNo() {
    const d = new Date();
    const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const n = String(state.orders.filter(o => o.orderNo.includes(ymd)).length + 1).padStart(4, '0');
    return `ORD-${ymd}-${n}`;
  }
  function nextTicketNo() {
    const d = new Date();
    const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const n = String(state.queue.filter(q => q.ticketNo.includes(ymd)).length + 1).padStart(3, '0');
    return `Q-${ymd}-${n}`;
  }
  function badge(status) {
    const cls = STATUS_BADGE[status] || 'outline';
    const icon = { 'out of stock': '✕', 'low stock': '⚠', 'in stock': '✓', 'overstock': '▤',
                   'Pending': '◔', 'In Production': '▶', 'Ready for Delivery': '◑',
                   'Completed': '✓', 'Cancelled': '✕', 'Waiting': '◔', 'Being Served': '▶' }[status] || '';
    return `<span class="badge badge-${cls}">${icon} ${esc(status)}</span>`;
  }

  /* ============================================================
     NOTIFICATIONS
     ============================================================ */
  function pushNotification(roles, message, link) {
    const notif = {
      id: uid('N'),
      date: new Date().toISOString(),
      roles: Array.isArray(roles) ? roles : [roles],
      message, link: link || null,
      read: false
    };
    state.notifications.unshift(notif);
    if (state.notifications.length > 200) state.notifications.length = 200;
    save();
    updateNotifDot();
  }
  function notificationsFor(role) {
    return state.notifications.filter(n => n.roles.includes(role));
  }
  function unreadCount(role) {
    return notificationsFor(role).filter(n => !n.read).length;
  }
  function updateNotifDot() {
    if (!session) return;
    const el = $('#notifDot');
    if (!el) return;
    const n = unreadCount(session.role);
    el.hidden = n === 0;
  }

  /* ============================================================
     AUTH
     ============================================================ */
  function login(email, password) {
    const user = state.users.find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, error: 'Invalid email or password.' };
    if (!user.active) return { ok: false, error: 'Account is deactivated.' };
    session = { userId: user.id, name: user.name, role: user.role, email: user.email, startedAt: new Date().toISOString() };
    try { localStorage.setItem(LS_SESSION, JSON.stringify(session)); } catch (e) {}
    return { ok: true };
  }
  function logout() {
    session = null;
    try { localStorage.removeItem(LS_SESSION); } catch (e) {}
    $('#app').hidden = true; $('#showroom').hidden = false; $('#loginModal').hidden = true;
    window.scrollTo(0, 0);
  }
  function restoreSession() {
    try { const raw = localStorage.getItem(LS_SESSION); if (raw) session = JSON.parse(raw); }
    catch (e) { session = null; }
  }

  /* ============================================================
     PERMISSIONS (updated per request)
     ============================================================ */
  const PERMS = {
    admin:     ['dashboard','orders','queue','inventory','qrcodes','scan','countlogs','production','sales','reports','promotions','customers','users','notifications'],
    sales:     ['orders','queue','customers','sales'],
    inventory: ['inventory','qrcodes','scan','countlogs','production','notifications'],
    production:['production'],
    marketing: ['promotions','customers']
  };
  function can(module) { return session && (PERMS[session.role] || []).includes(module); }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  const NAV = [
    { module: 'dashboard',   label: 'Dashboard',         icon: '▤' },
    { module: 'orders',      label: 'Orders & Queue',    icon: '▦' },
    { module: 'inventory',   label: 'Inventory',         icon: '▥' },
    { module: 'qrcodes',     label: 'QR Labels',         icon: '⌗' },
    { module: 'scan',        label: 'QR Scan & Count',   icon: '◉' },
    { module: 'countlogs',   label: 'Count Logs',        icon: '☰' },
    { module: 'production',  label: 'Production',        icon: '⚒' },
    { module: 'sales',       label: 'Sales Ledger',      icon: '₱' },
    { module: 'reports',     label: 'Reports',           icon: '▧' },
    { module: 'promotions',  label: 'Promotions',        icon: '★' },
    { module: 'customers',   label: 'Customers',         icon: '☺' },
    { module: 'users',       label: 'Users',             icon: '⚙' }
  ];
  let currentPage = 'dashboard';

  function renderNav() {
    const nav = $('#sbNav');
    if (!nav) return;
    nav.innerHTML = NAV.filter(n => can(n.module)).map(n => {
      let label = n.label;
      if (n.module === 'notifications') label += ' 🔔';
      if (n.module === 'production' && session.role === 'admin' && state.finishedGoods.some(f => f.status === 'pending')) {
        label = `${n.label} <span class="new-dot"></span>`;
      }
      return `
        <button class="sb-nav-item ${currentPage === n.module ? 'active' : ''}" data-page="${n.module}">
          <span class="nav-icon">${n.icon}</span>
          <span class="sb-nav-label">${label}</span>
        </button>`;
    }).join('');
    nav.querySelectorAll('.sb-nav-item').forEach(b => {
      b.addEventListener('click', () => {
        currentPage = b.dataset.page;
        renderNav(); renderPage();
        if (window.innerWidth < 900) $('#sidebar').classList.remove('open');
      });
    });
  }

  function renderPage() {
    const el = $('#content');
    const map = {
      dashboard: renderDashboard, orders: renderOrders, queue: renderQueue,
      inventory: renderInventory, qrcodes: renderQRCodes, scan: renderScan,
      countlogs: renderCountLogs, production: renderProduction,
      sales: renderSales, reports: renderReports, promotions: renderPromotions,
      customers: renderCustomers, users: renderUsers
    };
    if (!can(currentPage)) {
      el.innerHTML = `<div class="card"><h2>Access Restricted</h2><p class="muted">Your role (${ROLE_LABELS[session.role]}) does not have access to this module.</p></div>`;
      return;
    }
    (map[currentPage] || renderDashboard)(el);
  }

  /* ============================================================
     PASSWORD TOGGLE (delegated — works for any .pw-toggle)
     ============================================================ */
 /* Inline SVG icons for the password toggle */
const EYE_OPEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function bindPasswordToggles() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.pw-toggle');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.pw);
    if (!target) return;
    const showing = target.type === 'text';
    target.type = showing ? 'password' : 'text';
    btn.classList.toggle('on', !showing);
    btn.innerHTML = showing ? EYE_OPEN_SVG : EYE_OFF_SVG;
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
}

  /* ============================================================
     STOCK ALERT POPUP
     ============================================================ */
  function showStockAlertPopup() {
    const alerts = state.products.filter(p => ['low stock', 'out of stock', 'overstock'].includes(productStatus(p)));
    if (!alerts.length) return;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box alert-modal">
        <div class="modal-head"><h3>⚠ Stock Level Alert</h3><button data-close>✕</button></div>
        <div class="modal-body">
          <p class="muted" style="margin-top:0">The following products need your attention:</p>
          ${alerts.map(p => `
            <div class="stock-alert-item ${productStatus(p) === 'out of stock' ? 'crit' : ''}">
              <div style="display:flex;align-items:center;gap:12px">
                <img class="thumb" src="${esc(p.image || pickImg(p.category, p.sku))}" alt="" onerror="this.style.visibility='hidden'">
                <div>
                  <div class="a-name">${esc(p.name)}</div>
                  <div class="a-sku">${esc(p.sku)} · ${esc(p.category)}</div>
                </div>
              </div>
              <div style="text-align:right">
                ${badge(productStatus(p))}
                <div class="muted" style="font-size:12px;margin-top:4px">${productStock(p)} on hand</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="modal-foot"><button class="btn btn-primary" data-close>Understood</button></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
  }

  /* ============================================================
     QR GENERATOR
     ============================================================ */
  const qrCache = new Map();
  async function qrDataUrl(text) {
    if (qrCache.has(text)) return qrCache.get(text);
    if (typeof QRCode === 'undefined') throw new Error('QR library not loaded.');
    const url = await QRCode.toDataURL(text, { errorCorrectionLevel: 'H', margin: 4, scale: 10, color: { dark: '#000000', light: '#ffffff' } });
    qrCache.set(text, url);
    return url;
  }

  function getLabelOpts() {
    const size = parseFloat($('#qrSize')?.value || 40);
    const paper = $('#qrPaper')?.value || 'a4';
    let perRow = parseInt($('#qrPerRow')?.value || 4, 10);
    if (!(perRow >= 1)) perRow = 1;
    if (perRow > 8) perRow = 8;
    const maxFit = Math.max(1, Math.floor((PAPER[paper].w - 2 * PAGE_MARGIN) / (size + GAP)));
    const limited = perRow > maxFit;
    if (limited) perRow = maxFit;
    return { size, paper, perRow, limited, maxFit, showText: $('#qrShowText')?.checked !== false };
  }
  const textHeight = (size) => (size <= 25 ? 6 : 8);
  const fontPt = (size) => (size <= 25 ? 5 : size <= 40 ? 7 : 8);

  function applySheetOpts() {
    const o = getLabelOpts();
    const host = $('#qrSheet');
    if (!host) return o;
    host.className = 'sheet' + (o.showText ? '' : ' notext');
    host.style.setProperty('--size', o.size + 'mm');
    host.style.setProperty('--cols', o.perRow);
    host.style.setProperty('--texth', textHeight(o.size) + 'mm');
    host.style.setProperty('--fs', fontPt(o.size) + 'pt');
    return o;
  }

  const sheetUnits = () => state.labelSheet.map(id => unitIndex.get(id)).filter(Boolean);
  let sheetToken = 0;
  let sheetReady = true;

  async function renderSheet() {
    const token = ++sheetToken;
    const o = applySheetOpts();
    const units = sheetUnits();
    const host = $('#qrSheet');
    if (!host) return;
    host.innerHTML = '';
    const emptyEl = $('#qrSheetEmpty');
    if (emptyEl) emptyEl.hidden = units.length > 0;
    const infoEl = $('#qrSheetInfo');
    if (infoEl) infoEl.textContent = units.length ? 'Rendering ' + units.length + ' label(s)…' : '';
    if (!units.length) { sheetReady = true; return; }
    sheetReady = false;
    try {
      const frag = document.createDocumentFragment();
      for (const u of units) {
        const url = await qrDataUrl(u.id);
        if (token !== sheetToken) return;
        const d = document.createElement('div');
        d.className = 'lbl';
        d.innerHTML = '<img alt="' + esc(u.id) + '" src="' + url + '">' +
          '<div class="lbl-text"><div class="lbl-name">' + esc(u.name) + '</div><div class="lbl-id">' + esc(u.id) + '</div></div>';
        frag.appendChild(d);
      }
      host.appendChild(frag);
      if (infoEl) infoEl.textContent = units.length + ' label(s) · ' + o.size + ' mm · ' + o.perRow + ' per row';
      sheetReady = true;
    } catch (err) {
      if (infoEl) infoEl.textContent = '';
      toast(err.message, 'bad');
      sheetReady = true;
    }
  }

  /* ============================================================
     PRINT / PDF / PNG
     ============================================================ */
  function doPrint() {
    const units = sheetUnits();
    if (!units.length) { toast('Nothing to print.', 'bad'); return; }
    if (!sheetReady) { toast('Labels still rendering.', 'bad'); return; }
    const o = getLabelOpts();
    let ps = $('#pageStyle');
    if (!ps) { ps = document.createElement('style'); ps.id = 'pageStyle'; document.head.appendChild(ps); }
    ps.textContent = `
      @media print {
        @page { size: ${PAPER[o.paper].css} portrait; margin: ${PAGE_MARGIN}mm; }
        body * { visibility: hidden !important; }
        #printRoot, #printRoot * { visibility: visible !important; }
        #printRoot { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; display: block !important; }
      }
    `;
    const clone = $('#qrSheet').cloneNode(true);
    clone.removeAttribute('id');
    const root = $('#printRoot');
    root.innerHTML = '';
    root.appendChild(clone);
    setTimeout(() => window.print(), 150);
  }
  window.addEventListener('afterprint', () => { const r = $('#printRoot'); if (r) r.innerHTML = ''; });

  function layout(units, o, paginate) {
    const p = PAPER[o.paper];
    const lw = o.size, lh = o.size + (o.showText ? textHeight(o.size) : 0);
    const gridW = o.perRow * lw + (o.perRow - 1) * GAP;
    const x0 = (p.w - gridW) / 2;
    const rowsPerPage = Math.max(1, Math.floor((p.h - 2 * PAGE_MARGIN + GAP) / (lh + GAP)));
    const pages = [];
    units.forEach((u, i) => {
      const row = Math.floor(i / o.perRow), col = i % o.perRow;
      const pg = paginate ? Math.floor(row / rowsPerPage) : 0;
      const r = paginate ? row % rowsPerPage : row;
      (pages[pg] = pages[pg] || []).push({ u, x: x0 + col * (lw + GAP), y: PAGE_MARGIN + r * (lh + GAP) });
    });
    const totalRows = Math.ceil(units.length / o.perRow);
    const pageH = paginate ? p.h : 2 * PAGE_MARGIN + totalRows * lh + (totalRows - 1) * GAP;
    return { pages, pageW: p.w, pageH, lw, lh };
  }

  async function downloadSheetPdf() {
    const units = sheetUnits();
    if (!units.length) { toast('Nothing to export.', 'bad'); return; }
    if (!window.jspdf) { toast('PDF library not loaded.', 'bad'); return; }
    const o = getLabelOpts();
    const L = layout(units, o, true);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: o.paper === 'a4' ? 'a4' : 'letter', orientation: 'portrait' });
    const fit = (s, maxW) => {
      if (doc.getTextWidth(s) <= maxW) return s;
      let t = s;
      while (t.length > 1 && doc.getTextWidth(t + '...') > maxW) t = t.slice(0, -1);
      return t + '...';
    };
    try {
      for (let pi = 0; pi < L.pages.length; pi++) {
        if (pi > 0) doc.addPage();
        doc.setLineWidth(0.25); doc.setDrawColor(136); doc.setLineDashPattern([1, 1], 0);
        for (const it of L.pages[pi]) {
          const qrUrl = await qrDataUrl(it.u.id);
          doc.addImage(qrUrl, 'PNG', it.x, it.y, L.lw, L.lw);
          doc.rect(it.x, it.y, L.lw, L.lh, 'S');
          if (o.showText) {
            const th = textHeight(o.size);
            const cx = it.x + L.lw / 2;
            const ty = it.y + L.lw;
            doc.setTextColor(0); doc.setFontSize(fontPt(o.size)); doc.setFont('helvetica', 'normal');
            doc.text(fit(it.u.name, L.lw - 1.5), cx, ty + th * 0.4, { align: 'center' });
            doc.setFont('courier', 'bold');
            doc.text(fit(it.u.id, L.lw - 1.5), cx, ty + th * 0.8, { align: 'center' });
          }
        }
      }
      doc.save('labels-' + stamp() + '.pdf');
      toast('PDF downloaded.', 'ok');
    } catch (err) { toast('PDF export failed: ' + err.message, 'bad'); }
  }

  async function drawLabel(ctx, u, x, y, o, ppm) {
    const s = o.size * ppm, th = textHeight(o.size) * ppm;
    const img = await loadImg(await qrDataUrl(u.id));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, s, s);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.25 * ppm; ctx.setLineDash([ppm, ppm]);
    ctx.strokeRect(x, y, s, s + (o.showText ? th : 0));
    ctx.setLineDash([]);
    if (o.showText) {
      const px = fontPt(o.size) * 25.4 / 72 * ppm;
      const fitText = (t, font) => {
        ctx.font = font;
        if (ctx.measureText(t).width <= s - 1.5 * ppm) return t;
        while (t.length > 1 && ctx.measureText(t + '...').width > s - 1.5 * ppm) t = t.slice(0, -1);
        return t + '...';
      };
      ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const f1 = px + 'px Arial, Helvetica, sans-serif', f2 = 'bold ' + px + 'px "Courier New", monospace';
      ctx.font = f1; ctx.fillText(fitText(u.name, f1), x + s / 2, y + s + th * 0.38);
      ctx.font = f2; ctx.fillText(fitText(u.id, f2), x + s / 2, y + s + th * 0.74);
    }
  }

  async function downloadSheetPng() {
    const units = sheetUnits();
    if (!units.length) { toast('Nothing to export.', 'bad'); return; }
    const o = getLabelOpts();
    const L = layout(units, o, false);
    const ppm = Math.min(300 / 25.4, 16000 / L.pageH);
    if (ppm < 4) { toast('Too many labels for one PNG.', 'bad'); return; }
    try {
      const c = document.createElement('canvas');
      c.width = Math.round(L.pageW * ppm); c.height = Math.round(L.pageH * ppm);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      for (const it of L.pages[0]) await drawLabel(ctx, it.u, it.x * ppm, it.y * ppm, o, ppm);
      downloadBlob(await canvasToBlob(c), 'labels-' + stamp() + '.png');
      toast('PNG downloaded.', 'ok');
    } catch (err) { toast('PNG export failed: ' + err.message, 'bad'); }
  }

  async function downloadSingleLabel(unitId) {
    const u = unitById(unitId);
    if (!u) return;
    const o = getLabelOpts(), ppm = 300 / 25.4;
    try {
      const c = document.createElement('canvas');
      c.width = Math.round(o.size * ppm) + 2;
      c.height = Math.round((o.size + (o.showText ? textHeight(o.size) : 0)) * ppm) + 2;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await drawLabel(ctx, u, 1, 1, o, ppm);
      downloadBlob(await canvasToBlob(c), unitId + '.png');
      toast('Label downloaded.', 'ok');
    } catch (err) { toast('PNG export failed: ' + err.message, 'bad'); }
  }

  /* ============================================================
     QR LABELS PAGE
     ============================================================ */
  function renderQRCodes(el) {
    el.innerHTML = `
      <div class="page-title">
        <div><h1>QR Labels</h1><p>Generate unique QR-coded units and print labels.</p></div>
      </div>

      <div class="card">
        <div class="card-title">Generate Units</div>
        <div class="form-grid">
          <label>Product
            <select id="qrProduct">
              <option value="">— Select product —</option>
              ${state.products.filter(p => p.isActive).map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)})</option>`).join('')}
            </select>
          </label>
          <label>Quantity
            <input id="qrQty" type="number" min="1" max="${MAX_QTY}" value="1" />
          </label>
          <label>Label size
            <select id="qrSize">
              <option value="25.4">1×1 inch (25.4 mm)</option>
              <option value="40" selected>Medium (40 mm)</option>
              <option value="50">Large (50 mm)</option>
            </select>
          </label>
          <label>Labels per row
            <input id="qrPerRow" type="number" min="1" max="8" value="4" />
          </label>
          <label>Paper
            <select id="qrPaper"><option value="a4">A4</option><option value="letter">Letter</option></select>
          </label>
          <label class="check"><input id="qrShowText" type="checkbox" checked /> Show name & ID text</label>
        </div>
        <div class="toolbar" style="margin-top:16px">
          <button class="btn btn-primary" id="qrGenerate">+ Generate Units</button>
          <button class="btn" id="qrPrint">🖨 Print</button>
          <button class="btn" id="qrPdf">⬇ PDF</button>
          <button class="btn" id="qrPng">⬇ PNG</button>
          <button class="btn" id="qrClear">Clear Sheet</button>
          <span class="muted" id="qrSheetInfo" style="margin-left:auto;font-size:12px"></span>
        </div>
      </div>

      <div class="card">
        <div class="card-title"><span>Label Sheet</span></div>
        <div class="sheetwrap"><div id="qrSheet" class="sheet"></div></div>
        <p class="muted" id="qrSheetEmpty">No labels yet. Select a product and generate units.</p>
      </div>

      <div class="card">
        <div class="card-title">
          <span>Registered Units (${state.units.length})</span>
          <button class="btn btn-sm" id="qrExportCsv">⬇ Export CSV</button>
        </div>
        <div class="toolbar"><input class="grow" id="qrSearch" placeholder="Search units…" /></div>
        <div class="tablewrap">
          <table>
            <thead><tr><th>Unit ID</th><th>Product</th><th>SKU</th><th>Category</th><th>Status</th><th></th></tr></thead>
            <tbody id="qrUnitsBody"></tbody>
          </table>
        </div>
      </div>
    `;

    const renderUnits = () => {
      const q = ($('#qrSearch')?.value || '').toLowerCase();
      const list = state.units.filter(u => !q || (u.id + ' ' + u.name + ' ' + u.sku).toLowerCase().includes(q));
      $('#qrUnitsBody').innerHTML = list.length ? list.slice(0, 300).map(u => {
        const prod = state.products.find(p => p.sku === u.sku);
        const img = prod?.image || pickImg(u.category, u.sku);
        return `
        <tr>
          <td class="mono">${esc(u.id)}</td>
          <td><div class="name-cell"><img class="thumb" src="${esc(img)}" onerror="this.style.visibility='hidden'"><span>${esc(u.name)}</span></div></td>
          <td class="mono">${esc(u.sku)}</td>
          <td>${esc(u.category || '—')}</td>
          <td>${badge(u.status === 'missing' ? 'Cancelled' : 'Completed').replace('Cancelled', 'Missing').replace('Completed', 'In Stock')}</td>
          <td>
            <button class="btn btn-sm" data-lbl="${u.id}">Label</button>
            <button class="btn btn-sm" data-png="${u.id}">PNG</button>
            <button class="btn btn-sm btn-danger" data-del="${u.id}">✕</button>
          </td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="empty-row">No units registered yet.</td></tr>';

      $$('[data-lbl]').forEach(b => b.addEventListener('click', () => {
        state.labelSheet = [b.dataset.lbl];
        save(); renderSheet();
        $('#qrSheet').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
      $$('[data-png]').forEach(b => b.addEventListener('click', () => downloadSingleLabel(b.dataset.png)));
      $$('[data-del]').forEach(b => b.addEventListener('click', () => {
        if (!confirm('Delete unit ' + b.dataset.del + '?')) return;
        state.units = state.units.filter(u => u.id !== b.dataset.del);
        state.labelSheet = state.labelSheet.filter(id => id !== b.dataset.del);
        rebuildUnitIndex(); save(); renderQRCodes(el);
      }));
    };

    $('#qrGenerate').addEventListener('click', () => {
      const pid = $('#qrProduct').value;
      const qty = parseInt($('#qrQty').value, 10);
      if (!pid) { toast('Select a product.', 'bad'); return; }
      if (!(qty >= 1) || qty > MAX_QTY) { toast('Quantity 1–' + MAX_QTY + '.', 'bad'); return; }
      const p = productById(pid);
      const sku = p.sku;
      const ids = [];
      state.unitCounters = state.unitCounters || {};
      for (let i = 0; i < qty; i++) {
        let n = (state.unitCounters[sku] || 0) + 1;
        while (unitIndex.has(makeUnitId(sku, n))) n++;
        state.unitCounters[sku] = n;
        const unit = { id: makeUnitId(sku, n), name: p.name, sku: p.sku, category: p.category, notes: '', created: new Date().toISOString(), status: 'in stock' };
        state.units.push(unit); unitIndex.set(unit.id, unit); ids.push(unit.id);
      }
      state.labelSheet = ids;
      save(); renderSheet(); renderUnits();
      toast('Generated ' + qty + ' unit(s).', 'ok');
    });

    $('#qrPrint').addEventListener('click', doPrint);
    $('#qrPdf').addEventListener('click', downloadSheetPdf);
    $('#qrPng').addEventListener('click', downloadSheetPng);
    $('#qrClear').addEventListener('click', () => { state.labelSheet = []; save(); renderSheet(); });
    ['qrSize', 'qrPaper', 'qrPerRow', 'qrShowText'].forEach(id => {
      const node = $('#' + id);
      if (node) { node.addEventListener('change', applySheetOpts); node.addEventListener('input', applySheetOpts); }
    });
    $('#qrSearch').addEventListener('input', renderUnits);
    $('#qrExportCsv').addEventListener('click', () => {
      const lines = [csvRow(['unit_id', 'product', 'sku', 'category', 'status', 'created'])];
      state.units.forEach(u => lines.push(csvRow([u.id, u.name, u.sku, u.category, u.status, u.created])));
      downloadText('\uFEFF' + lines.join('\r\n'), 'units-' + stamp() + '.csv', 'text/csv');
      toast('CSV downloaded.', 'ok');
    });
    renderSheet();
    renderUnits();
  }

  /* ============================================================
     QR SCAN & COUNT (updated: comparison + logs)
     ============================================================ */
  let html5 = null, scanning = false, cameras = [], camIdx = -1, audioCtx = null;
  const lastSeen = new Map();
  let scanSession = null;
  let scanCounted = new Set();

  function loadScanSession() {
    try { scanSession = JSON.parse(localStorage.getItem('idash.count.v3') || 'null'); }
    catch (e) { scanSession = null; }
    scanCounted = new Set(scanSession ? scanSession.counted : []);
  }
  function saveScanSession() {
    try {
      if (scanSession) localStorage.setItem('idash.count.v3', JSON.stringify(scanSession));
      else localStorage.removeItem('idash.count.v3');
    } catch (e) {}
  }
  function ensureScanSession() {
    if (!scanSession) {
      scanSession = { id: uid('CS'), started: new Date().toISOString(), counted: [], dup: 0, unknown: [], log: [], finished: false, startedBy: session?.userId };
      scanCounted = new Set();
      saveScanSession();
    }
  }

  function ensureAudio() {
    try {
      if (!audioCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  function tone(freq, dur, type, delay) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime + (delay || 0), o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };
  function signal(kind) {
    if (kind === 'ok') { tone(1000, 0.12, 'sine'); vibrate(120); }
    else if (kind === 'warn') { tone(500, 0.12, 'square'); tone(500, 0.12, 'square', 0.18); vibrate([60, 60, 60]); }
    else { tone(200, 0.35, 'sawtooth'); vibrate([200, 80, 200]); }
  }
  function setFeedback(kind, title, detail) {
    const f = $('#scanFeedback');
    if (!f) return;
    f.className = 'feedback ' + (kind || '');
    f.innerHTML = '<strong>' + esc(title) + '</strong>' + (detail ? '<br>' + esc(detail) : '');
  }

  function processScannedCode(raw, source) {
    if (scanSession && scanSession.finished) { toast('Finish or clear the current count first.', 'bad'); return; }
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return;
    const now = Date.now();
    if (source === 'camera') {
      const last = lastSeen.get(code);
      lastSeen.set(code, now);
      if (last && now - last < COOLDOWN_MS) return;
    }
    ensureScanSession();
    const unit = unitIndex.get(code);
    let kind, title, msg;
    if (!unit) {
      if (!scanSession.unknown.includes(code)) scanSession.unknown.push(code);
      kind = 'bad'; title = '✖ Unknown code'; msg = code;
    } else if (scanCounted.has(unit.id)) {
      scanSession.dup++;
      kind = 'warn'; title = '⚠ Duplicate'; msg = unit.id + ' already counted';
    } else {
      scanCounted.add(unit.id);
      scanSession.counted.push(unit.id);
      kind = 'ok'; title = '✔ Counted'; msg = unit.id + ' · ' + unit.name;
    }
    scanSession.log.unshift({ t: new Date().toISOString(), kind, msg });
    if (scanSession.log.length > 100) scanSession.log.length = 100;
    saveScanSession();
    setFeedback(kind, title, msg);
    signal(kind);
    updateScanLive();
  }

  function updateScanLive() {
    const lvTotal = $('#lvTotal'), lvDup = $('#lvDup'), lvUnknown = $('#lvUnknown');
    if (lvTotal) lvTotal.textContent = scanSession ? scanSession.counted.length : 0;
    if (lvDup) lvDup.textContent = scanSession ? scanSession.dup : 0;
    if (lvUnknown) lvUnknown.textContent = scanSession ? scanSession.unknown.length : 0;
    const logEl = $('#scanLog');
    if (logEl) {
      logEl.innerHTML = scanSession && scanSession.log.length
        ? scanSession.log.slice(0, 50).map(l => `<li class="${l.kind}"><time>${esc(new Date(l.t).toLocaleTimeString())}</time>${esc(l.msg)}</li>`).join('')
        : '<li class="muted">Nothing scanned yet.</li>';
    }
  }

  function updateScanUI() {
    const has = !!scanSession, fin = has && scanSession.finished;
    const btnStart = $('#btnStart');
    if (btnStart) { btnStart.disabled = scanning || fin; btnStart.textContent = has ? '▶ Resume' : '▶ Start Count'; }
    const btnStop = $('#btnStop'); if (btnStop) btnStop.disabled = !scanning;
    const btnSwitch = $('#btnSwitch'); if (btnSwitch) btnSwitch.disabled = !scanning;
    const btnFinish = $('#btnFinish'); if (btnFinish) btnFinish.disabled = !has || fin;
    const btnDiscard = $('#btnDiscard'); if (btnDiscard) btnDiscard.disabled = !has;
    const manual = $('#manualCode'); if (manual) manual.disabled = fin;
  }

  function explainCameraError(err) {
    const s = String((err && (err.name || '')) + ' ' + (err && err.message ? err.message : err));
    if (/NotAllowed|Permission|denied/i.test(s)) return 'Camera permission denied. Allow camera access and try again. You can still use manual entry below.';
    if (/NotFound|DevicesNotFound|no camera/i.test(s)) return 'No camera found. Use manual entry below.';
    if (/NotReadable|TrackStart|in use|Could not start video/i.test(s)) return 'Camera busy. Close other apps and retry.';
    if (/Overconstrained/i.test(s)) return 'That camera is not available. Try Switch camera.';
    return 'Could not start camera: ' + s.trim();
  }
  function showCamError(msg) { const e = $('#camError'); if (e) { e.textContent = msg; e.hidden = false; } }
  function hideCamError() { const e = $('#camError'); if (e) e.hidden = true; }

  async function startCamera() {
    if (scanning) return;
    if (scanSession && scanSession.finished) { toast('Finish the count first.', 'bad'); return; }
    ensureAudio(); hideCamError();
    const readerEl = $('#reader');
    if (readerEl) readerEl.style.display = 'block';
    if (typeof Html5Qrcode === 'undefined') { showCamError('Scanner library failed to load. Manual entry still works.'); return; }
    if (!window.isSecureContext || !navigator.mediaDevices) { showCamError('Camera needs HTTPS or localhost. Manual entry still works.'); return; }
    ensureScanSession(); updateScanUI();
    try {
      html5 = new Html5Qrcode('reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      const source = camIdx >= 0 && cameras[camIdx] ? { deviceId: { exact: cameras[camIdx].id } } : { facingMode: 'environment' };
      await html5.start(source,
        { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } },
        (text) => processScannedCode(text, 'camera'),
        () => {});
      scanning = true;
      try {
        if (!cameras.length) cameras = await Html5Qrcode.getCameras();
        const dev = html5.getRunningTrackSettings && html5.getRunningTrackSettings().deviceId;
        if (dev) camIdx = cameras.findIndex(c => c.id === dev);
      } catch (e) {}
      setFeedback('', 'Scanning…', 'Point the camera at a QR label.');
    } catch (err) {
      scanning = false; html5 = null;
      showCamError(explainCameraError(err));
    }
    updateScanUI();
  }
  async function stopCamera() {
    if (html5 && scanning) {
      try { await html5.stop(); } catch (e) {}
      try { html5.clear(); } catch (e) {}
    }
    scanning = false; html5 = null;
    updateScanUI();
  }
  async function switchCamera() {
    if (!scanning) return;
    if (cameras.length < 2) { toast('Only one camera found.', 'bad'); return; }
    await stopCamera();
    camIdx = (camIdx + 1) % cameras.length;
    await startCamera();
  }

  function buildCountReport() {
    const counted = new Set(scanSession.counted);
    const rows = new Map();
    state.units.forEach(u => {
      const r = rows.get(u.sku) || { sku: u.sku, name: u.name, counted: 0, expected: 0, mismatch: false };
      if (u.status !== 'missing') r.expected++;
      rows.set(u.sku, r);
    });
    const countedIds = scanSession.counted.filter(id => unitIndex.has(id));
    countedIds.forEach(id => {
      const r = rows.get(unitById(id).sku);
      if (r) r.counted++;
    });
    const missing = state.units.filter(u => u.status !== 'missing' && !counted.has(u.id)).map(u => u.id);
    return {
      date: new Date().toISOString(),
      rows: Array.from(rows.values()),
      countedIds, missing,
      unknown: scanSession.unknown.slice(),
      duplicates: scanSession.dup
    };
  }

  async function finishCount() {
    if (!scanSession || scanSession.finished) return;
    if (!scanSession.counted.length && !confirm('Nothing counted. Finish anyway?')) return;
    await stopCamera();
    scanSession.finished = true;
    scanSession.report = buildCountReport();
    saveScanSession();
    renderCountReport();
    updateScanUI();
    const rc = $('#reportCard'); if (rc) rc.scrollIntoView({ behavior: 'smooth' });
  }

  function renderCountReport() {
    if (!scanSession || !scanSession.report) return;
    const r = scanSession.report;
    const meta = $('#reportMeta');
    if (meta) meta.textContent = fmtDateTime(r.date) + ' · counted ' + r.countedIds.length + ' · duplicates ' + r.duplicates;
    const tbody = $('#reportTable tbody');
    if (tbody) {
      tbody.innerHTML = r.rows.map(x => {
        const d = x.counted - x.expected;
        const cls = d !== 0 ? 'class="mismatch-cell"' : '';
        return `<tr ${cls}><td>${esc(x.name)}</td><td class="mono">${esc(x.sku)}</td><td>${x.counted}</td><td>${x.expected}</td><td class="${d < 0 ? 'neg' : d > 0 ? 'pos' : ''}">${d > 0 ? '+' : ''}${d}${d !== 0 ? ' ⚠' : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="5" class="empty-row">No products.</td></tr>';
    }
    const mismatchCount = r.rows.filter(x => x.counted !== x.expected).length;
    const warnEl = $('#mismatchWarning');
    if (warnEl) {
      if (mismatchCount > 0) {
        warnEl.hidden = false;
        warnEl.innerHTML = `<strong>⚠ Mismatch detected</strong> — ${mismatchCount} product(s) have a difference between the physical count and the system stock. Review before submitting.`;
      } else {
        warnEl.hidden = true;
      }
    }
    const missN = $('#repMissingN'); if (missN) missN.textContent = r.missing.length;
    const miss = $('#repMissing');
    if (miss) miss.innerHTML = r.missing.map(id => `<span class="chip">${esc(id)}</span>`).join('') || '<span class="muted">None.</span>';
    const unkN = $('#repUnknownN'); if (unkN) unkN.textContent = r.unknown.length;
    const unk = $('#repUnknown');
    if (unk) unk.innerHTML = r.unknown.map(c => `<span class="chip unk">${esc(c)}</span>`).join('') || '<span class="muted">None.</span>';
  }

  function submitCountReport() {
    if (!scanSession || !scanSession.report) return;
    const r = scanSession.report;
    const mismatch = r.rows.filter(x => x.counted !== x.expected).length;
    const msg = `Submit this count log?\n\n• Counted: ${r.countedIds.length}\n• Missing: ${r.missing.length}\n• Unknown: ${r.unknown.length}\n• Mismatches: ${mismatch}\n\nThe log will be visible to Admin and Inventory Staff.`;
    if (!confirm(msg)) return;
    state.countSessions.push({
      id: scanSession.id,
      started: scanSession.started,
      finished: new Date().toISOString(),
      startedBy: scanSession.startedBy,
      rows: r.rows,
      countedIds: r.countedIds,
      missing: r.missing,
      unknown: r.unknown,
      duplicates: r.duplicates,
      mismatch: mismatch
    });
    saveScanSession();
    save();
    // Notify admin
    pushNotification(['admin'], `New count log submitted by ${session.name} (${r.countedIds.length} counted, ${mismatch} mismatches)`);
    toast('Count log submitted.', 'ok');
    clearScanSession();
    renderPage();
  }

  function clearScanSession() {
    stopCamera();
    scanSession = null;
    scanCounted = new Set();
    lastSeen.clear();
    saveScanSession();
    setFeedback('', 'Ready', 'Press Start to begin scanning.');
    updateScanLive();
    updateScanUI();
    const rc = $('#reportCard'); if (rc) rc.hidden = true;
  }

  function renderScan(el) {
    const has = !!scanSession;
    const fin = has && scanSession.finished;
    el.innerHTML = `
      <div class="page-title">
        <div><h1>QR Scan & Count</h1><p>Scan QR labels to perform a physical stock count.</p></div>
      </div>

      <div class="card">
        <div class="card-title">Scanner</div>
        <div class="toolbar">
          <button class="btn btn-primary" id="btnStart">${has ? '▶ Resume' : '▶ Start Count'}</button>
          <button class="btn" id="btnStop" disabled>⏸ Pause</button>
          <button class="btn" id="btnSwitch" disabled>🔄 Switch camera</button>
          <button class="btn btn-primary" id="btnFinish" ${(!has || fin) ? 'disabled' : ''}>✔ Finish Count</button>
          <button class="btn btn-danger" id="btnDiscard" ${!has ? 'disabled' : ''}>Discard</button>
        </div>
        <div id="reader"></div>
        <div id="camError" class="alert-bad" hidden></div>
        <div id="scanFeedback" class="feedback">${has ? 'Resume to continue scanning.' : 'Press Start to begin.'}</div>
        <form class="toolbar" id="manualForm" style="margin-top:8px">
          <input class="grow" id="manualCode" placeholder="Manual entry, e.g. B500-0001" autocomplete="off" ${fin ? 'disabled' : ''} />
          <button class="btn" type="submit">Add</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Live Count</div>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">Counted</div><div class="kpi-val" id="lvTotal">${has ? scanSession.counted.length : 0}</div></div>
          <div class="kpi"><div class="kpi-label">Duplicates</div><div class="kpi-val" id="lvDup">${has ? scanSession.dup : 0}</div></div>
          <div class="kpi"><div class="kpi-label">Unknown</div><div class="kpi-val" id="lvUnknown">${has ? scanSession.unknown.length : 0}</div></div>
        </div>
        <h3 style="margin-top:16px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--g500)">Latest scans</h3>
        <ul class="log" id="scanLog"><li class="muted">Nothing scanned yet.</li></ul>
      </div>

      <div class="card" id="reportCard" ${!fin ? 'hidden' : ''}>
        <div class="card-title">Count Report</div>
        <p class="muted" id="reportMeta"></p>
        <div id="mismatchWarning" class="alert-bad" hidden style="margin-bottom:12px"></div>
        <div class="tablewrap">
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Counted</th><th>Expected</th><th>Diff</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <h3 style="margin-top:16px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--g500)">Missing units (<span id="repMissingN">0</span>)</h3>
        <div id="repMissing"></div>
        <h3 style="margin-top:16px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--g500)">Unknown codes (<span id="repUnknownN">0</span>)</h3>
        <div id="repUnknown"></div>
        <div class="toolbar" style="margin-top:16px">
          <button class="btn btn-primary" id="repSubmit">✔ Submit Count Log</button>
          <button class="btn" id="repCsv">⬇ Export CSV</button>
          <button class="btn btn-danger" id="repClose">Close Report</button>
        </div>
      </div>
    `;
    $('#btnStart').addEventListener('click', startCamera);
    $('#btnStop').addEventListener('click', stopCamera);
    $('#btnSwitch').addEventListener('click', switchCamera);
    $('#btnFinish').addEventListener('click', finishCount);
    $('#btnDiscard').addEventListener('click', () => { if (confirm('Discard this count?')) { clearScanSession(); renderPage(); } });
    $('#manualForm').addEventListener('submit', (e) => {
      e.preventDefault();
      ensureAudio();
      processScannedCode($('#manualCode').value, 'manual');
      $('#manualCode').value = '';
    });
    $('#repSubmit').addEventListener('click', submitCountReport);
    $('#repCsv').addEventListener('click', exportCountCsv);
    $('#repClose').addEventListener('click', () => {
      if (scanSession && !scanSession.applied && !confirm('Close without submitting?')) return;
      clearScanSession(); renderPage();
    });
    if (fin) renderCountReport();
    updateScanLive();
    updateScanUI();
  }

  function exportCountCsv() {
    if (!scanSession || !scanSession.report) return;
    const r = scanSession.report;
    const lines = [csvRow(['type', 'unit_id', 'product', 'sku', 'counted', 'expected', 'difference'])];
    r.rows.forEach(x => lines.push(csvRow(['SUMMARY', '', x.name, x.sku, x.counted, x.expected, x.counted - x.expected])));
    r.countedIds.forEach(id => { const u = unitById(id); lines.push(csvRow(['COUNTED', id, u ? u.name : '', u ? u.sku : '', '', '', ''])); });
    r.missing.forEach(id => { const u = unitById(id); lines.push(csvRow(['MISSING', id, u ? u.name : '', u ? u.sku : '', '', '', ''])); });
    r.unknown.forEach(c => lines.push(csvRow(['UNKNOWN', c, '', '', '', '', ''])));
    downloadText('\uFEFF' + lines.join('\r\n'), 'count-report-' + stamp() + '.csv', 'text/csv');
    toast('Report CSV downloaded.', 'ok');
  }

  /* ============================================================
     COUNT LOGS PAGE (new)
     ============================================================ */
  function renderCountLogs(el) {
    const logs = [...state.countSessions].sort((a, b) => new Date(b.finished) - new Date(a.finished));
    el.innerHTML = `
      <div class="page-title">
        <div><h1>Count Logs</h1><p>Submitted inventory count sessions with mismatch details.</p></div>
      </div>
      <div class="card">
        <div class="tablewrap">
          <table>
            <thead><tr><th>Started</th><th>Finished</th><th>By</th><th>Counted</th><th>Missing</th><th>Unknown</th><th>Mismatches</th><th></th></tr></thead>
            <tbody>
              ${logs.length ? logs.map(cs => `
                <tr class="${cs.mismatch > 0 ? 'has-new' : ''}">
                  <td>${fmtDateTime(cs.started)}</td>
                  <td>${fmtDateTime(cs.finished)}</td>
                  <td>${esc(userById(cs.startedBy)?.name || '—')}</td>
                  <td>${cs.countedIds.length}</td>
                  <td>${cs.missing.length}</td>
                  <td>${cs.unknown.length}</td>
                  <td>${cs.mismatch > 0 ? `<span class="mismatch">${cs.mismatch}</span>` : '0'}</td>
                  <td><button class="btn btn-sm" data-viewlog="${cs.id}">View</button></td>
                </tr>
              `).join('') : '<tr><td colspan="8" class="empty-row">No count logs yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    $$('[data-viewlog]').forEach(b => b.addEventListener('click', () => viewCountLog(b.dataset.viewlog)));
  }

  function viewCountLog(id) {
    const cs = state.countSessions.find(c => c.id === id);
    if (!cs) return;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:720px">
        <div class="modal-head"><h3>Count Log — ${fmtDateTime(cs.finished)}</h3><button data-close>✕</button></div>
        <div class="modal-body">
          <p class="muted">Started ${fmtDateTime(cs.started)} by ${esc(userById(cs.startedBy)?.name || '—')}</p>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th>Counted</th><th>Expected</th><th>Diff</th></tr></thead>
              <tbody>
                ${cs.rows.map(x => {
                  const d = x.counted - x.expected;
                  return `<tr><td>${esc(x.name)}</td><td class="mono">${esc(x.sku)}</td><td>${x.counted}</td><td>${x.expected}</td><td class="${d !== 0 ? 'mismatch' : ''}">${d > 0 ? '+' : ''}${d}${d !== 0 ? ' ⚠' : ''}</td></tr>`;
                }).join('') || '<tr><td colspan="5" class="empty-row">No rows.</td></tr>'}
              </tbody>
            </table>
          </div>
          ${cs.missing.length ? `<h3 style="margin-top:16px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--g500)">Missing Units (${cs.missing.length})</h3><div>${cs.missing.map(id => `<span class="chip">${esc(id)}</span>`).join('')}</div>` : ''}
          ${cs.unknown.length ? `<h3 style="margin-top:16px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--g500)">Unknown Codes (${cs.unknown.length})</h3><div>${cs.unknown.map(c => `<span class="chip unk">${esc(c)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="modal-foot">
          <button class="btn" id="logCsv">⬇ Export CSV</button>
          <button class="btn btn-primary" data-close>Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.querySelector('#logCsv').addEventListener('click', () => {
      const lines = [csvRow(['product', 'sku', 'counted', 'expected', 'diff'])];
      cs.rows.forEach(x => lines.push(csvRow([x.name, x.sku, x.counted, x.expected, x.counted - x.expected])));
      downloadText('\uFEFF' + lines.join('\r\n'), 'count-log-' + cs.id + '.csv', 'text/csv');
      toast('Log exported.', 'ok');
    });
  }

  /* ============================================================
     PRODUCTION PAGE
     ============================================================ */
  function renderProduction(el) {
    const isProduction = session.role === 'production';
    const isApprover = session.role === 'admin' || session.role === 'inventory';

    el.innerHTML = `
      <div class="page-title">
        <div><h1>Production</h1><p>Material requests and finished-product submissions.</p></div>
      </div>

      ${isProduction ? `
        <div class="card">
          <div class="card-title">Request Materials</div>
          <div class="form-grid">
            <label class="full">For Product / Order
              <input id="mrProduct" placeholder="e.g. Natural Basic Color Window Blind" />
            </label>
            <label>SKU (optional)
              <input id="mrSku" placeholder="e.g. B500" />
            </label>
          </div>
          <div style="margin-top:14px">
            <label style="font-size:12px;font-weight:600;color:var(--g700);display:block;margin-bottom:6px">Materials List</label>
            <div id="mrList"></div>
            <button class="btn btn-sm" id="mrAdd">+ Add Material</button>
          </div>
          <div class="toolbar" style="margin-top:14px">
            <input class="grow" id="mrNotes" placeholder="Notes (optional)" />
            <button class="btn btn-primary" id="mrSubmit">Submit Request</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Submit Finished Product</div>
          <div class="form-grid">
            <label class="full">Product Name *
              <input id="fgName" required placeholder="e.g. Natural Basic Color Window Blind" />
            </label>
            <label>SKU *
              <input id="fgSku" required placeholder="e.g. B500" />
            </label>
            <label>Category
              <input id="fgCat" placeholder="e.g. Window Blinds" />
            </label>
            <label>Quantity *
              <input id="fgQty" type="number" min="1" value="1" />
            </label>
            <label class="full">Notes
              <input id="fgNotes" placeholder="e.g. Finished for order ORD-…" />
            </label>
          </div>
          <div class="toolbar" style="margin-top:14px">
            <button class="btn btn-primary" id="fgSubmit">Submit Finished Product</button>
          </div>
          <div class="fg-preview" id="fgPreview" hidden></div>
        </div>
      ` : ''}

      ${isApprover ? `
        <div class="card">
          <div class="card-title">
            <span>Incoming Finished Products ${state.finishedGoods.filter(f => f.status === 'pending').length ? '<span class="new-dot"></span>' : ''}</span>
            <span class="muted" style="font-size:12px;text-transform:none;letter-spacing:0">Confirm to add to inventory</span>
          </div>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>SKU</th><th>Qty</th><th>By</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${state.finishedGoods.length ? state.finishedGoods.map(f => `
                  <tr class="${f.status === 'pending' ? 'has-new' : ''}">
                    <td>${fmtDateTime(f.date)}</td>
                    <td><div class="name-cell">${f.status === 'pending' ? '<span class="new-dot"></span>' : ''}<span>${esc(f.name)}</span></div></td>
                    <td class="mono">${esc(f.sku)}</td>
                    <td>${f.qty}</td>
                    <td>${esc(userById(f.submittedBy)?.name || '—')}</td>
                    <td>${f.status === 'pending' ? badge('Pending') : f.status === 'confirmed' ? badge('Completed').replace('Completed', 'Confirmed') : badge('Cancelled')}</td>
                    <td>
                      ${f.status === 'pending' ? `
                        <button class="btn btn-sm btn-primary" data-fgok="${f.id}">Confirm</button>
                        <button class="btn btn-sm btn-danger" data-fgno="${f.id}">Cancel</button>
                      ` : '—'}
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="7" class="empty-row">No finished-product submissions yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Material Requests</div>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>SKU</th><th>Materials</th><th>By</th></tr></thead>
              <tbody>
                ${state.materialRequests.length ? state.materialRequests.map(m => `
                  <tr>
                    <td>${fmtDateTime(m.date)}</td>
                    <td>${esc(m.product)}</td>
                    <td class="mono">${esc(m.sku || '—')}</td>
                    <td>${(m.materials || []).map(x => `<span class="chip">${esc(x.name)} ×${x.qty}</span>`).join(' ') || '—'}</td>
                    <td>${esc(userById(m.requestedBy)?.name || '—')}</td>
                  </tr>
                `).join('') : '<tr><td colspan="5" class="empty-row">No material requests yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      ${isProduction ? `
        <div class="card">
          <div class="card-title">My Submission History</div>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>SKU</th><th>Qty</th><th>Status</th></tr></thead>
              <tbody>
                ${state.finishedGoods.filter(f => f.submittedBy === session.userId).length ? state.finishedGoods.filter(f => f.submittedBy === session.userId).map(f => `
                  <tr>
                    <td>${fmtDateTime(f.date)}</td>
                    <td>${esc(f.name)}</td>
                    <td class="mono">${esc(f.sku)}</td>
                    <td>${f.qty}</td>
                    <td>${f.status === 'pending' ? badge('Pending') : f.status === 'confirmed' ? badge('Completed').replace('Completed', 'Confirmed') : badge('Cancelled')}</td>
                  </tr>
                `).join('') : '<tr><td colspan="5" class="empty-row">Nothing submitted yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;

    if (isProduction) {
      const list = $('#mrList');
      const addMatRow = () => {
        const row = document.createElement('div');
        row.className = 'mat-row';
        row.innerHTML = `
          <input placeholder="Material name" class="mat-name" />
          <input type="number" min="1" value="1" class="mat-qty" />
          <button class="btn btn-sm btn-danger" type="button">✕</button>
        `;
        row.querySelector('.btn-danger').addEventListener('click', () => row.remove());
        list.appendChild(row);
      };
      addMatRow();
      $('#mrAdd').addEventListener('click', addMatRow);
      $('#mrSubmit').addEventListener('click', () => {
        const product = $('#mrProduct').value.trim();
        if (!product) { toast('Enter a product.', 'bad'); return; }
        const materials = Array.from(list.children).map(r => ({
          name: r.querySelector('.mat-name').value.trim(),
          qty: Number(r.querySelector('.mat-qty').value) || 1
        })).filter(m => m.name);
        if (!materials.length) { toast('Add at least one material.', 'bad'); return; }
        state.materialRequests.unshift({
          id: uid('MR'), date: new Date().toISOString(),
          product, sku: sanitizeSku($('#mrSku').value),
          materials, notes: $('#mrNotes').value,
          status: 'submitted', requestedBy: session.userId
        });
        save();
        pushNotification(['admin', 'inventory'], `Material request for ${product} by ${session.name}`);
        toast('Material request submitted.', 'ok');
        renderPage();
      });

      // Live preview
      const updatePreview = () => {
        const name = $('#fgName').value.trim();
        const sku = sanitizeSku($('#fgSku').value);
        const qty = Number($('#fgQty').value) || 0;
        const prev = $('#fgPreview');
        if (!name || !sku) { prev.hidden = true; return; }
        prev.hidden = false;
        prev.innerHTML = `Will submit: <strong>${esc(name)}</strong> (SKU <strong>${esc(sku)}</strong>) × <strong>${qty}</strong>. Admin or Inventory staff will review and confirm before it enters inventory.`;
      };
      ['fgName', 'fgSku', 'fgQty'].forEach(id => $('#' + id).addEventListener('input', updatePreview));

      $('#fgSubmit').addEventListener('click', () => {
        const name = $('#fgName').value.trim();
        const sku = sanitizeSku($('#fgSku').value);
        const qty = Number($('#fgQty').value) || 0;
        if (!name || !sku || qty <= 0) { toast('Name, SKU, and quantity required.', 'bad'); return; }
        state.finishedGoods.unshift({
          id: uid('FG'), date: new Date().toISOString(),
          name, sku,
          category: $('#fgCat').value.trim(),
          qty, notes: $('#fgNotes').value,
          status: 'pending', submittedBy: session.userId
        });
        save();
        pushNotification(['admin', 'inventory'], `New finished product submitted: ${name} (${sku}) × ${qty} by ${session.name}`);
        toast('Submitted for approval.', 'ok');
        renderPage();
      });
    }

    if (isApprover) {
      $$('[data-fgok]').forEach(b => b.addEventListener('click', () => confirmFinishedGood(b.dataset.fgok)));
      $$('[data-fgno]').forEach(b => b.addEventListener('click', () => cancelFinishedGood(b.dataset.fgno)));
    }
  }

  function confirmFinishedGood(id) {
    const fg = state.finishedGoods.find(f => f.id === id);
    if (!fg || fg.status !== 'pending') return;
    // Find matching product by SKU, or create new
    let p = state.products.find(x => x.sku === fg.sku);
    if (p) {
      const before = p.stock;
      p.stock += fg.qty;
      state.stockMovements.push({
        id: uid('M'), productId: p.id, type: 'Stock-In', qty: fg.qty,
        before, after: p.stock,
        reason: 'Production: ' + fg.name,
        loggedBy: session.userId, date: new Date().toISOString()
      });
      toast(`Confirmed: ${p.name} +${fg.qty}`, 'ok');
    } else {
      // Create new product
      const np = {
        id: uid('P'), name: fg.name, sku: fg.sku,
        category: fg.category || 'Uncategorized',
        price: 0, cost: 0, stock: fg.qty, reorder: 5,
        unit: 'pc', description: fg.notes || '',
        image: pickImg(fg.category || 'Window Blinds', fg.sku),
        isActive: true, featured: false, isNew: true,
        createdAt: new Date().toISOString()
      };
      state.products.push(np);
      state.stockMovements.push({
        id: uid('M'), productId: np.id, type: 'Stock-In', qty: fg.qty,
        before: 0, after: fg.qty,
        reason: 'New from production',
        loggedBy: session.userId, date: new Date().toISOString()
      });
      toast(`New product created: ${np.name} (${np.sku})`, 'ok');
    }
    fg.status = 'confirmed';
    fg.confirmedBy = session.userId;
    fg.confirmedAt = new Date().toISOString();
    save();
    pushNotification(['production'], `Your submission ${fg.name} (${fg.sku}) was confirmed and added to inventory.`);
    renderPage();
  }

  function cancelFinishedGood(id) {
    const fg = state.finishedGoods.find(f => f.id === id);
    if (!fg || fg.status !== 'pending') return;
    if (!confirm(`Cancel submission: ${fg.name} (${fg.sku}) × ${fg.qty}?`)) return;
    fg.status = 'cancelled';
    fg.cancelledBy = session.userId;
    fg.cancelledAt = new Date().toISOString();
    save();
    pushNotification(['production'], `Your submission ${fg.name} (${fg.sku}) was cancelled.`);
    toast('Submission cancelled.', 'warn');
    renderPage();
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  function renderDashboard(el) {
    const t = new Date();
    const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
    const weekStart = new Date(t.getTime() - 7 * 864e5);
    const monthlySales = state.orders.filter(o => o.status === 'Completed' && new Date(o.completedAt || o.createdAt) >= monthStart).reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const weeklySales = state.orders.filter(o => o.status === 'Completed' && new Date(o.completedAt || o.createdAt) >= weekStart).reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const monthlyCogs = state.orders.filter(o => o.status === 'Completed' && new Date(o.completedAt || o.createdAt) >= monthStart).reduce((s, o) => s + Number(o.cogs || 0), 0);
    const monthlyExpenses = state.expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + Number(e.amount || 0), 0);
    const netProfit = monthlySales - monthlyCogs - monthlyExpenses;
    const lowStockCount = state.products.filter(p => ['low stock', 'out of stock'].includes(productStatus(p))).length;
    const overstockCount = state.products.filter(p => productStatus(p) === 'overstock').length;
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const start = new Date(t.getFullYear(), i, 1);
      const end = new Date(t.getFullYear(), i + 1, 0, 23, 59, 59);
      return state.orders.filter(o => o.status === 'Completed' && new Date(o.completedAt || o.createdAt) >= start && new Date(o.completedAt || o.createdAt) <= end).reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    });
    const maxMonth = Math.max(...monthlyData, 1);
    const topProducts = {};
    state.orders.filter(o => o.status === 'Completed').forEach(o => {
      (o.items || []).forEach(it => {
        const p = productById(it.productId);
        if (!p) return;
        topProducts[p.id] = topProducts[p.id] || { product: p, qty: 0, revenue: 0 };
        topProducts[p.id].qty += Number(it.qty);
        topProducts[p.id].revenue += Number(it.qty) * Number(it.price);
      });
    });
    const topList = Object.values(topProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const recentOrders = [...state.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    el.innerHTML = `
      <div class="page-title">
        <div><h1>Dashboard</h1><p>Business overview for ${t.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</p></div>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Weekly Sales</div><div class="kpi-val">${peso(weeklySales)}</div><div class="kpi-delta">Last 7 days</div></div>
        <div class="kpi"><div class="kpi-label">Monthly Sales</div><div class="kpi-val">${peso(monthlySales)}</div><div class="kpi-delta">${t.toLocaleDateString('en-PH', { month: 'long' })}</div></div>
        <div class="kpi"><div class="kpi-label">Est. Net Profit</div><div class="kpi-val">${peso(netProfit)}</div><div class="kpi-delta">Revenue − COGS − Expenses</div></div>
        <div class="kpi"><div class="kpi-label">Low Stock Alerts</div><div class="kpi-val">${lowStockCount}</div><div class="kpi-delta">${overstockCount} overstocked</div></div>
      </div>
      <div class="card">
        <div class="card-title">Monthly Sales — ${t.getFullYear()}</div>
        <div class="chart-bars">
          ${monthlyData.map((v, i) => {
            const h = (v / maxMonth) * 100;
            const cur = i === t.getMonth();
            return `<div class="chart-bar-wrap">
              <div class="chart-bar-val">${v > 0 ? peso(v) : ''}</div>
              <div class="chart-bar ${cur ? 'current' : ''}" style="height:${Math.max(h, 2)}%"></div>
              <div class="chart-bar-label">${monthName(i)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Inventory Alert Console</div>
        <div class="alert-list">
          ${state.products.filter(p => ['low stock', 'out of stock', 'overstock'].includes(productStatus(p))).slice(0, 8).map(p => `
            <div class="alert-item ${productStatus(p) === 'out of stock' ? 'critical' : ''}">
              <div style="display:flex;align-items:center;gap:12px">
                <img class="thumb" src="${esc(p.image || pickImg(p.category, p.sku))}" onerror="this.style.visibility='hidden'">
                <div>
                  <div class="a-name">${esc(p.name)}</div>
                  <div class="a-sku">${esc(p.sku)} · ${esc(p.category)}</div>
                </div>
              </div>
              <div style="text-align:right">
                ${badge(productStatus(p))}
                <div class="muted" style="font-size:12px;margin-top:4px">${productStock(p)} on hand</div>
              </div>
            </div>
          `).join('') || '<div class="muted">No alerts.</div>'}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" id="dashTwoCol">
        <div class="card">
          <div class="card-title">Top 5 Products</div>
          <div class="tablewrap">
            <table><thead><tr><th>Product</th><th>Qty</th><th>Revenue</th></tr></thead>
              <tbody>${topList.length ? topList.map(x => `<tr><td><div class="name-cell"><img class="thumb" src="${esc(x.product.image || pickImg(x.product.category, x.product.sku))}" onerror="this.style.visibility='hidden'"><span>${esc(x.product.name)}</span></div></td><td>${x.qty}</td><td>${peso(x.revenue)}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-row">No completed sales.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Recent Orders</div>
          <div class="tablewrap">
            <table><thead><tr><th>Order No.</th><th>Client</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>${recentOrders.length ? recentOrders.map(o => `<tr><td class="mono">${esc(o.orderNo)}</td><td>${esc(customerById(o.customerId)?.name || '—')}</td><td>${badge(o.status)}</td><td>${peso(o.totalAmount)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-row">No orders yet.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      </div>
      <style>@media(max-width:900px){#dashTwoCol{grid-template-columns:1fr !important;}}</style>
    `;
  }

  /* ============================================================
     ORDERS (unchanged, but images)
     ============================================================ */
  let orderFilter = 'All';
  function renderOrders(el) {
    const statuses = ['All', 'Pending', 'In Production', 'Ready for Delivery', 'Completed', 'Cancelled'];
    const filtered = orderFilter === 'All' ? state.orders : state.orders.filter(o => o.status === orderFilter);
    el.innerHTML = `
      <div class="page-title">
        <div><h1>Orders</h1><p>Manage customer orders from inquiry to completion.</p></div>
        ${can('orders') ? '<button class="btn btn-primary" id="btnNewOrder">+ New Order</button>' : ''}
      </div>
      <div class="tabs">
        ${statuses.map(s => `<button class="tab-btn ${orderFilter === s ? 'active' : ''}" data-of="${s}">${s} <span class="muted">(${s === 'All' ? state.orders.length : state.orders.filter(o => o.status === s).length})</span></button>`).join('')}
      </div>
      <div class="card">
        <div class="tablewrap">
          <table>
            <thead><tr><th>Order No.</th><th>Client</th><th>Lead</th><th>Status</th><th>Delivery</th><th>Total</th><th>Balance</th><th></th></tr></thead>
            <tbody>${filtered.length ? filtered.map(o => {
              const c = customerById(o.customerId);
              return `<tr><td class="mono">${esc(o.orderNo)}</td><td>${esc(c?.name || '—')}</td><td>${esc(o.leadSource || '—')}</td><td>${badge(o.status)}</td><td>${esc(o.deliveryMethod || '—')}</td><td>${peso(o.totalAmount)}</td><td>${peso(o.remainingBalance)}</td><td><button class="btn btn-sm" data-view="${o.id}">View</button></td></tr>`;
            }).join('') : '<tr><td colspan="8" class="empty-row">No orders in this view.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
    $$('.tab-btn[data-of]').forEach(b => b.addEventListener('click', () => { orderFilter = b.dataset.of; renderPage(); }));
    const nb = $('#btnNewOrder');
    if (nb) nb.addEventListener('click', () => openOrderModal());
    $$('[data-view]').forEach(b => b.addEventListener('click', () => openOrderView(b.dataset.view)));
  }

  function openOrderModal(orderId) {
    const order = orderId ? orderById(orderId) : null;
    const customers = state.customers.filter(c => c.isActive);
    const products = state.products.filter(p => p.isActive);
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:720px">
        <div class="modal-head"><h3>${order ? 'Edit ' + esc(order.orderNo) : 'New Order'}</h3><button data-close>✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <label>Client *<select id="oClient"><option value="">— Select —</option>${customers.map(c => `<option value="${c.id}" ${order && order.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <label>Lead Source<select id="oLead"><option>Facebook</option><option>Walk-in</option><option>Referral</option><option>Website</option><option>Other</option></select></label>
            <label>Delivery<select id="oDelivery"><option>Pickup</option><option>Delivery</option><option>Installation</option></select></label>
            <label>Payment Mode<select id="oPayMode"><option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Card</option></select></label>
          </div>
          <h3 style="margin:20px 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--g500)">Order Items</h3>
          <div id="oItems"></div>
          <button class="btn btn-sm" id="oAddItem" style="margin-top:8px">+ Add Item</button>
          <div class="form-grid" style="margin-top:20px">
            <label>Amount Paid<input id="oPaid" type="number" min="0" step="0.01" value="0" /></label>
            <label>Notes<textarea id="oNotes" rows="2"></textarea></label>
          </div>
          <div style="margin-top:16px;padding:14px;background:var(--g50);border-radius:8px">
            <div style="display:flex;justify-content:space-between"><span>Total:</span><strong id="oTotal">₱0.00</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Balance:</span><strong id="oBalance">₱0.00</strong></div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-close>Cancel</button>
          <button class="btn btn-primary" id="oSave">${order ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const itemsEl = modal.querySelector('#oItems');
    const addItemRow = (productId = '', qty = 1, price = 0) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:2fr 80px 110px 40px;gap:8px;margin-bottom:8px;align-items:center';
      row.innerHTML = `
        <select class="it-prod"><option value="">— Product —</option>${products.map(p => `<option value="${p.id}" data-price="${p.price}" ${productId === p.id ? 'selected' : ''}>${esc(p.name)} (${esc(p.sku)})</option>`).join('')}</select>
        <input class="it-qty" type="number" min="1" value="${qty}" />
        <input class="it-price" type="number" min="0" step="0.01" value="${price}" />
        <button class="btn btn-sm btn-danger">✕</button>
      `;
      row.querySelector('.it-prod').addEventListener('change', (e) => {
        const opt = e.target.selectedOptions[0];
        if (opt && opt.dataset.price) row.querySelector('.it-price').value = opt.dataset.price;
        recalc();
      });
      row.querySelector('.it-qty').addEventListener('input', recalc);
      row.querySelector('.it-price').addEventListener('input', recalc);
      row.querySelector('.btn-danger').addEventListener('click', () => { row.remove(); recalc(); });
      itemsEl.appendChild(row);
    };
    (order?.items || []).forEach(it => addItemRow(it.productId, it.qty, it.price));
    if (!order) addItemRow();
    function recalc() {
      const items = Array.from(itemsEl.children).map(r => ({
        productId: r.querySelector('.it-prod').value,
        qty: Number(r.querySelector('.it-qty').value) || 0,
        price: Number(r.querySelector('.it-price').value) || 0
      }));
      const total = items.reduce((s, it) => s + it.qty * it.price, 0);
      const paid = Number(modal.querySelector('#oPaid').value) || 0;
      modal.querySelector('#oTotal').textContent = peso(total);
      modal.querySelector('#oBalance').textContent = peso(total - paid);
    }
    modal.querySelector('#oPaid').addEventListener('input', recalc);
    modal.querySelector('#oAddItem').addEventListener('click', () => addItemRow());
    recalc();
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.querySelector('#oSave').addEventListener('click', () => {
      const customerId = modal.querySelector('#oClient').value;
      if (!customerId) { toast('Select a client.', 'bad'); return; }
      const items = Array.from(itemsEl.children).map(r => ({
        productId: r.querySelector('.it-prod').value,
        qty: Number(r.querySelector('.it-qty').value) || 0,
        price: Number(r.querySelector('.it-price').value) || 0
      })).filter(it => it.productId && it.qty > 0);
      if (!items.length) { toast('Add at least one item.', 'bad'); return; }
      const total = items.reduce((s, it) => s + it.qty * it.price, 0);
      const cogs = items.reduce((s, it) => { const p = productById(it.productId); return s + (p ? p.cost * it.qty : 0); }, 0);
      const paid = Number(modal.querySelector('#oPaid').value) || 0;
      if (order) {
        Object.assign(order, { customerId, items, leadSource: modal.querySelector('#oLead').value, deliveryMethod: modal.querySelector('#oDelivery').value, paymentMode: modal.querySelector('#oPayMode').value, notes: modal.querySelector('#oNotes').value, totalAmount: total, cogs, amountPaid: paid, remainingBalance: total - paid });
        toast('Order updated.', 'ok');
      } else {
        state.orders.push({ id: uid('O'), orderNo: nextOrderNo(), customerId, items, leadSource: modal.querySelector('#oLead').value, deliveryMethod: modal.querySelector('#oDelivery').value, paymentMode: modal.querySelector('#oPayMode').value, notes: modal.querySelector('#oNotes').value, totalAmount: total, cogs, amountPaid: paid, remainingBalance: total - paid, status: 'Pending', createdAt: new Date().toISOString(), createdBy: session.userId });
        toast('Order created.', 'ok');
      }
      save(); modal.remove(); renderPage();
    });
  }

  function openOrderView(orderId) {
    const o = orderById(orderId);
    if (!o) return;
    const c = customerById(o.customerId);
    const statuses = ['Pending', 'In Production', 'Ready for Delivery', 'Completed', 'Cancelled'];
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:640px">
        <div class="modal-head"><h3>Order ${esc(o.orderNo)}</h3><button data-close>✕</button></div>
        <div class="modal-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
            <div><div class="muted" style="font-size:11px;text-transform:uppercase">Client</div><strong>${esc(c?.name || '—')}</strong></div>
            <div><div class="muted" style="font-size:11px;text-transform:uppercase">Status</div>${badge(o.status)}</div>
            <div><div class="muted" style="font-size:11px;text-transform:uppercase">Created</div>${fmtDate(o.createdAt)}</div>
            <div><div class="muted" style="font-size:11px;text-transform:uppercase">Delivery</div>${esc(o.deliveryMethod || '—')}</div>
          </div>
          <div class="card-title">Items</div>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
              <tbody>${(o.items || []).map(it => { const p = productById(it.productId); return `<tr><td><div class="name-cell"><img class="thumb" src="${esc(p?.image || pickImg(p?.category, p?.sku))}" onerror="this.style.visibility='hidden'"><span>${esc(p?.name || '—')}</span></div></td><td>${it.qty}</td><td>${peso(it.price)}</td><td>${peso(it.qty * it.price)}</td></tr>`; }).join('')}</tbody>
            </table>
          </div>
          <div style="margin-top:16px;padding:14px;background:var(--g50);border-radius:8px">
            <div style="display:flex;justify-content:space-between"><span>Total:</span><strong>${peso(o.totalAmount)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Paid:</span><strong>${peso(o.amountPaid)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Balance:</span><strong>${peso(o.remainingBalance)}</strong></div>
          </div>
          ${(can('orders') || session.role === 'production') ? `
            <div class="card-title" style="margin-top:20px">Update Status</div>
            <div class="toolbar">
              <select id="ovStatus">${statuses.map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
              <button class="btn btn-primary" id="ovSaveStatus">Update</button>
            </div>
          ` : ''}
        </div>
        <div class="modal-foot"><button class="btn" data-close>Close</button></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
    const saveBtn = modal.querySelector('#ovSaveStatus');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      updateOrderStatus(o.id, modal.querySelector('#ovStatus').value);
      modal.remove(); renderPage();
    });
  }

  function updateOrderStatus(orderId, newStatus) {
    const o = orderById(orderId);
    if (!o) return;
    const wasCompleted = o.status === 'Completed';
    o.status = newStatus;
    if (newStatus === 'Completed' && !wasCompleted) {
      o.completedAt = new Date().toISOString();
      (o.items || []).forEach(it => {
        const p = productById(it.productId);
        if (!p) return;
        const before = p.stock;
        p.stock = Math.max(0, p.stock - it.qty);
        state.stockMovements.push({ id: uid('M'), productId: p.id, type: 'Stock-Out', qty: -it.qty, before, after: p.stock, orderId: o.id, loggedBy: session.userId, date: new Date().toISOString(), reason: 'Order ' + o.orderNo });
      });
      const c = customerById(o.customerId);
      if (c) { c.totalOrders = (c.totalOrders || 0) + 1; c.lifetimeValue = (c.lifetimeValue || 0) + o.totalAmount; }
      toast('Order completed. Stock deducted.', 'ok');
    } else toast('Status: ' + newStatus);
    save();
  }

  /* ============================================================
     QUEUE
     ============================================================ */
  function renderQueue(el) {
    const active = state.queue.filter(q => q.status !== 'Completed');
    const completed = state.queue.filter(q => q.status === 'Completed').slice(-10).reverse();
    el.innerHTML = `
      <div class="page-title">
        <div><h1>Customer Queue</h1><p>Walk-in and phone-in customer service queue.</p></div>
        <button class="btn btn-primary" id="btnAddQueue">+ Add to Queue</button>
      </div>
      <div class="card">
        <div class="card-title">Active Queue (${active.length})</div>
        <div class="tablewrap">
          <table>
            <thead><tr><th>Ticket</th><th>Customer</th><th>Contact</th><th>Assigned</th><th>Status</th><th>Wait</th><th></th></tr></thead>
            <tbody>${active.length ? active.map(q => `
              <tr><td class="mono">${esc(q.ticketNo)}</td><td>${esc(q.customerName)}</td><td>${esc(q.contact || '—')}</td><td>${esc(userById(q.assignedStaffId)?.name || '—')}</td><td>${badge(q.status)}</td><td>${q.estWait || 10} min</td>
              <td><button class="btn btn-sm" data-qs="${q.id}" data-qstatus="Being Served">Serve</button><button class="btn btn-sm" data-qs="${q.id}" data-qstatus="Completed">Done</button></td></tr>
            `).join('') : '<tr><td colspan="7" class="empty-row">Queue is empty.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Recently Completed</div>
        <div class="tablewrap">
          <table><thead><tr><th>Ticket</th><th>Customer</th><th>Assigned</th><th>Completed</th></tr></thead>
            <tbody>${completed.length ? completed.map(q => `<tr><td class="mono">${esc(q.ticketNo)}</td><td>${esc(q.customerName)}</td><td>${esc(userById(q.assignedStaffId)?.name || '—')}</td><td>${fmtDateTime(q.completedAt)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-row">No completed tickets.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
    $('#btnAddQueue').addEventListener('click', () => openQueueModal());
    $$('[data-qs]').forEach(b => b.addEventListener('click', () => {
      const q = state.queue.find(x => x.id === b.dataset.qs);
      if (!q) return;
      q.status = b.dataset.qstatus;
      q.assignedStaffId = q.assignedStaffId || session.userId;
      if (q.status === 'Completed') q.completedAt = new Date().toISOString();
      save(); renderPage();
      toast('Ticket updated.', 'ok');
    }));
  }

  function openQueueModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-head"><h3>Add to Queue</h3><button data-close>✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <label>Customer Name *<input id="qName" required /></label>
            <label>Contact<input id="qContact" /></label>
            <label>Assigned Staff<select id="qStaff">${state.users.filter(u => u.active).map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select></label>
            <label>Est. Wait (min)<input id="qWait" type="number" value="10" min="1" /></label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-close>Cancel</button>
          <button class="btn btn-primary" id="qSave">Add</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.querySelector('#qSave').addEventListener('click', () => {
      const name = modal.querySelector('#qName').value.trim();
      if (!name) { toast('Name required.', 'bad'); return; }
      state.queue.push({ id: uid('Q'), ticketNo: nextTicketNo(), customerName: name, contact: modal.querySelector('#qContact').value.trim(), assignedStaffId: modal.querySelector('#qStaff').value, estWait: Number(modal.querySelector('#qWait').value) || 10, status: 'Waiting', createdAt: new Date().toISOString() });
      save(); modal.remove(); renderPage();
      toast('Ticket added.', 'ok');
    });
  }

  /* ============================================================
     INVENTORY (with images + new-product highlight)
     ============================================================ */
  let invTab = 'list';
  function renderInventory(el) {
    el.innerHTML = `
      <div class="page-title">
        <div><h1>Inventory</h1><p>Stock list and movements.</p></div>
        ${can('inventory') ? '<button class="btn btn-primary" id="btnStockIn">+ Stock-In</button>' : ''}
      </div>
      <div class="tabs">
        <button class="tab-btn ${invTab === 'list' ? 'active' : ''}" data-it="list">Stock List</button>
        <button class="tab-btn ${invTab === 'movements' ? 'active' : ''}" data-it="movements">Stock Movements</button>
      </div>
      <div id="invPane"></div>
    `;
    $$('.tab-btn[data-it]').forEach(b => b.addEventListener('click', () => { invTab = b.dataset.it; renderPage(); }));
    const si = $('#btnStockIn'); if (si) si.addEventListener('click', openStockInModal);
    renderInvPane();
  }

  function renderInvPane() {
    const pane = $('#invPane');
    if (invTab === 'list') {
      pane.innerHTML = `
        <div class="card">
          <div class="toolbar">
            <input class="grow" id="invSearch" placeholder="Search products…" />
            <select id="invCat"><option value="">All categories</option>${[...new Set(state.products.map(p => p.category))].map(c => `<option>${esc(c)}</option>`).join('')}</select>
          </div>
          <div class="tablewrap">
            <table>
              <thead><tr><th></th><th>Product</th><th>SKU</th><th>Category</th><th>QTY</th><th>Reorder</th><th>Status</th><th></th></tr></thead>
              <tbody id="invBody"></tbody>
            </table>
          </div>
        </div>
      `;
      const render = () => {
        const q = $('#invSearch').value.toLowerCase();
        const cat = $('#invCat').value;
        const list = state.products.filter(p => {
          if (cat && p.category !== cat) return false;
          if (q && !(p.name + ' ' + p.sku + ' ' + p.category).toLowerCase().includes(q)) return false;
          return true;
        });
        $('#invBody').innerHTML = list.map(p => {
          // yellow dot if there is a pending finishedGood for this sku
          const isNewPending = state.finishedGoods.some(f => f.sku === p.sku && f.status === 'pending');
          return `
          <tr class="${isNewPending ? 'has-new' : ''}">
            <td><img class="thumb" src="${esc(p.image || pickImg(p.category, p.sku))}" onerror="this.style.visibility='hidden'"></td>
            <td><div class="name-cell">${isNewPending ? '<span class="new-dot" title="New incoming product from Production"></span>' : ''}<span class="name-text">${esc(p.name)}</span></div></td>
            <td class="mono">${esc(p.sku)}</td>
            <td>${esc(p.category)}</td>
            <td><strong>${productStock(p)}</strong></td>
            <td>${p.reorder}</td>
            <td>${badge(productStatus(p))}</td>
            <td><button class="btn btn-sm" data-editp="${p.id}">Edit</button></td>
          </tr>`;
        }).join('') || '<tr><td colspan="8" class="empty-row">No products.</td></tr>';
        $$('[data-editp]').forEach(b => b.addEventListener('click', () => openProductModal(b.dataset.editp)));
      };
      $('#invSearch').addEventListener('input', render);
      $('#invCat').addEventListener('change', render);
      render();
    } else {
      const moves = [...state.stockMovements].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100);
      pane.innerHTML = `
        <div class="card">
          <div class="card-title">Recent Stock Movements (last 100)</div>
          <div class="tablewrap">
            <table>
              <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Before</th><th>After</th><th>Reference</th><th>By</th></tr></thead>
              <tbody>${moves.length ? moves.map(m => {
                const p = productById(m.productId);
                return `<tr><td>${fmtDateTime(m.date)}</td><td>${esc(p?.name || '—')}</td><td>${esc(m.type)}</td><td><strong>${m.qty > 0 ? '+' : ''}${m.qty}</strong></td><td>${m.before}</td><td>${m.after}</td><td>${esc(m.reason || '—')}</td><td>${esc(userById(m.loggedBy)?.name || '—')}</td></tr>`;
              }).join('') : '<tr><td colspan="8" class="empty-row">No movements yet.</td></tr>'}</tbody>
            </table>
          </div>
        </div>
      `;
    }
  }

  function openProductModal(productId) {
    const p = productId ? productById(productId) : null;
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-head"><h3>${p ? 'Edit' : 'New'} Product</h3><button data-close>✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <label class="full">Product Name *<input id="pName" value="${esc(p?.name || '')}" required /></label>
            <label>SKU *<input id="pSku" value="${esc(p?.sku || '')}" required /></label>
            <label>Category<input id="pCat" value="${esc(p?.category || '')}" /></label>
            <label>Unit<input id="pUnit" value="${esc(p?.unit || 'pc')}" /></label>
            <label>Price<input id="pPrice" type="number" min="0" step="0.01" value="${p?.price || 0}" /></label>
            <label>Cost<input id="pCost" type="number" min="0" step="0.01" value="${p?.cost || 0}" /></label>
            <label>Stock<input id="pStock" type="number" min="0" value="${p?.stock || 0}" /></label>
            <label>Reorder Level<input id="pReorder" type="number" min="0" value="${p?.reorder || 5}" /></label>
            <label class="full">Image URL<input id="pImg" value="${esc(p?.image || '')}" placeholder="https://…" /></label>
            <label class="full">Description<textarea id="pDesc" rows="2">${esc(p?.description || '')}</textarea></label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-close>Cancel</button>
          <button class="btn btn-primary" id="pSave">${p ? 'Save' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.querySelector('#pSave').addEventListener('click', () => {
      const name = modal.querySelector('#pName').value.trim();
      const sku = modal.querySelector('#pSku').value.trim().toUpperCase();
      if (!name || !sku) { toast('Name and SKU required.', 'bad'); return; }
      const cat = modal.querySelector('#pCat').value.trim();
      const data = {
        name, sku, category: cat,
        unit: modal.querySelector('#pUnit').value.trim() || 'pc',
        price: Number(modal.querySelector('#pPrice').value) || 0,
        cost: Number(modal.querySelector('#pCost').value) || 0,
        stock: Number(modal.querySelector('#pStock').value) || 0,
        reorder: Number(modal.querySelector('#pReorder').value) || 5,
        image: modal.querySelector('#pImg').value.trim() || pickImg(cat, sku),
        description: modal.querySelector('#pDesc').value
      };
      if (p) { Object.assign(p, data); toast('Product updated.', 'ok'); }
      else { state.products.push({ id: uid('P'), ...data, isActive: true, featured: false, isNew: true, createdAt: new Date().toISOString() }); toast('Product created.', 'ok'); }
      save(); modal.remove(); renderPage();
    });
  }

  function openStockInModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-head"><h3>Record Stock-In</h3><button data-close>✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <label class="full">Product *
              <select id="siProduct"><option value="">— Select —</option>${state.products.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.sku)}) — ${p.stock} on hand</option>`).join('')}</select>
            </label>
            <label>Quantity *<input id="siQty" type="number" min="1" value="1" /></label>
            <label>Reference<input id="siRef" placeholder="e.g. PO-2026-001" /></label>
            <label class="full">Notes<input id="siNotes" /></label>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-close>Cancel</button>
          <button class="btn btn-primary" id="siSave">Record</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
    modal.querySelector('#siSave').addEventListener('click', () => {
      const pid = modal.querySelector('#siProduct').value;
      const qty = Number(modal.querySelector('#siQty').value) || 0;
      if (!pid || qty <= 0) { toast('Select product and quantity.', 'bad'); return; }
      const p = productById(pid);
      const before = p.stock;
      p.stock += qty;
      state.stockMovements.push({ id: uid('M'), productId: p.id, type: 'Stock-In', qty, before, after: p.stock, reason: modal.querySelector('#siRef').value || 'Stock-In', notes: modal.querySelector('#siNotes').value, loggedBy: session.userId, date: new Date().toISOString() });
      save(); modal.remove(); renderPage();
      toast('Stock-In recorded.', 'ok');
    });
  }

  /* ============================================================
     SALES / REPORTS / PROMOTIONS / CUSTOMERS / USERS
     (light adjustments for images)
     ============================================================ */
  function renderSales(el) {
    const completed = state.orders.filter(o => o.status === 'Completed');
    const totalRevenue = completed.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const count = completed.length;
    const avg = count ? totalRevenue / count : 0;
    el.innerHTML = `
      <div class="page-title"><div><h1>Sales Ledger</h1><p>Completed sales transactions.</p></div></div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val">${peso(totalRevenue)}</div></div>
        <div class="kpi"><div class="kpi-label">Completed Sales</div><div class="kpi-val">${count}</div></div>
        <div class="kpi"><div class="kpi-label">Average Order Value</div><div class="kpi-val">${peso(avg)}</div></div>
      </div>
      <div class="card">
        <div class="card-title">Transactions</div>
        <div class="tablewrap">
          <table><thead><tr><th>Date</th><th>Order No.</th><th>Customer</th><th>Payment</th><th>Amount</th></tr></thead>
            <tbody>${completed.length ? completed.map(o => { const c = customerById(o.customerId); return `<tr><td>${fmtDate(o.completedAt || o.createdAt)}</td><td class="mono">${esc(o.orderNo)}</td><td>${esc(c?.name || '—')}</td><td>${esc(o.paymentMode || 'Cash')}</td><td>${peso(o.totalAmount)}</td></tr>`; }).join('') : '<tr><td colspan="5" class="empty-row">No completed sales yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderReports(el) {
    el.innerHTML = `
      <div class="page-title"><div><h1>Reports</h1><p>Export business reports.</p></div></div>
      <div class="card">
        <div class="card-title">Available Reports</div>
        <div style="display:grid;gap:12px">
          <div class="alert-item"><div><div class="a-name">Monthly Sales Performance</div><div class="a-sku">Revenue, COGS, gross profit</div></div><button class="btn btn-sm btn-primary" data-report="sales">Export CSV</button></div>
          <div class="alert-item"><div><div class="a-name">Inventory Valuation</div><div class="a-sku">Stock, value, reorder status</div></div><button class="btn btn-sm btn-primary" data-report="inventory">Export CSV</button></div>
          <div class="alert-item"><div><div class="a-name">Customer Lifetime Value</div><div class="a-sku">Orders, revenue, lead source</div></div><button class="btn btn-sm btn-primary" data-report="customers">Export CSV</button></div>
          <div class="alert-item"><div><div class="a-name">Stock Movement Audit Trail</div><div class="a-sku">All stock-in, stock-out, adjustment</div></div><button class="btn btn-sm btn-primary" data-report="movements">Export CSV</button></div>
          <div class="alert-item"><div><div class="a-name">Registered Units</div><div class="a-sku">All QR-coded units</div></div><button class="btn btn-sm btn-primary" data-report="units">Export CSV</button></div>
        </div>
      </div>
    `;
    $$('[data-report]').forEach(b => b.addEventListener('click', () => exportReport(b.dataset.report)));
  }

  function exportReport(type) {
    const lines = [];
    if (type === 'sales') {
      lines.push(csvRow(['Order No', 'Date', 'Customer', 'Payment', 'Total', 'COGS', 'Gross Profit']));
      state.orders.filter(o => o.status === 'Completed').forEach(o => {
        const c = customerById(o.customerId);
        lines.push(csvRow([o.orderNo, o.completedAt || o.createdAt, c?.name || '', o.paymentMode || 'Cash', o.totalAmount, o.cogs || 0, (o.totalAmount - (o.cogs || 0))]));
      });
    } else if (type === 'inventory') {
      lines.push(csvRow(['SKU', 'Product', 'Category', 'Qty', 'Cost', 'Total Value', 'Reorder', 'Status']));
      state.products.forEach(p => lines.push(csvRow([p.sku, p.name, p.category, p.stock, p.cost, p.stock * p.cost, p.reorder, productStatus(p)])));
    } else if (type === 'customers') {
      lines.push(csvRow(['Client Code', 'Name', 'Phone', 'Email', 'Lead Source', 'Orders', 'Lifetime Value']));
      state.customers.forEach(c => lines.push(csvRow([c.clientCode, c.name, c.phone, c.email, c.leadSource, c.totalOrders, c.lifetimeValue])));
    } else if (type === 'movements') {
      lines.push(csvRow(['Date', 'Product', 'Type', 'Qty', 'Before', 'After', 'Reference', 'By']));
      state.stockMovements.forEach(m => { const p = productById(m.productId); lines.push(csvRow([m.date, p?.name || '', m.type, m.qty, m.before, m.after, m.reason || '', userById(m.loggedBy)?.name || ''])); });
    } else if (type === 'units') {
      lines.push(csvRow(['Unit ID', 'Product', 'SKU', 'Category', 'Status', 'Created']));
      state.units.forEach(u => lines.push(csvRow([u.id, u.name, u.sku, u.category, u.status, u.created])));
    }
    downloadText('\uFEFF' + lines.join('\r\n'), `${type}-report-${stamp()}.csv`, 'text/csv');
    toast('Report exported.', 'ok');
  }

  function renderPromotions(el) {
    el.innerHTML = `
      <div class="page-title"><div><h1>Promotions</h1><p>Manage featured items and promotions.</p></div><button class="btn btn-primary" id="btnNewPromo">+ New Promotion</button></div>
      <div class="card">
        <div class="card-title">Showcase Flags</div>
        <div class="tablewrap">
          <table><thead><tr><th>Product</th><th>SKU</th><th>Featured</th><th>New Arrival</th></tr></thead>
            <tbody>${state.products.map(p => `<tr><td><div class="name-cell"><img class="thumb" src="${esc(p.image || pickImg(p.category, p.sku))}" onerror="this.style.visibility='hidden'"><span>${esc(p.name)}</span></div></td><td class="mono">${esc(p.sku)}</td><td><input type="checkbox" data-flag="featured" data-pid="${p.id}" ${p.featured ? 'checked' : ''}></td><td><input type="checkbox" data-flag="isNew" data-pid="${p.id}" ${p.isNew ? 'checked' : ''}></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Active Promotions</div>
        <div class="tablewrap">
          <table><thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Period</th><th>Products</th><th>Status</th></tr></thead>
            <tbody>${state.promotions.map(pr => `<tr><td>${esc(pr.name)}</td><td>${esc(pr.type)}</td><td>${pr.type === 'percentage' ? pr.value + '%' : peso(pr.value)}</td><td>${esc(pr.start)} → ${esc(pr.end)}</td><td>${(pr.products || []).map(pid => esc(productById(pid)?.sku || '')).join(', ') || '—'}</td><td>${badge(pr.active ? 'Completed' : 'Cancelled')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-row">No promotions.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
    $$('[data-flag]').forEach(cb => cb.addEventListener('change', () => {
      const p = productById(cb.dataset.pid);
      if (p) p[cb.dataset.flag] = cb.checked;
      save(); Showroom.refresh();
    }));
    $('#btnNewPromo').addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-head"><h3>New Promotion</h3><button data-close>✕</button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="full">Name *<input id="prName" required /></label>
              <label>Type<select id="prType"><option value="percentage">Percentage</option><option value="amount">Fixed Amount</option><option value="bundle">Bundle</option></select></label>
              <label>Value<input id="prValue" type="number" min="0" step="0.01" value="10" /></label>
              <label>Start<input id="prStart" type="date" value="${today()}" /></label>
              <label>End<input id="prEnd" type="date" value="${today()}" /></label>
            </div>
          </div>
          <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="prSave">Create</button></div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
      modal.querySelector('#prSave').addEventListener('click', () => {
        const name = modal.querySelector('#prName').value.trim();
        if (!name) { toast('Name required.', 'bad'); return; }
        state.promotions.push({ id: uid('PR'), name, type: modal.querySelector('#prType').value, value: Number(modal.querySelector('#prValue').value) || 0, start: modal.querySelector('#prStart').value, end: modal.querySelector('#prEnd').value, products: [], active: true });
        save(); modal.remove(); renderPage();
        toast('Promotion created.', 'ok');
      });
    });
  }

  function renderCustomers(el) {
    el.innerHTML = `
      <div class="page-title"><div><h1>Customer Directory</h1><p>All clients and prospects.</p></div>${can('customers') ? '<button class="btn btn-primary" id="btnNewCust">+ New Customer</button>' : ''}</div>
      <div class="card">
        <div class="toolbar"><input class="grow" id="custSearch" placeholder="Search customers…" /></div>
        <div class="tablewrap">
          <table><thead><tr><th>Client ID</th><th>Name</th><th>Contact</th><th>Email</th><th>Lead Source</th><th>Orders</th><th>LTV</th></tr></thead><tbody id="custBody"></tbody></table>
        </div>
      </div>
    `;
    const render = () => {
      const q = $('#custSearch').value.toLowerCase();
      const list = state.customers.filter(c => !q || (c.name + ' ' + c.email + ' ' + c.phone).toLowerCase().includes(q));
      $('#custBody').innerHTML = list.map(c => `<tr><td class="mono">${esc(c.clientCode)}</td><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td><td>${esc(c.leadSource)}</td><td>${c.totalOrders || 0}</td><td>${peso(c.lifetimeValue || 0)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty-row">No customers.</td></tr>';
    };
    $('#custSearch').addEventListener('input', render);
    render();
    const nc = $('#btnNewCust');
    if (nc) nc.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-head"><h3>New Customer</h3><button data-close>✕</button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="full">Full Name *<input id="cName" required /></label>
              <label>Contact Number<input id="cPhone" /></label>
              <label>Email<input id="cEmail" type="email" /></label>
              <label>Lead Source<select id="cLead"><option>Facebook</option><option>Walk-in</option><option>Referral</option><option>Website</option><option>Other</option></select></label>
            </div>
          </div>
          <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="cSave">Create</button></div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
      modal.querySelector('#cSave').addEventListener('click', () => {
        const name = modal.querySelector('#cName').value.trim();
        if (!name) { toast('Name required.', 'bad'); return; }
        const code = 'CL-' + String(state.customers.length + 1).padStart(4, '0');
        state.customers.push({ id: uid('C'), clientCode: code, name, phone: modal.querySelector('#cPhone').value, email: modal.querySelector('#cEmail').value, leadSource: modal.querySelector('#cLead').value, totalOrders: 0, lifetimeValue: 0, isActive: true, createdAt: new Date().toISOString() });
        save(); modal.remove(); renderPage();
        toast('Customer created.', 'ok');
      });
    });
  }

  function renderUsers(el) {
    el.innerHTML = `
      <div class="page-title"><div><h1>User Management</h1><p>Staff accounts and roles.</p></div><button class="btn btn-primary" id="btnNewUser">+ New User</button></div>
      <div class="card">
        <div class="tablewrap">
          <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>${state.users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(ROLE_LABELS[u.role] || u.role)}</td><td>${u.active ? badge('Completed').replace('Completed', 'Active') : badge('Cancelled').replace('Cancelled', 'Inactive')}</td><td><button class="btn btn-sm" data-toggle-user="${u.id}">${u.active ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    `;
    $$('[data-toggle-user]').forEach(b => b.addEventListener('click', () => {
      const u = userById(b.dataset.toggleUser);
      if (!u) return;
      if (u.id === session.userId) { toast('Cannot deactivate your own account.', 'bad'); return; }
      u.active = !u.active;
      save(); renderPage();
      toast(u.active ? 'User activated.' : 'User deactivated.', 'ok');
    }));
    $('#btnNewUser').addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-head"><h3>New User</h3><button data-close>✕</button></div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="full">Full Name *<input id="uName" required /></label>
              <label>Email *<input id="uEmail" type="email" required /></label>
              <label>Password *
                <div class="pw-wrap">
                  <input id="uPass" type="password" required />
                  <button type="button" class="pw-toggle" data-pw="uPass">👁</button>
                </div>
              </label>
              <label>Role<select id="uRole"><option value="admin">Administrator</option><option value="sales">Sales Staff</option><option value="inventory">Inventory Staff</option><option value="production">Production Staff</option><option value="marketing">Marketing Staff</option></select></label>
            </div>
          </div>
          <div class="modal-foot"><button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="uSave">Create</button></div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
      modal.querySelector('#uSave').addEventListener('click', () => {
        const name = modal.querySelector('#uName').value.trim();
        const email = modal.querySelector('#uEmail').value.trim();
        const pass = modal.querySelector('#uPass').value;
        if (!name || !email || !pass) { toast('All fields required.', 'bad'); return; }
        if (state.users.some(u => u.email === email)) { toast('Email already used.', 'bad'); return; }
        state.users.push({ id: uid('U'), name, email, password: pass, role: modal.querySelector('#uRole').value, active: true });
        save(); modal.remove(); renderPage();
        toast('User created.', 'ok');
      });
    });
  }

  /* ============================================================
     GLOBAL SEARCH
     ============================================================ */
  function setupGlobalSearch() {
    const input = $('#globalSearch');
    const results = $('#gsResults');
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.hidden = true; return; }
      const orderHits = state.orders.filter(o => o.orderNo.toLowerCase().includes(q)).slice(0, 5);
      const productHits = state.products.filter(p => (p.name + ' ' + p.sku).toLowerCase().includes(q)).slice(0, 5);
      const custHits = state.customers.filter(c => (c.name + ' ' + c.email + ' ' + c.phone).toLowerCase().includes(q)).slice(0, 5);
      if (!orderHits.length && !productHits.length && !custHits.length) {
        results.innerHTML = '<div class="gs-empty">No results.</div>';
        results.hidden = false; return;
      }
      results.innerHTML = `
        ${orderHits.length ? `<div class="gs-group"><div class="gs-group-label">Orders</div>${orderHits.map(o => `<div class="gs-item" data-goto="orders"><span class="mono">${esc(o.orderNo)}</span><span class="muted">${esc(customerById(o.customerId)?.name || '')}</span></div>`).join('')}</div>` : ''}
        ${productHits.length ? `<div class="gs-group"><div class="gs-group-label">Products</div>${productHits.map(p => `<div class="gs-item" data-goto="inventory"><span>${esc(p.name)}</span><span class="muted mono">${esc(p.sku)}</span></div>`).join('')}</div>` : ''}
        ${custHits.length ? `<div class="gs-group"><div class="gs-group-label">Clients</div>${custHits.map(c => `<div class="gs-item" data-goto="customers"><span>${esc(c.name)}</span><span class="muted mono">${esc(c.clientCode)}</span></div>`).join('')}</div>` : ''}
      `;
      results.hidden = false;
      results.querySelectorAll('[data-goto]').forEach(el => el.addEventListener('click', () => {
        const mod = el.dataset.goto;
        if (can(mod)) { currentPage = mod; renderNav(); renderPage(); }
        results.hidden = true; input.value = '';
      }));
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.global-search')) results.hidden = true; });
  }

  /* ============================================================
     SHOWROOM (with images)
     ============================================================ */
  const Showroom = {
    init() { this.renderStats(); this.renderGrids(); this.renderFilters(); this.bind(); },
    refresh() { this.renderStats(); this.renderGrids(); this.renderFilters(); },
    renderStats() {
      $('#pubProducts').textContent = state.products.filter(p => p.isActive).length;
      $('#pubPromos').textContent = state.promotions.filter(p => p.active).length;
      $('#pubNew').textContent = state.products.filter(p => p.isNew && p.isActive).length;
    },
    renderFilters() {
      const cats = [...new Set(state.products.map(p => p.category))];
      const sel = $('#pubCategory');
      const cur = sel.value;
      sel.innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
      sel.value = cur;
    },
    card(p) {
      const status = productStatus(p);
      const soldOut = productStock(p) <= 0;
      const img = p.image || pickImg(p.category, p.sku);
      return `
        <div class="pcard">
          <div class="pcard-img has-img">
            <img src="${esc(img)}" alt="${esc(p.name)}" onerror="this.style.display='none';this.parentElement.classList.remove('has-img');this.parentElement.textContent='${esc(p.category[0]||'?')}'">
            ${p.isNew ? '<div class="pcard-tag">New</div>' : ''}
            ${p.featured && !p.isNew ? '<div class="pcard-tag promo">Featured</div>' : ''}
            ${soldOut ? '<div class="pcard-sold">SOLD</div>' : ''}
          </div>
          <div class="pcard-body">
            <div class="pcard-cat">${esc(p.category)}</div>
            <div class="pcard-name">${esc(p.name)}</div>
            <div class="pcard-foot">
              <div class="pcard-price">${peso(p.price)}</div>
              <div class="pcard-stock">${soldOut ? 'Out of stock' : status === 'low stock' ? 'Low stock' : 'Available'}</div>
            </div>
          </div>
        </div>
      `;
    },
    renderGrids() {
      const active = state.products.filter(p => p.isActive);
      $('#featuredGrid').innerHTML = active.filter(p => p.featured).slice(0, 4).map(p => this.card(p)).join('') || '<p class="muted">No featured items yet.</p>';
      $('#newGrid').innerHTML = active.filter(p => p.isNew).slice(0, 4).map(p => this.card(p)).join('') || '<p class="muted">No new arrivals yet.</p>';
      $('#allGrid').innerHTML = this.filteredProducts().map(p => this.card(p)).join('') || '<p class="muted">No products match.</p>';
      $('#newArrivalsGrid').innerHTML = active.filter(p => p.isNew).map(p => this.card(p)).join('') || '<p class="muted">No new arrivals yet.</p>';
      const promos = state.promotions.filter(pr => pr.active);
      $('#promoGrid').innerHTML = active.filter(p => promos.some(pr => (pr.products || []).includes(p.id))).map(p => this.card(p)).join('') || '<p class="muted">No products on promotion.</p>';
      $('#promoBanners').innerHTML = promos.map(pr => `
        <div class="promo-banner">
          <div><h3>${esc(pr.name)}</h3><p>${pr.type === 'percentage' ? pr.value + '% off' : pr.type === 'amount' ? peso(pr.value) + ' off' : 'Bundle offer'} · until ${esc(pr.end)}</p></div>
          <div class="pb-tag">${pr.type === 'percentage' ? '-' + pr.value + '%' : pr.type === 'amount' ? '-' + peso(pr.value) : 'BUNDLE'}</div>
        </div>
      `).join('');
    },
    filteredProducts() {
      const q = $('#pubSearch')?.value.toLowerCase() || '';
      const cat = $('#pubCategory')?.value || '';
      return state.products.filter(p => p.isActive && (!cat || p.category === cat) && (!q || (p.name + ' ' + p.sku + ' ' + p.category).toLowerCase().includes(q)));
    },
    go(page) {
      $$('.ppage').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
      $$('.plink').forEach(b => b.classList.toggle('active', b.dataset.page === page));
      window.scrollTo(0, 0);
    },
    bind() {
      $$('.plink').forEach(b => b.addEventListener('click', () => this.go(b.dataset.page)));
      $('#pubSearch')?.addEventListener('input', () => this.renderGrids());
      $('#pubCategory')?.addEventListener('change', () => this.renderGrids());
      $('#contactForm').addEventListener('submit', (e) => {
        e.preventDefault();
        toast('Inquiry sent!', 'ok');
        e.target.reset();
      });
    }
  };

  /* ============================================================
     LOGIN / LOGOUT
     ============================================================ */
  function bindLogin() {
    $('#openLogin').addEventListener('click', () => {
      $('#loginModal').hidden = false;
      $('#loginError').hidden = true;
      $('#loginEmail').value = '';
      $('#loginPass').value = '';
    });
    $('#closeLogin').addEventListener('click', () => { $('#loginModal').hidden = true; });
    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#loginEmail').value.trim();
      const pass = $('#loginPass').value;
      const r = login(email, pass);
      if (!r.ok) { const el = $('#loginError'); el.textContent = r.error; el.hidden = false; return; }
      $('#loginModal').hidden = true;
      enterAdmin();
    });
  }

  function enterAdmin() {
  $('#showroom').hidden = true;
  $('#app').hidden = false;
  $('#sbUserName').textContent = session.name;
  $('#sbUserRole').textContent = ROLE_LABELS[session.role];
  $('#sbAvatar').textContent = session.name.charAt(0).toUpperCase();
  $('#sbRoleLabel').textContent = ROLE_LABELS[session.role];
  currentPage = can('dashboard') ? 'dashboard' : (NAV.find(n => can(n.module))?.module || 'dashboard');
  renderNav(); renderPage(); updateDate();
  updateNotifDot();
  // Stock alert popup — ONLY for Admin and Inventory Staff
  if (session.role === 'admin' || session.role === 'inventory') {
    setTimeout(() => showStockAlertPopup(), 400);
  }
}
  function updateDate() {
    const d = new Date();
    $('#tbDate').textContent = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function bindAdmin() {
    $('#btnLogout').addEventListener('click', () => { if (confirm('Sign out?')) logout(); });
    $('#toggleSidebar').addEventListener('click', () => {
      if (window.innerWidth < 900) $('#sidebar').classList.toggle('open');
      else $('#sidebar').classList.toggle('collapsed');
    });
    const notifBtn = $('#notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', () => {
      const list = notificationsFor(session.role);
      list.forEach(n => n.read = true);
      save();
      updateNotifDot();
      if (!list.length) { toast('No notifications.'); return; }
      const modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-head"><h3>Notifications</h3><button data-close>✕</button></div>
          <div class="modal-body">
            ${list.slice(0, 50).map(n => `<div class="stock-alert-item"><div><div class="a-name">${esc(n.message)}</div><div class="a-sku">${fmtDateTime(n.date)}</div></div></div>`).join('') || '<p class="muted">No notifications.</p>'}
          </div>
          <div class="modal-foot"><button class="btn btn-primary" data-close>Close</button></div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => modal.remove()));
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    load();
    loadScanSession();
    Showroom.init();
    bindLogin();
    bindAdmin();
    bindPasswordToggles();
    setupGlobalSearch();

    restoreSession();
    if (session && state.users.find(u => u.id === session.userId)?.active) {
      enterAdmin();
    }
    window.addEventListener('beforeunload', () => saveScanSession());
  }

  document.addEventListener('DOMContentLoaded', init);
  window.Showroom = Showroom;
})();