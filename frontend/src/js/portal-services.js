/**
 * Salon Portal - Services & Catalog Management Engine (/portal/services)
 */

import { Store } from "./store.js";
import { TenantContext } from "./tenant-context.js";
import { AuthGuard } from "./auth-guard.js";

const STATE = {
  servicesList: [],
  staffList: [],
  activeCategory: "ALL",
  searchQuery: "",
  editingServiceId: null
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!AuthGuard.requireAuth()) return;

  const context = await TenantContext.init();
  if (!context) {
    showToast("Failed to initialize salon tenant session.", "error");
    return;
  }

  // RBAC Guard: Only Owner can access Services Catalogue
  if (TenantContext.isStaff()) {
    showToast("Access Denied: Staff members are restricted from services catalogue.", "error");
    setTimeout(() => {
      window.location.href = "../index.html#schedule";
    }, 1200);
    return;
  }

  initHeader(context);
  initSidebar(context);
  initEventListeners();
  await Promise.all([loadServicesList(), loadStaffList()]);
});

/* =========================================================================
 * 1. COMMON HEADER INITIALIZATION
 * ========================================================================= */
function initHeader(context) {
  const user = context.user;
  const shop = context.shop || { name: "Golden Scissors Salon", branch: "Olaya, Riyadh" };

  const nameEl = document.getElementById("header-salon-name");
  if (nameEl) nameEl.innerText = shop.name || user.salonName || "Salon Portal";

  const branchEl = document.getElementById("header-branch-text");
  if (branchEl) branchEl.innerText = shop.branch || "Olaya, Riyadh";

  const userNameEl = document.getElementById("header-user-name");
  if (userNameEl) userNameEl.innerText = user.fullName || "User";

  const userEmailEl = document.getElementById("header-user-email");
  if (userEmailEl) userEmailEl.innerText = user.email || "";

  const avatarEl = document.getElementById("header-user-avatar");
  if (avatarEl) {
    const initials = (user.fullName || "SO").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
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
    window.location.href = "../../login.html";
  });

  document.getElementById("mobile-menu-toggle")?.addEventListener("click", () => {
    document.getElementById("portal-sidebar")?.classList.toggle("-translate-x-full");
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
 * 2. SIDEBAR NAVIGATION
 * ========================================================================= */
function initSidebar(context) {
  const salonIdBadge = document.getElementById("sidebar-salon-id-badge");
  if (salonIdBadge) salonIdBadge.innerText = `#${TenantContext.getSalonId() || "31"}`;

  const navContainer = document.getElementById("portal-nav-menu");
  if (!navContainer) return;

  const navItems = [
    { id: "dashboard", label: "Revenue & Analytics", icon: "📊", sub: "Daily, weekly & monthly metrics", href: "../index.html#analytics" },
    { id: "bookings", label: "Calendar / Bookings", icon: "📅", sub: "Manage all appointments", href: "../index.html#bookings" },
    { id: "staff", label: "Staff Management", icon: "👥", sub: "Barbers, shifts & hours", href: "../staff/index.html" },
    { id: "services", label: "Services & Pricing", icon: "✂️", sub: "Catalogue and durations", href: "index.html", active: true },
    { id: "settings", label: "Salon Profile & Settings", icon: "⚙️", sub: "Location, rules & QR", href: "../settings/index.html" }
  ];

  navContainer.innerHTML = navItems
    .map((item) => `
      <a href="${item.href}" class="portal-nav-link flex items-center gap-3 px-3.5 py-3 rounded-2xl transition group border ${
        item.active
          ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-lg shadow-amber-500/20"
          : "text-slate-400 hover:text-white hover:bg-slate-900 border-transparent hover:border-slate-800"
      }">
        <span class="text-lg group-hover:scale-110 transition-transform">${item.icon}</span>
        <div class="min-w-0">
          <span class="text-xs font-black tracking-tight block ${item.active ? "text-slate-950" : "text-slate-200 group-hover:text-amber-400"}">${item.label}</span>
          <span class="text-[10px] block truncate ${item.active ? "text-slate-900 opacity-80" : "text-slate-500"}">${item.sub}</span>
        </div>
      </a>
    `)
    .join("");
}

/* =========================================================================
 * 3. DATA LOADING & RENDERING
 * ========================================================================= */
async function loadServicesList() {
  const container = document.getElementById("services-grid");
  if (container) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 font-mono text-xs">Loading services catalogue from database...</div>`;
  }

  try {
    const res = await TenantContext.tenantFetch("/api/portal/services");
    if (!res.ok) throw new Error("Failed to load services");
    STATE.servicesList = await res.json();
    renderStats();
    renderServicesGrid();
  } catch (err) {
    console.error("Services load error:", err);
    showToast(err.message, "error");
    if (container) {
      container.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs">Error loading services catalogue.</div>`;
    }
  }
}

async function loadStaffList() {
  try {
    const res = await TenantContext.tenantFetch("/api/portal/staff");
    if (res.ok) {
      STATE.staffList = await res.json();
      populateStaffCheckboxes();
    }
  } catch (err) {
    console.error("Staff fetch for services error:", err);
  }
}

function renderStats() {
  const total = STATE.servicesList.length;
  const visible = STATE.servicesList.filter((s) => s.isVisible !== false).length;
  const categories = new Set(STATE.servicesList.map((s) => s.category || "General")).size;
  const avgPrice = total > 0 ? (STATE.servicesList.reduce((acc, s) => acc + (parseFloat(s.price) || 0), 0) / total).toFixed(1) : "0.0";

  const totalEl = document.getElementById("stat-total-services");
  const visibleEl = document.getElementById("stat-visible-services");
  const catEl = document.getElementById("stat-categories-count");
  const avgEl = document.getElementById("stat-avg-price");

  if (totalEl) totalEl.innerText = total;
  if (visibleEl) visibleEl.innerText = visible;
  if (catEl) catEl.innerText = categories;
  if (avgEl) avgEl.innerText = `${avgPrice} SAR`;
}

function renderServicesGrid() {
  const container = document.getElementById("services-grid");
  if (!container) return;

  let filtered = [...STATE.servicesList];

  // Search filter
  if (STATE.searchQuery.trim()) {
    const q = STATE.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }

  // Category filter
  if (STATE.activeCategory !== "ALL") {
    filtered = filtered.filter((s) => (s.category || "General").toLowerCase() === STATE.activeCategory.toLowerCase());
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800">
        <p class="text-sm font-semibold text-slate-400">No services found</p>
        <p class="text-xs text-slate-600 mt-1">Try selecting another category or add a new service to your catalog.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((srv) => {
      const isVis = srv.isVisible !== false;
      const buffer = srv.bufferMinutes || 5;

      return `
        <div class="bg-slate-900/90 rounded-3xl border border-slate-800 hover:border-slate-700/80 transition-all p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xl group">
          <!-- Card Top: Category, Title, Price -->
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ${srv.category || "General"}
              </span>
              <span class="text-base font-black text-amber-400 font-mono tracking-tight bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
                ${srv.price} <span class="text-xs text-slate-400">SAR</span>
              </span>
            </div>

            <div>
              <h3 class="text-base font-extrabold text-white group-hover:text-amber-400 transition-colors">${srv.name}</h3>
              <p class="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                ${srv.description || "Professional grooming service performed by master barbers."}
              </p>
            </div>
          </div>

          <!-- Metadata: Duration, Buffer, Qualified Barbers -->
          <div class="space-y-3 pt-3 border-t border-slate-800/80">
            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div class="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 flex items-center gap-2">
                <span>⏱️</span>
                <span>${srv.durationMinutes || 30} mins</span>
              </div>
              <div class="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 flex items-center gap-2">
                <span>🧼</span>
                <span>${buffer}m buffer</span>
              </div>
            </div>

            <!-- Qualified Staff -->
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-slate-500 font-mono">Assigned Staff:</span>
              <span class="text-slate-300 font-semibold px-2 py-0.5 rounded-lg bg-slate-800 text-[10px]">
                ${srv.assignedStaffIds === "ALL" ? "⭐ All Qualified Staff" : "✂️ Selected Staff"}
              </span>
            </div>

            <!-- Public Booking Visibility Toggle -->
            <div class="p-3 rounded-2xl bg-slate-950/90 border border-slate-800/80 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm">${isVis ? "👁️" : "🙈"}</span>
                <div>
                  <span class="text-xs font-bold ${isVis ? "text-emerald-400" : "text-slate-400"} block">
                    ${isVis ? "Publicly Visible" : "Hidden from Booking"}
                  </span>
                  <span class="text-[10px] text-slate-500 block">
                    ${isVis ? "Available online" : "Walk-in only"}
                  </span>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer service-visibility-toggle" data-service-id="${srv.id}" ${isVis ? "checked" : ""} />
                <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          <!-- Bottom Actions: Edit & Delete -->
          <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <button class="edit-service-btn px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center gap-1.5" data-service-id="${srv.id}">
              <span>✏️</span>
              <span>Edit</span>
            </button>
            <button class="delete-service-btn px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 hover:border-red-500/30 font-bold text-xs transition flex items-center gap-1.5 border border-transparent" data-service-id="${srv.id}" data-service-name="${srv.name}">
              <span>🗑️</span>
              <span>Delete</span>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  attachCardEventListeners();
}

function attachCardEventListeners() {
  // Visibility toggle
  document.querySelectorAll(".service-visibility-toggle").forEach((toggle) => {
    toggle.addEventListener("change", async (e) => {
      const serviceId = e.target.getAttribute("data-service-id");
      const isVisible = e.target.checked;
      await toggleServiceVisibility(serviceId, isVisible);
    });
  });

  // Edit button
  document.querySelectorAll(".edit-service-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const serviceId = btn.getAttribute("data-service-id");
      openServiceModal(serviceId);
    });
  });

  // Delete button
  document.querySelectorAll(".delete-service-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const serviceId = btn.getAttribute("data-service-id");
      const serviceName = btn.getAttribute("data-service-name");
      confirmDeleteService(serviceId, serviceName);
    });
  });
}

async function toggleServiceVisibility(serviceId, isVisible) {
  try {
    const res = await TenantContext.tenantFetch(`/api/portal/services/${serviceId}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible })
    });

    if (!res.ok) throw new Error("Failed to update visibility");
    const updated = await res.json();
    const idx = STATE.servicesList.findIndex((s) => s.id == serviceId);
    if (idx !== -1) {
      STATE.servicesList[idx] = updated;
    }

    showToast(`Service "${updated.name}" visibility updated.`, "success");
    renderStats();
    renderServicesGrid();
  } catch (err) {
    console.error("Visibility toggle error:", err);
    showToast(err.message, "error");
    renderServicesGrid();
  }
}

async function confirmDeleteService(serviceId, serviceName) {
  if (!confirm(`Are you sure you want to delete "${serviceName}" from your salon catalogue?`)) {
    return;
  }

  try {
    const res = await TenantContext.tenantFetch(`/api/portal/services/${serviceId}`, {
      method: "DELETE"
    });

    if (!res.ok) throw new Error("Failed to delete service");

    STATE.servicesList = STATE.servicesList.filter((s) => s.id != serviceId);
    showToast(`Service "${serviceName}" deleted successfully.`, "success");
    renderStats();
    renderServicesGrid();
  } catch (err) {
    console.error("Delete service error:", err);
    showToast(err.message, "error");
  }
}

/* =========================================================================
 * 4. ADD & EDIT SERVICE MODAL
 * ========================================================================= */
function initEventListeners() {
  // Search
  document.getElementById("services-search-input")?.addEventListener("input", (e) => {
    STATE.searchQuery = e.target.value;
    renderServicesGrid();
  });

  // Category filters
  document.querySelectorAll(".service-cat-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".service-cat-filter").forEach((b) => {
        b.className = "service-cat-filter px-3.5 py-1.5 rounded-xl text-xs font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800";
      });
      btn.className = "service-cat-filter px-3.5 py-1.5 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 border border-amber-400 shadow-md shadow-amber-500/20";
      STATE.activeCategory = btn.getAttribute("data-category");
      renderServicesGrid();
    });
  });

  // Modal open/close
  document.getElementById("open-add-service-btn")?.addEventListener("click", () => {
    openServiceModal(null);
  });

  const closeModal = () => {
    const modal = document.getElementById("service-modal");
    modal?.classList.add("hidden");
    modal?.classList.remove("flex");
    STATE.editingServiceId = null;
    document.getElementById("service-form")?.reset();
  };

  document.getElementById("close-service-modal-btn")?.addEventListener("click", closeModal);
  document.getElementById("cancel-service-btn")?.addEventListener("click", closeModal);

  // Form submit
  document.getElementById("service-form")?.addEventListener("submit", saveService);
}

function populateStaffCheckboxes() {
  const container = document.getElementById("assigned-staff-checkboxes");
  if (!container) return;

  if (STATE.staffList.length === 0) {
    container.innerHTML = `<span class="text-slate-500 text-xs">No active barbers found</span>`;
    return;
  }

  container.innerHTML = `
    <label class="flex items-center gap-2 text-slate-200 cursor-pointer">
      <input type="checkbox" id="staff-all-check" value="ALL" checked class="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0" />
      <span class="font-bold">⭐ All Qualified Barbers</span>
    </label>
    <div id="individual-barber-checks" class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
      ${STATE.staffList
        .map(
          (b) => `
        <label class="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer">
          <input type="checkbox" class="barber-select-check rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0" value="${b.id}" />
          <span class="truncate">${b.name}</span>
        </label>
      `
        )
        .join("")}
    </div>
  `;

  const allCheck = document.getElementById("staff-all-check");
  allCheck?.addEventListener("change", (e) => {
    document.querySelectorAll(".barber-select-check").forEach((cb) => {
      cb.checked = e.target.checked;
    });
  });
}

function openServiceModal(serviceId) {
  STATE.editingServiceId = serviceId;
  const modal = document.getElementById("service-modal");
  const title = document.getElementById("service-modal-title");
  const submitBtn = document.getElementById("save-service-btn");

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");

  if (serviceId) {
    title.innerText = "Edit Service Details";
    submitBtn.innerText = "Update Service";

    const srv = STATE.servicesList.find((s) => s.id == serviceId);
    if (srv) {
      document.getElementById("service-name").value = srv.name || "";
      document.getElementById("service-category").value = srv.category || "General";
      document.getElementById("service-description").value = srv.description || "";
      document.getElementById("service-price").value = srv.price || "";
      document.getElementById("service-duration").value = srv.durationMinutes || 30;
      document.getElementById("service-buffer").value = srv.bufferMinutes || 5;
      document.getElementById("service-visible-check").checked = srv.isVisible !== false;
    }
  } else {
    title.innerText = "Add New Service";
    submitBtn.innerText = "Create Service";
    document.getElementById("service-form")?.reset();
    document.getElementById("service-visible-check").checked = true;
  }
}

async function saveService(e) {
  e.preventDefault();
  const name = document.getElementById("service-name").value.trim();
  const category = document.getElementById("service-category").value;
  const description = document.getElementById("service-description").value.trim();
  const price = parseFloat(document.getElementById("service-price").value) || 50.0;
  const durationMinutes = parseInt(document.getElementById("service-duration").value) || 30;
  const bufferMinutes = parseInt(document.getElementById("service-buffer").value) || 5;
  const isVisible = document.getElementById("service-visible-check").checked;

  let assignedStaffIds = "ALL";
  const allChecked = document.getElementById("staff-all-check")?.checked;
  if (!allChecked) {
    const selected = [];
    document.querySelectorAll(".barber-select-check:checked").forEach((cb) => selected.push(cb.value));
    if (selected.length > 0) assignedStaffIds = selected.join(",");
  }

  const payload = {
    name,
    category,
    description,
    price,
    durationMinutes,
    bufferMinutes,
    isVisible,
    assignedStaffIds
  };

  const submitBtn = document.getElementById("save-service-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Saving Service...";

  try {
    let res;
    if (STATE.editingServiceId) {
      res = await TenantContext.tenantFetch(`/api/portal/services/${STATE.editingServiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      res = await TenantContext.tenantFetch("/api/portal/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to save service");
    }

    const saved = await res.json();
    if (STATE.editingServiceId) {
      const idx = STATE.servicesList.findIndex((s) => s.id == STATE.editingServiceId);
      if (idx !== -1) STATE.servicesList[idx] = saved;
      showToast(`Service "${saved.name}" updated successfully.`, "success");
    } else {
      STATE.servicesList.unshift(saved);
      showToast(`Service "${saved.name}" created and published!`, "success");
    }

    const modal = document.getElementById("service-modal");
    modal?.classList.add("hidden");
    modal?.classList.remove("flex");
    STATE.editingServiceId = null;

    renderStats();
    renderServicesGrid();
  } catch (err) {
    console.error("Save service error:", err);
    showToast(err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
}

/* =========================================================================
 * 5. TOAST NOTIFICATION UTILITY
 * ========================================================================= */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const isErr = type === "error";

  toast.className = `p-4 rounded-2xl border text-xs font-bold shadow-2xl flex items-center gap-3 pointer-events-auto transition-all transform translate-y-2 opacity-0 ${
    isErr ? "bg-red-500/10 text-red-300 border-red-500/30" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
  }`;

  toast.innerHTML = `<span>${isErr ? "⚠️" : "✅"}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.remove("translate-y-2", "opacity-0"));
  setTimeout(() => {
    toast.classList.add("translate-y-2", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
