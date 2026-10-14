/**
 * Salon Portal Application Engine
 * Booking & Slot Management Engine (/portal/bookings and /portal/schedule)
 *
 * Implements:
 * 1. Day / Week / Timeline calendar views
 * 2. Slot Statuses: CONFIRMED, ARRIVED, IN_SERVICE, COMPLETED, CANCELLED, NO_SHOW, WALK_IN_RESERVED, BLOCKED
 * 3. Role-Based Permissions & Filtering:
 *    - Salon Owner: All staff filter, Reassign barber, Cancel with reason, Block slot, Walk-In
 *    - Salon Staff: Locked to own chair, Quick Walk-in, Status update (Arrived, In-Service, Completed, No-Show)
 * 4. Concurrency conflict checks & Optimistic UI updates with rollback on error
 */

import { Store } from "./store.js";
import { TenantContext } from "./tenant-context.js";
import { PortalAnalytics } from "./portal-analytics.js";

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = String(dateStr).trim().split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
}

function addDaysToDateStr(dateStr, days) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

function extractBookingDate(slotStart) {
  if (!slotStart) return "";
  const s = String(slotStart).trim();
  const raw = s.includes("T") ? s.split("T")[0] : s.split(" ")[0];
  return raw.trim();
}

function extractBookingHour(slotStart) {
  if (!slotStart) return "";
  const s = String(slotStart).trim();
  const timePart = s.includes("T") ? s.split("T")[1] : s.split(" ")[1];
  if (!timePart) return "";
  const hourPart = timePart.split(":")[0];
  return hourPart.padStart(2, "0");
}

const STATE = {
  activeView: "bookings", // "bookings", "schedule", "staff", "services", "settings", "profile"
  calendarMode: "DAY", // "DAY", "WEEK", "TIMELINE"
  selectedDate: getLocalDateString(new Date()),
  barberFilter: "ALL", // "ALL" or specific barberId
  statusFilter: "ALL",
  bookings: [],
  staffList: [],
  servicesList: [],
  loading: false
};

document.addEventListener("DOMContentLoaded", async () => {
  const context = await TenantContext.init();

  if (!context || !context.user) {
    window.location.href = "../login.html?redirect_to=" + encodeURIComponent(window.location.href);
    return;
  }

  // Preload staff and services in background
  preloadTenantMetadata();

  initHeader(context);
  initSidebar(context);
  initRouting(context);
  initModals(context);

  window.addEventListener("hashchange", () => {
    handleRoute(context);
  });
});

async function preloadTenantMetadata() {
  try {
    if (TenantContext.isOwner()) {
      const staffRes = await TenantContext.tenantFetch("http://localhost:8080/api/portal/staff");
      if (staffRes.ok) STATE.staffList = await staffRes.json();
    }
  } catch (err) {
    console.warn("Could not load staff list:", err);
  }

  try {
    const srvRes = await TenantContext.tenantFetch("http://localhost:8080/api/portal/services");
    if (srvRes.ok) STATE.servicesList = await srvRes.json();
  } catch (err) {
    console.warn("Could not load services list:", err);
  }

  // Ensure default staff fallback if empty
  if (!STATE.staffList || STATE.staffList.length === 0) {
    STATE.staffList = [
      { id: 26, name: "Master Barber Ahmed", rating: 4.9 },
      { id: 27, name: "Sami Al-Otaibi", rating: 4.8 }
    ];
  }
  if (!STATE.servicesList || STATE.servicesList.length === 0) {
    STATE.servicesList = [
      { id: 1, name: "Royal Haircut & Hot Towel", durationMinutes: 30, price: 60 },
      { id: 2, name: "Beard Sculpting & Razor Line", durationMinutes: 25, price: 40 },
      { id: 3, name: "Charcoal Face Mask Detox", durationMinutes: 20, price: 35 }
    ];
  }
}

/* =========================================================================
 * 1. COMMON HEADER INITIALIZATION
 * ========================================================================= */
function initHeader(context) {
  const user = context.user;
  const shop = context.shop || {
    name: "Golden Scissors Salon",
    branch: "Olaya, Riyadh"
  };

  const nameEl = document.getElementById("header-salon-name");
  if (nameEl) nameEl.innerText = shop.name || user.salonName || "Salon Portal";

  const branchEl = document.getElementById("header-branch-text");
  if (branchEl) branchEl.innerText = shop.branch || "Olaya, Riyadh";

  const roleEl = document.getElementById("header-role-text");
  const iconEl = document.getElementById("header-role-icon");
  const badgeEl = document.getElementById("header-role-badge");

  if (TenantContext.isOwner()) {
    if (roleEl) roleEl.innerText = "SALON_OWNER";
    if (iconEl) iconEl.innerText = "👑";
    if (badgeEl) badgeEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30";
  } else if (TenantContext.isStaff()) {
    if (roleEl) roleEl.innerText = "SALON_STAFF";
    if (iconEl) iconEl.innerText = "✂️";
    if (badgeEl) badgeEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/30";
  } else {
    if (roleEl) roleEl.innerText = user.role || "ADMIN";
    if (iconEl) iconEl.innerText = "🛡️";
  }

  const userNameEl = document.getElementById("header-user-name");
  if (userNameEl) userNameEl.innerText = user.fullName || "User";

  const userEmailEl = document.getElementById("header-user-email");
  if (userEmailEl) userEmailEl.innerText = user.email || "";

  const avatarEl = document.getElementById("header-user-avatar");
  if (avatarEl) {
    const initials = (user.fullName || "SO")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    avatarEl.innerText = initials;
  }

  updateShiftUI(TenantContext.getShiftStatus());
  const shiftBtn = document.getElementById("shift-toggle-btn");
  shiftBtn?.addEventListener("click", async () => {
    shiftBtn.disabled = true;
    const newStatus = await TenantContext.toggleShiftStatus();
    updateShiftUI(newStatus);
    showToast(`Staff shift updated to ${newStatus}`, "success");
    shiftBtn.disabled = false;
  });

  document.getElementById("header-signout-btn")?.addEventListener("click", () => {
    Store.logout();
    window.location.href = "../login.html";
  });

  document.getElementById("mobile-menu-toggle")?.addEventListener("click", () => {
    const sidebar = document.getElementById("portal-sidebar");
    sidebar?.classList.toggle("-translate-x-full");
  });
}

function updateShiftUI(status) {
  const dot = document.getElementById("shift-indicator-dot");
  const text = document.getElementById("shift-status-text");
  const btn = document.getElementById("shift-toggle-btn");

  if (!btn || !text || !dot) return;

  if (status === "ONLINE") {
    text.innerText = "Online";
    dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
    btn.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30";
  } else {
    text.innerText = "Offline";
    dot.className = "w-2 h-2 rounded-full bg-slate-500";
    btn.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700";
  }
}

/* =========================================================================
 * 2. DYNAMIC SIDEBAR MENU BY ROLE
 * ========================================================================= */
function initSidebar(context) {
  const isOwner = TenantContext.isOwner();
  const isStaff = TenantContext.isStaff();
  const navContainer = document.getElementById("portal-nav-menu");
  const captionEl = document.getElementById("sidebar-role-caption");
  const salonIdBadge = document.getElementById("sidebar-salon-id-badge");
  const scopeBadge = document.getElementById("sidebar-scope-badge");

  if (salonIdBadge) salonIdBadge.innerText = `#${TenantContext.getSalonId() || "29"}`;
  if (scopeBadge) {
    scopeBadge.innerText = isStaff ? `Staff Scoped (#${TenantContext.getStaffId() || "26"})` : "Tenant Unrestricted";
    scopeBadge.className = isStaff ? "text-sky-400 font-bold" : "text-amber-400 font-bold";
  }

  if (captionEl) {
    captionEl.innerText = isOwner ? "Salon Management Portal" : "Barber Personal Console";
  }

  let navItems = [];

  if (isOwner) {
    navItems = [
      { id: "dashboard", label: "Revenue & Analytics", icon: "📊", sub: "Daily, weekly & monthly metrics", href: "#dashboard" },
      { id: "bookings", label: "Calendar / Bookings", icon: "📅", sub: "Manage all salon appointments", href: "#bookings" },
      { id: "staff", label: "Staff Management", icon: "👥", sub: "Barbers, shifts & working hours", href: "staff/index.html" },
      { id: "services", label: "Services & Pricing", icon: "✂️", sub: "Service catalogue and durations", href: "services/index.html" },
      { id: "settings", label: "Salon Profile & Settings", icon: "⚙️", sub: "Location, address & QR codes", href: "settings/index.html" }
    ];
  } else if (isStaff) {
    navItems = [
      { id: "schedule", label: "My Schedule / Bookings", icon: "📅", sub: "My assigned appointments", href: "#schedule" },
      { id: "profile", label: "Profile & Working Hours", icon: "👤", sub: "Shift schedule and credentials", href: "#profile" }
    ];
  }

  if (navContainer) {
    navContainer.innerHTML = navItems
      .map((item) => `
        <a href="${item.href}" data-view="${item.id}" class="portal-nav-link flex items-center gap-3 px-3.5 py-3 rounded-2xl transition group text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800">
          <span class="text-lg group-hover:scale-110 transition-transform">${item.icon}</span>
          <div class="min-w-0">
            <span class="text-xs font-extrabold tracking-tight block text-slate-200 group-hover:text-amber-400">${item.label}</span>
            <span class="text-[10px] text-slate-500 block truncate">${item.sub}</span>
          </div>
        </a>
      `)
      .join("");
  }
}

/* =========================================================================
 * 3. ROUTING & ACCESS GUARD
 * ========================================================================= */
function initRouting(context) {
  handleRoute(context);
}

function handleRoute(context) {
  const isOwner = TenantContext.isOwner();
  const isStaff = TenantContext.isStaff();

  let defaultHash = isStaff ? "schedule" : "bookings";
  let hash = window.location.hash.replace("#", "") || defaultHash;

  // Intercept Staff attempting to view Owner modules
  if (isStaff && (hash === "staff" || hash === "services" || hash === "settings" || hash === "bookings" || hash === "dashboard" || hash === "analytics")) {
    showToast(`Access Denied: You do not have permission to access '${hash}'.`, "error");
    window.location.hash = "schedule";
    return;
  }

  // Intercept Owner on staff schedule route
  if (isOwner && hash === "schedule") {
    window.location.hash = "bookings";
    return;
  }

  // Intercept Owner navigating to dedicated modules
  if (isOwner && hash === "staff") {
    window.location.href = "staff/index.html";
    return;
  }
  if (isOwner && hash === "services") {
    window.location.href = "services/index.html";
    return;
  }
  if (isOwner && hash === "settings") {
    window.location.href = "settings/index.html";
    return;
  }

  STATE.activeView = hash;

  // Update active sidebar state
  document.querySelectorAll(".portal-nav-link").forEach((link) => {
    const linkView = link.getAttribute("data-view");
    if (linkView === hash) {
      link.className = `portal-nav-link flex items-center gap-3 px-3.5 py-3 rounded-2xl transition group border ${
        isStaff
          ? "bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-lg shadow-sky-500/20"
          : "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20"
      }`;
      const title = link.querySelector("span.text-xs");
      if (title) title.className = "text-xs font-black tracking-tight block text-slate-950";
      const sub = link.querySelector("span.text-\\[10px\\]");
      if (sub) sub.className = "text-[10px] text-slate-900 block truncate opacity-80";
    } else {
      link.className =
        "portal-nav-link flex items-center gap-3 px-3.5 py-3 rounded-2xl transition group text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800";
      const title = link.querySelector("span.text-xs");
      if (title) title.className = "text-xs font-extrabold tracking-tight block text-slate-200 group-hover:text-amber-400";
      const sub = link.querySelector("span.text-\\[10px\\]");
      if (sub) sub.className = "text-[10px] text-slate-500 block truncate";
    }
  });

  renderActiveWorkspace(context);
}

/* =========================================================================
 * 4. WORKSPACE VIEWS
 * ========================================================================= */
async function renderActiveWorkspace(context) {
  const workspace = document.getElementById("portal-workspace");
  if (!workspace) return;

  const view = STATE.activeView;

  if (view === "dashboard" || view === "analytics") {
    await PortalAnalytics.render(workspace);
  } else if (view === "bookings" || view === "schedule") {
    await renderBookingEngineWorkspace(workspace, context);
  } else if (view === "staff") {
    await renderStaffView(workspace, context);
  } else if (view === "services") {
    await renderServicesView(workspace, context);
  } else if (view === "settings") {
    renderSettingsView(workspace, context);
  } else if (view === "profile") {
    renderProfileView(workspace, context);
  } else {
    workspace.innerHTML = `<div class="p-8 text-center text-slate-500">View not found.</div>`;
  }
}

/* =========================================================================
 * 4.1 BOOKING & SLOT MANAGEMENT ENGINE WORKSPACE
 * ========================================================================= */
async function renderBookingEngineWorkspace(container, context) {
  const isStaff = TenantContext.isStaff();
  const isOwner = TenantContext.isOwner();
  const user = context.user;

  container.innerHTML = `
    <!-- Top Control Bar: Mode, Dates, Filters, Actions -->
    <div class="bg-slate-900/90 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-xl space-y-5">
      <!-- Title & Role Badge -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5">
            <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight">
              ${isStaff ? "My Booking Schedule" : "Salon Calendar & Appointments"}
            </h2>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              isStaff ? "bg-sky-500/10 text-sky-400 border border-sky-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
            }">
              ${isStaff ? "STAFF SCOPED" : "ALL BARBERS"}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            ${isStaff ? "Real-time personal chair appointments and walk-in queue." : "Multi-chair schedule, reassignments, slot blocking, and walk-in management."}
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 flex-wrap">
          ${
            isOwner
              ? `
            <button id="open-block-btn" class="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-2xl transition flex items-center gap-2">
              <span>⛔</span>
              <span>Block Slot</span>
            </button>
          `
              : ""
          }
          <button id="open-walkin-btn" class="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2">
            <span>✂️</span>
            <span>+ Quick Walk-In</span>
          </button>
        </div>
      </div>

      <!-- Controls Row: Calendar Mode Switch + Date Navigation + Staff/Status Filters -->
      <div class="pt-4 border-t border-slate-800/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <!-- View Mode Switch: Day / Week / Timeline -->
        <div class="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
          <button class="cal-mode-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
            STATE.calendarMode === "DAY" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
          }" data-mode="DAY">
            ☀️ Day
          </button>
          <button class="cal-mode-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
            STATE.calendarMode === "WEEK" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
          }" data-mode="WEEK">
            📅 Week
          </button>
          <button class="cal-mode-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
            STATE.calendarMode === "TIMELINE" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
          }" data-mode="TIMELINE">
            ⏱️ Timeline
          </button>
        </div>

        <!-- Date Navigation -->
        <div class="flex items-center gap-2 shrink-0">
          <button id="cal-prev-date-btn" class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-xs" title="Previous Date">‹</button>
          <input type="date" id="cal-date-picker" value="${STATE.selectedDate}" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400" />
          <button id="cal-today-btn" class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-amber-400 hover:bg-slate-800 transition">Today</button>
          <button id="cal-next-date-btn" class="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-xs" title="Next Date">›</button>
        </div>

        <!-- Role Filters: Staff Filter (Owner) / Status Filter -->
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Staff Filter: Disabled/Hidden for Staff -->
          ${
            isOwner
              ? `
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] text-slate-400 hidden sm:inline">Staff:</span>
              <select id="cal-barber-filter" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400">
                <option value="ALL" ${STATE.barberFilter === "ALL" ? "selected" : ""}>All Barbers</option>
                ${STATE.staffList
                  .map(
                    (b) =>
                      `<option value="${b.id}" ${String(STATE.barberFilter) === String(b.id) ? "selected" : ""}>${b.name}</option>`
                  )
                  .join("")}
              </select>
            </div>
          `
              : `
            <div class="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-sky-300">
              <span>🔒 Chair:</span>
              <span class="font-bold font-mono">${user.fullName}</span>
            </div>
          `
          }

          <!-- Status Filter -->
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-slate-400 hidden sm:inline">Status:</span>
            <select id="cal-status-filter" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400">
              <option value="ALL" ${STATE.statusFilter === "ALL" ? "selected" : ""}>All Statuses</option>
              <option value="CONFIRMED" ${STATE.statusFilter === "CONFIRMED" ? "selected" : ""}>Confirmed</option>
              <option value="ARRIVED" ${STATE.statusFilter === "ARRIVED" ? "selected" : ""}>Arrived</option>
              <option value="IN_SERVICE" ${STATE.statusFilter === "IN_SERVICE" ? "selected" : ""}>In-Service</option>
              <option value="COMPLETED" ${STATE.statusFilter === "COMPLETED" ? "selected" : ""}>Completed</option>
              <option value="CANCELLED" ${STATE.statusFilter === "CANCELLED" ? "selected" : ""}>Cancelled</option>
              <option value="NO_SHOW" ${STATE.statusFilter === "NO_SHOW" ? "selected" : ""}>No-Show</option>
              <option value="WALK_IN_RESERVED" ${STATE.statusFilter === "WALK_IN_RESERVED" ? "selected" : ""}>Walk-In</option>
              <option value="BLOCKED" ${STATE.statusFilter === "BLOCKED" ? "selected" : ""}>Blocked</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Staff Scope Warning Banner if Staff -->
    ${
      isStaff
        ? `
      <div class="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs flex items-center justify-between gap-3 shadow-md">
        <div class="flex items-center gap-3">
          <span class="text-xl">🔒</span>
          <div>
            <strong>Staff Scope Restriction Active:</strong> You are viewing appointments strictly assigned to <span class="text-white font-mono font-bold">${user.fullName}</span> (Barber Chair #${TenantContext.getStaffId() || "26"}). Peer schedules and salon administrative settings are isolated.
          </div>
        </div>
        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 font-bold shrink-0">LOCKED</span>
      </div>
    `
        : ""
    }

    <!-- Dynamic Calendar Canvas Container -->
    <div id="calendar-canvas-container" class="space-y-4">
      <div class="p-12 text-center text-slate-400 bg-slate-900/60 rounded-3xl border border-slate-800">
        <div class="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs">Synchronizing appointments and chair schedule...</p>
      </div>
    </div>
  `;

  // Attach control listeners
  container.querySelectorAll(".cal-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      STATE.calendarMode = btn.getAttribute("data-mode");
      renderBookingEngineWorkspace(container, context);
    });
  });

  const datePicker = document.getElementById("cal-date-picker");
  datePicker?.addEventListener("change", (e) => {
    STATE.selectedDate = e.target.value;
    loadAndRenderCalendarData();
  });

  document.getElementById("cal-today-btn")?.addEventListener("click", () => {
    STATE.selectedDate = getLocalDateString(new Date());
    if (datePicker) datePicker.value = STATE.selectedDate;
    loadAndRenderCalendarData();
  });

  document.getElementById("cal-prev-date-btn")?.addEventListener("click", () => {
    const step = STATE.calendarMode === "WEEK" ? -7 : -1;
    STATE.selectedDate = addDaysToDateStr(STATE.selectedDate, step);
    if (datePicker) datePicker.value = STATE.selectedDate;
    loadAndRenderCalendarData();
  });

  document.getElementById("cal-next-date-btn")?.addEventListener("click", () => {
    const step = STATE.calendarMode === "WEEK" ? 7 : 1;
    STATE.selectedDate = addDaysToDateStr(STATE.selectedDate, step);
    if (datePicker) datePicker.value = STATE.selectedDate;
    loadAndRenderCalendarData();
  });

  document.getElementById("cal-barber-filter")?.addEventListener("change", (e) => {
    STATE.barberFilter = e.target.value;
    loadAndRenderCalendarData();
  });

  document.getElementById("cal-status-filter")?.addEventListener("change", (e) => {
    STATE.statusFilter = e.target.value;
    loadAndRenderCalendarData();
  });

  document.getElementById("open-walkin-btn")?.addEventListener("click", () => {
    openWalkinModal(context);
  });

  document.getElementById("open-block-btn")?.addEventListener("click", () => {
    openBlockModal(context);
  });

  await loadAndRenderCalendarData();
}

/* =========================================================================
 * 4.2 LOAD BOOKINGS & DISPATCH TO CALENDAR VIEWS
 * ========================================================================= */
async function loadAndRenderCalendarData() {
  const container = document.getElementById("calendar-canvas-container");
  if (!container) return;

  try {
    let url = "/api/portal/bookings";
    const params = [];

    if (TenantContext.isOwner() && STATE.barberFilter !== "ALL") {
      params.push(`barberId=${encodeURIComponent(STATE.barberFilter)}`);
    }

    // Query based on visible date range
    let startDate, endDate;
    if (STATE.calendarMode === "WEEK") {
      startDate = STATE.selectedDate;
      endDate = addDaysToDateStr(STATE.selectedDate, 6);
    } else {
      // For Day or Timeline view, fetch a sensible surrounding window
      startDate = addDaysToDateStr(STATE.selectedDate, -7);
      endDate = addDaysToDateStr(STATE.selectedDate, 30);
    }

    if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
    if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);

    if (params.length > 0) {
      url += `?${params.join("&")}`;
    }

    const res = await TenantContext.tenantFetch(url);
    if (res.ok) {
      STATE.bookings = await res.json();
    } else {
      console.warn("REST Bookings fetch returned status:", res.status);
      STATE.bookings = [];
    }
  } catch (err) {
    console.warn("REST Bookings fetch failed, showing real empty state:", err);
    STATE.bookings = [];
  }

  // Filter staff appointments
  let filtered = STATE.bookings || [];
  if (TenantContext.isStaff()) {
    const staffId = TenantContext.getStaffId();
    const staffName = (TenantContext.getCurrentUser()?.fullName || "").toLowerCase();
    filtered = filtered.filter((b) => {
      if (staffId && b.barberId) return String(b.barberId) === String(staffId);
      if (b.barberName) return b.barberName.toLowerCase().includes(staffName) || staffName.includes(b.barberName.toLowerCase());
      return true;
    });
  } else if (STATE.barberFilter !== "ALL") {
    filtered = filtered.filter((b) => String(b.barberId) === String(STATE.barberFilter));
  }

  if (STATE.statusFilter !== "ALL") {
    filtered = filtered.filter((b) => b.status === STATE.statusFilter);
  }

  if (STATE.calendarMode === "DAY") {
    renderDayCalendarView(container, filtered);
  } else if (STATE.calendarMode === "WEEK") {
    renderWeekCalendarView(container, filtered);
  } else if (STATE.calendarMode === "TIMELINE") {
    renderTimelineCalendarView(container, filtered);
  }
}

/* =========================================================================
 * 4.3 DAY CALENDAR VIEW
 * ========================================================================= */
function renderDayCalendarView(container, bookings) {
  const isOwner = TenantContext.isOwner();
  const isStaff = TenantContext.isStaff();
  const targetDateStr = STATE.selectedDate;

  // Filter bookings for this day using exact date extraction
  const dayBookings = bookings.filter((b) => extractBookingDate(b.slotStart) === targetDateStr);

  const hours = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

  // If Owner with "ALL" barbers, show side-by-side columns
  const activeBarbers = isStaff
    ? [{ id: TenantContext.getStaffId(), name: TenantContext.getCurrentUser()?.fullName || "My Chair" }]
    : STATE.barberFilter === "ALL"
    ? STATE.staffList
    : STATE.staffList.filter((b) => String(b.id) === String(STATE.barberFilter));

  container.innerHTML = `
    <div class="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-white">Daily Schedule:</span>
          <span class="font-mono text-xs text-amber-400 font-bold px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800">${targetDateStr}</span>
        </div>
        <span class="text-xs text-slate-400 font-mono">${dayBookings.length} Appointment(s)</span>
      </div>

      ${
        dayBookings.length === 0
          ? `
        <div class="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-xs text-slate-400">
          <div class="flex items-center gap-2">
            <span class="text-amber-400">ℹ️</span>
            <span>No appointments scheduled for this date.</span>
          </div>
          <span class="text-[11px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">All Chairs Open</span>
        </div>
      `
          : ""
      }

      <!-- Multi-Barber Day Grid -->
      <div class="grid grid-cols-1 ${activeBarbers.length > 1 ? "md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"} gap-6">
        ${activeBarbers
          .map((barber) => {
            const barberBookings = dayBookings.filter(
              (b) => String(b.barberId) === String(barber.id) || !b.barberId
            );

            return `
            <div class="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-inner">
              <!-- Barber Header -->
              <div class="flex items-center justify-between pb-2 border-b border-slate-800">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center justify-center text-sm font-bold">
                    💈
                  </div>
                  <div>
                    <h4 class="text-xs font-black text-white">${barber.name}</h4>
                    <span class="text-[10px] text-slate-500 font-mono">Chair #${barber.id}</span>
                  </div>
                </div>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                  ${barberBookings.length} slots
                </span>
              </div>

              <!-- Hourly Slot Stack -->
              <div class="space-y-2.5">
                ${hours
                  .map((hour) => {
                    const targetHour = hour.split(":")[0];
                    const match = barberBookings.find((b) => {
                      return extractBookingHour(b.slotStart) === targetHour;
                    });

                    if (match) {
                      return renderAppointmentSlotCard(match);
                    } else {
                      return `
                        <div class="flex items-center justify-between p-2.5 rounded-xl border border-dashed border-slate-800/70 bg-slate-900/30 hover:border-slate-700 transition group text-xs">
                          <span class="font-mono text-slate-500 text-[11px] font-bold">${hour}</span>
                          <span class="text-[10px] text-slate-600">Available Chair</span>
                          <button class="quick-slot-book-btn opacity-60 group-hover:opacity-100 px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold transition"
                                  data-barber-id="${barber.id}"
                                  data-time="${hour}">
                            + Walk-In
                          </button>
                        </div>
                      `;
                    }
                  })
                  .join("")}
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;

  // Attach quick slot listeners
  container.querySelectorAll(".quick-slot-book-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const bId = btn.getAttribute("data-barber-id");
      const time = btn.getAttribute("data-time");
      openWalkinModal(TenantContext.getContext(), bId, time);
    });
  });

  attachAppointmentActionListeners(container);
}

/* =========================================================================
 * 4.4 WEEK CALENDAR VIEW
 * ========================================================================= */
function renderWeekCalendarView(container, bookings) {
  // Generate 7 days in local timezone
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const curDateStr = addDaysToDateStr(STATE.selectedDate, i);
    const d = parseLocalDate(curDateStr);
    weekDays.push({
      dateStr: curDateStr,
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      displayDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    });
  }

  container.innerHTML = `
    <div class="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <span class="text-sm font-bold text-white">7-Day Schedule Overview</span>
        <span class="text-xs text-slate-400 font-mono">${weekDays[0].displayDate} — ${weekDays[6].displayDate}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
        ${weekDays
          .map((day) => {
            const dayBookings = bookings.filter((b) => extractBookingDate(b.slotStart) === day.dateStr);
            const isSelected = day.dateStr === STATE.selectedDate;

            return `
            <div class="bg-slate-950/60 rounded-2xl border ${isSelected ? "border-amber-500/50" : "border-slate-800"} p-3 space-y-2.5 flex flex-col justify-start min-h-[260px]">
              <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div>
                  <span class="text-[11px] font-black text-white block uppercase tracking-wider">${day.dayName}</span>
                  <span class="text-[10px] text-slate-400 font-mono">${day.displayDate}</span>
                </div>
                <span class="w-5 h-5 rounded-full bg-slate-900 text-slate-300 text-[10px] font-mono font-bold flex items-center justify-center border border-slate-800">
                  ${dayBookings.length}
                </span>
              </div>

              <!-- Day Appointments Stack -->
              <div class="space-y-2 flex-1">
                ${
                  dayBookings.length === 0
                    ? `<div class="py-10 text-center text-[10px] text-slate-500 font-medium">No appointments scheduled</div>`
                    : dayBookings
                        .map((b) => renderMiniSlotBadge(b))
                        .join("")
                }
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;

  attachAppointmentActionListeners(container);
}

/* =========================================================================
 * 4.5 TIMELINE CALENDAR VIEW
 * ========================================================================= */
function renderTimelineCalendarView(container, bookings) {
  const targetDateStr = STATE.selectedDate;
  const dayBookings = bookings.filter((b) => extractBookingDate(b.slotStart) === targetDateStr);

  const hours = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
  ];

  const barbers = TenantContext.isStaff()
    ? [{ id: TenantContext.getStaffId(), name: TenantContext.getCurrentUser()?.fullName || "My Chair" }]
    : STATE.staffList;

  container.innerHTML = `
    <div class="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4 overflow-x-auto">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800 min-w-[800px]">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-white">Gantt Timeline Schedule:</span>
          <span class="font-mono text-xs text-amber-400 font-bold px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800">${targetDateStr}</span>
        </div>
        <span class="text-xs text-slate-400 font-mono">09:00 AM — 10:00 PM (Riyadh Time)</span>
      </div>

      <!-- Timeline Track -->
      <div class="min-w-[900px] space-y-4">
        <!-- Header Hours Axis -->
        <div class="gap-1.5 text-[10px] font-mono font-bold text-slate-400 border-b border-slate-800 pb-2" style="display: grid; grid-template-columns: 100px repeat(13, minmax(65px, 1fr));">
          <div class="text-slate-500 font-bold">STAFF CHAIR</div>
          ${hours.map((h) => `<div class="text-center">${h}</div>`).join("")}
        </div>

        <!-- Barber Rows -->
        ${barbers
          .map((barber) => {
            const barberBookings = dayBookings.filter((b) => String(b.barberId) === String(barber.id) || !b.barberId);

            return `
            <div class="gap-1.5 items-center bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800/80" style="display: grid; grid-template-columns: 100px repeat(13, minmax(65px, 1fr));">
              <div class="text-xs font-bold text-white truncate pr-2 flex items-center gap-1.5">
                <span>💈</span>
                <span class="truncate">${barber.name.split(" ")[0]}</span>
              </div>

              ${hours
                .map((hour) => {
                  const targetHour = hour.split(":")[0];
                  const match = barberBookings.find((b) => {
                    return extractBookingHour(b.slotStart) === targetHour;
                  });

                  if (match) {
                    return `
                      <div class="col-span-1 p-1">
                        ${renderMiniSlotBadge(match, true)}
                      </div>
                    `;
                  } else {
                    return `
                      <div class="col-span-1 h-9 rounded-lg border border-dashed border-slate-800/60 flex items-center justify-center text-[9px] text-slate-700 hover:border-slate-600 transition cursor-pointer"
                           onclick="window.quickBookSlot('${barber.id}', '${hour}')">
                        +
                      </div>
                    `;
                  }
                })
                .join("")}
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;

  window.quickBookSlot = (barberId, time) => {
    openWalkinModal(TenantContext.getContext(), barberId, time);
  };

  attachAppointmentActionListeners(container);
}

/* =========================================================================
 * 4.6 SLOT STATUS BADGE & CARD HELPERS
 * ========================================================================= */
function getStatusBadgeConfig(status) {
  switch (status) {
    case "CONFIRMED":
      return {
        label: "CONFIRMED",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
        icon: "✓"
      };
    case "ARRIVED":
      return {
        label: "ARRIVED",
        badgeClass: "bg-sky-500/10 text-sky-400 border border-sky-500/30",
        icon: "📍"
      };
    case "IN_SERVICE":
      return {
        label: "IN-SERVICE",
        badgeClass: "bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse",
        icon: "✂️"
      };
    case "COMPLETED":
      return {
        label: "COMPLETED",
        badgeClass: "bg-slate-800 text-slate-400 border border-slate-700",
        icon: "✅"
      };
    case "CANCELLED":
      return {
        label: "CANCELLED",
        badgeClass: "bg-red-500/10 text-red-400 border border-red-500/30 line-through",
        icon: "✕"
      };
    case "NO_SHOW":
      return {
        label: "NO-SHOW",
        badgeClass: "bg-orange-500/10 text-orange-400 border border-orange-500/30",
        icon: "🚫"
      };
    case "WALK_IN_RESERVED":
      return {
        label: "WALK-IN",
        badgeClass: "bg-purple-500/10 text-purple-300 border border-purple-500/30",
        icon: "🚶"
      };
    case "BLOCKED":
      return {
        label: "BLOCKED",
        badgeClass: "bg-rose-950/40 text-rose-300 border border-rose-800/40 border-dashed",
        icon: "⛔"
      };
    default:
      return {
        label: status || "SCHEDULED",
        badgeClass: "bg-slate-800 text-slate-300 border border-slate-700",
        icon: "•"
      };
  }
}

function renderAppointmentSlotCard(booking) {
  const isOwner = TenantContext.isOwner();
  const isStaff = TenantContext.isStaff();
  const cfg = getStatusBadgeConfig(booking.status);

  const timeStart = booking.slotStart
    ? new Date(booking.slotStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "14:00";
  const timeEnd = booking.slotEnd
    ? new Date(booking.slotEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "14:30";

  const isBlocked = booking.status === "BLOCKED";

  return `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-md hover:border-slate-700 transition">
      <!-- Card Top: Time, Status Badge & SAR Price -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono text-xs font-black shrink-0">
            ${timeStart} – ${timeEnd}
          </span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${cfg.badgeClass} flex items-center gap-1">
            <span>${cfg.icon}</span>
            <span>${cfg.label}</span>
          </span>
        </div>

        ${
          !isBlocked
            ? `<span class="text-xs font-black text-amber-400 font-mono shrink-0">${booking.servicePrice || 50} SAR</span>`
            : `<span class="text-[10px] text-rose-400 font-mono font-bold">RESERVED</span>`
        }
      </div>

      <!-- Card Middle: Customer & Service Info -->
      <div class="text-xs">
        <div class="font-extrabold text-white flex items-center gap-1.5">
          <span>${isBlocked ? "⛔ " + (booking.notes || "Salon Break / Maintenance") : "👤 " + (booking.customerName || "Customer")}</span>
        </div>
        ${
          !isBlocked
            ? `
          <div class="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
            <span>✂️ ${booking.serviceName || "Haircut"}</span>
            <span>•</span>
            <span class="font-mono text-slate-300">📞 ${booking.customerPhone || "05XXXXXXXX"}</span>
          </div>
        `
            : ""
        }
        ${
          booking.cancellationReason
            ? `<div class="mt-1 text-[10px] text-red-400 font-mono">Reason: ${booking.cancellationReason}</div>`
            : ""
        }
      </div>

      <!-- Card Actions: Role Based Action Bar -->
      <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs flex-wrap">
        <!-- Staff Status Actions -->
        ${
          isStaff && booking.status !== "COMPLETED" && booking.status !== "CANCELLED"
            ? `
          <div class="flex items-center gap-1.5 flex-wrap">
            ${
              booking.status !== "ARRIVED" && booking.status !== "IN_SERVICE"
                ? `<button class="app-status-btn px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/30" data-id="${booking.id}" data-status="ARRIVED">📍 Arrived</button>`
                : ""
            }
            ${
              booking.status !== "IN_SERVICE"
                ? `<button class="app-status-btn px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30" data-id="${booking.id}" data-status="IN_SERVICE">✂️ In-Service</button>`
                : ""
            }
            <button class="app-status-btn px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30" data-id="${booking.id}" data-status="COMPLETED">✅ Completed</button>
            <button class="app-status-btn px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-[10px] font-bold border border-orange-500/30" data-id="${booking.id}" data-status="NO_SHOW">🚫 No-Show</button>
          </div>
        `
            : ""
        }

        <!-- Owner Direct Actions -->
        ${
          isOwner && booking.status !== "COMPLETED" && booking.status !== "CANCELLED"
            ? `
          <div class="flex items-center gap-2 flex-wrap">
            <button class="app-reassign-btn text-amber-400 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1" data-id="${booking.id}">
              <span>🔄</span>
              <span>Reassign</span>
            </button>
            <button class="app-status-btn text-emerald-400 hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1" data-id="${booking.id}" data-status="COMPLETED">
              <span>✅</span>
              <span>Complete</span>
            </button>
            <button class="app-cancel-btn text-red-400 hover:text-red-300 text-[11px] font-bold flex items-center gap-1" data-id="${booking.id}">
              <span>✕</span>
              <span>Cancel</span>
            </button>
          </div>
        `
            : ""
        }

        <span class="text-[10px] font-mono text-slate-500 ml-auto">#${booking.id}</span>
      </div>
    </div>
  `;
}

function renderMiniSlotBadge(booking, isTimeline = false) {
  const cfg = getStatusBadgeConfig(booking.status);
  const timeStart = booking.slotStart
    ? new Date(booking.slotStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "14:00";

  return `
    <div class="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] space-y-1 shadow-sm hover:border-slate-700 transition cursor-pointer"
         onclick="window.inspectBooking(${booking.id})">
      <div class="flex items-center justify-between gap-1">
        <span class="font-mono text-amber-400 font-bold">${timeStart}</span>
        <span class="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold ${cfg.badgeClass}">
          ${cfg.label}
        </span>
      </div>
      <div class="text-white font-bold truncate">
        ${booking.status === "BLOCKED" ? booking.notes || "Blocked" : booking.customerName || "Customer"}
      </div>
      ${!isTimeline ? `<div class="text-slate-400 truncate text-[9px]">${booking.serviceName || "Service"}</div>` : ""}
    </div>
  `;
}

/* =========================================================================
 * 5. ACTION LISTENERS WITH OPTIMISTIC UPDATES & ROLLBACK
 * ========================================================================= */
function attachAppointmentActionListeners(container) {
  // 1. Status Update Buttons (Staff & Owner)
  container.querySelectorAll(".app-status-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const bookingId = btn.getAttribute("data-id");
      const targetStatus = btn.getAttribute("data-status");
      await executeOptimisticStatusUpdate(bookingId, targetStatus);
    });
  });

  // 2. Cancel Buttons (Owner)
  container.querySelectorAll(".app-cancel-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const bookingId = btn.getAttribute("data-id");
      openCancelModal(bookingId);
    });
  });

  // 3. Reassign Buttons (Owner)
  container.querySelectorAll(".app-reassign-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const bookingId = btn.getAttribute("data-id");
      openReassignModal(bookingId);
    });
  });

  window.inspectBooking = (id) => {
    const booking = STATE.bookings.find((b) => String(b.id) === String(id));
    if (booking) {
      showToast(`Appointment #${booking.id}: ${booking.customerName} - ${booking.status}`);
    }
  };
}

/**
 * Optimistic Status Update with Rollback on error
 */
async function executeOptimisticStatusUpdate(bookingId, newStatus, cancellationReason = null) {
  const previousState = JSON.parse(JSON.stringify(STATE.bookings));

  // Optimistic mutation
  const booking = STATE.bookings.find((b) => String(b.id) === String(bookingId));
  if (booking) {
    booking.status = newStatus;
    if (cancellationReason) booking.cancellationReason = cancellationReason;
  }

  // Re-render immediately
  const container = document.getElementById("calendar-canvas-container");
  if (container) {
    if (STATE.calendarMode === "DAY") renderDayCalendarView(container, STATE.bookings);
    else if (STATE.calendarMode === "WEEK") renderWeekCalendarView(container, STATE.bookings);
    else renderTimelineCalendarView(container, STATE.bookings);
  }

  try {
    const payload = { status: newStatus };
    if (cancellationReason) payload.cancellationReason = cancellationReason;

    const res = await TenantContext.tenantFetch(
      `http://localhost:8080/api/portal/bookings/${bookingId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || "Failed to update booking status");
    }

    const updatedDTO = await res.json();
    const idx = STATE.bookings.findIndex((b) => String(b.id) === String(bookingId));
    if (idx !== -1) STATE.bookings[idx] = updatedDTO;

    showToast(`Appointment status updated to ${newStatus}`, "success");
  } catch (err) {
    console.error("Status update error, rolling back:", err);
    STATE.bookings = previousState;
    if (container) {
      if (STATE.calendarMode === "DAY") renderDayCalendarView(container, STATE.bookings);
      else if (STATE.calendarMode === "WEEK") renderWeekCalendarView(container, STATE.bookings);
      else renderTimelineCalendarView(container, STATE.bookings);
    }
    showToast(err.message || "Failed to update status", "error");
  }
}

/**
 * Optimistic Reassign with Rollback on conflict
 */
async function executeOptimisticReassign(bookingId, newBarberId) {
  const previousState = JSON.parse(JSON.stringify(STATE.bookings));
  const newBarber = STATE.staffList.find((b) => String(b.id) === String(newBarberId));

  // Optimistic update
  const booking = STATE.bookings.find((b) => String(b.id) === String(bookingId));
  if (booking && newBarber) {
    booking.barberId = newBarber.id;
    booking.barberName = newBarber.name;
  }

  const container = document.getElementById("calendar-canvas-container");
  if (container) {
    if (STATE.calendarMode === "DAY") renderDayCalendarView(container, STATE.bookings);
    else if (STATE.calendarMode === "WEEK") renderWeekCalendarView(container, STATE.bookings);
    else renderTimelineCalendarView(container, STATE.bookings);
  }

  try {
    const res = await TenantContext.tenantFetch(
      `http://localhost:8080/api/portal/bookings/${bookingId}/reassign`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newBarberId: Number(newBarberId) })
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || "Reassign conflict or error");
    }

    const updatedDTO = await res.json();
    const idx = STATE.bookings.findIndex((b) => String(b.id) === String(bookingId));
    if (idx !== -1) STATE.bookings[idx] = updatedDTO;

    showToast(`Appointment reassigned to ${newBarber?.name || "barber"}!`, "success");
  } catch (err) {
    console.error("Reassign error, rolling back:", err);
    STATE.bookings = previousState;
    if (container) {
      if (STATE.calendarMode === "DAY") renderDayCalendarView(container, STATE.bookings);
      else if (STATE.calendarMode === "WEEK") renderWeekCalendarView(container, STATE.bookings);
      else renderTimelineCalendarView(container, STATE.bookings);
    }
    showToast(err.message || "Cannot reassign booking", "error");
  }
}

/* =========================================================================
 * 6. MODALS SETUP (WALK-IN, CANCEL, REASSIGN, BLOCK)
 * ========================================================================= */
function initModals(context) {
  // 1. Walk-In Modal
  const walkinModal = document.getElementById("walkin-modal");
  document.getElementById("close-walkin-modal-btn")?.addEventListener("click", () => walkinModal?.classList.add("hidden"));
  document.getElementById("cancel-walkin-btn")?.addEventListener("click", () => walkinModal?.classList.add("hidden"));

  document.getElementById("walkin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("walkin-name")?.value;
    const phone = document.getElementById("walkin-phone")?.value;
    const barberId = document.getElementById("walkin-barber")?.value;
    const serviceId = document.getElementById("walkin-service")?.value;
    const date = document.getElementById("walkin-date")?.value;
    const time = document.getElementById("walkin-time")?.value;

    const slotStart = `${date}T${time}:00`;

    walkinModal?.classList.add("hidden");

    try {
      const res = await TenantContext.tenantFetch("http://localhost:8080/api/portal/bookings/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          barberId: Number(barberId),
          serviceId: Number(serviceId),
          slotStart: slotStart
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to create walk-in reservation");
      }

      const created = await res.json();
      STATE.bookings.push(created);
      showToast(`Walk-in booked for ${name} (${time})!`, "success");
      loadAndRenderCalendarData();
    } catch (err) {
      showToast(err.message || "Slot conflict or error", "error");
    }
  });

  // 2. Cancel Modal
  const cancelModal = document.getElementById("cancel-modal");
  document.getElementById("close-cancel-modal-btn")?.addEventListener("click", () => cancelModal?.classList.add("hidden"));
  document.getElementById("abort-cancel-btn")?.addEventListener("click", () => cancelModal?.classList.add("hidden"));

  document.getElementById("cancel-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bookingId = document.getElementById("cancel-booking-id")?.value;
    const reasonSelect = document.getElementById("cancel-reason-select")?.value;
    const notes = document.getElementById("cancel-notes")?.value;

    const fullReason = notes ? `${reasonSelect} - ${notes}` : reasonSelect;

    cancelModal?.classList.add("hidden");
    await executeOptimisticStatusUpdate(bookingId, "CANCELLED", fullReason);
  });

  // 3. Reassign Modal
  const reassignModal = document.getElementById("reassign-modal");
  document.getElementById("close-reassign-modal-btn")?.addEventListener("click", () => reassignModal?.classList.add("hidden"));
  document.getElementById("abort-reassign-btn")?.addEventListener("click", () => reassignModal?.classList.add("hidden"));

  document.getElementById("reassign-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bookingId = document.getElementById("reassign-booking-id")?.value;
    const newBarberId = document.getElementById("reassign-barber-select")?.value;

    reassignModal?.classList.add("hidden");
    await executeOptimisticReassign(bookingId, newBarberId);
  });

  // 4. Block Modal
  const blockModal = document.getElementById("block-modal");
  document.getElementById("close-block-modal-btn")?.addEventListener("click", () => blockModal?.classList.add("hidden"));
  document.getElementById("abort-block-btn")?.addEventListener("click", () => blockModal?.classList.add("hidden"));

  document.getElementById("block-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const barberId = document.getElementById("block-barber-select")?.value;
    const date = document.getElementById("block-date")?.value;
    const startTime = document.getElementById("block-start-time")?.value;
    const endTime = document.getElementById("block-end-time")?.value;
    const reason = document.getElementById("block-reason-select")?.value;

    blockModal?.classList.add("hidden");

    try {
      const res = await TenantContext.tenantFetch("http://localhost:8080/api/portal/bookings/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: Number(barberId),
          slotStart: `${date}T${startTime}:00`,
          slotEnd: `${date}T${endTime}:00`,
          reason: reason
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Cannot block slot");
      }

      const created = await res.json();
      STATE.bookings.push(created);
      showToast(`Slot blocked: ${reason}`, "success");
      loadAndRenderCalendarData();
    } catch (err) {
      showToast(err.message || "Conflict blocking slot", "error");
    }
  });
}

function openWalkinModal(context, preselectedBarberId = null, preselectedTime = null) {
  const modal = document.getElementById("walkin-modal");
  if (!modal) return;

  const barberSelect = document.getElementById("walkin-barber");
  const serviceSelect = document.getElementById("walkin-service");
  const dateInput = document.getElementById("walkin-date");
  const timeInput = document.getElementById("walkin-time");

  if (dateInput) dateInput.value = STATE.selectedDate;
  if (timeInput && preselectedTime) timeInput.value = preselectedTime;

  if (barberSelect) {
    if (TenantContext.isStaff()) {
      barberSelect.innerHTML = `<option value="${TenantContext.getStaffId()}">${context.user.fullName} (Your Chair)</option>`;
      barberSelect.disabled = true;
    } else {
      barberSelect.disabled = false;
      barberSelect.innerHTML = STATE.staffList
        .map(
          (b) =>
            `<option value="${b.id}" ${String(b.id) === String(preselectedBarberId) ? "selected" : ""}>${b.name} (Chair #${b.id})</option>`
        )
        .join("");
    }
  }

  if (serviceSelect) {
    serviceSelect.innerHTML = STATE.servicesList
      .map((s) => `<option value="${s.id}">${s.name} (${s.price} SAR - ${s.durationMinutes}m)</option>`)
      .join("");
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function openCancelModal(bookingId) {
  const modal = document.getElementById("cancel-modal");
  const idInput = document.getElementById("cancel-booking-id");
  const subtitle = document.getElementById("cancel-modal-subtitle");

  if (!modal || !idInput) return;

  idInput.value = bookingId;
  const booking = STATE.bookings.find((b) => String(b.id) === String(bookingId));
  if (subtitle && booking) {
    subtitle.innerText = `Appointment #${booking.id} - ${booking.customerName} (${booking.serviceName || "Service"})`;
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function openReassignModal(bookingId) {
  const modal = document.getElementById("reassign-modal");
  const idInput = document.getElementById("reassign-booking-id");
  const barberSelect = document.getElementById("reassign-barber-select");
  const details = document.getElementById("reassign-current-details");

  if (!modal || !idInput || !barberSelect) return;

  idInput.value = bookingId;
  const booking = STATE.bookings.find((b) => String(b.id) === String(bookingId));
  if (booking && details) {
    details.innerText = `${booking.customerName} • ${booking.serviceName} • Current: ${booking.barberName}`;
  }

  // Populate other barbers
  barberSelect.innerHTML = STATE.staffList
    .map((b) => `<option value="${b.id}">${b.name} (Chair #${b.id})</option>`)
    .join("");

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function openBlockModal(context) {
  const modal = document.getElementById("block-modal");
  const barberSelect = document.getElementById("block-barber-select");
  const dateInput = document.getElementById("block-date");

  if (!modal || !barberSelect) return;

  if (dateInput) dateInput.value = STATE.selectedDate;

  barberSelect.innerHTML = STATE.staffList
    .map((b) => `<option value="${b.id}">${b.name} (Chair #${b.id})</option>`)
    .join("");

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

/* =========================================================================
 * 7. OTHER VIEWS (STAFF, SERVICES, SETTINGS, PROFILE)
 * ========================================================================= */
async function renderStaffView(container, context) {
  container.innerHTML = `
    <div class="flex items-center justify-between bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
      <div>
        <h2 class="text-xl font-extrabold text-white tracking-tight">Staff & Barber Management</h2>
        <p class="text-xs text-slate-400 mt-1">Manage salon team members, chair assignments, and working hours.</p>
      </div>
      <button class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl transition shadow-lg shadow-amber-500/20">
        + Add Barber
      </button>
    </div>

    <div id="staff-cards-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${STATE.staffList
        .map(
          (staff) => `
        <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-4 shadow-xl">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-lg font-bold">
              💈
            </div>
            <div class="min-w-0">
              <h4 class="text-sm font-extrabold text-white truncate">${staff.name}</h4>
              <span class="text-[10px] font-mono text-slate-400">Barber ID #${staff.id}</span>
            </div>
          </div>

          <div class="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs flex items-center justify-between">
            <span class="text-slate-400">Shift Status:</span>
            <span class="text-emerald-400 font-bold font-mono">● ONLINE</span>
          </div>

          <div class="pt-2 flex items-center justify-between text-xs">
            <button class="text-amber-400 hover:underline font-bold">Edit Schedule</button>
            <button class="text-red-400 hover:underline">Remove</button>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

async function renderServicesView(container, context) {
  container.innerHTML = `
    <div class="flex items-center justify-between bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
      <div>
        <h2 class="text-xl font-extrabold text-white tracking-tight">Services & Pricing Catalogue</h2>
        <p class="text-xs text-slate-400 mt-1">Published services available for online customer booking and walk-in selection.</p>
      </div>
      <button class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-2xl transition shadow-lg shadow-amber-500/20">
        + Add Service
      </button>
    </div>

    <div id="services-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${STATE.servicesList
        .map(
          (srv) => `
        <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition space-y-3 shadow-xl">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-extrabold text-white">${srv.name}</h4>
            <span class="text-base font-black text-amber-400 font-mono">${srv.price} SAR</span>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">${srv.description || "Professional grooming service"}</p>
          <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>⏱️ ${srv.durationMinutes || 30} mins</span>
            <span class="text-emerald-400 font-bold">Active</span>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function renderSettingsView(container, context) {
  const shop = context.shop || {};
  container.innerHTML = `
    <div class="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
      <div>
        <h2 class="text-xl font-extrabold text-white tracking-tight">Salon Profile & Settings</h2>
        <p class="text-xs text-slate-400 mt-1">Manage public profile details, address, and customer booking link.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label class="block font-semibold text-slate-400 mb-1">Salon Name</label>
          <input type="text" value="${shop.name || "Golden Scissors Salon"}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white" />
        </div>

        <div>
          <label class="block font-semibold text-slate-400 mb-1">City / Region</label>
          <input type="text" value="${shop.branch || "Riyadh, Olaya"}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white" />
        </div>

        <div class="col-span-full">
          <label class="block font-semibold text-slate-400 mb-1">National Address</label>
          <input type="text" value="${shop.fullAddress || "King Fahd Road, Building 42, Olaya"}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white" />
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
        <h4 class="text-xs font-bold text-white">Public Customer Booking URL</h4>
        <div class="flex items-center gap-2">
          <input type="text" readonly value="http://localhost:3000/booking/?slug=${shop.slug || "golden-scissors"}" class="w-full bg-slate-900 border border-slate-800 text-amber-400 font-mono text-xs rounded-xl px-3 py-2" />
          <button class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs shrink-0" onclick="navigator.clipboard.writeText('http://localhost:3000/booking/?slug=${shop.slug || "golden-scissors"}')">Copy</button>
        </div>
      </div>
    </div>
  `;
}

function renderProfileView(container, context) {
  const user = context.user;
  container.innerHTML = `
    <div class="bg-slate-900/80 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-2xl font-bold">
          ✂️
        </div>
        <div>
          <h2 class="text-xl font-extrabold text-white tracking-tight">${user.fullName}</h2>
          <span class="text-xs text-sky-400 font-mono">Assigned Staff Barber • ID #${TenantContext.getStaffId() || "26"}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <span class="text-slate-400">Email Address:</span>
          <p class="font-mono text-white font-bold">${user.email}</p>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <span class="text-slate-400">Saudi Phone:</span>
          <p class="font-mono text-white font-bold">${user.phone || "0553344556"}</p>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <span class="text-slate-400">Assigned Salon:</span>
          <p class="font-mono text-amber-400 font-bold">${user.salonName || "Golden Scissors Salon"}</p>
        </div>
        <div class="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
          <span class="text-slate-400">Active Shift:</span>
          <p class="font-mono text-emerald-400 font-bold">ONLINE (Receiving Appointments)</p>
        </div>
      </div>
    </div>
  `;
}

function getLocalBookingsFallback() {
  return [];
}

/* =========================================================================
 * 8. TOAST NOTIFICATION UTILITY
 * ========================================================================= */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const isErr = type === "error";

  toast.className = `p-4 rounded-2xl border text-xs font-bold shadow-2xl flex items-center gap-3 pointer-events-auto transition-all transform translate-y-2 opacity-0 ${
    isErr
      ? "bg-red-500/10 text-red-300 border-red-500/30"
      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
  }`;

  toast.innerHTML = `
    <span>${isErr ? "⚠️" : "✅"}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("translate-y-2", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
