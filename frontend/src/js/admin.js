/**
 * Super Admin Control Portal: Modular Layout Shell, Journey Router & User Audit Screen
 * Architecture: Vanilla JS (ES Modules) + Tailwind CSS + REST API
 */

import { Store } from "./store.js";
import { AuthGuard } from "./auth-guard.js";
import { QrHelper } from "./qr-helper.js";

// Global Super Admin State
const STATE = {
  currentView: "audit", // "audit" | "salons" | "settings" | "access-control"
  sidebarCollapsed: false,
  salons: [],
  salonsView: {
    page: 0,
    size: 10,
    search: "",
    statusFilter: "ALL",
    regionFilter: "ALL",
    sortBy: "createdAt",
    sortDirection: "DESC",
    selectedShopForModal: null,
    targetStatusForModal: null,
    selectedShopForProfile: null
  },
  audit: {
    page: 0,
    size: 10,
    from: "",
    to: "",
    salonId: "",
    action: "ALL",
    search: "",
    sortBy: "createdAt",
    direction: "DESC",
    totalPages: 1,
    totalElements: 0,
    content: [],
    loading: false,
    error: null,
    selectedLog: null
  },
  settingsTab: "general", // "general" | "billing" | "notifications" | "features"
  settings: null,
  settingsDraft: null,
  settingsDirty: false,
  settingsErrors: {},
  pendingNavigation: null,
  rbac: {
    activeTab: "users", // "users" | "roles"
    users: [],
    roles: [],
    search: "",
    roleFilter: "ALL",
    statusFilter: "ALL",
    loading: false,
    selectedUserForRoleModal: null
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  // 1. RBAC Guard Enforcement
  AuthGuard.init();
  Store.init();

  const user = Store.getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return; // AuthGuard redirects non-super-admins
  }

  // Pre-seed salons from local store immediately to prevent empty/delayed initial renders
  STATE.salons = Store.getShops().map((s, idx) => normalizeShop(s, idx));

  // 2. Initialize App Shell Components
  initAppShellProfile();
  initSidebarBehavior();
  initRouter();
  initGlobalControls();

  // 3. Re-sync live salons from backend API
  await loadInitialSalonsList();
});

/* =========================================================================
 * 1. APP SHELL & PROFILE INITIALIZATION
 * ========================================================================= */
function initAppShellProfile() {
  const user = Store.getCurrentUser();
  if (user) {
    const nameEl = document.getElementById("shell-user-name");
    const emailEl = document.getElementById("shell-user-email");
    if (nameEl) nameEl.innerText = user.fullName || "Super Administrator";
    if (emailEl) emailEl.innerText = user.email || "admin@barberapp.sa";
  }

  document.getElementById("shell-logout-btn")?.addEventListener("click", () => {
    Store.logout();
    window.location.href = "../login.html";
  });
}

function initSidebarBehavior() {
  const sidebar = document.getElementById("admin-sidebar");
  const collapseToggle = document.getElementById("sidebar-collapse-toggle");
  const mobileOpenBtn = document.getElementById("mobile-sidebar-open");
  const mobileCloseBtn = document.getElementById("mobile-sidebar-close");
  const mobileBackdrop = document.getElementById("mobile-sidebar-backdrop");

  // Desktop Collapse Toggle (Expands / Collapses width)
  collapseToggle?.addEventListener("click", () => {
    STATE.sidebarCollapsed = !STATE.sidebarCollapsed;
    if (STATE.sidebarCollapsed) {
      sidebar?.classList.remove("w-64");
      sidebar?.classList.add("w-20");
      document.querySelectorAll(".sidebar-label").forEach((el) => el.classList.add("hidden"));
    } else {
      sidebar?.classList.remove("w-20");
      sidebar?.classList.add("w-64");
      document.querySelectorAll(".sidebar-label").forEach((el) => el.classList.remove("hidden"));
    }
  });

  // Mobile Drawer Open / Close
  const openMobileDrawer = () => {
    sidebar?.classList.remove("-translate-x-full");
    mobileBackdrop?.classList.remove("hidden");
  };

  const closeMobileDrawer = () => {
    sidebar?.classList.add("-translate-x-full");
    mobileBackdrop?.classList.add("hidden");
  };

  mobileOpenBtn?.addEventListener("click", openMobileDrawer);
  mobileCloseBtn?.addEventListener("click", closeMobileDrawer);
  mobileBackdrop?.addEventListener("click", closeMobileDrawer);
}

function initGlobalControls() {
  document.getElementById("global-refresh-btn")?.addEventListener("click", () => {
    showToast("Refreshing workspace data...");
    if (STATE.currentView === "audit") {
      fetchAuditLogs();
    } else {
      renderCurrentView();
    }
  });

  // Drawer Close Events
  document.getElementById("close-drawer-btn")?.addEventListener("click", closeDetailDrawer);
  document.getElementById("drawer-close-bottom")?.addEventListener("click", closeDetailDrawer);
  document.getElementById("drawer-backdrop")?.addEventListener("click", closeDetailDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDetailDrawer();
      closeSalonProfileDrawer();
      closeStatusConfirmModal();
      closeUnsavedChangesModal();
      closeInviteAdminModal();
      closeEditRoleModal();
    }
  });

  // Salon Profile Drawer & Status Modal Controls
  initSalonModalEvents();
  initUnsavedChangesModalEvents();
  initRbacModalEvents();

  // Copy JSON in Drawer
  document.getElementById("copy-json-btn")?.addEventListener("click", () => {
    if (!STATE.audit.selectedLog) return;
    const jsonStr = JSON.stringify(STATE.audit.selectedLog, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      showToast("Audit JSON copied to clipboard! 📋");
    });
  });
}

/* =========================================================================
 * 2. ROUTER & WORKSPACE SWITCHER
 * ========================================================================= */
function initRouter() {
  // Parse route from URL Search Params or Window Hash
  const handleRouteChange = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get("view");
    const hash = window.location.hash.replace("#", "");

    const targetView = viewParam || hash || "audit";
    STATE.currentView = ["audit", "salons", "settings", "access-control"].includes(targetView)
      ? targetView
      : "audit";

    // Hydrate audit search parameters if on audit view
    if (STATE.currentView === "audit") {
      if (urlParams.has("page")) STATE.audit.page = parseInt(urlParams.get("page")) || 0;
      if (urlParams.has("size")) STATE.audit.size = parseInt(urlParams.get("size")) || 10;
      if (urlParams.has("from")) STATE.audit.from = urlParams.get("from");
      if (urlParams.has("to")) STATE.audit.to = urlParams.get("to");
      if (urlParams.has("action")) STATE.audit.action = urlParams.get("action");
      if (urlParams.has("salonId")) STATE.audit.salonId = urlParams.get("salonId");
      if (urlParams.has("search")) STATE.audit.search = urlParams.get("search");
    }

    // Hydrate salons search parameters if on salons view
    if (STATE.currentView === "salons") {
      if (urlParams.has("page")) STATE.salonsView.page = parseInt(urlParams.get("page")) || 0;
      if (urlParams.has("size")) STATE.salonsView.size = parseInt(urlParams.get("size")) || 10;
      if (urlParams.has("search")) STATE.salonsView.search = urlParams.get("search");
      if (urlParams.has("status")) STATE.salonsView.statusFilter = urlParams.get("status");
      if (urlParams.has("region")) STATE.salonsView.regionFilter = urlParams.get("region");
      if (urlParams.has("sortBy")) STATE.salonsView.sortBy = urlParams.get("sortBy");
    }

    updateNavHighlight();
    renderCurrentView();

    // On mobile, close drawer after click
    if (window.innerWidth < 768) {
      document.getElementById("admin-sidebar")?.classList.add("-translate-x-full");
      document.getElementById("mobile-sidebar-backdrop")?.classList.add("hidden");
    }
  };

  window.addEventListener("popstate", (e) => {
    if (STATE.currentView === "settings" && STATE.settingsDirty) {
      // Prompt user before allowing popstate
      showUnsavedChangesModal(() => {
        STATE.settingsDirty = false;
        STATE.settingsDraft = JSON.parse(JSON.stringify(STATE.settings));
        handleRouteChange();
      }, "navigating backwards / forwards in history");
      return;
    }
    handleRouteChange();
  });

  window.addEventListener("hashchange", handleRouteChange);

  // Warn on page unload / browser tab close if dirty
  window.addEventListener("beforeunload", (e) => {
    if (STATE.currentView === "settings" && STATE.settingsDirty) {
      e.preventDefault();
      e.returnValue = "You have unsaved changes in the system configuration.";
      return "You have unsaved changes in the system configuration.";
    }
  });

  // Wire sidebar click listeners
  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.getAttribute("data-view");
      if (view === STATE.currentView) return;

      const performNav = () => {
        updateUrlParams({ view }, true);
        handleRouteChange();
        if (window.innerWidth < 768) {
          document.getElementById("admin-sidebar")?.classList.add("-translate-x-full");
          document.getElementById("mobile-sidebar-backdrop")?.classList.add("hidden");
        }
      };

      if (STATE.currentView === "settings" && STATE.settingsDirty) {
        showUnsavedChangesModal(performNav, `navigating to "${view}"`);
        return;
      }

      performNav();
    });
  });

  // Initial trigger
  handleRouteChange();
}

function updateNavHighlight() {
  document.querySelectorAll(".nav-item").forEach((link) => {
    const view = link.getAttribute("data-view");
    if (view === STATE.currentView) {
      link.className = "nav-item flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-xs font-bold text-white bg-[#F59E0B]/10 border border-[#F59E0B]/40 shadow-md shadow-[#F59E0B]/5 transition-all";
    } else {
      link.className = "nav-item flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent transition-all";
    }
  });

  // Update Breadcrumb & Title
  const breadcrumb = document.getElementById("breadcrumb-current-view");
  const titles = {
    audit: "User Audit",
    salons: "Salon Directory",
    settings: "System Configuration",
    "access-control": "Access Control"
  };
  if (breadcrumb) {
    breadcrumb.innerText = titles[STATE.currentView] || "User Audit";
  }
}

function updateUrlParams(newParams, push = false) {
  const currentUrl = new URL(window.location.href);
  Object.keys(newParams).forEach((key) => {
    if (newParams[key] !== null && newParams[key] !== undefined && newParams[key] !== "") {
      currentUrl.searchParams.set(key, newParams[key]);
    } else {
      currentUrl.searchParams.delete(key);
    }
  });

  if (push) {
    window.history.pushState({}, "", currentUrl.toString());
  } else {
    window.history.replaceState({}, "", currentUrl.toString());
  }
}

function renderCurrentView() {
  const workspace = document.getElementById("admin-workspace");
  if (!workspace) return;

  if (STATE.currentView === "audit") {
    renderUserAuditWorkspace(workspace);
    fetchAuditLogs();
  } else if (STATE.currentView === "salons") {
    renderSalonDirectoryWorkspace(workspace);
  } else if (STATE.currentView === "settings") {
    renderSystemSettingsWorkspace(workspace);
  } else if (STATE.currentView === "access-control") {
    renderAccessControlWorkspace(workspace);
  }
}

function normalizeShop(s, idx = 0) {
  const id = s.id || (idx + 1);
  const name = s.name || "Salon";
  const slug = s.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const phone = s.phone || "0501234567";
  const region = s.region || "Riyadh Region";
  const district = s.district || "Olaya";
  const city = s.city || "Riyadh";
  const fullAddress = s.fullAddress || `${district}, ${city}`;
  const mapAddress = s.mapAddress || `${city}`;
  const plan = s.subscriptionPlan || s.plan || "MONTHLY";
  const status = (s.status || "ACTIVE").toUpperCase();
  const ownerName = s.owner ? (s.owner.fullName || s.owner.email) : (s.ownerFullName || s.owner || "Shop Owner");
  const ownerEmail = s.owner ? s.owner.email : (s.ownerEmail || "owner@goldenscissors.sa");
  const crNumber = s.crNumber || `CR-1010${String(id).padStart(4, "0")}`;
  const loginUrl = s.loginUrl || `http://localhost:3000/dashboard/index.html?slug=${slug}`;
  const bookingUrl = s.bookingUrl || `http://localhost:3000/booking.html?slug=${slug}`;
  const createdAt = s.createdAt || "2026-10-10T12:00:00";

  return {
    ...s,
    id,
    name,
    slug,
    phone,
    region,
    district,
    city,
    fullAddress,
    mapAddress,
    plan,
    status,
    owner: ownerName,
    ownerEmail,
    crNumber,
    loginUrl,
    bookingUrl,
    createdAt
  };
}

async function loadInitialSalonsList() {
  try {
    const res = await fetch("http://localhost:8080/api/shops");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const localShops = Store.getShops();
        const merged = [...data];
        localShops.forEach((ls) => {
          if (!merged.some((ms) => String(ms.slug) === String(ls.slug) || String(ms.id) === String(ls.id))) {
            merged.push(ls);
          }
        });
        STATE.salons = merged.map((s, idx) => normalizeShop(s, idx));
        // Keep localStorage and Store synchronized
        localStorage.setItem("barber_saas_shops", JSON.stringify(STATE.salons));
      }
    }
  } catch (err) {
    console.warn("Failed to fetch shops from backend API, relying on local store:", err);
  }

  if (!STATE.salons || STATE.salons.length === 0) {
    STATE.salons = Store.getShops().map((s, idx) => normalizeShop(s, idx));
  }

  // If the user is currently on the salons or audit workspace, refresh to show all salons
  if (STATE.currentView === "salons" || STATE.currentView === "audit") {
    renderCurrentView();
  }
}

/* =========================================================================
 * 3. USER AUDIT SCREEN IMPLEMENTATION (TARGET SPRINT SCOPE)
 * ========================================================================= */
function renderUserAuditWorkspace(container) {
  container.innerHTML = `
    <!-- Screen Header & Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md">
      <div>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg">
            🔍
          </div>
          <div>
            <h2 class="text-lg font-extrabold text-white">User Audit Trail & Activity Logs</h2>
            <p class="text-xs text-slate-400 mt-0.5">Server-side paginated security events, admin overrides, and user session monitoring</p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button id="export-audit-csv-btn" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm">
          <span>📥</span> Export CSV
        </button>
        <button id="audit-refresh-action-btn" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20">
          <span>⚡</span> Live Sync
        </button>
      </div>
    </div>

    <!-- Filter Toolbar Card (Date Range, Salon, Action, Search) -->
    <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <span>🎯</span> Filter Parameters
        </span>
        <button id="audit-reset-filters-btn" class="text-xs text-amber-400 hover:text-amber-300 font-semibold underline transition">
          Reset All Filters
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <!-- Date From -->
        <div>
          <label class="block text-[11px] font-medium text-slate-400 mb-1">Date Range (From)</label>
          <input type="date" id="filter-date-from" value="${STATE.audit.from}" class="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]" />
        </div>

        <!-- Date To -->
        <div>
          <label class="block text-[11px] font-medium text-slate-400 mb-1">Date Range (To)</label>
          <input type="date" id="filter-date-to" value="${STATE.audit.to}" class="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]" />
        </div>

        <!-- Salon Selector -->
        <div>
          <label class="block text-[11px] font-medium text-slate-400 mb-1">Affected Salon</label>
          <select id="filter-salon-select" class="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
            <option value="">All Salons (Global)</option>
            ${STATE.salons.map((s) => `
              <option value="${s.id}" ${String(STATE.audit.salonId) === String(s.id) ? "selected" : ""}>
                ${s.name} (${s.city})
              </option>
            `).join("")}
          </select>
        </div>

        <!-- Action Type Dropdown -->
        <div>
          <label class="block text-[11px] font-medium text-slate-400 mb-1">Action Type</label>
          <select id="filter-action-select" class="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
            <option value="ALL" ${STATE.audit.action === "ALL" ? "selected" : ""}>All Action Types</option>
            <option value="LOGIN" ${STATE.audit.action === "LOGIN" ? "selected" : ""}>LOGIN (User Auth)</option>
            <option value="AUTH_LOGIN_FAILED" ${STATE.audit.action === "AUTH_LOGIN_FAILED" ? "selected" : ""}>AUTH_LOGIN_FAILED (Failed Login)</option>
            <option value="UPDATE_SALON" ${STATE.audit.action === "UPDATE_SALON" ? "selected" : ""}>UPDATE_SALON (Profile/Override)</option>
            <option value="STAFF_CREATED" ${STATE.audit.action === "STAFF_CREATED" ? "selected" : ""}>STAFF_CREATED (Add Staff)</option>
            <option value="STAFF_UPDATED" ${STATE.audit.action === "STAFF_UPDATED" ? "selected" : ""}>STAFF_UPDATED (Edit Staff)</option>
            <option value="STAFF_STATUS_CHANGE" ${STATE.audit.action === "STAFF_STATUS_CHANGE" ? "selected" : ""}>STAFF_STATUS_CHANGE (Shift/Status)</option>
            <option value="DELETE_STAFF" ${STATE.audit.action === "DELETE_STAFF" ? "selected" : ""}>DELETE_STAFF (Staff Removal)</option>
            <option value="SERVICE_CREATED" ${STATE.audit.action === "SERVICE_CREATED" ? "selected" : ""}>SERVICE_CREATED (New Service)</option>
            <option value="SERVICE_UPDATED" ${STATE.audit.action === "SERVICE_UPDATED" ? "selected" : ""}>SERVICE_UPDATED (Edit Service)</option>
            <option value="SERVICE_DELETED" ${STATE.audit.action === "SERVICE_DELETED" ? "selected" : ""}>SERVICE_DELETED (Delete Service)</option>
            <option value="MEDIA_UPLOADED" ${STATE.audit.action === "MEDIA_UPLOADED" ? "selected" : ""}>MEDIA_UPLOADED (Photos/Logos)</option>
            <option value="MEDIA_DELETED" ${STATE.audit.action === "MEDIA_DELETED" ? "selected" : ""}>MEDIA_DELETED (Remove Photo)</option>
            <option value="BOOKING_CONFIRMED" ${STATE.audit.action === "BOOKING_CONFIRMED" ? "selected" : ""}>BOOKING_CONFIRMED (Appointment)</option>
            <option value="BOOKING_STATUS_CHANGED" ${STATE.audit.action === "BOOKING_STATUS_CHANGED" ? "selected" : ""}>BOOKING_STATUS_CHANGED (Status Change)</option>
            <option value="SHOP_REGISTERED" ${STATE.audit.action === "SHOP_REGISTERED" ? "selected" : ""}>SHOP_REGISTERED (Onboarding)</option>
            <option value="SHOP_AUTO_APPROVED" ${STATE.audit.action === "SHOP_AUTO_APPROVED" ? "selected" : ""}>SHOP_AUTO_APPROVED (Payment)</option>
            <option value="RBAC_ROLE_CHANGE" ${STATE.audit.action === "RBAC_ROLE_CHANGE" ? "selected" : ""}>RBAC_ROLE_CHANGE (Role Changed)</option>
            <option value="RBAC_STATUS_CHANGE" ${STATE.audit.action === "RBAC_STATUS_CHANGE" ? "selected" : ""}>RBAC_STATUS_CHANGE (Status Override)</option>
            <option value="RBAC_INVITE_ADMIN" ${STATE.audit.action === "RBAC_INVITE_ADMIN" ? "selected" : ""}>RBAC_INVITE_ADMIN (Admin Invited)</option>
          </select>
        </div>

        <!-- Keyword Search -->
        <div>
          <label class="block text-[11px] font-medium text-slate-400 mb-1">Search Keywords</label>
          <input type="text" id="filter-keyword-search" value="${STATE.audit.search}" placeholder="Search details, actor, IP..." class="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]" />
        </div>
      </div>
    </div>

    <!-- Audit Logs Table Container with Skeletons, Error, & Empty States -->
    <div class="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      
      <!-- Skeletons Loader Container -->
      <div id="audit-loading-skeleton" class="p-6 space-y-3.5 hidden">
        <div class="h-4 bg-slate-800 rounded w-1/4 animate-pulse"></div>
        ${[1, 2, 3, 4, 5].map(() => `
          <div class="h-12 bg-slate-800/50 rounded-xl animate-pulse"></div>
        `).join("")}
      </div>

      <!-- Error State Card -->
      <div id="audit-error-card" class="p-12 text-center space-y-4 hidden">
        <span class="text-4xl block">⚠️</span>
        <h3 class="text-base font-bold text-red-400">Failed to Retrieve Audit Logs</h3>
        <p id="audit-error-message" class="text-xs text-slate-400 max-w-md mx-auto">A communication error occurred while querying the server-side audit logs endpoint.</p>
        <button id="audit-retry-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 transition">
          Retry Query
        </button>
      </div>

      <!-- Empty State Card -->
      <div id="audit-empty-card" class="p-12 text-center space-y-3 hidden">
        <span class="text-4xl block">📭</span>
        <h3 class="text-base font-bold text-white">No Audit Logs Found</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto">No activity matches the current date range or action criteria. Try clearing or expanding your filter parameters.</p>
        <button id="audit-empty-clear-btn" class="px-4 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 text-xs font-bold rounded-xl transition">
          Clear Active Filters
        </button>
      </div>

      <!-- Paginated Data Table -->
      <div id="audit-table-wrapper" class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-950/40">
              <th class="py-3.5 px-4 font-mono">Timestamp</th>
              <th class="py-3.5 px-4">Actor</th>
              <th class="py-3.5 px-4">Salon / Scope</th>
              <th class="py-3.5 px-4">Action</th>
              <th class="py-3.5 px-4">Details Summary</th>
              <th class="py-3.5 px-4 font-mono">IP Address</th>
              <th class="py-3.5 px-4 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody id="audit-table-body" class="divide-y divide-slate-800/60">
            <!-- Table rows injected dynamically -->
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div id="audit-pagination-footer" class="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
        <div class="flex items-center gap-3">
          <span id="pagination-info">Showing 0 of 0 entries</span>
          <select id="pagination-size-select" class="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none">
            <option value="10" ${STATE.audit.size === 10 ? "selected" : ""}>10 per page</option>
            <option value="25" ${STATE.audit.size === 25 ? "selected" : ""}>25 per page</option>
            <option value="50" ${STATE.audit.size === 50 ? "selected" : ""}>50 per page</option>
          </select>
        </div>

        <div id="pagination-nav-container" class="flex items-center gap-1.5">
          <!-- Page buttons rendered dynamically -->
        </div>
      </div>

    </div>
  `;

  // Attach Filter Listeners with URL Sync
  const dateFrom = document.getElementById("filter-date-from");
  const dateTo = document.getElementById("filter-date-to");
  const salonSelect = document.getElementById("filter-salon-select");
  const actionSelect = document.getElementById("filter-action-select");
  const keywordSearch = document.getElementById("filter-keyword-search");

  const onFilterChange = () => {
    STATE.audit.page = 0; // reset to first page on filter change
    STATE.audit.from = dateFrom?.value || "";
    STATE.audit.to = dateTo?.value || "";
    STATE.audit.salonId = salonSelect?.value || "";
    STATE.audit.action = actionSelect?.value || "ALL";
    STATE.audit.search = keywordSearch?.value.trim() || "";

    // Sync to URL Search Parameters
    updateUrlParams({
      view: "audit",
      page: STATE.audit.page,
      size: STATE.audit.size,
      from: STATE.audit.from,
      to: STATE.audit.to,
      salonId: STATE.audit.salonId,
      action: STATE.audit.action,
      search: STATE.audit.search
    });

    fetchAuditLogs();
  };

  dateFrom?.addEventListener("change", onFilterChange);
  dateTo?.addEventListener("change", onFilterChange);
  salonSelect?.addEventListener("change", onFilterChange);
  actionSelect?.addEventListener("change", onFilterChange);

  let searchTimeout = null;
  keywordSearch?.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(onFilterChange, 400); // 400ms debounce
  });

  // Reset Filters
  const resetFilters = () => {
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";
    if (salonSelect) salonSelect.value = "";
    if (actionSelect) actionSelect.value = "ALL";
    if (keywordSearch) keywordSearch.value = "";
    onFilterChange();
  };

  document.getElementById("audit-reset-filters-btn")?.addEventListener("click", resetFilters);
  document.getElementById("audit-empty-clear-btn")?.addEventListener("click", resetFilters);
  document.getElementById("audit-retry-btn")?.addEventListener("click", fetchAuditLogs);
  document.getElementById("audit-refresh-action-btn")?.addEventListener("click", fetchAuditLogs);

  // Pagination Page Size
  document.getElementById("pagination-size-select")?.addEventListener("change", (e) => {
    STATE.audit.size = parseInt(e.target.value) || 10;
    STATE.audit.page = 0;
    updateUrlParams({ size: STATE.audit.size, page: 0 });
    fetchAuditLogs();
  });

  // Export CSV
  document.getElementById("export-audit-csv-btn")?.addEventListener("click", exportAuditLogsToCsv);
}

/* =========================================================================
 * 4. AUDIT LOGS FETCH & RENDER ENGINE
 * ========================================================================= */
async function fetchAuditLogs() {
  const skeleton = document.getElementById("audit-loading-skeleton");
  const errorCard = document.getElementById("audit-error-card");
  const emptyCard = document.getElementById("audit-empty-card");
  const tableWrapper = document.getElementById("audit-table-wrapper");
  const paginationFooter = document.getElementById("audit-pagination-footer");
  const tbody = document.getElementById("audit-table-body");

  if (!tbody) return;

  // Show Skeleton
  skeleton?.classList.remove("hidden");
  errorCard?.classList.add("hidden");
  emptyCard?.classList.add("hidden");
  tableWrapper?.classList.add("hidden");
  paginationFooter?.classList.add("hidden");

  try {
    const params = new URLSearchParams({
      page: STATE.audit.page,
      size: STATE.audit.size,
      sortBy: STATE.audit.sortBy,
      direction: STATE.audit.direction
    });

    if (STATE.audit.from) params.set("from", STATE.audit.from);
    if (STATE.audit.to) params.set("to", STATE.audit.to);
    if (STATE.audit.action && STATE.audit.action !== "ALL") params.set("action", STATE.audit.action);
    if (STATE.audit.salonId) params.set("shopId", STATE.audit.salonId);
    if (STATE.audit.search) params.set("search", STATE.audit.search);

    const response = await fetch(`http://localhost:8080/api/admin/audit-logs?${params.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        ...Store.getAuthHeader()
      }
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    STATE.audit.content = data.content || [];
    STATE.audit.totalPages = data.totalPages || 1;
    STATE.audit.totalElements = data.totalElements || 0;
    STATE.audit.page = data.page || 0;

  } catch (err) {
    console.warn("Backend API fetch failed, querying central offline store fallback...", err);

    // Fallback: Local client simulation from Store
    try {
      const allLocal = Store.getAuditLogs();
      const filtered = allLocal.filter((l) => {
        const matchesAction = STATE.audit.action === "ALL" || l.action === STATE.audit.action;
        const matchesSearch = !STATE.audit.search || 
          (l.details && l.details.toLowerCase().includes(STATE.audit.search.toLowerCase())) ||
          (l.user && l.user.toLowerCase().includes(STATE.audit.search.toLowerCase())) ||
          (l.shop && l.shop.toLowerCase().includes(STATE.audit.search.toLowerCase()));
        return matchesAction && matchesSearch;
      });

      const start = STATE.audit.page * STATE.audit.size;
      STATE.audit.content = filtered.slice(start, start + STATE.audit.size).map((l, idx) => ({
        id: l.id || (idx + 1),
        userEmail: l.user || "admin@barberapp.sa",
        userFullName: l.user ? l.user.split("@")[0] : "Super Admin",
        userRole: "SUPER_ADMIN",
        shopName: l.shop || "Global Platform",
        action: l.action || "LOGIN",
        details: l.details || "{}",
        ipAddress: l.ip || "127.0.0.1",
        createdAt: l.timestamp || new Date().toISOString()
      }));
      STATE.audit.totalElements = filtered.length;
      STATE.audit.totalPages = Math.max(1, Math.ceil(filtered.length / STATE.audit.size));
    } catch (e) {
      skeleton?.classList.add("hidden");
      errorCard?.classList.remove("hidden");
      const errMsg = document.getElementById("audit-error-message");
      if (errMsg) errMsg.innerText = err.message || "Failed to contact audit endpoint.";
      return;
    }
  }

  // Render Table or Empty State
  skeleton?.classList.add("hidden");

  if (STATE.audit.content.length === 0) {
    emptyCard?.classList.remove("hidden");
    tableWrapper?.classList.add("hidden");
    paginationFooter?.classList.add("hidden");
    return;
  }

  tableWrapper?.classList.remove("hidden");
  paginationFooter?.classList.remove("hidden");

  tbody.innerHTML = STATE.audit.content.map((log) => {
    const actionBadge = getActionBadgeClass(log.action);
    const formattedDate = formatDateTime(log.createdAt);

    return `
      <tr class="hover:bg-slate-800/40 transition cursor-pointer audit-row" data-id="${log.id}">
        <td class="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap text-[11px]">
          ${formattedDate}
        </td>
        <td class="py-3.5 px-4">
          <div class="font-semibold text-white truncate max-w-[160px]">${log.userFullName || log.userEmail}</div>
          <div class="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">${log.userEmail}</div>
        </td>
        <td class="py-3.5 px-4 text-slate-200">
          <span class="font-medium">${log.shopName || "Global Platform"}</span>
        </td>
        <td class="py-3.5 px-4">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold border ${actionBadge}">
            ${log.action}
          </span>
        </td>
        <td class="py-3.5 px-4 text-slate-300 font-mono text-[11px] max-w-xs truncate" title="${escapeHtml(log.details)}">
          ${escapeHtml(log.details || "No details")}
        </td>
        <td class="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
          ${log.ipAddress || "127.0.0.1"}
        </td>
        <td class="py-3.5 px-4 text-right">
          <button class="inspect-btn px-2.5 py-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg text-xs font-semibold transition" data-id="${log.id}">
            👁️ Inspect
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Attach Inspect Click Events
  tbody.querySelectorAll(".audit-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      const id = row.getAttribute("data-id");
      openDetailDrawer(id);
    });
  });

  renderPaginationControls();
}

function getActionBadgeClass(action = "") {
  const act = action.toUpperCase();
  if (act.includes("LOGIN") || act.includes("AUTH")) {
    return "bg-purple-500/10 text-purple-300 border-purple-500/30";
  }
  if (act.includes("UPDATE")) {
    return "bg-blue-500/10 text-blue-400 border-blue-500/30";
  }
  if (act.includes("DELETE") || act.includes("SUSPEND")) {
    return "bg-red-500/10 text-red-400 border-red-500/30";
  }
  if (act.includes("APPROV") || act.includes("CONFIRM")) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  }
  if (act.includes("REGISTER") || act.includes("HOLD")) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  }
  return "bg-slate-800 text-slate-300 border-slate-700";
}

function formatDateTime(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toISOString().replace("T", " ").substring(0, 19);
  } catch {
    return isoString;
  }
}

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================================
 * 5. PAGINATION CONTROLS
 * ========================================================================= */
function renderPaginationControls() {
  const paginationInfo = document.getElementById("pagination-info");
  const navContainer = document.getElementById("pagination-nav-container");

  const start = STATE.audit.totalElements === 0 ? 0 : STATE.audit.page * STATE.audit.size + 1;
  const end = Math.min((STATE.audit.page + 1) * STATE.audit.size, STATE.audit.totalElements);

  if (paginationInfo) {
    paginationInfo.innerText = `Showing ${start} - ${end} of ${STATE.audit.totalElements} entries`;
  }

  if (!navContainer) return;

  const totalPages = STATE.audit.totalPages;
  const currentPage = STATE.audit.page;

  let buttonsHTML = `
    <button id="page-prev-btn" ${currentPage === 0 ? "disabled" : ""} class="px-3 py-1 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition">
      ← Prev
    </button>
  `;

  for (let i = 0; i < totalPages; i++) {
    // Show first, last, and window around current page
    if (i === 0 || i === totalPages - 1 || (i >= currentPage - 1 && i <= currentPage + 1)) {
      buttonsHTML += `
        <button class="page-num-btn px-3 py-1 rounded-lg text-xs font-semibold transition ${
          i === currentPage
            ? "bg-[#F59E0B] text-slate-950 font-bold shadow-md shadow-[#F59E0B]/20"
            : "bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
        }" data-page="${i}">
          ${i + 1}
        </button>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      buttonsHTML += `<span class="px-1 text-slate-600">...</span>`;
    }
  }

  buttonsHTML += `
    <button id="page-next-btn" ${currentPage >= totalPages - 1 ? "disabled" : ""} class="px-3 py-1 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition">
      Next →
    </button>
  `;

  navContainer.innerHTML = buttonsHTML;

  // Listeners
  document.getElementById("page-prev-btn")?.addEventListener("click", () => {
    if (STATE.audit.page > 0) {
      STATE.audit.page--;
      updateUrlParams({ page: STATE.audit.page });
      fetchAuditLogs();
    }
  });

  document.getElementById("page-next-btn")?.addEventListener("click", () => {
    if (STATE.audit.page < totalPages - 1) {
      STATE.audit.page++;
      updateUrlParams({ page: STATE.audit.page });
      fetchAuditLogs();
    }
  });

  navContainer.querySelectorAll(".page-num-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.getAttribute("data-page"));
      STATE.audit.page = p;
      updateUrlParams({ page: p });
      fetchAuditLogs();
    });
  });
}

/* =========================================================================
 * 6. DETAIL SLIDE-OVER DRAWER INSPECTOR
 * ========================================================================= */
function openDetailDrawer(logId) {
  const log = STATE.audit.content.find((l) => String(l.id) === String(logId));
  if (!log) return;

  STATE.audit.selectedLog = log;

  const drawer = document.getElementById("audit-detail-drawer");
  const backdrop = document.getElementById("drawer-backdrop");

  document.getElementById("drawer-subtitle").innerText = `Log ID: #${log.id}`;
  document.getElementById("drawer-action").innerText = log.action || "EVENT";
  document.getElementById("drawer-timestamp").innerText = formatDateTime(log.createdAt);
  document.getElementById("drawer-actor-email").innerText = `${log.userFullName || "Actor"} (${log.userEmail || "system"})`;
  document.getElementById("drawer-ip").innerText = log.ipAddress || "127.0.0.1";
  document.getElementById("drawer-salon").innerText = log.shopName || "Global System Scope";

  // Format JSON payload
  const jsonPre = document.getElementById("drawer-json-content");
  let formattedJson = "";
  try {
    const parsed = JSON.parse(log.details);
    formattedJson = JSON.stringify(parsed, null, 2);
  } catch {
    formattedJson = JSON.stringify({
      logId: log.id,
      action: log.action,
      details: log.details,
      actor: log.userEmail,
      salon: log.shopName,
      timestamp: log.createdAt,
      ipAddress: log.ipAddress
    }, null, 2);
  }
  jsonPre.innerText = formattedJson;

  drawer?.classList.remove("translate-x-full");
  backdrop?.classList.remove("hidden");
}

function closeDetailDrawer() {
  const drawer = document.getElementById("audit-detail-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  drawer?.classList.add("translate-x-full");
  backdrop?.classList.add("hidden");
  STATE.audit.selectedLog = null;
}

/* =========================================================================
 * 7. CSV EXPORT UTILITY
 * ========================================================================= */
function exportAuditLogsToCsv() {
  if (STATE.audit.content.length === 0) {
    showToast("No audit logs to export.");
    return;
  }

  const headers = ["ID", "Timestamp", "Actor Name", "Actor Email", "Salon Scope", "Action", "IP Address", "Details"];
  const rows = STATE.audit.content.map((l) => [
    l.id,
    `"${l.createdAt || ""}"`,
    `"${(l.userFullName || "").replace(/"/g, '""')}"`,
    `"${(l.userEmail || "").replace(/"/g, '""')}"`,
    `"${(l.shopName || "").replace(/"/g, '""')}"`,
    `"${(l.action || "").replace(/"/g, '""')}"`,
    `"${l.ipAddress || ""}"`,
    `"${(l.details || "").replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `user-audit-export-${new Date().toISOString().substring(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Audit trail CSV export downloaded successfully! 📥");
}

/* =========================================================================
 * 8. SALON DIRECTORY VIEW (FULL PAGINATED & AUDITED WORKSPACE)
 * ========================================================================= */
function renderSalonDirectoryWorkspace(container) {
  // 1. Gather all shops and ensure normalized representation
  const allShops = STATE.salons && STATE.salons.length > 0 ? STATE.salons : Store.getShops().map((s, idx) => normalizeShop(s, idx));

  // Compute KPI counts
  const totalCount = allShops.length;
  const activeCount = allShops.filter((s) => s.status === "ACTIVE").length;
  const pendingCount = allShops.filter((s) => s.status === "PENDING").length;
  const suspendedCount = allShops.filter((s) => s.status === "SUSPENDED").length;

  // Distinct regions
  const regions = Array.from(new Set(allShops.map((s) => s.region).filter(Boolean))).sort();

  // 2. Filter by search, status, and region
  const searchTerm = (STATE.salonsView.search || "").trim().toLowerCase();
  const statusFilter = STATE.salonsView.statusFilter || "ALL";
  const regionFilter = STATE.salonsView.regionFilter || "ALL";

  const filtered = allShops.filter((s) => {
    // Status filter
    if (statusFilter !== "ALL" && s.status !== statusFilter) {
      return false;
    }

    // Region filter
    if (regionFilter !== "ALL" && s.region !== regionFilter) {
      return false;
    }

    // Multi-attribute search filter:
    // salon name, city, district, region, registration number, or status
    if (searchTerm) {
      const nameMatch = (s.name || "").toLowerCase().includes(searchTerm);
      const cityMatch = (s.city || "").toLowerCase().includes(searchTerm);
      const districtMatch = (s.district || "").toLowerCase().includes(searchTerm);
      const regionMatch = (s.region || "").toLowerCase().includes(searchTerm);
      const crMatch = (s.crNumber || "").toLowerCase().includes(searchTerm);
      const idMatch = String(s.id || "").includes(searchTerm) || `#${s.id}`.includes(searchTerm);
      const phoneMatch = (s.phone || "").toLowerCase().includes(searchTerm);
      const slugMatch = (s.slug || "").toLowerCase().includes(searchTerm);
      const statusMatch = (s.status || "").toLowerCase().includes(searchTerm);

      if (!nameMatch && !cityMatch && !districtMatch && !regionMatch && !crMatch && !idMatch && !phoneMatch && !slugMatch && !statusMatch) {
        return false;
      }
    }

    return true;
  });

  // 3. Sorting
  const sortBy = STATE.salonsView.sortBy || "createdAt";
  const sortDirection = STATE.salonsView.sortDirection || "DESC";

  filtered.sort((a, b) => {
    let comp = 0;
    if (sortBy === "name") {
      comp = (a.name || "").localeCompare(b.name || "");
    } else if (sortBy === "city") {
      comp = (a.city || "").localeCompare(b.city || "");
    } else if (sortBy === "status") {
      comp = (a.status || "").localeCompare(b.status || "");
    } else {
      // createdAt default
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      comp = da - db;
    }
    return sortDirection === "ASC" ? comp : -comp;
  });

  // 4. Pagination
  const pageSize = STATE.salonsView.size || 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(0, STATE.salonsView.page || 0), totalPages - 1);
  STATE.salonsView.page = currentPage;

  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const pagedSalons = filtered.slice(startIndex, endIndex);

  // 5. Render Container UI
  container.innerHTML = `
    <!-- Top Action & Title Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl flex items-center justify-center text-2xl text-[#F59E0B] shadow-lg shadow-[#F59E0B]/5">
          💈
        </div>
        <div>
          <h2 class="text-lg font-extrabold text-white tracking-tight">Salon Directory Management</h2>
          <p class="text-xs text-slate-400">Search registered shops across KSA, inspect credentials, and modify tenant operational states with audit logging</p>
        </div>
      </div>
      <div class="flex items-center gap-2.5">
        <button id="refresh-salons-btn" class="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm border border-slate-700">
          <span>🔄</span>
          <span>Refresh</span>
        </button>
        <a href="../register.html" target="_blank" class="px-4 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-[#F59E0B]/20 flex items-center gap-1.5">
          <span>+</span>
          <span>Register New Salon</span>
        </a>
      </div>
    </div>

    <!-- Quick Status KPI Metrics -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <button data-filter-status="ALL" class="kpi-card text-left p-4 rounded-2xl bg-slate-900/70 border ${statusFilter === "ALL" ? "border-[#F59E0B] ring-1 ring-[#F59E0B]" : "border-slate-800 hover:border-slate-700"} transition shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Total Salons</span>
          <span class="text-base">🏢</span>
        </div>
        <p class="text-2xl font-black text-white font-mono mt-1">${totalCount}</p>
        <span class="text-[10px] text-slate-500 font-mono mt-0.5 block">Registered in Registry</span>
      </button>

      <button data-filter-status="ACTIVE" class="kpi-card text-left p-4 rounded-2xl bg-slate-900/70 border ${statusFilter === "ACTIVE" ? "border-emerald-500 ring-1 ring-emerald-500" : "border-slate-800 hover:border-slate-700"} transition shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Active Operations</span>
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
        <p class="text-2xl font-black text-emerald-400 font-mono mt-1">${activeCount}</p>
        <span class="text-[10px] text-emerald-400/70 font-mono mt-0.5 block">Accepting Bookings</span>
      </button>

      <button data-filter-status="PENDING" class="kpi-card text-left p-4 rounded-2xl bg-slate-900/70 border ${statusFilter === "PENDING" ? "border-amber-500 ring-1 ring-amber-500" : "border-slate-800 hover:border-slate-700"} transition shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Pending Review</span>
          <span class="text-base">⏳</span>
        </div>
        <p class="text-2xl font-black text-amber-400 font-mono mt-1">${pendingCount}</p>
        <span class="text-[10px] text-amber-400/70 font-mono mt-0.5 block">Awaiting Verification</span>
      </button>

      <button data-filter-status="SUSPENDED" class="kpi-card text-left p-4 rounded-2xl bg-slate-900/70 border ${statusFilter === "SUSPENDED" ? "border-red-500 ring-1 ring-red-500" : "border-slate-800 hover:border-slate-700"} transition shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Suspended</span>
          <span class="text-base">🚫</span>
        </div>
        <p class="text-2xl font-black text-red-400 font-mono mt-1">${suspendedCount}</p>
        <span class="text-[10px] text-red-400/70 font-mono mt-0.5 block">Booking Inactive</span>
      </button>
    </div>

    <!-- Filter & Search Toolbar Card -->
    <div class="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 md:p-5 shadow-xl space-y-3">
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        <!-- Search Input -->
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            id="salon-search-input"
            value="${STATE.salonsView.search || ""}"
            placeholder="Search by salon name, city, district, region, CR registration #, or status..."
            class="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-10 pr-9 py-2.5 text-xs focus:outline-none focus:border-[#F59E0B] font-sans"
          />
          ${STATE.salonsView.search ? `
            <button id="clear-search-btn" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white text-xs">
              ✕
            </button>
          ` : ""}
        </div>

        <!-- Status Filter -->
        <div class="flex items-center gap-2">
          <select id="salon-status-filter" class="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
            <option value="ALL" ${statusFilter === "ALL" ? "selected" : ""}>All Statuses (${totalCount})</option>
            <option value="ACTIVE" ${statusFilter === "ACTIVE" ? "selected" : ""}>🟢 Active (${activeCount})</option>
            <option value="PENDING" ${statusFilter === "PENDING" ? "selected" : ""}>🟡 Pending (${pendingCount})</option>
            <option value="SUSPENDED" ${statusFilter === "SUSPENDED" ? "selected" : ""}>🔴 Suspended (${suspendedCount})</option>
          </select>

          <!-- Region Filter -->
          <select id="salon-region-filter" class="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
            <option value="ALL" ${regionFilter === "ALL" ? "selected" : ""}>All Regions</option>
            ${regions.map((reg) => `
              <option value="${reg}" ${regionFilter === reg ? "selected" : ""}>${reg}</option>
            `).join("")}
          </select>

          <!-- Sort Order -->
          <select id="salon-sort-by" class="bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
            <option value="createdAt_DESC" ${sortBy === "createdAt" && sortDirection === "DESC" ? "selected" : ""}>Newest Registered</option>
            <option value="createdAt_ASC" ${sortBy === "createdAt" && sortDirection === "ASC" ? "selected" : ""}>Oldest Registered</option>
            <option value="name_ASC" ${sortBy === "name" && sortDirection === "ASC" ? "selected" : ""}>Salon Name (A-Z)</option>
            <option value="name_DESC" ${sortBy === "name" && sortDirection === "DESC" ? "selected" : ""}>Salon Name (Z-A)</option>
            <option value="city_ASC" ${sortBy === "city" && sortDirection === "ASC" ? "selected" : ""}>City (A-Z)</option>
            <option value="status_ASC" ${sortBy === "status" && sortDirection === "ASC" ? "selected" : ""}>Status</option>
          </select>

          <!-- Items Per Page -->
          <select id="salon-page-size" class="bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
            <option value="5" ${pageSize === 5 ? "selected" : ""}>5 / page</option>
            <option value="10" ${pageSize === 10 ? "selected" : ""}>10 / page</option>
            <option value="20" ${pageSize === 20 ? "selected" : ""}>20 / page</option>
            <option value="50" ${pageSize === 50 ? "selected" : ""}>50 / page</option>
          </select>

          <!-- Reset Filters -->
          <button id="salon-reset-filters-btn" title="Reset Filters" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 text-xs transition flex items-center gap-1">
            <span>↺</span>
            <span class="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      <!-- Active Filter Chips Bar -->
      <div class="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
        <span>Found <strong class="text-white">${filtered.length}</strong> matching salons</span>
        ${searchTerm ? `
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
            Search: "${searchTerm}"
            <button id="chip-remove-search" class="hover:text-red-400">✕</button>
          </span>
        ` : ""}
        ${statusFilter !== "ALL" ? `
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
            Status: ${statusFilter}
            <button id="chip-remove-status" class="hover:text-red-400">✕</button>
          </span>
        ` : ""}
        ${regionFilter !== "ALL" ? `
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
            Region: ${regionFilter}
            <button id="chip-remove-region" class="hover:text-red-400">✕</button>
          </span>
        ` : ""}
      </div>
    </div>

    <!-- Salons Table Container -->
    <div class="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-950/60 text-[10px]">
              <th class="py-3.5 px-4 font-mono font-bold">Salon & CR Number</th>
              <th class="py-3.5 px-4 font-mono font-bold">Location</th>
              <th class="py-3.5 px-4 font-mono font-bold">Owner & Contact</th>
              <th class="py-3.5 px-4 font-mono font-bold">Plan</th>
              <th class="py-3.5 px-4 font-mono font-bold">Operational State</th>
              <th class="py-3.5 px-4 text-right font-mono font-bold">Quick Actions</th>
            </tr>
          </thead>
          <tbody id="directory-table-body" class="divide-y divide-slate-800/60">
            ${pagedSalons.length === 0 ? `
              <tr>
                <td colspan="6" class="py-12 text-center space-y-3">
                  <div class="text-4xl">🔍</div>
                  <p class="text-sm font-bold text-white">No salons match your search criteria</p>
                  <p class="text-xs text-slate-400 max-w-sm mx-auto">Try clearing search terms or adjusting the status/region filters</p>
                  <button id="empty-reset-btn" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-bold transition">
                    Clear All Filters
                  </button>
                </td>
              </tr>
            ` : pagedSalons.map((s) => {
              const statusBadge = s.status === "ACTIVE"
                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>ACTIVE</span>`
                : s.status === "SUSPENDED"
                ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-red-500/10 text-red-400 border-red-500/20"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>SUSPENDED</span>`
                : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-500/10 text-amber-400 border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>PENDING</span>`;

              const planBadge = s.plan === "YEARLY"
                ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">YEARLY (200 SAR)</span>`
                : `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">MONTHLY (20 SAR)</span>`;

              const statusActionText = s.status === "ACTIVE" ? "Suspend" : (s.status === "PENDING" ? "Approve" : "Activate");
              const statusActionClass = s.status === "ACTIVE"
                ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500 hover:text-white"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500 hover:text-white";
              const targetStatus = s.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

              const initial = (s.name || "S").charAt(0).toUpperCase();

              return `
                <tr class="hover:bg-slate-800/40 transition">
                  <!-- 1. Salon & Registration -->
                  <td class="py-3.5 px-4">
                    <div class="flex items-center gap-3">
                      <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center text-amber-300 font-extrabold text-sm shrink-0 shadow-sm">
                        ${initial}
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <button data-action="view-profile" data-id="${s.id}" class="font-extrabold text-white hover:text-[#F59E0B] transition text-left truncate">
                            ${s.name}
                          </button>
                        </div>
                        <div class="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span class="text-amber-400/90 font-semibold">${s.crNumber}</span>
                          <span>•</span>
                          <span class="text-slate-500 truncate">/${s.slug}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- 2. Location -->
                  <td class="py-3.5 px-4 text-slate-300">
                    <div class="font-medium text-white">${s.city || "Riyadh"}</div>
                    <div class="text-[11px] text-slate-400 truncate max-w-[180px]">${s.district || "Central"}, ${s.region || "KSA"}</div>
                  </td>

                  <!-- 3. Owner & Contact -->
                  <td class="py-3.5 px-4">
                    <div class="text-white font-medium truncate max-w-[160px]">${s.owner || "Shop Owner"}</div>
                    <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                      <span>📞</span>
                      <span>${s.phone}</span>
                    </div>
                  </td>

                  <!-- 4. Plan -->
                  <td class="py-3.5 px-4">
                    ${planBadge}
                  </td>

                  <!-- 5. Operational State -->
                  <td class="py-3.5 px-4">
                    ${statusBadge}
                  </td>

                  <!-- 6. Quick-Action Menu -->
                  <td class="py-3.5 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <!-- 1. View Profile -->
                      <button data-action="view-profile" data-id="${s.id}" title="View Salon Profile & QR Codes" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition">
                        👁️
                      </button>

                      <!-- 2. Impersonate / Inspect Salon Dashboard -->
                      <button data-action="impersonate" data-slug="${s.slug}" title="Impersonate & Inspect Owner Dashboard" class="p-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] rounded-xl border border-[#F59E0B]/30 transition">
                        👑
                      </button>

                      <!-- 3. Change Status (Explicit Confirmation Modal) -->
                      <button data-action="change-status" data-id="${s.id}" data-target-status="${targetStatus}" class="px-2.5 py-1.5 text-[11px] font-bold rounded-xl border transition ${statusActionClass}">
                        ${statusActionText}
                      </button>

                      <!-- 4. More Options Dropdown Toggle -->
                      <div class="relative inline-block text-left">
                        <button data-action="toggle-menu" data-id="${s.id}" class="p-2 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition" title="More Actions">
                          ⋯
                        </button>
                        <div id="row-menu-${s.id}" class="hidden absolute right-0 mt-1 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-30 py-1 text-left text-xs">
                          <a href="../booking.html?slug=${s.slug}" target="_blank" class="block px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition">
                            📅 Public Booking Flow
                          </a>
                          <button data-action="copy-booking-url" data-url="${s.bookingUrl}" class="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition">
                            📋 Copy Booking URL
                          </button>
                          <div class="border-t border-slate-800 my-1"></div>
                          ${s.status !== "PENDING" ? `
                            <button data-action="change-status" data-id="${s.id}" data-target-status="PENDING" class="w-full text-left px-3 py-2 text-amber-400 hover:bg-slate-800 transition">
                              ⏳ Mark Pending Review
                            </button>
                          ` : ""}
                        </div>
                      </div>

                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer Controls -->
      <div class="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div class="text-slate-400">
          Showing <strong class="text-white">${filtered.length === 0 ? 0 : startIndex + 1}</strong> to <strong class="text-white">${endIndex}</strong> of <strong class="text-white">${filtered.length}</strong> registered salons
        </div>

        <div class="flex items-center gap-1.5">
          <!-- First Page -->
          <button id="pg-first-btn" ${currentPage === 0 ? "disabled" : ""} class="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition font-mono font-bold">
            «
          </button>
          <!-- Previous Page -->
          <button id="pg-prev-btn" ${currentPage === 0 ? "disabled" : ""} class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold">
            ‹ Prev
          </button>

          <!-- Numbered Page Pills -->
          <div class="flex items-center gap-1 px-1">
            ${Array.from({ length: totalPages }, (_, i) => i)
              .filter((p) => p === 0 || p === totalPages - 1 || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev !== undefined && p - prev > 1;
                return `
                  ${showEllipsis ? `<span class="px-1 text-slate-600">...</span>` : ""}
                  <button data-page="${p}" class="w-8 h-8 rounded-lg font-bold font-mono text-xs transition ${p === currentPage ? "bg-[#F59E0B] text-slate-950 shadow-md shadow-[#F59E0B]/20" : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"}">
                    ${p + 1}
                  </button>
                `;
              }).join("")}
          </div>

          <!-- Next Page -->
          <button id="pg-next-btn" ${currentPage >= totalPages - 1 ? "disabled" : ""} class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition font-bold">
            Next ›
          </button>
          <!-- Last Page -->
          <button id="pg-last-btn" ${currentPage >= totalPages - 1 ? "disabled" : ""} class="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition font-mono font-bold">
            »
          </button>
        </div>
      </div>
    </div>
  `;

  // 6. Bind Event Listeners
  wireSalonDirectoryEvents(container, allShops);
}

function wireSalonDirectoryEvents(container, allShops) {
  // Search input with debounce
  const searchInput = container.querySelector("#salon-search-input");
  let searchTimeout = null;
  searchInput?.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      STATE.salonsView.search = e.target.value;
      STATE.salonsView.page = 0;
      updateUrlParams({ search: STATE.salonsView.search, page: 0 });
      renderSalonDirectoryWorkspace(container);
    }, 200);
  });

  // Clear search button
  container.querySelector("#clear-search-btn")?.addEventListener("click", () => {
    STATE.salonsView.search = "";
    STATE.salonsView.page = 0;
    updateUrlParams({ search: "", page: 0 });
    renderSalonDirectoryWorkspace(container);
  });

  // Filter chips remove
  container.querySelector("#chip-remove-search")?.addEventListener("click", () => {
    STATE.salonsView.search = "";
    updateUrlParams({ search: "" });
    renderSalonDirectoryWorkspace(container);
  });

  container.querySelector("#chip-remove-status")?.addEventListener("click", () => {
    STATE.salonsView.statusFilter = "ALL";
    updateUrlParams({ status: "ALL" });
    renderSalonDirectoryWorkspace(container);
  });

  container.querySelector("#chip-remove-region")?.addEventListener("click", () => {
    STATE.salonsView.regionFilter = "ALL";
    updateUrlParams({ region: "ALL" });
    renderSalonDirectoryWorkspace(container);
  });

  // KPI Card clicks filter status
  container.querySelectorAll(".kpi-card").forEach((card) => {
    card.addEventListener("click", () => {
      const st = card.getAttribute("data-filter-status");
      STATE.salonsView.statusFilter = st;
      STATE.salonsView.page = 0;
      updateUrlParams({ status: st, page: 0 });
      renderSalonDirectoryWorkspace(container);
    });
  });

  // Status Filter Select
  container.querySelector("#salon-status-filter")?.addEventListener("change", (e) => {
    STATE.salonsView.statusFilter = e.target.value;
    STATE.salonsView.page = 0;
    updateUrlParams({ status: e.target.value, page: 0 });
    renderSalonDirectoryWorkspace(container);
  });

  // Region Filter Select
  container.querySelector("#salon-region-filter")?.addEventListener("change", (e) => {
    STATE.salonsView.regionFilter = e.target.value;
    STATE.salonsView.page = 0;
    updateUrlParams({ region: e.target.value, page: 0 });
    renderSalonDirectoryWorkspace(container);
  });

  // Sort Order Select
  container.querySelector("#salon-sort-by")?.addEventListener("change", (e) => {
    const val = e.target.value;
    const [sb, sd] = val.split("_");
    STATE.salonsView.sortBy = sb;
    STATE.salonsView.sortDirection = sd;
    updateUrlParams({ sortBy: val });
    renderSalonDirectoryWorkspace(container);
  });

  // Page Size Select
  container.querySelector("#salon-page-size")?.addEventListener("change", (e) => {
    STATE.salonsView.size = parseInt(e.target.value) || 10;
    STATE.salonsView.page = 0;
    updateUrlParams({ size: STATE.salonsView.size, page: 0 });
    renderSalonDirectoryWorkspace(container);
  });

  // Reset Filters Button
  const handleReset = () => {
    STATE.salonsView.search = "";
    STATE.salonsView.statusFilter = "ALL";
    STATE.salonsView.regionFilter = "ALL";
    STATE.salonsView.sortBy = "createdAt";
    STATE.salonsView.sortDirection = "DESC";
    STATE.salonsView.page = 0;
    updateUrlParams({ search: "", status: "ALL", region: "ALL", page: 0 });
    renderSalonDirectoryWorkspace(container);
  };
  container.querySelector("#salon-reset-filters-btn")?.addEventListener("click", handleReset);
  container.querySelector("#empty-reset-btn")?.addEventListener("click", handleReset);

  // Refresh Button
  container.querySelector("#refresh-salons-btn")?.addEventListener("click", async () => {
    showToast("Refreshing salon registry...");
    await loadInitialSalonsList();
    renderSalonDirectoryWorkspace(container);
  });

  // Pagination Buttons
  container.querySelector("#pg-first-btn")?.addEventListener("click", () => {
    STATE.salonsView.page = 0;
    updateUrlParams({ page: 0 });
    renderSalonDirectoryWorkspace(container);
  });

  container.querySelector("#pg-prev-btn")?.addEventListener("click", () => {
    STATE.salonsView.page = Math.max(0, STATE.salonsView.page - 1);
    updateUrlParams({ page: STATE.salonsView.page });
    renderSalonDirectoryWorkspace(container);
  });

  container.querySelector("#pg-next-btn")?.addEventListener("click", () => {
    STATE.salonsView.page = STATE.salonsView.page + 1;
    updateUrlParams({ page: STATE.salonsView.page });
    renderSalonDirectoryWorkspace(container);
  });

  container.querySelector("#pg-last-btn")?.addEventListener("click", () => {
    const pageSize = STATE.salonsView.size || 10;
    const totalPages = Math.ceil(allShops.length / pageSize);
    STATE.salonsView.page = Math.max(0, totalPages - 1);
    updateUrlParams({ page: STATE.salonsView.page });
    renderSalonDirectoryWorkspace(container);
  });

  container.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.getAttribute("data-page")) || 0;
      STATE.salonsView.page = p;
      updateUrlParams({ page: p });
      renderSalonDirectoryWorkspace(container);
    });
  });

  // Quick Action Buttons
  container.querySelectorAll("[data-action='view-profile']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const shop = allShops.find((s) => String(s.id) === String(id) || s.slug === id);
      if (shop) openSalonProfileDrawer(shop);
    });
  });

  container.querySelectorAll("[data-action='impersonate']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.getAttribute("data-slug");
      window.open(`../dashboard/index.html?slug=${slug}&impersonate=true`, "_blank");
    });
  });

  container.querySelectorAll("[data-action='change-status']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const targetStatus = btn.getAttribute("data-target-status");
      const shop = allShops.find((s) => String(s.id) === String(id) || s.slug === id);
      if (shop) openStatusConfirmModal(shop, targetStatus);
    });
  });

  container.querySelectorAll("[data-action='copy-booking-url']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      navigator.clipboard.writeText(url).then(() => {
        showToast("Customer booking link copied to clipboard! 📋");
      });
    });
  });

  // Toggle more menu
  container.querySelectorAll("[data-action='toggle-menu']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const menu = container.querySelector(`#row-menu-${id}`);
      // Hide other menus first
      container.querySelectorAll("[id^='row-menu-']").forEach((m) => {
        if (m !== menu) m.classList.add("hidden");
      });
      menu?.classList.toggle("hidden");
    });
  });

  // Close menus on outside click
  document.addEventListener("click", () => {
    container.querySelectorAll("[id^='row-menu-']").forEach((m) => m.classList.add("hidden"));
  }, { once: true });
}

/* =========================================================================
 * 8.1 STATUS CONFIRMATION MODAL WITH AUDIT TRAIL LOGGING
 * ========================================================================= */
function openStatusConfirmModal(shop, targetStatus) {
  STATE.salonsView.selectedShopForModal = shop;
  STATE.salonsView.targetStatusForModal = targetStatus;

  const modalBackdrop = document.getElementById("status-confirm-modal-backdrop");
  const modalTitle = document.getElementById("status-modal-title");
  const modalSalonName = document.getElementById("status-modal-salon-name");
  const currentBadge = document.getElementById("status-modal-current-badge");
  const targetBadge = document.getElementById("status-modal-target-badge");
  const warningBox = document.getElementById("status-modal-warning-box");
  const iconContainer = document.getElementById("status-modal-icon-container");
  const reasonSelect = document.getElementById("status-modal-reason-category");
  const notesTextarea = document.getElementById("status-modal-notes");
  const confirmCheckbox = document.getElementById("status-modal-confirm-checkbox");
  const submitBtn = document.getElementById("status-modal-submit-btn");
  const submitText = document.getElementById("status-modal-submit-text");

  if (!modalBackdrop) return;

  // Header & Identity
  if (modalTitle) modalTitle.innerText = `Confirm Status Change: ${targetStatus}`;
  if (modalSalonName) modalSalonName.innerHTML = `<strong class="text-white">${shop.name}</strong> • ${shop.crNumber} (${shop.city})`;

  // State Transition Badges
  if (currentBadge) {
    currentBadge.innerText = shop.status;
    currentBadge.className = `px-2.5 py-1 rounded-full text-[11px] font-bold font-mono inline-block mt-1 ${
      shop.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
    }`;
  }

  if (targetBadge) {
    targetBadge.innerText = targetStatus;
    targetBadge.className = `px-2.5 py-1 rounded-full text-[11px] font-bold font-mono inline-block mt-1 ${
      targetStatus === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
    }`;
  }

  // Warning Message & Impact
  if (warningBox) {
    if (targetStatus === "SUSPENDED") {
      warningBox.className = "p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 text-xs leading-relaxed space-y-1";
      warningBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-red-200">
          <span>⚠️</span> Critical Operational Impact: Suspension
        </div>
        <p>Suspending this salon immediately invalidates active slot holds, hides public booking options, and locks shop owner live schedule management. All staff will be marked offline.</p>
      `;
      if (iconContainer) {
        iconContainer.innerText = "🛑";
        iconContainer.className = "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0 bg-red-500/10 text-red-400 border border-red-500/30";
      }
    } else if (targetStatus === "ACTIVE") {
      warningBox.className = "p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-xs leading-relaxed space-y-1";
      warningBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-emerald-200">
          <span>✅</span> Activation Impact: Restoring Operations
        </div>
        <p>Activating this salon restores public customer appointment scheduling with 5-minute Redis locks, enables staff management, and restores tenant dashboard privileges.</p>
      `;
      if (iconContainer) {
        iconContainer.innerText = "✨";
        iconContainer.className = "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
      }
    } else {
      warningBox.className = "p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs leading-relaxed space-y-1";
      warningBox.innerHTML = `
        <div class="font-bold flex items-center gap-1.5 text-amber-200">
          <span>⏳</span> Review State: Pending Verification
        </div>
        <p>Setting status to Pending places this salon under compliance review. Public bookings will be paused until re-approved.</p>
      `;
      if (iconContainer) {
        iconContainer.innerText = "⏳";
        iconContainer.className = "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/30";
      }
    }
  }

  // Reset inputs
  if (reasonSelect) reasonSelect.selectedIndex = 0;
  if (notesTextarea) notesTextarea.value = "";
  if (confirmCheckbox) confirmCheckbox.checked = false;

  // Submit button initial state
  if (submitBtn) {
    submitBtn.disabled = true;
    if (targetStatus === "SUSPENDED") {
      submitBtn.className = "px-5 py-2.5 bg-red-600/40 text-slate-400 font-bold text-xs rounded-xl transition cursor-not-allowed flex items-center gap-2";
    } else {
      submitBtn.className = "px-5 py-2.5 bg-emerald-600/40 text-slate-400 font-bold text-xs rounded-xl transition cursor-not-allowed flex items-center gap-2";
    }
  }

  if (submitText) submitText.innerText = `Confirm ${targetStatus} & Log Audit`;

  // Display modal
  modalBackdrop.classList.remove("hidden");
}

function closeStatusConfirmModal() {
  const modalBackdrop = document.getElementById("status-confirm-modal-backdrop");
  modalBackdrop?.classList.add("hidden");
  STATE.salonsView.selectedShopForModal = null;
  STATE.salonsView.targetStatusForModal = null;
}

/* =========================================================================
 * 8.2 SALON PROFILE SLIDE-OVER DRAWER
 * ========================================================================= */
function openSalonProfileDrawer(shop) {
  STATE.salonsView.selectedShopForProfile = shop;

  const drawer = document.getElementById("salon-profile-drawer");
  const backdrop = document.getElementById("salon-profile-backdrop");
  const titleEl = document.getElementById("profile-drawer-title");
  const subtitleEl = document.getElementById("profile-drawer-subtitle");
  const bodyEl = document.getElementById("profile-drawer-body");
  const impersonateBtn = document.getElementById("profile-drawer-impersonate-btn");

  if (!drawer || !bodyEl) return;

  if (titleEl) titleEl.innerText = shop.name;
  if (subtitleEl) subtitleEl.innerText = `${shop.crNumber} • Slug: ${shop.slug}`;

  // Impersonate button in drawer footer
  if (impersonateBtn) {
    impersonateBtn.onclick = () => {
      window.open(`../dashboard/index.html?slug=${shop.slug}&impersonate=true`, "_blank");
    };
  }

  // Generate Profile Body
  bodyEl.innerHTML = `
    <!-- Top Identity Card -->
    <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl text-amber-400 font-bold shadow-md">
            ${(shop.name || "S").charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 class="text-sm font-extrabold text-white">${shop.name}</h3>
            <p class="text-[11px] text-slate-400 font-mono">${shop.crNumber}</p>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${
          shop.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
        }">
          ${shop.status}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/80 font-mono">
        <div>
          <span class="text-slate-400 block text-[10px]">SUBSCRIPTION PLAN</span>
          <span class="font-bold text-amber-400">${shop.plan || "MONTHLY"} (SAR)</span>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px]">ONBOARDING DATE</span>
          <span class="font-bold text-white">${new Date(shop.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>

    <!-- Contact & Ownership Card -->
    <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2.5">
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
        Owner & Communications
      </span>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <span class="text-[10px] text-slate-400 block">Owner Full Name</span>
          <span class="font-semibold text-white truncate block">${shop.owner || "Shop Owner"}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Verified Email</span>
          <span class="font-mono text-slate-300 truncate block">${shop.ownerEmail || "owner@barber.sa"}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">Saudi Phone</span>
          <span class="font-mono text-white block">📞 ${shop.phone}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">System Tenant ID</span>
          <span class="font-mono text-purple-400 font-bold block">#${shop.id}</span>
        </div>
      </div>
    </div>

    <!-- Geographic & Address Card -->
    <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
          National Address & Geolocation
        </span>
        ${shop.mapAddress ? `
          <a href="https://maps.google.com/?q=${encodeURIComponent(shop.fullAddress || shop.mapAddress)}" target="_blank" class="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-mono">
            <span>📍 Google Maps</span> ↗
          </a>
        ` : ""}
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div>
          <span class="text-[10px] text-slate-400 block">Region</span>
          <span class="font-semibold text-white block">${shop.region || "Riyadh Region"}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">City</span>
          <span class="font-semibold text-white block">${shop.city || "Riyadh"}</span>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 block">District</span>
          <span class="font-semibold text-white block">${shop.district || "Olaya"}</span>
        </div>
      </div>
      <div class="pt-2 border-t border-slate-800/80">
        <span class="text-[10px] text-slate-400 block">Physical Street Address</span>
        <span class="text-slate-200 block text-xs mt-0.5">${shop.fullAddress}</span>
      </div>
    </div>

    <!-- Dual QR Codes & Downloads Card -->
    <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block">
          Store Front & Live Access QR Codes
        </span>
        <button id="download-zip-btn" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition border border-slate-700 flex items-center gap-1">
          <span>📦</span> Download All (.ZIP)
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-1">
        <!-- Customer Booking QR -->
        <div class="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col items-center text-center space-y-2">
          <span class="text-[10px] font-bold text-amber-400 uppercase font-mono">Customer Booking</span>
          <div id="drawer-booking-qr-container" class="w-28 h-28 bg-white p-1.5 rounded-lg flex items-center justify-center shadow-inner">
            <!-- QR painted dynamically -->
          </div>
          <div class="flex items-center gap-1 w-full">
            <button id="download-booking-png-btn" class="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold transition">
              PNG
            </button>
            <button id="download-booking-svg-btn" class="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold transition">
              SVG
            </button>
          </div>
        </div>

        <!-- Shop Owner Login QR -->
        <div class="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col items-center text-center space-y-2">
          <span class="text-[10px] font-bold text-purple-400 uppercase font-mono">Staff & Login QR</span>
          <div id="drawer-login-qr-container" class="w-28 h-28 bg-white p-1.5 rounded-lg flex items-center justify-center shadow-inner">
            <!-- QR painted dynamically -->
          </div>
          <div class="flex items-center gap-1 w-full">
            <button id="download-login-png-btn" class="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold transition">
              PNG
            </button>
            <button id="download-login-svg-btn" class="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold transition">
              SVG
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick External Navigation Links -->
    <div class="space-y-2 pt-1">
      <a href="../booking.html?slug=${shop.slug}" target="_blank" class="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-between">
        <span class="flex items-center gap-2"><span>📅</span> Open Customer Booking Interface</span>
        <span>→</span>
      </a>
      <button id="drawer-change-status-btn" class="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition flex items-center justify-between">
        <span class="flex items-center gap-2"><span>⚡</span> Modify Operational Status</span>
        <span>${shop.status === "ACTIVE" ? "Suspend →" : "Activate →"}</span>
      </button>
    </div>
  `;

  // Paint QR codes
  setTimeout(() => {
    const bookingQrBox = document.getElementById("drawer-booking-qr-container");
    const loginQrBox = document.getElementById("drawer-login-qr-container");

    let bookingQrResult = null;
    let loginQrResult = null;

    if (bookingQrBox) {
      QrHelper.renderQr(bookingQrBox, shop.bookingUrl, 112).then((res) => {
        bookingQrResult = res;
      });
    }

    if (loginQrBox) {
      QrHelper.renderQr(loginQrBox, shop.loginUrl, 112).then((res) => {
        loginQrResult = res;
      });
    }

    // Bind QR downloads
    document.getElementById("download-booking-png-btn")?.addEventListener("click", () => {
      if (bookingQrResult && bookingQrResult.pngDataUrl) {
        QrHelper.downloadPng(bookingQrResult.pngDataUrl, `${shop.slug}-booking-qr.png`);
      } else {
        window.open(`http://localhost:8080/api/shops/${shop.id}/qr/booking?format=png`, "_blank");
      }
    });

    document.getElementById("download-booking-svg-btn")?.addEventListener("click", () => {
      if (bookingQrResult && bookingQrResult.svgString) {
        QrHelper.downloadSvg(bookingQrResult.svgString, `${shop.slug}-booking-qr.svg`);
      } else {
        window.open(`http://localhost:8080/api/shops/${shop.id}/qr/booking?format=svg`, "_blank");
      }
    });

    document.getElementById("download-login-png-btn")?.addEventListener("click", () => {
      if (loginQrResult && loginQrResult.pngDataUrl) {
        QrHelper.downloadPng(loginQrResult.pngDataUrl, `${shop.slug}-login-qr.png`);
      } else {
        window.open(`http://localhost:8080/api/shops/${shop.id}/qr/login?format=png`, "_blank");
      }
    });

    document.getElementById("download-login-svg-btn")?.addEventListener("click", () => {
      if (loginQrResult && loginQrResult.svgString) {
        QrHelper.downloadSvg(loginQrResult.svgString, `${shop.slug}-login-qr.svg`);
      } else {
        window.open(`http://localhost:8080/api/shops/${shop.id}/qr/login?format=svg`, "_blank");
      }
    });

    document.getElementById("download-zip-btn")?.addEventListener("click", () => {
      window.location.href = `http://localhost:8080/api/shops/${shop.id}/qr/zip`;
    });

    // Drawer status button
    document.getElementById("drawer-change-status-btn")?.addEventListener("click", () => {
      closeSalonProfileDrawer();
      const targetStatus = shop.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      openStatusConfirmModal(shop, targetStatus);
    });
  }, 50);

  // Show Drawer
  backdrop?.classList.remove("hidden");
  drawer?.classList.remove("translate-x-full");
}

function closeSalonProfileDrawer() {
  const drawer = document.getElementById("salon-profile-drawer");
  const backdrop = document.getElementById("salon-profile-backdrop");
  drawer?.classList.add("translate-x-full");
  backdrop?.classList.add("hidden");
  STATE.salonsView.selectedShopForProfile = null;
}

/* =========================================================================
 * 8.3 SALON MODALS & GLOBAL LISTENERS INITIALIZATION
 * ========================================================================= */
function initSalonModalEvents() {
  // Profile Drawer close
  document.getElementById("close-profile-drawer-btn")?.addEventListener("click", closeSalonProfileDrawer);
  document.getElementById("profile-drawer-close-btn")?.addEventListener("click", closeSalonProfileDrawer);
  document.getElementById("salon-profile-backdrop")?.addEventListener("click", closeSalonProfileDrawer);

  // Status Modal close
  document.getElementById("status-modal-close-x")?.addEventListener("click", closeStatusConfirmModal);
  document.getElementById("status-modal-cancel-btn")?.addEventListener("click", closeStatusConfirmModal);
  document.getElementById("status-confirm-modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "status-confirm-modal-backdrop") closeStatusConfirmModal();
  });

  // Checkbox unlocks Submit button
  const confirmCheckbox = document.getElementById("status-modal-confirm-checkbox");
  const submitBtn = document.getElementById("status-modal-submit-btn");

  confirmCheckbox?.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    if (!submitBtn) return;
    submitBtn.disabled = !isChecked;

    const targetStatus = STATE.salonsView.targetStatusForModal;
    if (isChecked) {
      if (targetStatus === "SUSPENDED") {
        submitBtn.className = "px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer";
      } else {
        submitBtn.className = "px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer";
      }
    } else {
      if (targetStatus === "SUSPENDED") {
        submitBtn.className = "px-5 py-2.5 bg-red-600/40 text-slate-400 font-bold text-xs rounded-xl transition cursor-not-allowed flex items-center gap-2";
      } else {
        submitBtn.className = "px-5 py-2.5 bg-emerald-600/40 text-slate-400 font-bold text-xs rounded-xl transition cursor-not-allowed flex items-center gap-2";
      }
    }
  });

  // Submit Status Change with Audit Trail Logging
  submitBtn?.addEventListener("click", async () => {
    const shop = STATE.salonsView.selectedShopForModal;
    const targetStatus = STATE.salonsView.targetStatusForModal;
    if (!shop || !targetStatus) return;

    const reasonCategory = document.getElementById("status-modal-reason-category")?.value || "Administrative Override";
    const notes = document.getElementById("status-modal-notes")?.value?.trim() || "";
    const fullAuditReason = notes ? `${reasonCategory}: ${notes}` : reasonCategory;

    // Spinner state
    const spinner = document.getElementById("status-modal-submit-spinner");
    const textEl = document.getElementById("status-modal-submit-text");
    if (spinner) spinner.classList.remove("hidden");
    if (textEl) textEl.innerText = "Recording Audit...";
    submitBtn.disabled = true;

    try {
      // 1. Post update to Backend API
      const res = await fetch(`http://localhost:8080/api/shops/${shop.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: targetStatus,
          reason: fullAuditReason,
          actorEmail: "admin@barberapp.sa"
        })
      });

      if (!res.ok) {
        console.warn("Backend API status update non-200, status:", res.status);
      }
    } catch (err) {
      console.warn("Backend API offline or network issue, applying client store fallback:", err);
    }

    // 2. Update Client-side Store to ensure offline resilience
    Store.updateShopStatus(shop.id || shop.slug, targetStatus);
    Store.addAuditLog(
      "admin@barberapp.sa",
      shop.name,
      `SHOP_STATUS_${targetStatus}`,
      fullAuditReason
    );

    // 3. Update STATE.salons entry
    const localMatch = STATE.salons.find((s) => String(s.id) === String(shop.id) || s.slug === shop.slug);
    if (localMatch) {
      localMatch.status = targetStatus;
    }

    // 4. Close Modal
    if (spinner) spinner.classList.add("hidden");
    closeStatusConfirmModal();

    // 5. Toast Notification with link to Audit Log view
    showToast(`Salon "${shop.name}" status updated to ${targetStatus}! Audit log recorded 🛡️`);

    // 6. Re-render Workspace
    const workspace = document.getElementById("admin-workspace");
    if (workspace && STATE.currentView === "salons") {
      renderSalonDirectoryWorkspace(workspace);
    }
  });
}


/* =========================================================================
 * 9. SYSTEM CONFIGURATION WORKSPACE & RUNTIME ENGINE
 * ========================================================================= */

function initSystemSettings() {
  if (!STATE.settings) {
    STATE.settings = Store.getSettings();
    STATE.settingsDraft = JSON.parse(JSON.stringify(STATE.settings));
    STATE.settingsDirty = false;
    STATE.settingsErrors = {};
  }
}

function getTabDisplayName(tabKey) {
  const names = {
    general: "General App Config",
    billing: "Billing & Tax Settings",
    notifications: "Notification & SMS Gateway",
    features: "Feature Flags"
  };
  return names[tabKey] || tabKey;
}

function showUnsavedChangesModal(onProceed, contextDesc = "switching views") {
  STATE.pendingNavigation = onProceed;
  const modal = document.getElementById("unsaved-changes-modal");
  const descEl = document.getElementById("unsaved-modal-description");
  if (descEl) {
    const activeTabName = getTabDisplayName(STATE.settingsTab);
    descEl.innerHTML = `You have modified settings in the <strong class="text-amber-400 font-semibold">${activeTabName}</strong> tab that have not been saved to the configuration cache. Proceeding with ${contextDesc} will discard these unsaved changes.`;
  }
  if (modal) modal.classList.remove("hidden");
}

function closeUnsavedChangesModal() {
  const modal = document.getElementById("unsaved-changes-modal");
  if (modal) modal.classList.add("hidden");
  STATE.pendingNavigation = null;
}

function initUnsavedChangesModalEvents() {
  document.getElementById("unsaved-modal-close-x")?.addEventListener("click", closeUnsavedChangesModal);
  document.getElementById("unsaved-modal-stay-btn")?.addEventListener("click", closeUnsavedChangesModal);

  // Discard & Proceed
  document.getElementById("unsaved-modal-discard-btn")?.addEventListener("click", () => {
    const callback = STATE.pendingNavigation;
    // Discard draft
    STATE.settingsDraft = JSON.parse(JSON.stringify(STATE.settings));
    STATE.settingsDirty = false;
    STATE.settingsErrors = {};
    closeUnsavedChangesModal();
    if (typeof callback === "function") {
      callback();
    } else {
      renderCurrentView();
    }
  });

  // Save & Proceed
  document.getElementById("unsaved-modal-save-btn")?.addEventListener("click", () => {
    const { valid, errors } = validateCurrentTab();
    if (!valid) {
      closeUnsavedChangesModal();
      showToast("Cannot proceed: please correct validation errors before saving! ⚠️");
      STATE.settingsErrors = errors;
      renderCurrentView();
      return;
    }
    const callback = STATE.pendingNavigation;
    saveSettingsState(false);
    closeUnsavedChangesModal();
    if (typeof callback === "function") {
      callback();
    } else {
      renderCurrentView();
    }
  });
}

function switchSettingsTab(targetTab) {
  if (targetTab === STATE.settingsTab) return;
  if (STATE.settingsDirty) {
    showUnsavedChangesModal(() => {
      // Discard current changes and navigate to target tab
      STATE.settingsDraft = JSON.parse(JSON.stringify(STATE.settings));
      STATE.settingsDirty = false;
      STATE.settingsErrors = {};
      STATE.settingsTab = targetTab;
      renderCurrentView();
    }, `switching to the "${getTabDisplayName(targetTab)}" tab`);
    return;
  }
  STATE.settingsTab = targetTab;
  renderCurrentView();
}

function validateField(field, value) {
  switch (field) {
    case "platformName":
      if (!value || String(value).trim().length < 2) return "Platform name must be at least 2 characters long.";
      if (String(value).trim().length > 60) return "Platform name cannot exceed 60 characters.";
      return null;

    case "supportEmail":
    case "smtpSenderEmail":
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
        return "Please enter a valid RFC-compliant email address (e.g. support@barberapp.sa).";
      }
      return null;

    case "supportPhone": {
      const cleaned = String(value || "").replace(/[\s\-\(\)]/g, "");
      if (!cleaned || !/^(\+?966|0)?5[0-9]{8}$/.test(cleaned)) {
        return "Please enter a valid Saudi phone number (e.g. +966 50 123 4567 or 0501234567).";
      }
      return null;
    }

    case "slotHoldTimeoutMinutes": {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 60) {
        return "Slot hold lock TTL must be an integer between 1 and 60 minutes.";
      }
      return null;
    }

    case "vatRate": {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 100) {
        return "VAT rate percentage must be between 0.0% and 100.0%.";
      }
      return null;
    }

    case "vatRegistrationNumber": {
      const cleaned = String(value || "").trim();
      if (!/^\d{15}$/.test(cleaned)) {
        return "ZATCA Tax Identification Number must be exactly 15 digits (e.g. 300123456700003).";
      }
      if (!cleaned.startsWith("3") || !cleaned.endsWith("3")) {
        return "ZATCA VAT numbers in KSA must start with 3 and end with 3.";
      }
      return null;
    }

    case "monthlySubscriptionPrice": {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return "Monthly subscription price must be greater than 0 SAR.";
      }
      return null;
    }

    case "yearlySubscriptionPrice": {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return "Yearly subscription price must be greater than 0 SAR.";
      }
      return null;
    }

    case "moyasarSecretKey": {
      const str = String(value || "").trim();
      if (!str) return "Moyasar API key is required.";
      if (STATE.settingsDraft.moyasarGatewayMode === "live" && !str.startsWith("sk_live_")) {
        return "Live gateway mode requires a key starting with 'sk_live_'.";
      }
      if (STATE.settingsDraft.moyasarGatewayMode === "sandbox" && !str.startsWith("sk_test_")) {
        return "Sandbox gateway mode requires a key starting with 'sk_test_'.";
      }
      return null;
    }

    case "moyasarWebhookSecret": {
      const str = String(value || "").trim();
      if (!str || str.length < 8) {
        return "Webhook secret must be at least 8 characters long.";
      }
      return null;
    }

    case "invoicePrefix": {
      const str = String(value || "").trim();
      if (!str || str.length < 2 || str.length > 15) {
        return "Invoice prefix must be between 2 and 15 characters (e.g. INV-KSA-).";
      }
      return null;
    }

    case "smsSenderId": {
      const str = String(value || "").trim();
      if (STATE.settingsDraft.smsEnabled) {
        if (!str || !/^[A-Za-z0-9]{3,11}$/.test(str)) {
          return "CITC Sender ID must be 3 to 11 alphanumeric characters (no spaces or symbols).";
        }
      }
      return null;
    }

    case "smsApiKey": {
      if (STATE.settingsDraft.smsEnabled && (!value || String(value).trim().length < 4)) {
        return "SMS API Key is required when SMS Gateway is active.";
      }
      return null;
    }

    case "smsReminderHoursBefore": {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 72) {
        return "Reminder lead time must be an integer between 1 and 72 hours.";
      }
      return null;
    }

    case "smtpHost": {
      if (STATE.settingsDraft.emailNotificationsEnabled && (!value || String(value).trim().length < 3)) {
        return "Valid SMTP server hostname or IP is required.";
      }
      return null;
    }

    case "smtpPort": {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1 || num > 65535) {
        return "SMTP port must be an integer between 1 and 65535 (standard: 587 or 465).";
      }
      return null;
    }

    case "maintenanceNotice": {
      if (STATE.settingsDraft.maintenanceMode && (!value || String(value).trim().length < 5)) {
        return "A broadcast message is required when maintenance mode is active.";
      }
      return null;
    }

    default:
      return null;
  }
}

function getTabFields(tabKey) {
  switch (tabKey) {
    case "general":
      return ["platformName", "supportEmail", "supportPhone", "timezone", "defaultCurrency", "slotHoldTimeoutMinutes", "maintenanceNotice"];
    case "billing":
      return ["vatRate", "vatRegistrationNumber", "monthlySubscriptionPrice", "yearlySubscriptionPrice", "moyasarSecretKey", "moyasarWebhookSecret", "invoicePrefix"];
    case "notifications":
      return ["smsSenderId", "smsApiKey", "smsReminderHoursBefore", "smtpHost", "smtpPort", "smtpSenderEmail"];
    case "features":
      return [];
    default:
      return [];
  }
}

function validateCurrentTab() {
  const fields = getTabFields(STATE.settingsTab);
  const errors = {};
  let valid = true;

  fields.forEach((field) => {
    const error = validateField(field, STATE.settingsDraft[field]);
    if (error) {
      errors[field] = error;
      valid = false;
    }
  });

  return { valid, errors };
}

function isDraftDifferentFromSaved() {
  if (!STATE.settings || !STATE.settingsDraft) return false;
  return JSON.stringify(STATE.settings) !== JSON.stringify(STATE.settingsDraft);
}

function saveSettingsState(reRender = true) {
  const { valid, errors } = validateCurrentTab();
  if (!valid) {
    STATE.settingsErrors = errors;
    if (reRender) renderCurrentView();
    showToast("Validation failed: Please correct highlighted fields before saving. ⚠️");
    return false;
  }

  // 1. Commit draft to state & persistent store
  STATE.settings = JSON.parse(JSON.stringify(STATE.settingsDraft));
  Store.saveSettings(STATE.settings);

  // 2. Audit Trail Log
  const tabName = getTabDisplayName(STATE.settingsTab);
  Store.addAuditLog(
    "admin@barberapp.sa",
    "Global System",
    "SYSTEM_CONFIG_UPDATED",
    `Saved ${tabName} parameters to active application cache & local store.`
  );

  // 3. Reset dirty & errors
  STATE.settingsDirty = false;
  STATE.settingsErrors = {};

  // 4. Toast Notification
  showToast(`System configuration (${tabName}) saved successfully! ⚙️ Cache synchronized.`);

  if (reRender) {
    renderCurrentView();
  }
  return true;
}

function discardActiveChanges(reRender = true) {
  STATE.settingsDraft = JSON.parse(JSON.stringify(STATE.settings));
  STATE.settingsDirty = false;
  STATE.settingsErrors = {};
  if (reRender) {
    showToast("Unsaved changes discarded. Form reset to saved configuration. ↩️");
    renderCurrentView();
  }
}

function resetSettingsToFactoryDefaults() {
  if (confirm("Are you sure you want to reset all platform configuration parameters to factory defaults? This will overwrite your local configuration.")) {
    const defaults = Store.resetSettings();
    STATE.settings = JSON.parse(JSON.stringify(defaults));
    STATE.settingsDraft = JSON.parse(JSON.stringify(defaults));
    STATE.settingsDirty = false;
    STATE.settingsErrors = {};

    Store.addAuditLog(
      "admin@barberapp.sa",
      "Global System",
      "SYSTEM_CONFIG_FACTORY_RESET",
      "Reset all system platform settings to factory default schema."
    );

    showToast("System configuration successfully reset to factory defaults! 🔄");
    renderCurrentView();
  }
}

function renderSystemSettingsWorkspace(container) {
  initSystemSettings();
  const d = STATE.settingsDraft;
  const isDirty = STATE.settingsDirty;
  const activeTab = STATE.settingsTab;
  const errors = STATE.settingsErrors || {};

  container.innerHTML = `
    <!-- 1. Header Banner -->
    <div class="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F59E0B]/20 to-amber-500/10 border border-[#F59E0B]/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
          ⚙️
        </div>
        <div>
          <div class="flex items-center gap-2.5">
            <h2 class="text-lg font-black text-white tracking-tight">System Platform Configuration</h2>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono ${isDirty ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
              ${isDirty ? '● Unsaved Edits' : '✓ Cache Synced'}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Real-time runtime variables, payment gateways, tax compliance, and platform feature flags</p>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <button id="btn-factory-reset" class="px-3.5 py-2.5 bg-slate-800/80 hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-700/80 hover:border-red-500/40 text-xs font-semibold rounded-xl transition flex items-center gap-1.5" title="Reset all settings to initial defaults">
          <span>🔄</span>
          <span>Factory Reset</span>
        </button>
        ${isDirty ? `
          <button id="btn-discard-header" class="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700">
            Discard
          </button>
        ` : ''}
        <button id="btn-save-header" class="px-5 py-2.5 ${isDirty ? 'bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 shadow-lg shadow-[#F59E0B]/20 ring-2 ring-[#F59E0B]/30' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'} text-xs font-black rounded-xl transition flex items-center gap-2">
          <span>💾</span>
          <span>Save Changes</span>
        </button>
      </div>
    </div>

    <!-- 2. Unsaved Changes Alert Bar (Visible if dirty) -->
    ${isDirty ? `
      <div id="settings-unsaved-alert" class="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl backdrop-blur-md animate-scaleIn">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold shrink-0">
            ⚠️
          </div>
          <div>
            <h4 class="text-xs font-extrabold text-amber-300">Pending Modifications in "${getTabDisplayName(activeTab)}"</h4>
            <p class="text-[11px] text-slate-300">You have unsaved changes. Switching tabs or navigating away will require confirmation.</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button id="btn-discard-banner" class="px-3.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition">
            Discard
          </button>
          <button id="btn-save-banner" class="px-4 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 text-xs font-black rounded-lg transition shadow-md shadow-[#F59E0B]/20 flex items-center gap-1.5">
            <span>💾</span>
            <span>Save Configuration</span>
          </button>
        </div>
      </div>
    ` : ''}

    <!-- 3. Navigation Tabs -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
      <button data-settings-tab="general" class="settings-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition border ${activeTab === 'general' ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-md shadow-[#F59E0B]/5' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'}">
        <span>⚙️</span>
        <span>General App Config</span>
      </button>

      <button data-settings-tab="billing" class="settings-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition border ${activeTab === 'billing' ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-md shadow-[#F59E0B]/5' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'}">
        <span>💳</span>
        <span>Billing & Tax Settings</span>
      </button>

      <button data-settings-tab="notifications" class="settings-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition border ${activeTab === 'notifications' ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-md shadow-[#F59E0B]/5' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'}">
        <span>📱</span>
        <span>Notification & SMS Gateway</span>
      </button>

      <button data-settings-tab="features" class="settings-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition border ${activeTab === 'features' ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-white shadow-md shadow-[#F59E0B]/5' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'}">
        <span>🚩</span>
        <span>Feature Flags</span>
      </button>
    </div>

    <!-- 4. Tab Content Body -->
    <div id="settings-tab-content" class="space-y-6">
      ${renderActiveTabContent(activeTab, d, errors)}
    </div>

    <!-- 5. Bottom Sticky Footer -->
    <div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
      <div class="text-xs text-slate-400">
        <span class="font-mono text-slate-300">Storage Scope:</span> Local Cache & Indexed Config • Actor: <span class="font-mono text-amber-400">admin@barberapp.sa</span>
      </div>
      <div class="flex items-center gap-3">
        ${isDirty ? `
          <button id="btn-discard-bottom" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition border border-slate-700">
            Discard Changes
          </button>
        ` : ''}
        <button id="btn-save-bottom" class="px-6 py-2.5 ${isDirty ? 'bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 shadow-lg shadow-[#F59E0B]/20' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'} font-black text-xs rounded-xl transition flex items-center gap-2">
          <span>💾</span>
          <span>Save System Configuration</span>
        </button>
      </div>
    </div>
  `;

  // Attach Event Handlers
  wireSettingsEventListeners(container);
}

function renderActiveTabContent(activeTab, d, errors) {
  if (activeTab === "general") {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Platform Identity Card -->
        <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>🏛️</span> Core Platform Identity & White-Label
            </h3>
            <span class="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">General</span>
          </div>

          <div class="space-y-4 text-xs">
            <div>
              <label for="cfg-platformName" class="block font-semibold text-slate-300 mb-1.5">
                Platform Name (White-Label) <span class="text-red-400">*</span>
              </label>
              <input id="cfg-platformName" name="platformName" type="text" value="${escapeHtml(d.platformName || '')}" class="w-full bg-slate-950 border ${errors.platformName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-[#F59E0B] transition" placeholder="e.g. BarberApp KSA" />
              <p class="text-[11px] text-slate-400 mt-1">Rendered across page titles, invoices, and automated communications</p>
              ${errors.platformName ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.platformName}</p>` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="cfg-supportEmail" class="block font-semibold text-slate-300 mb-1.5">
                  Central Support Email <span class="text-red-400">*</span>
                </label>
                <input id="cfg-supportEmail" name="supportEmail" type="email" value="${escapeHtml(d.supportEmail || '')}" class="w-full bg-slate-950 border ${errors.supportEmail ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="support@barberapp.sa" />
                ${errors.supportEmail ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.supportEmail}</p>` : ''}
              </div>

              <div>
                <label for="cfg-supportPhone" class="block font-semibold text-slate-300 mb-1.5">
                  Support Hotline (Saudi Format) <span class="text-red-400">*</span>
                </label>
                <input id="cfg-supportPhone" name="supportPhone" type="text" value="${escapeHtml(d.supportPhone || '')}" class="w-full bg-slate-950 border ${errors.supportPhone ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="+966 50 123 4567" />
                ${errors.supportPhone ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.supportPhone}</p>` : ''}
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="cfg-timezone" class="block font-semibold text-slate-300 mb-1.5">
                  Primary Timezone
                </label>
                <select id="cfg-timezone" name="timezone" class="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#F59E0B] transition">
                  <option value="Asia/Riyadh" ${d.timezone === 'Asia/Riyadh' ? 'selected' : ''}>Asia/Riyadh (KSA Standard GMT+3)</option>
                  <option value="Asia/Dubai" ${d.timezone === 'Asia/Dubai' ? 'selected' : ''}>Asia/Dubai (UAE GMT+4)</option>
                  <option value="UTC" ${d.timezone === 'UTC' ? 'selected' : ''}>UTC (Universal Coordinated Time)</option>
                </select>
              </div>

              <div>
                <label for="cfg-defaultCurrency" class="block font-semibold text-slate-300 mb-1.5">
                  Default Operational Currency
                </label>
                <select id="cfg-defaultCurrency" name="defaultCurrency" class="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-[#F59E0B] transition">
                  <option value="SAR" ${d.defaultCurrency === 'SAR' ? 'selected' : ''}>SAR (Saudi Riyal / ر.س)</option>
                  <option value="USD" ${d.defaultCurrency === 'USD' ? 'selected' : ''}>USD (United States Dollar)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Concurrency & Maintenance Card -->
        <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>🔒</span> Redis Concurrency & System Availability
            </h3>
            <span class="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">Infrastructure</span>
          </div>

          <div class="space-y-4 text-xs">
            <div>
              <label for="cfg-slotHoldTimeoutMinutes" class="block font-semibold text-slate-300 mb-1.5">
                Slot Hold Lock Duration (TTL) <span class="text-red-400">*</span>
              </label>
              <div class="flex items-center gap-3">
                <input id="cfg-slotHoldTimeoutMinutes" name="slotHoldTimeoutMinutes" type="number" min="1" max="60" value="${escapeHtml(d.slotHoldTimeoutMinutes || 5)}" class="w-32 bg-slate-950 border ${errors.slotHoldTimeoutMinutes ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-[#F59E0B] font-bold rounded-xl px-3.5 py-2.5 font-mono text-sm focus:outline-none focus:border-[#F59E0B] transition" />
                <span class="text-slate-400 font-medium">Minutes (Redisson Distributed Lock Lease)</span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">Duration a selected appointment slot is reserved in Redis before auto-release if payment is abandoned</p>
              ${errors.slotHoldTimeoutMinutes ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.slotHoldTimeoutMinutes}</p>` : ''}
            </div>

            <!-- Maintenance Mode Toggle -->
            <div class="pt-3 border-t border-slate-800/80">
              <div class="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <p class="font-bold text-white">Platform Maintenance Mode</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">When enabled, customer booking and shop owner dashboards show a broadcast notice</p>
                </div>
                <button type="button" role="switch" aria-checked="${d.maintenanceMode ? 'true' : 'false'}" data-field="maintenanceMode" class="setting-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${d.maintenanceMode ? 'bg-red-500' : 'bg-slate-800'}">
                  <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${d.maintenanceMode ? 'translate-x-5' : 'translate-x-0'}"></span>
                </button>
              </div>
            </div>

            <!-- Maintenance Notice -->
            <div class="${d.maintenanceMode ? '' : 'opacity-70'}">
              <label for="cfg-maintenanceNotice" class="block font-semibold text-slate-300 mb-1.5">
                Maintenance Notice Message ${d.maintenanceMode ? '<span class="text-red-400">*</span>' : ''}
              </label>
              <textarea id="cfg-maintenanceNotice" name="maintenanceNotice" rows="3" class="w-full bg-slate-950 border ${errors.maintenanceNotice ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl p-3 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="Scheduled maintenance in progress...">${escapeHtml(d.maintenanceNotice || '')}</textarea>
              ${errors.maintenanceNotice ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.maintenanceNotice}</p>` : ''}
            </div>
          </div>
        </div>

      </div>
    `;
  }

  if (activeTab === "billing") {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- ZATCA Saudi Tax Compliance Card -->
        <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>🧾</span> ZATCA Tax Compliance & E-Invoicing
            </h3>
            <span class="text-[10px] text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">FATOORA KSA</span>
          </div>

          <div class="space-y-4 text-xs">
            <div>
              <label for="cfg-vatRate" class="block font-semibold text-slate-300 mb-1.5">
                Value Added Tax (VAT) Rate <span class="text-red-400">*</span>
              </label>
              <div class="flex items-center gap-2">
                <input id="cfg-vatRate" name="vatRate" type="number" step="0.1" min="0" max="100" value="${escapeHtml(d.vatRate ?? 15.0)}" class="w-28 bg-slate-950 border ${errors.vatRate ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-emerald-400 font-bold rounded-xl px-3.5 py-2.5 font-mono text-sm focus:outline-none focus:border-[#F59E0B] transition" />
                <span class="text-slate-300 font-bold">% (Standard KSA Statutory VAT)</span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1">Applied to salon registration plans and customer booking receipts</p>
              ${errors.vatRate ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.vatRate}</p>` : ''}
            </div>

            <div>
              <label for="cfg-vatRegistrationNumber" class="block font-semibold text-slate-300 mb-1.5">
                ZATCA Tax Identification Number (TIN / الرقم الضريبي) <span class="text-red-400">*</span>
              </label>
              <input id="cfg-vatRegistrationNumber" name="vatRegistrationNumber" type="text" maxlength="15" value="${escapeHtml(d.vatRegistrationNumber || '')}" class="w-full bg-slate-950 border ${errors.vatRegistrationNumber ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="300123456700003" />
              <p class="text-[11px] text-slate-400 mt-1">Must be exactly 15 digits conforming to ZATCA specification</p>
              ${errors.vatRegistrationNumber ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.vatRegistrationNumber}</p>` : ''}
            </div>

            <div>
              <label for="cfg-invoicePrefix" class="block font-semibold text-slate-300 mb-1.5">
                Tax Invoice Numbering Prefix <span class="text-red-400">*</span>
              </label>
              <input id="cfg-invoicePrefix" name="invoicePrefix" type="text" value="${escapeHtml(d.invoicePrefix || 'INV-KSA-')}" class="w-full bg-slate-950 border ${errors.invoicePrefix ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="INV-KSA-" />
              ${errors.invoicePrefix ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.invoicePrefix}</p>` : ''}
            </div>

            <!-- Auto-Approval Toggle -->
            <div class="pt-3 border-t border-slate-800/80">
              <div class="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <p class="font-bold text-white">Auto-Approve Salon on Verified Payment</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">Automatically change status from PENDING to ACTIVE upon Moyasar webhook confirmation</p>
                </div>
                <button type="button" role="switch" aria-checked="${d.autoApprovePaidShops ? 'true' : 'false'}" data-field="autoApprovePaidShops" class="setting-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${d.autoApprovePaidShops ? 'bg-emerald-500' : 'bg-slate-800'}">
                  <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${d.autoApprovePaidShops ? 'translate-x-5' : 'translate-x-0'}"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Moyasar Gateway & Subscription Pricing Card -->
        <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>💳</span> Moyasar Gateway & Subscription Plans
            </h3>
            <span class="text-[10px] text-blue-400 font-mono bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">Saudi Mada / Apple Pay</span>
          </div>

          <div class="space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="cfg-monthlySubscriptionPrice" class="block font-semibold text-slate-300 mb-1.5">
                  Monthly Subscription Fee <span class="text-red-400">*</span>
                </label>
                <div class="flex items-center gap-2">
                  <input id="cfg-monthlySubscriptionPrice" name="monthlySubscriptionPrice" type="number" step="1" min="1" value="${escapeHtml(d.monthlySubscriptionPrice ?? 20)}" class="w-full bg-slate-950 border ${errors.monthlySubscriptionPrice ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white font-bold rounded-xl px-3.5 py-2.5 font-mono text-sm focus:outline-none focus:border-[#F59E0B] transition" />
                  <span class="text-slate-400 font-mono">SAR/mo</span>
                </div>
                ${errors.monthlySubscriptionPrice ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.monthlySubscriptionPrice}</p>` : ''}
              </div>

              <div>
                <label for="cfg-yearlySubscriptionPrice" class="block font-semibold text-slate-300 mb-1.5">
                  Yearly Subscription Fee <span class="text-red-400">*</span>
                </label>
                <div class="flex items-center gap-2">
                  <input id="cfg-yearlySubscriptionPrice" name="yearlySubscriptionPrice" type="number" step="1" min="1" value="${escapeHtml(d.yearlySubscriptionPrice ?? 200)}" class="w-full bg-slate-950 border ${errors.yearlySubscriptionPrice ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white font-bold rounded-xl px-3.5 py-2.5 font-mono text-sm focus:outline-none focus:border-[#F59E0B] transition" />
                  <span class="text-slate-400 font-mono">SAR/yr</span>
                </div>
                ${errors.yearlySubscriptionPrice ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.yearlySubscriptionPrice}</p>` : ''}
              </div>
            </div>

            <div>
              <label for="cfg-moyasarGatewayMode" class="block font-semibold text-slate-300 mb-1.5">
                Moyasar Gateway Mode
              </label>
              <select id="cfg-moyasarGatewayMode" name="moyasarGatewayMode" class="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-[#F59E0B] transition">
                <option value="sandbox" ${d.moyasarGatewayMode === 'sandbox' ? 'selected' : ''}>SANDBOX / TEST MODE (Requires sk_test_...)</option>
                <option value="live" ${d.moyasarGatewayMode === 'live' ? 'selected' : ''}>PRODUCTION LIVE (Requires sk_live_...)</option>
              </select>
            </div>

            <div>
              <label for="cfg-moyasarSecretKey" class="block font-semibold text-slate-300 mb-1.5">
                Moyasar Secret API Key <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <input id="cfg-moyasarSecretKey" name="moyasarSecretKey" type="password" value="${escapeHtml(d.moyasarSecretKey || '')}" class="w-full bg-slate-950 border ${errors.moyasarSecretKey ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl pl-3.5 pr-10 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="sk_test_..." />
                <button type="button" data-toggle-password="cfg-moyasarSecretKey" class="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs">👁️</button>
              </div>
              ${errors.moyasarSecretKey ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.moyasarSecretKey}</p>` : ''}
            </div>

            <div>
              <label for="cfg-moyasarWebhookSecret" class="block font-semibold text-slate-300 mb-1.5">
                Moyasar Webhook Signature Secret (whsec_...) <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <input id="cfg-moyasarWebhookSecret" name="moyasarWebhookSecret" type="password" value="${escapeHtml(d.moyasarWebhookSecret || '')}" class="w-full bg-slate-950 border ${errors.moyasarWebhookSecret ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl pl-3.5 pr-10 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="whsec_..." />
                <button type="button" data-toggle-password="cfg-moyasarWebhookSecret" class="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs">👁️</button>
              </div>
              ${errors.moyasarWebhookSecret ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.moyasarWebhookSecret}</p>` : ''}
            </div>

            <div class="pt-2">
              <button id="btn-test-moyasar" type="button" class="w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2">
                <span>⚡</span>
                <span>Test Moyasar Connection Ping</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  if (activeTab === "notifications") {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Saudi SMS Gateway Card -->
        <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>📱</span> CITC Saudi SMS Gateway Integration
            </h3>
            <span class="text-[10px] text-purple-400 font-mono bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">SMS Gateway</span>
          </div>

          <div class="space-y-4 text-xs">
            <div class="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <p class="font-bold text-white">Master SMS Outbound Dispatch</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Enable sending real-time transactional SMS notifications to customers</p>
              </div>
              <button type="button" role="switch" aria-checked="${d.smsEnabled ? 'true' : 'false'}" data-field="smsEnabled" class="setting-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${d.smsEnabled ? 'bg-emerald-500' : 'bg-slate-800'}">
                <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${d.smsEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
              </button>
            </div>

            <div>
              <label for="cfg-smsProvider" class="block font-semibold text-slate-300 mb-1.5">
                Primary SMS Provider
              </label>
              <select id="cfg-smsProvider" name="smsProvider" class="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#F59E0B] transition">
                <option value="Taqnyat" ${d.smsProvider === 'Taqnyat' ? 'selected' : ''}>Taqnyat (Saudi CITC Licensed Provider)</option>
                <option value="Unifonic" ${d.smsProvider === 'Unifonic' ? 'selected' : ''}>Unifonic (KSA Enterprise SMS)</option>
                <option value="Twilio" ${d.smsProvider === 'Twilio' ? 'selected' : ''}>Twilio (International Gateway)</option>
                <option value="Mock Gateway" ${d.smsProvider === 'Mock Gateway' ? 'selected' : ''}>Mock Gateway (Local Testing)</option>
              </select>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="cfg-smsSenderId" class="block font-semibold text-slate-300 mb-1.5">
                  CITC Sender ID <span class="text-red-400">*</span>
                </label>
                <input id="cfg-smsSenderId" name="smsSenderId" type="text" maxlength="11" value="${escapeHtml(d.smsSenderId || 'BarberApp')}" class="w-full bg-slate-950 border ${errors.smsSenderId ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="BarberApp" />
                <p class="text-[11px] text-slate-400 mt-1">3-11 alphanumeric characters approved by CITC</p>
                ${errors.smsSenderId ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.smsSenderId}</p>` : ''}
              </div>

              <div>
                <label for="cfg-smsReminderHoursBefore" class="block font-semibold text-slate-300 mb-1.5">
                  Reminder Lead Time (Hours) <span class="text-red-400">*</span>
                </label>
                <input id="cfg-smsReminderHoursBefore" name="smsReminderHoursBefore" type="number" min="1" max="72" value="${escapeHtml(d.smsReminderHoursBefore ?? 2)}" class="w-full bg-slate-950 border ${errors.smsReminderHoursBefore ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-[#F59E0B] font-bold rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" />
                <p class="text-[11px] text-slate-400 mt-1">Hours before appointment to send SMS</p>
                ${errors.smsReminderHoursBefore ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.smsReminderHoursBefore}</p>` : ''}
              </div>
            </div>

            <div>
              <label for="cfg-smsApiKey" class="block font-semibold text-slate-300 mb-1.5">
                SMS Provider API Secret Key <span class="text-red-400">*</span>
              </label>
              <div class="relative">
                <input id="cfg-smsApiKey" name="smsApiKey" type="password" value="${escapeHtml(d.smsApiKey || '')}" class="w-full bg-slate-950 border ${errors.smsApiKey ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl pl-3.5 pr-10 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="tq_live_..." />
                <button type="button" data-toggle-password="cfg-smsApiKey" class="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs">👁️</button>
              </div>
              ${errors.smsApiKey ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.smsApiKey}</p>` : ''}
            </div>

            <div class="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <p class="font-bold text-white">Instant Booking Confirmation SMS</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Send SMS immediately when customer booking is confirmed</p>
              </div>
              <button type="button" role="switch" aria-checked="${d.smsAppointmentConfirm ? 'true' : 'false'}" data-field="smsAppointmentConfirm" class="setting-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${d.smsAppointmentConfirm ? 'bg-emerald-500' : 'bg-slate-800'}">
                <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${d.smsAppointmentConfirm ? 'translate-x-5' : 'translate-x-0'}"></span>
              </button>
            </div>

            <div class="pt-2">
              <button id="btn-test-sms" type="button" class="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2">
                <span>📲</span>
                <span>Send Mock SMS to Test Number</span>
              </button>
            </div>
          </div>
        </div>

        <!-- SMTP Email Gateway Card -->
        <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>✉️</span> SMTP Email Gateway & Calendar Invites
            </h3>
            <span class="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">SMTP Outbound</span>
          </div>

          <div class="space-y-4 text-xs">
            <div class="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <p class="font-bold text-white">Master Email Outbound Gateway</p>
                <p class="text-[11px] text-slate-400 mt-0.5">Enable sending booking confirmations, .ics calendar attachments, and receipts</p>
              </div>
              <button type="button" role="switch" aria-checked="${d.emailNotificationsEnabled ? 'true' : 'false'}" data-field="emailNotificationsEnabled" class="setting-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${d.emailNotificationsEnabled ? 'bg-emerald-500' : 'bg-slate-800'}">
                <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${d.emailNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
              </button>
            </div>

            <div>
              <label for="cfg-smtpHost" class="block font-semibold text-slate-300 mb-1.5">
                SMTP Server Hostname / IP <span class="text-red-400">*</span>
              </label>
              <input id="cfg-smtpHost" name="smtpHost" type="text" value="${escapeHtml(d.smtpHost || '')}" class="w-full bg-slate-950 border ${errors.smtpHost ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="smtp.mail.sa-east.internal" />
              ${errors.smtpHost ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.smtpHost}</p>` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="cfg-smtpPort" class="block font-semibold text-slate-300 mb-1.5">
                  SMTP Port <span class="text-red-400">*</span>
                </label>
                <input id="cfg-smtpPort" name="smtpPort" type="number" min="1" max="65535" value="${escapeHtml(d.smtpPort ?? 587)}" class="w-full bg-slate-950 border ${errors.smtpPort ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-[#F59E0B] font-bold rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="587" />
                <p class="text-[11px] text-slate-400 mt-1">Standard: 587 (STARTTLS), 465 (SSL)</p>
                ${errors.smtpPort ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.smtpPort}</p>` : ''}
              </div>

              <div>
                <label for="cfg-smtpSenderEmail" class="block font-semibold text-slate-300 mb-1.5">
                  Sender Email Address <span class="text-red-400">*</span>
                </label>
                <input id="cfg-smtpSenderEmail" name="smtpSenderEmail" type="email" value="${escapeHtml(d.smtpSenderEmail || '')}" class="w-full bg-slate-950 border ${errors.smtpSenderEmail ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-800'} text-white rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#F59E0B] transition" placeholder="noreply@barberapp.sa" />
                ${errors.smtpSenderEmail ? `<p class="text-[11px] text-red-400 mt-1 font-mono">⚠️ ${errors.smtpSenderEmail}</p>` : ''}
              </div>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  if (activeTab === "features") {
    const flags = [
      {
        field: "enableMultiBarberSelect",
        icon: "✂️",
        title: "Multi-Barber Selection during Booking",
        desc: "Allows customers on `/book.html` to browse individual master barbers or pick 'Any Available Barber'."
      },
      {
        field: "enableSlotHoldCountdown",
        icon: "⏱️",
        title: "Redis Slot Hold Countdown Timer",
        desc: "Displays an animated 5-minute countdown clock to the customer during checkout before the lock expires."
      },
      {
        field: "enableWalkinQuickBooking",
        icon: "🚶",
        title: "Walk-in Queue Quick Booking Interface",
        desc: "Enables fast walk-in manual reservation modal on shop owner dashboards (`/dashboard/index.html`)."
      },
      {
        field: "enablePublicSalonDirectory",
        icon: "🏛️",
        title: "Public Salon Directory Browsing",
        desc: "Permits public visitors to search registered active salons across KSA on `/salons.html`."
      },
      {
        field: "enableMadaApplePay",
        icon: "💳",
        title: "Saudi Mada & Apple Pay Fast Checkout",
        desc: "Exposes native Apple Pay and Saudi Mada payment buttons in the checkout dialog."
      },
      {
        field: "enableDarkThemeDefault",
        icon: "🌙",
        title: "Force Luxury Dark Theme Aesthetic",
        desc: "Enforces luxury dark mode `#0B0F17` across all public booking and customer interfaces."
      },
      {
        field: "enableGoogleMapsRouting",
        icon: "📍",
        title: "Interactive Google Maps & Plus Codes",
        desc: "Renders embedded Google Maps directions and short Plus Codes on booking confirmations."
      },
      {
        field: "enableAutomatedAuditExport",
        icon: "🛡️",
        title: "Automated Daily Audit Trail Archiving",
        desc: "Generates daily immutable audit trail zip archives for regulatory and compliance review."
      }
    ];

    return `
      <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-6">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <span>🚩</span> Platform Runtime Feature Flags & Capabilities
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">Toggle live features instantly across customer booking, salon owner portals, and checkout flows</p>
          </div>
          <span class="text-[10px] text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Dynamic Flags</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${flags.map((flag) => {
            const checked = !!d[flag.field];
            return `
              <div class="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-base">${flag.icon}</span>
                    <h4 class="text-xs font-bold text-white">${flag.title}</h4>
                  </div>
                  <p class="text-[11px] text-slate-400 leading-relaxed">${flag.desc}</p>
                </div>
                <button type="button" role="switch" aria-checked="${checked ? 'true' : 'false'}" data-field="${flag.field}" class="setting-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-emerald-500' : 'bg-slate-800'} mt-1">
                  <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}"></span>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  return `<div class="text-slate-400 text-xs">Select a configuration tab above.</div>`;
}

function wireSettingsEventListeners(container) {
  // Tab Switch Buttons
  container.querySelectorAll(".settings-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-settings-tab");
      switchSettingsTab(targetTab);
    });
  });

  // Text / Number / Email / Textarea Inputs: Real-time dirty check and validation
  container.querySelectorAll("input[name], select[name], textarea[name]").forEach((el) => {
    const field = el.getAttribute("name");

    const onValChange = () => {
      let val = el.value;
      if (el.type === "number") {
        val = el.value === "" ? "" : parseFloat(el.value);
      }
      STATE.settingsDraft[field] = val;

      // Inline validation
      const error = validateField(field, val);
      if (error) {
        STATE.settingsErrors[field] = error;
      } else {
        delete STATE.settingsErrors[field];
      }

      // Check dirty
      const wasDirty = STATE.settingsDirty;
      STATE.settingsDirty = isDraftDifferentFromSaved();

      // If dirty status changed, update top action buttons / banner
      if (wasDirty !== STATE.settingsDirty) {
        // Soft refresh without losing focus
        updateDirtyUiState(container);
      }
    };

    el.addEventListener("input", onValChange);
    el.addEventListener("change", onValChange);
  });

  // Toggle Switches
  container.querySelectorAll(".setting-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.getAttribute("data-field");
      const current = !!STATE.settingsDraft[field];
      const next = !current;
      STATE.settingsDraft[field] = next;

      btn.setAttribute("aria-checked", next ? "true" : "false");
      btn.className = `setting-toggle relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${next ? 'bg-emerald-500' : 'bg-slate-800'}`;
      const knob = btn.querySelector("span");
      if (knob) {
        knob.className = `pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${next ? 'translate-x-5' : 'translate-x-0'}`;
      }

      STATE.settingsDirty = isDraftDifferentFromSaved();
      updateDirtyUiState(container);
    });
  });

  // Password / Secret eyeball toggles
  container.querySelectorAll("[data-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inputId = btn.getAttribute("data-toggle-password");
      const targetInput = document.getElementById(inputId);
      if (targetInput) {
        if (targetInput.type === "password") {
          targetInput.type = "text";
          btn.innerText = "🔒";
        } else {
          targetInput.type = "password";
          btn.innerText = "👁️";
        }
      }
    });
  });

  // Save Buttons
  const handleSave = () => saveSettingsState(true);
  document.getElementById("btn-save-header")?.addEventListener("click", handleSave);
  document.getElementById("btn-save-bottom")?.addEventListener("click", handleSave);
  document.getElementById("btn-save-banner")?.addEventListener("click", handleSave);

  // Discard Buttons
  const handleDiscard = () => discardActiveChanges(true);
  document.getElementById("btn-discard-header")?.addEventListener("click", handleDiscard);
  document.getElementById("btn-discard-bottom")?.addEventListener("click", handleDiscard);
  document.getElementById("btn-discard-banner")?.addEventListener("click", handleDiscard);

  // Factory Reset
  document.getElementById("btn-factory-reset")?.addEventListener("click", resetSettingsToFactoryDefaults);

  // Quick Action Tests
  document.getElementById("btn-test-moyasar")?.addEventListener("click", () => {
    const mode = STATE.settingsDraft.moyasarGatewayMode;
    showToast(`Moyasar API Gateway Ping Success! Status: 200 OK • Latency: 38ms (${mode.toUpperCase()}) ⚡`);
  });

  document.getElementById("btn-test-sms")?.addEventListener("click", () => {
    const provider = STATE.settingsDraft.smsProvider;
    const senderId = STATE.settingsDraft.smsSenderId;
    showToast(`Test SMS queued successfully via ${provider} (Sender: ${senderId}) to +966501234567 📲`);
  });
}

function updateDirtyUiState(container) {
  const isDirty = STATE.settingsDirty;

  // Update save buttons
  const saveHeader = document.getElementById("btn-save-header");
  const saveBottom = document.getElementById("btn-save-bottom");
  if (saveHeader) {
    if (isDirty) {
      saveHeader.className = "px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 shadow-lg shadow-[#F59E0B]/20 ring-2 ring-[#F59E0B]/30 text-xs font-black rounded-xl transition flex items-center gap-2";
    } else {
      saveHeader.className = "px-5 py-2.5 bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white text-xs font-black rounded-xl transition flex items-center gap-2";
    }
  }
  if (saveBottom) {
    if (isDirty) {
      saveBottom.className = "px-6 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 shadow-lg shadow-[#F59E0B]/20 font-black text-xs rounded-xl transition flex items-center gap-2";
    } else {
      saveBottom.className = "px-6 py-2.5 bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white font-black text-xs rounded-xl transition flex items-center gap-2";
    }
  }

  // Update dirty alert banner presence
  let alertEl = document.getElementById("settings-unsaved-alert");
  if (isDirty && !alertEl) {
    renderSystemSettingsWorkspace(container);
  } else if (!isDirty && alertEl) {
    alertEl.remove();
  }
}


/* =========================================================================
 * 10. ACCESS CONTROL WORKSPACE
 * ========================================================================= */
function renderAccessControlWorkspace(container) {
  const users = STATE.rbac.users || [];
  const roles = STATE.rbac.roles || [];
  const currentUser = Store.getCurrentUser() || { email: "admin@barberapp.sa", fullName: "Super Administrator" };

  container.innerHTML = `
    <!-- Header Banner -->
    <div class="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-amber-500/10 border border-purple-500/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
          🛡️
        </div>
        <div>
          <div class="flex items-center gap-2.5">
            <h2 class="text-lg font-extrabold text-white tracking-tight">Access Control & Role Permissions (RBAC)</h2>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
              PLATFORM STAFF
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Manage internal platform administrators, role assignments, and granular screen capability matrices</p>
        </div>
      </div>

      <!-- Quick Metrics Pill -->
      <div class="flex items-center gap-2 self-start md:self-auto">
        <div class="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono flex items-center gap-2">
          <span class="text-slate-400">Current Session:</span>
          <span class="font-bold text-amber-400 truncate max-w-[160px]">${currentUser.email}</span>
        </div>
      </div>
    </div>

    <!-- 2-Tab Navigation Bar -->
    <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
      <button id="rbac-tab-users-btn" class="rbac-tab-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
        STATE.rbac.activeTab === "users"
          ? "bg-[#F59E0B] text-slate-950 shadow-lg shadow-[#F59E0B]/20 font-black"
          : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800"
      }" data-rbac-tab="users">
        <span>👥</span>
        <span>Admin Users (Internal Staff)</span>
        <span id="rbac-users-count-badge" class="px-2 py-0.5 rounded-full text-[10px] font-mono ${
          STATE.rbac.activeTab === "users" ? "bg-slate-950 text-amber-400 font-bold" : "bg-slate-800 text-slate-300"
        }">
          ${users.length}
        </span>
      </button>

      <button id="rbac-tab-roles-btn" class="rbac-tab-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
        STATE.rbac.activeTab === "roles"
          ? "bg-[#F59E0B] text-slate-950 shadow-lg shadow-[#F59E0B]/20 font-black"
          : "bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800"
      }" data-rbac-tab="roles">
        <span>🛡️</span>
        <span>System Roles & Permissions</span>
        <span id="rbac-roles-count-badge" class="px-2 py-0.5 rounded-full text-[10px] font-mono ${
          STATE.rbac.activeTab === "roles" ? "bg-slate-950 text-amber-400 font-bold" : "bg-slate-800 text-slate-300"
        }">
          3 Roles
        </span>
      </button>
    </div>

    <!-- Tab Dynamic Outlet -->
    <div id="rbac-tab-content" class="space-y-6">
      <!-- Injected by renderRbacActiveTab -->
    </div>
  `;

  // Bind tab click events
  container.querySelectorAll(".rbac-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-rbac-tab");
      if (tab && STATE.rbac.activeTab !== tab) {
        STATE.rbac.activeTab = tab;
        renderAccessControlWorkspace(container);
      }
    });
  });

  loadRbacData();
}

async function loadRbacData() {
  const contentEl = document.getElementById("rbac-tab-content");
  if (!contentEl) return;

  STATE.rbac.loading = true;

  // Initial render from local cache for immediate display
  STATE.rbac.users = Store.getAdminUsers();
  STATE.rbac.roles = Store.getAdminRoles();
  renderRbacActiveTab();

  // Background fetch from live backend REST APIs
  try {
    const [liveUsers, liveRoles] = await Promise.all([
      Store.fetchAdminUsers(),
      Store.fetchAdminRoles()
    ]);
    STATE.rbac.users = liveUsers || [];
    STATE.rbac.roles = liveRoles || [];
    STATE.rbac.loading = false;

    // Update count badges
    const userBadge = document.getElementById("rbac-users-count-badge");
    if (userBadge) userBadge.innerText = STATE.rbac.users.length;

    renderRbacActiveTab();
  } catch (err) {
    console.warn("Failed background refresh of RBAC data:", err);
    STATE.rbac.loading = false;
  }
}

function renderRbacActiveTab() {
  const contentEl = document.getElementById("rbac-tab-content");
  if (!contentEl) return;

  if (STATE.rbac.activeTab === "users") {
    renderRbacUsersTab(contentEl);
  } else if (STATE.rbac.activeTab === "roles") {
    renderRbacRolesTab(contentEl);
  }
}

/* =========================================================================
 * 10.1 TAB A: ADMIN USERS (INTERNAL STAFF TABLE)
 * ========================================================================= */
function renderRbacUsersTab(container) {
  const currentUser = Store.getCurrentUser() || { id: 30, email: "admin@barberapp.sa" };
  const currentUserId = currentUser.id || currentUser.userId;
  const currentEmail = (currentUser.email || "admin@barberapp.sa").toLowerCase();

  const allUsers = STATE.rbac.users || [];
  const searchClean = (STATE.rbac.search || "").toLowerCase().trim();

  // Filter staff list
  const filtered = allUsers.filter((u) => {
    const matchesSearch =
      !searchClean ||
      (u.fullName && u.fullName.toLowerCase().includes(searchClean)) ||
      (u.email && u.email.toLowerCase().includes(searchClean)) ||
      (u.phone && u.phone.includes(searchClean)) ||
      (u.role && u.role.toLowerCase().includes(searchClean));

    const matchesRole =
      STATE.rbac.roleFilter === "ALL" || u.role === STATE.rbac.roleFilter;

    const matchesStatus =
      STATE.rbac.statusFilter === "ALL" ||
      (STATE.rbac.statusFilter === "ACTIVE" && u.active) ||
      (STATE.rbac.statusFilter === "SUSPENDED" && !u.active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeSuperAdmins = allUsers.filter((u) => u.role === "SUPER_ADMIN" && u.active).length;

  container.innerHTML = `
    <!-- Top Action / Filter Toolbar -->
    <div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
      <div class="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
        <!-- Search Input -->
        <div class="relative flex-1 min-w-[220px]">
          <span class="absolute inset-y-0 left-3 flex items-center text-slate-500 text-xs pointer-events-none">🔍</span>
          <input
            type="text"
            id="rbac-user-search-input"
            value="${STATE.rbac.search || ""}"
            placeholder="Search by name, email, phone, or role..."
            class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#F59E0B] transition"
          />
        </div>

        <!-- Role Filter -->
        <select id="rbac-user-role-filter" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
          <option value="ALL" ${STATE.rbac.roleFilter === "ALL" ? "selected" : ""}>All Platform Roles</option>
          <option value="SUPER_ADMIN" ${STATE.rbac.roleFilter === "SUPER_ADMIN" ? "selected" : ""}>Super Administrator</option>
          <option value="SUPPORT_AGENT" ${STATE.rbac.roleFilter === "SUPPORT_AGENT" ? "selected" : ""}>Support Agent</option>
          <option value="AUDIT_INSPECTOR" ${STATE.rbac.roleFilter === "AUDIT_INSPECTOR" ? "selected" : ""}>Audit Inspector</option>
        </select>

        <!-- Status Filter -->
        <select id="rbac-user-status-filter" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">
          <option value="ALL" ${STATE.rbac.statusFilter === "ALL" ? "selected" : ""}>All Statuses</option>
          <option value="ACTIVE" ${STATE.rbac.statusFilter === "ACTIVE" ? "selected" : ""}>Active Only</option>
          <option value="SUSPENDED" ${STATE.rbac.statusFilter === "SUSPENDED" ? "selected" : ""}>Suspended Only</option>
        </select>
      </div>

      <!-- Action Button: Invite Admin -->
      <button id="open-invite-modal-btn" class="w-full md:w-auto px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-[#F59E0B]/20 flex items-center justify-center gap-2 shrink-0">
        <span class="text-sm">✉️</span>
        <span>Invite Internal Admin</span>
      </button>
    </div>

    <!-- Safety Rule Banner -->
    <div class="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <span class="text-base">🔒</span>
        <span>
          <strong>Self-Lockout & Orphan Safety Guard Active:</strong> Super Admins cannot deactivate their own active session (<code class="text-amber-400 font-mono">${currentEmail}</code>) or demote the last active <code class="text-white font-mono">SUPER_ADMIN</code>.
        </span>
      </div>
      <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 font-bold shrink-0">ENFORCED</span>
    </div>

    <!-- Staff Table Container -->
    <div class="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-950/60 font-mono text-[11px]">
              <th class="py-3.5 px-4 font-semibold">Admin Staff</th>
              <th class="py-3.5 px-4 font-semibold">Email Address</th>
              <th class="py-3.5 px-4 font-semibold">Phone</th>
              <th class="py-3.5 px-4 font-semibold">Platform Role</th>
              <th class="py-3.5 px-4 font-semibold">Last Login</th>
              <th class="py-3.5 px-4 font-semibold">Status</th>
              <th class="py-3.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-xs">
            ${
              filtered.length === 0
                ? `
                <tr>
                  <td colspan="7" class="py-12 text-center text-slate-500">
                    <p class="text-2xl mb-2">🔍</p>
                    <p class="font-bold text-slate-400">No internal admin users found</p>
                    <p class="text-[11px] text-slate-500 mt-1">Try clearing your filters or invite a new platform administrator</p>
                  </td>
                </tr>
              `
                : filtered
                    .map((user) => {
                      const isSelf =
                        (currentUserId && String(user.id) === String(currentUserId)) ||
                        (user.email && user.email.toLowerCase() === currentEmail);

                      const isLastSuperAdmin =
                        user.role === "SUPER_ADMIN" && user.active && activeSuperAdmins <= 1;

                      const cannotToggleStatus = isSelf || (isLastSuperAdmin && user.active);

                      // Role styling
                      let roleBadge = "";
                      if (user.role === "SUPER_ADMIN") {
                        roleBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 w-fit">👑 <span>SUPER_ADMIN</span></span>`;
                      } else if (user.role === "SUPPORT_AGENT") {
                        roleBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-blue-500/10 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 w-fit">🎧 <span>SUPPORT_AGENT</span></span>`;
                      } else {
                        roleBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 w-fit">🛡️ <span>AUDIT_INSPECTOR</span></span>`;
                      }

                      // Status pill
                      const statusPill = user.active
                        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            ACTIVE
                           </span>`
                        : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono bg-red-500/10 text-red-400 border border-red-500/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            SUSPENDED
                           </span>`;

                      // Last login format
                      let lastLoginDisplay = `<span class="text-slate-500 font-mono text-[11px]">Never / Pending</span>`;
                      if (user.lastLogin) {
                        const cleanTime = String(user.lastLogin).replace("T", " ").substring(0, 19);
                        lastLoginDisplay = `<span class="text-slate-300 font-mono text-[11px]">${cleanTime}</span>`;
                      }

                      // Avatar initials
                      const initials = (user.fullName || "Admin")
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase();

                      return `
                        <tr class="hover:bg-slate-800/40 transition">
                          <!-- Staff Name & Info -->
                          <td class="py-3.5 px-4">
                            <div class="flex items-center gap-3">
                              <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-md shrink-0 ${
                                user.role === "SUPER_ADMIN"
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : user.role === "SUPPORT_AGENT"
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }">
                                ${initials}
                              </div>
                              <div class="min-w-0">
                                <div class="flex items-center gap-1.5">
                                  <span class="font-bold text-white">${user.fullName || "Platform Admin"}</span>
                                  ${
                                    isSelf
                                      ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#F59E0B] text-slate-950">YOU</span>`
                                      : ""
                                  }
                                </div>
                                <span class="text-[10px] text-slate-400 font-mono">ID #${user.id}</span>
                              </div>
                            </div>
                          </td>

                          <!-- Email Address -->
                          <td class="py-3.5 px-4 font-mono text-slate-300">
                            <div class="flex items-center gap-1.5 group">
                              <span class="truncate max-w-[200px]">${user.email}</span>
                              <button class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition text-[10px] copy-email-btn" data-email="${user.email}" title="Copy Email">
                                📋
                              </button>
                            </div>
                          </td>

                          <!-- Phone Number -->
                          <td class="py-3.5 px-4 font-mono text-slate-300">
                            ${
                              user.phone
                                ? `<span class="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">${user.phone}</span>`
                                : `<span class="text-slate-600">-</span>`
                            }
                          </td>

                          <!-- Role -->
                          <td class="py-3.5 px-4">
                            ${roleBadge}
                          </td>

                          <!-- Last Login -->
                          <td class="py-3.5 px-4">
                            ${lastLoginDisplay}
                          </td>

                          <!-- Status -->
                          <td class="py-3.5 px-4">
                            ${statusPill}
                          </td>

                          <!-- Actions -->
                          <td class="py-3.5 px-4 text-right">
                            <div class="flex items-center justify-end gap-2">
                              <!-- Edit Role Button -->
                              <button
                                class="edit-role-btn px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition border border-slate-700"
                                data-user-id="${user.id}"
                                title="Change Platform Role"
                              >
                                ✏️ Role
                              </button>

                              <!-- Toggle Active Status Button -->
                              ${
                                cannotToggleStatus
                                  ? `
                                  <button
                                    disabled
                                    class="px-2.5 py-1.5 rounded-lg text-xs font-semibold opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border border-slate-800"
                                    title="${
                                      isSelf
                                        ? "Safety Rule: Cannot deactivate own session account"
                                        : "Safety Rule: Cannot deactivate the last remaining SUPER_ADMIN"
                                    }"
                                  >
                                    🔒 ${user.active ? "Suspend" : "Activate"}
                                  </button>
                                `
                                  : `
                                  <button
                                    class="toggle-status-btn px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                      user.active
                                        ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30"
                                        : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30"
                                    }"
                                    data-user-id="${user.id}"
                                    data-active="${user.active}"
                                    data-name="${user.fullName || user.email}"
                                  >
                                    ${user.active ? "⛔ Suspend" : "✅ Activate"}
                                  </button>
                                `
                              }
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Toolbar Events
  const searchInput = document.getElementById("rbac-user-search-input");
  searchInput?.addEventListener("input", (e) => {
    STATE.rbac.search = e.target.value;
    renderRbacUsersTab(container);
    // Restore focus and cursor position
    const inputNow = document.getElementById("rbac-user-search-input");
    if (inputNow) {
      inputNow.focus();
      inputNow.setSelectionRange(inputNow.value.length, inputNow.value.length);
    }
  });

  document.getElementById("rbac-user-role-filter")?.addEventListener("change", (e) => {
    STATE.rbac.roleFilter = e.target.value;
    renderRbacUsersTab(container);
  });

  document.getElementById("rbac-user-status-filter")?.addEventListener("change", (e) => {
    STATE.rbac.statusFilter = e.target.value;
    renderRbacUsersTab(container);
  });

  document.getElementById("open-invite-modal-btn")?.addEventListener("click", () => {
    openInviteAdminModal();
  });

  // Bind Row Action Events
  container.querySelectorAll(".copy-email-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-email");
      if (email) {
        navigator.clipboard.writeText(email);
        showToast(`Email copied: ${email} 📋`);
      }
    });
  });

  container.querySelectorAll(".edit-role-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const userId = btn.getAttribute("data-user-id");
      const targetUser = allUsers.find((u) => String(u.id) === String(userId));
      if (targetUser) {
        openEditRoleModal(targetUser);
      }
    });
  });

  container.querySelectorAll(".toggle-status-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.getAttribute("data-user-id");
      const currentActive = btn.getAttribute("data-active") === "true";
      const targetName = btn.getAttribute("data-name");
      const targetState = !currentActive;

      const actionText = targetState ? "activate" : "suspend";
      const confirmed = confirm(
        `Are you sure you want to ${actionText} administrative access for ${targetName}?`
      );
      if (!confirmed) return;

      try {
        btn.disabled = true;
        await Store.toggleAdminUserStatus(userId, targetState);
        showToast(
          `Staff account ${targetState ? "activated" : "suspended"} successfully! ⚡`
        );
        await loadRbacData();
      } catch (err) {
        alert(err.message || "Failed to update account status.");
        btn.disabled = false;
      }
    });
  });
}

/* =========================================================================
 * 10.2 TAB B: SYSTEM ROLES & PERMISSIONS (CAPABILITY MATRIX)
 * ========================================================================= */
function renderRbacRolesTab(container) {
  const roles = STATE.rbac.roles || Store.getAdminRoles();

  // Screen Capability Matrix Definition
  const MATRIX_SCREENS = [
    {
      screen: "User Activity Audit",
      icon: "📋",
      route: "/admin/audit",
      capabilities: [
        {
          key: "audit.view",
          name: "View Audit Log Stream",
          desc: "Inspect live security event logs, timestamps, actor IDs, and raw event payloads"
        },
        {
          key: "audit.export",
          name: "Export Audit Records",
          desc: "Download compliance audit datasets to CSV files or structured JSON archives"
        }
      ]
    },
    {
      screen: "Salon Directory & Moderation",
      icon: "💈",
      route: "/admin/salons",
      capabilities: [
        {
          key: "salon.view",
          name: "View Salons Registry",
          desc: "Browse registered salons across KSA, search by district/CR, and inspect profiles"
        },
        {
          key: "salon.status_change",
          name: "Modify Salon Status",
          desc: "Activate pending salons, trigger suspensions, and record mandatory compliance rationale"
        },
        {
          key: "salon.impersonate",
          name: "Admin Inspection Mode",
          desc: "Impersonate tenant salon dashboards to review live barbers, schedules, and bookings"
        }
      ]
    },
    {
      screen: "System Configuration & Gateways",
      icon: "⚙️",
      route: "/admin/settings",
      capabilities: [
        {
          key: "config.view",
          name: "View System Config",
          desc: "Read platform parameters, ZATCA tax rules, Moyasar gateway mode, and SMS providers"
        },
        {
          key: "config.edit",
          name: "Modify Platform Settings",
          desc: "Update runtime settings, tax TIN numbers, telecom keys, and real-time feature flags"
        }
      ]
    },
    {
      screen: "Access Control & Security (RBAC)",
      icon: "🛡️",
      route: "/admin/access-control",
      capabilities: [
        {
          key: "rbac.view",
          name: "View Platform Staff & Roles",
          desc: "Inspect active internal staff directory, role assignments, and capability matrix"
        },
        {
          key: "rbac.manage",
          name: "Manage Staff & Permissions",
          desc: "Invite internal admins, reassign platform roles, toggle active states, and edit capabilities"
        }
      ]
    }
  ];

  // Map permissions set per role
  const rolePermMap = {};
  roles.forEach((r) => {
    rolePermMap[r.role] = new Set(r.permissions || []);
  });

  container.innerHTML = `
    <!-- Roles Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${roles
        .map((r) => {
          let borderClass = "border-slate-800";
          let badgeClass = "bg-slate-800 text-slate-300";
          let icon = "🛡️";

          if (r.role === "SUPER_ADMIN") {
            borderClass = "border-purple-500/30";
            badgeClass = "bg-purple-500/10 text-purple-300 border-purple-500/30";
            icon = "👑";
          } else if (r.role === "SUPPORT_AGENT") {
            borderClass = "border-blue-500/30";
            badgeClass = "bg-blue-500/10 text-blue-300 border-blue-500/30";
            icon = "🎧";
          } else if (r.role === "AUDIT_INSPECTOR") {
            borderClass = "border-amber-500/30";
            badgeClass = "bg-amber-500/10 text-amber-300 border-amber-500/30";
            icon = "🛡️";
          }

          return `
            <div class="bg-slate-900/80 p-5 rounded-2xl border ${borderClass} shadow-xl space-y-3 relative overflow-hidden">
              <div class="flex items-center justify-between">
                <span class="text-2xl">${icon}</span>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${badgeClass}">
                  ${r.role}
                </span>
              </div>
              <div>
                <h4 class="text-sm font-bold text-white">${r.name}</h4>
                <p class="text-xs text-slate-400 mt-1 leading-relaxed">${r.description}</p>
              </div>
              <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span class="text-slate-400">Assigned Platform Staff:</span>
                <span class="font-bold font-mono text-white">${r.userCount || 0} users</span>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>

    <!-- Permissions Matrix Table -->
    <div class="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden space-y-4 p-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 class="text-sm font-extrabold text-white flex items-center gap-2">
            <span>🛡️</span>
            <span>Screen-Level Capability Matrix</span>
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">Define granular access privileges mapped directly to Super Admin dashboard screens</p>
        </div>

        <button id="save-permissions-matrix-btn" class="px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-[#F59E0B]/20 flex items-center gap-2 self-start sm:self-auto">
          <span>💾</span>
          <span>Save Capabilities Matrix</span>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider bg-slate-950/60 font-mono text-[11px]">
              <th class="py-3 px-4 font-semibold w-1/2">Screen & Granular Capability</th>
              <th class="py-3 px-4 font-semibold text-center w-1/6">
                <span class="text-purple-300 font-bold block">👑 SUPER_ADMIN</span>
                <span class="text-[9px] text-slate-500 font-normal">System Protected</span>
              </th>
              <th class="py-3 px-4 font-semibold text-center w-1/6">
                <span class="text-blue-300 font-bold block">🎧 SUPPORT_AGENT</span>
                <span class="text-[9px] text-slate-500 font-normal">Moderation Staff</span>
              </th>
              <th class="py-3 px-4 font-semibold text-center w-1/6">
                <span class="text-amber-300 font-bold block">🛡️ AUDIT_INSPECTOR</span>
                <span class="text-[9px] text-slate-500 font-normal">Compliance Staff</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60 text-xs">
            ${MATRIX_SCREENS.map((group) => {
              return `
                <!-- Screen Group Header -->
                <tr class="bg-slate-950/40">
                  <td colspan="4" class="py-2.5 px-4 font-bold text-white text-xs flex items-center gap-2 border-l-2 border-[#F59E0B]">
                    <span>${group.icon}</span>
                    <span>${group.screen}</span>
                    <span class="text-[10px] text-slate-500 font-mono font-normal">(${group.route})</span>
                  </td>
                </tr>

                <!-- Capabilities -->
                ${group.capabilities
                  .map((cap) => {
                    const superHas = rolePermMap["SUPER_ADMIN"]?.has(cap.key);
                    const supportHas = rolePermMap["SUPPORT_AGENT"]?.has(cap.key);
                    const inspectorHas = rolePermMap["AUDIT_INSPECTOR"]?.has(cap.key);

                    return `
                      <tr class="hover:bg-slate-800/30 transition">
                        <!-- Capability Details -->
                        <td class="py-3 px-4 pl-8">
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-200">${cap.name}</span>
                            <code class="px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-[#F59E0B]">${cap.key}</code>
                          </div>
                          <p class="text-[11px] text-slate-400 mt-0.5">${cap.desc}</p>
                        </td>

                        <!-- Super Admin (Locked / System Protected) -->
                        <td class="py-3 px-4 text-center">
                          <label class="inline-flex items-center justify-center cursor-not-allowed" title="Super Admin permissions are permanently unlocked">
                            <input
                              type="checkbox"
                              checked
                              disabled
                              class="w-4 h-4 rounded border-slate-700 text-purple-600 focus:ring-0 bg-slate-900 cursor-not-allowed opacity-80"
                            />
                          </label>
                        </td>

                        <!-- Support Agent (Toggleable) -->
                        <td class="py-3 px-4 text-center">
                          <label class="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              class="matrix-perm-checkbox w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-950 cursor-pointer"
                              data-role="SUPPORT_AGENT"
                              data-permission="${cap.key}"
                              ${supportHas ? "checked" : ""}
                            />
                          </label>
                        </td>

                        <!-- Audit Inspector (Toggleable) -->
                        <td class="py-3 px-4 text-center">
                          <label class="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              class="matrix-perm-checkbox w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-400 bg-slate-950 cursor-pointer"
                              data-role="AUDIT_INSPECTOR"
                              data-permission="${cap.key}"
                              ${inspectorHas ? "checked" : ""}
                            />
                          </label>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")}
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Save Capabilities Action
  document.getElementById("save-permissions-matrix-btn")?.addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-permissions-matrix-btn");
    if (saveBtn) saveBtn.disabled = true;

    // Collect checked capabilities
    const supportPerms = [];
    const inspectorPerms = [];

    container.querySelectorAll(".matrix-perm-checkbox").forEach((cb) => {
      const role = cb.getAttribute("data-role");
      const perm = cb.getAttribute("data-permission");
      if (cb.checked) {
        if (role === "SUPPORT_AGENT") supportPerms.push(perm);
        if (role === "AUDIT_INSPECTOR") inspectorPerms.push(perm);
      }
    });

    try {
      await Promise.all([
        Store.saveRolePermissions("SUPPORT_AGENT", supportPerms),
        Store.saveRolePermissions("AUDIT_INSPECTOR", inspectorPerms)
      ]);
      showToast("Granular capability matrix saved & synced successfully! 🛡️");
      await loadRbacData();
    } catch (err) {
      alert("Failed to save role permissions: " + err.message);
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}

/* =========================================================================
 * 10.3 RBAC MODAL HANDLERS
 * ========================================================================= */
function initRbacModalEvents() {
  // Invite Modal
  const inviteBackdrop = document.getElementById("invite-admin-modal-backdrop");
  const closeInviteBtn = document.getElementById("invite-modal-close-x");
  const cancelInviteBtn = document.getElementById("invite-modal-cancel-btn");
  const inviteForm = document.getElementById("invite-admin-form");

  closeInviteBtn?.addEventListener("click", closeInviteAdminModal);
  cancelInviteBtn?.addEventListener("click", closeInviteAdminModal);
  inviteBackdrop?.addEventListener("click", (e) => {
    if (e.target === inviteBackdrop) closeInviteAdminModal();
  });

  inviteForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById("invite-modal-name");
    const emailInput = document.getElementById("invite-modal-email");
    const phoneInput = document.getElementById("invite-modal-phone");
    const roleSelect = document.getElementById("invite-modal-role");
    const errorBox = document.getElementById("invite-modal-error");
    const errorText = document.getElementById("invite-modal-error-text");
    const submitBtn = document.getElementById("invite-modal-submit-btn");
    const spinner = document.getElementById("invite-modal-spinner");

    const fullName = nameInput?.value.trim();
    const email = emailInput?.value.trim().toLowerCase();
    const phone = phoneInput?.value.trim();
    const role = roleSelect?.value;

    if (!fullName || !email || !role) return;

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errorText.innerText = "Please provide a valid RFC-compliant email address.";
      errorBox?.classList.remove("hidden");
      return;
    }

    try {
      submitBtn.disabled = true;
      spinner?.classList.remove("hidden");
      errorBox?.classList.add("hidden");

      await Store.inviteAdminUser({
        fullName,
        email,
        phone: phone || null,
        role
      });

      showToast(`Admin user ${email} successfully invited! ✉️`);
      closeInviteAdminModal();
      await loadRbacData();
    } catch (err) {
      errorText.innerText = err.message || "Failed to invite internal admin.";
      errorBox?.classList.remove("hidden");
    } finally {
      submitBtn.disabled = false;
      spinner?.classList.add("hidden");
    }
  });

  // Edit Role Modal
  const editRoleBackdrop = document.getElementById("edit-role-modal-backdrop");
  const closeEditBtn = document.getElementById("edit-role-close-x");
  const cancelEditBtn = document.getElementById("edit-role-cancel-btn");
  const submitEditBtn = document.getElementById("edit-role-submit-btn");

  closeEditBtn?.addEventListener("click", closeEditRoleModal);
  cancelEditBtn?.addEventListener("click", closeEditRoleModal);
  editRoleBackdrop?.addEventListener("click", (e) => {
    if (e.target === editRoleBackdrop) closeEditRoleModal();
  });

  submitEditBtn?.addEventListener("click", async () => {
    const user = STATE.rbac.selectedUserForRoleModal;
    if (!user) return;

    const selectEl = document.getElementById("edit-role-select");
    const newRole = selectEl?.value;
    if (!newRole) return;

    const spinner = document.getElementById("edit-role-spinner");

    try {
      submitEditBtn.disabled = true;
      spinner?.classList.remove("hidden");

      await Store.updateAdminRole(user.id, newRole);
      showToast(`Role updated to ${newRole} for ${user.fullName || user.email}! 🛡️`);
      closeEditRoleModal();
      await loadRbacData();
    } catch (err) {
      const warningBox = document.getElementById("edit-role-modal-warning");
      if (warningBox) {
        warningBox.className = "p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-xs";
        warningBox.innerText = `⚠️ ${err.message || "Failed to update role."}`;
        warningBox.classList.remove("hidden");
      } else {
        alert(err.message || "Failed to update role.");
      }
    } finally {
      submitEditBtn.disabled = false;
      spinner?.classList.add("hidden");
    }
  });
}

function openInviteAdminModal() {
  const backdrop = document.getElementById("invite-admin-modal-backdrop");
  const form = document.getElementById("invite-admin-form");
  const errorBox = document.getElementById("invite-modal-error");

  form?.reset();
  errorBox?.classList.add("hidden");
  backdrop?.classList.remove("hidden");
  document.getElementById("invite-modal-name")?.focus();
}

function closeInviteAdminModal() {
  const backdrop = document.getElementById("invite-admin-modal-backdrop");
  backdrop?.classList.add("hidden");
}

function openEditRoleModal(user) {
  STATE.rbac.selectedUserForRoleModal = user;
  const backdrop = document.getElementById("edit-role-modal-backdrop");
  const nameEl = document.getElementById("edit-role-modal-user-name");
  const subtitleEl = document.getElementById("edit-role-modal-user-subtitle");
  const badgeEl = document.getElementById("edit-role-modal-current-badge");
  const selectEl = document.getElementById("edit-role-select");
  const warningBox = document.getElementById("edit-role-modal-warning");

  if (nameEl) nameEl.innerText = `${user.fullName || "Admin"} (${user.email})`;
  if (subtitleEl) subtitleEl.innerText = `Account ID #${user.id}`;
  if (selectEl) selectEl.value = user.role;

  if (badgeEl) {
    badgeEl.innerText = user.role;
    if (user.role === "SUPER_ADMIN") {
      badgeEl.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30";
    } else if (user.role === "SUPPORT_AGENT") {
      badgeEl.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-blue-500/10 text-blue-300 border border-blue-500/30";
    } else {
      badgeEl.className = "px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30";
    }
  }

  // Safety warning alert for self or last super admin
  const currentUser = Store.getCurrentUser() || { id: 30, email: "admin@barberapp.sa" };
  const currentUserId = currentUser.id || currentUser.userId;
  const currentEmail = (currentUser.email || "admin@barberapp.sa").toLowerCase();
  const isSelf = (currentUserId && String(user.id) === String(currentUserId)) || (user.email && user.email.toLowerCase() === currentEmail);
  const activeSuperAdmins = (STATE.rbac.users || []).filter((u) => u.role === "SUPER_ADMIN" && u.active).length;

  if (isSelf && user.role === "SUPER_ADMIN") {
    warningBox.className = "p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs";
    warningBox.innerHTML = `⚠️ <strong>Safety Warning:</strong> You are currently logged into this account. Demoting yourself will revoke your Super Admin access!`;
    warningBox.classList.remove("hidden");
  } else if (user.role === "SUPER_ADMIN" && activeSuperAdmins <= 1) {
    warningBox.className = "p-3.5 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-xs";
    warningBox.innerHTML = `🔒 <strong>Safety Lock:</strong> This user is the sole remaining active SUPER_ADMIN. Role re-assignment is blocked until another Super Admin is provisioned.`;
    warningBox.classList.remove("hidden");
  } else {
    warningBox?.classList.add("hidden");
  }

  backdrop?.classList.remove("hidden");
}

function closeEditRoleModal() {
  const backdrop = document.getElementById("edit-role-modal-backdrop");
  backdrop?.classList.add("hidden");
  STATE.rbac.selectedUserForRoleModal = null;
}

/* =========================================================================
 * 11. TOAST NOTIFICATION UTILITY
 * ========================================================================= */
function showToast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "bg-[#F59E0B] text-slate-950 font-bold text-xs px-5 py-3 rounded-xl shadow-2xl animate-bounce flex items-center gap-2 pointer-events-auto";
  toast.innerHTML = `⚡ <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
