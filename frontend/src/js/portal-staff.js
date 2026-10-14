/**
 * Salon Portal - Staff & Roster Management Engine (/portal/staff)
 * Strictly Enforces Tenant Isolation (salonId = currentSession.salonId)
 */

import { Store } from "./store.js";
import { TenantContext } from "./tenant-context.js";
import { AuthGuard } from "./auth-guard.js";

const STATE = {
  staffList: [],
  filterStatus: "ALL",
  searchQuery: "",
  viewMode: "table", // "table" or "cards"
  activeBarberForSchedule: null,
  currentSchedule: null,
  editingBarberId: null
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!AuthGuard.requireAuth()) return;

  const context = await TenantContext.init();
  if (!context) {
    showToast("Failed to initialize salon tenant session.", "error");
    return;
  }

  // RBAC Guard: Only Owner can access Staff Management
  if (TenantContext.isStaff()) {
    showToast("Access Denied: Staff members are restricted from staff management module.", "error");
    setTimeout(() => {
      window.location.href = "../index.html#schedule";
    }, 1200);
    return;
  }

  initHeader(context);
  initSidebar(context);
  initEventListeners();
  await loadStaffList();
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
    { id: "staff", label: "Staff Management", icon: "👥", sub: "Barbers, shifts & hours", href: "index.html", active: true },
    { id: "services", label: "Services & Pricing", icon: "✂️", sub: "Catalogue and durations", href: "../services/index.html" },
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
 * 3. DATA LOADING & RENDERING COORDINATION
 * ========================================================================= */
async function loadStaffList() {
  const tableContainer = document.getElementById("staff-table-body");
  const cardsContainer = document.getElementById("staff-cards-container");

  if (tableContainer) {
    tableContainer.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-slate-500 font-mono text-xs">Loading staff roster from database...</td></tr>`;
  }
  if (cardsContainer) {
    cardsContainer.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500 font-mono text-xs">Loading staff roster from database...</div>`;
  }

  try {
    const res = await TenantContext.tenantFetch("/api/portal/staff");
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        showToast("Session expired or unauthorized. Please sign in again.", "warning");
        const authNotice = `Session expired or unauthorized. <a href="/login.html" class="underline font-bold text-amber-300 ml-1">Sign in here</a>`;
        if (tableContainer) {
          tableContainer.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-amber-400 text-xs font-mono">${authNotice}</td></tr>`;
        }
        if (cardsContainer) {
          cardsContainer.innerHTML = `<div class="col-span-full py-12 text-center text-amber-400 text-xs font-mono">${authNotice}</div>`;
        }
        return;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to load staff roster");
    }
    STATE.staffList = await res.json();
    renderStats();
    renderStaff();
  } catch (err) {
    console.error("Staff load error:", err);
    showToast(err.message, "error");
    const errMsg = `Error loading staff list: ${err.message || "Server error"}. <button onclick="location.reload()" class="underline font-bold text-slate-300 ml-2">Retry</button>`;
    if (tableContainer) {
      tableContainer.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-red-400 text-xs font-mono">${errMsg}</td></tr>`;
    }
    if (cardsContainer) {
      cardsContainer.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 text-xs font-mono">${errMsg}</div>`;
    }
  }
}

function renderStats() {
  const total = STATE.staffList.length;
  const active = STATE.staffList.filter((s) => s.isActive && s.status === "ACTIVE").length;
  const onBreak = STATE.staffList.filter((s) => s.isActive && s.status === "BREAK").length;
  const inactive = STATE.staffList.filter((s) => !s.isActive || s.status === "OFFLINE").length;

  const totalEl = document.getElementById("stat-total-staff");
  const activeEl = document.getElementById("stat-active-staff");
  const breakEl = document.getElementById("stat-break-staff");
  const inactiveEl = document.getElementById("stat-inactive-staff");

  if (totalEl) totalEl.innerText = total;
  if (activeEl) activeEl.innerText = active;
  if (breakEl) breakEl.innerText = onBreak;
  if (inactiveEl) inactiveEl.innerText = inactive;
}

function getFilteredStaff() {
  let filtered = [...STATE.staffList];

  // Search filter (name, specialty, skills, phone, email)
  if (STATE.searchQuery.trim()) {
    const q = STATE.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.specialty && s.specialty.toLowerCase().includes(q)) ||
        (s.skills && s.skills.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
    );
  }

  // Status filter
  if (STATE.filterStatus !== "ALL") {
    if (STATE.filterStatus === "INACTIVE") {
      filtered = filtered.filter((s) => !s.isActive || s.status === "OFFLINE");
    } else {
      filtered = filtered.filter((s) => s.isActive && s.status === STATE.filterStatus);
    }
  }

  return filtered;
}

function renderStaff() {
  const filtered = getFilteredStaff();
  const tableWrapper = document.getElementById("staff-table-wrapper");
  const cardsContainer = document.getElementById("staff-cards-container");

  if (STATE.viewMode === "table") {
    tableWrapper?.classList.remove("hidden");
    cardsContainer?.classList.add("hidden");
    renderStaffTable(filtered);
  } else {
    tableWrapper?.classList.add("hidden");
    cardsContainer?.classList.remove("hidden");
    renderStaffCards(filtered);
  }

  attachStaffActionListeners();
}

function formatAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith("/uploads/")) {
    const backendBase = (typeof window !== "undefined" && window.location.port !== "8080")
      ? "http://localhost:8080"
      : "";
    return `${backendBase}${url}`;
  }
  return url;
}

/* =========================================================================
 * 4. TABLE VIEW RENDERING
 * ========================================================================= */
function renderStaffTable(filtered) {
  const container = document.getElementById("staff-table-body");
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="4" class="py-12 text-center text-slate-500">
          <p class="text-sm font-semibold">No staff members found matching criteria</p>
          <p class="text-xs text-slate-600 mt-1">Try adjusting your filters or invite a new barber</p>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((staff) => {
      const initials = staff.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
      const isActive = staff.isActive !== false && staff.status !== "OFFLINE";

      let statusBadge = "";
      if (!staff.isActive || staff.status === "OFFLINE") {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>OFFLINE</span>`;
      } else if (staff.status === "ACTIVE") {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>ACTIVE</span>`;
      } else if (staff.status === "BREAK") {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 w-fit"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>ON BREAK</span>`;
      }

      const avatarSrc = formatAvatarUrl(staff.avatarUrl || staff.photoUrl);
      const avatarHtml = avatarSrc
        ? `<img src="${avatarSrc}" alt="${staff.name}" class="w-10 h-10 rounded-2xl object-cover border border-amber-500/30 shrink-0 shadow-inner" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\\'w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner\\\'>${initials}</div>';" />`
        : `<div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">${initials}</div>`;

      // Skills tags pills
      const skillsArray = staff.skillsTags && staff.skillsTags.length > 0
        ? staff.skillsTags
        : (staff.skills ? staff.skills.split(",").map((s) => s.trim()).filter(Boolean) : ["Haircut", "Beard Trim"]);

      const skillsHtml = skillsArray.slice(0, 2).map((tag) => `
        <span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-900 border border-slate-800 text-amber-300/90">#${tag}</span>
      `).join("");

      const extraSkillsCount = skillsArray.length > 2 ? `<span class="text-[10px] text-slate-500 font-mono">+${skillsArray.length - 2}</span>` : "";

      const cleanEmail = staff.email && !staff.email.endsWith(".internal") ? staff.email : null;

      return `
        <tr class="border-b border-slate-800/80 hover:bg-slate-800/30 transition text-xs">
          <!-- 1. Staff Member Identity & Contact -->
          <td class="py-3.5 px-5">
            <div class="flex items-center gap-3.5">
              <div class="shrink-0 relative cursor-pointer view-staff-btn" data-barber-id="${staff.id}">
                ${avatarHtml}
                <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
              </div>
              <div class="min-w-0">
                <span class="font-extrabold text-white text-sm block truncate hover:text-amber-400 cursor-pointer view-staff-name-btn transition-colors" data-barber-id="${staff.id}" title="View profile">${staff.name}</span>
                <div class="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                  <span>📞 ${staff.phone || "No phone"}</span>
                  ${cleanEmail ? `<span class="text-slate-600">•</span><span class="truncate max-w-[150px] text-slate-400" title="${cleanEmail}">✉️ ${cleanEmail}</span>` : ""}
                </div>
              </div>
            </div>
          </td>

          <!-- 2. Role & Specialty -->
          <td class="py-3.5 px-5">
            <div class="space-y-1">
              <span class="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700/80 inline-flex items-center gap-1">
                💈 ${staff.specialty || "Master Barber"}
              </span>
              <div class="flex flex-wrap items-center gap-1">
                ${skillsHtml}
                ${extraSkillsCount}
              </div>
            </div>
          </td>

          <!-- 3. Shift Status -->
          <td class="py-3.5 px-5">
            <div class="flex items-center gap-3">
              ${statusBadge}
              <label class="relative inline-flex items-center cursor-pointer" title="${isActive ? 'Click to deactivate' : 'Click to activate'}">
                <input type="checkbox" class="sr-only peer staff-active-toggle" data-barber-id="${staff.id}" ${isActive ? "checked" : ""} />
                <div class="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </td>

          <!-- 4. Actions -->
          <td class="py-3.5 px-5 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button class="view-staff-btn px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 font-bold text-xs transition flex items-center gap-1.5 shadow-sm" data-barber-id="${staff.id}" title="View Full Profile">
                <span>👁️</span>
                <span>View</span>
              </button>

              <button class="edit-staff-btn px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-bold text-xs transition flex items-center gap-1" data-barber-id="${staff.id}" title="Edit Barber Details">
                <span>✏️</span>
                <span>Edit</span>
              </button>

              <button class="edit-schedule-btn px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 font-bold text-xs transition flex items-center gap-1" data-barber-id="${staff.id}" data-barber-name="${staff.name}" title="Configure Weekly Hours & Breaks">
                <span>🕒</span>
                <span>Hours</span>
              </button>

              <button class="delete-staff-btn p-1.5 rounded-xl bg-slate-900 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-500/30 transition text-xs" data-barber-id="${staff.id}" data-barber-name="${staff.name}" title="Remove Barber">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

/* =========================================================================
 * 5. CARDS GRID VIEW RENDERING
 * ========================================================================= */
function renderStaffCards(filtered) {
  const container = document.getElementById("staff-cards-container");
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8">
        <p class="text-sm font-semibold">No staff members found matching criteria</p>
        <p class="text-xs text-slate-600 mt-1">Try adjusting your filters or invite a new barber</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((staff) => {
      const initials = staff.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
      const isActive = staff.isActive !== false && staff.status !== "OFFLINE";

      let statusBadge = "";
      if (!staff.isActive || staff.status === "OFFLINE") {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>OFFLINE</span>`;
      } else if (staff.status === "ACTIVE") {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>ACTIVE</span>`;
      } else if (staff.status === "BREAK") {
        statusBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>ON BREAK</span>`;
      }

      const avatarSrc = formatAvatarUrl(staff.avatarUrl || staff.photoUrl);
      const avatarHtml = avatarSrc
        ? `<img src="${avatarSrc}" alt="${staff.name}" class="w-16 h-16 rounded-3xl object-cover border border-amber-500/30 shrink-0 shadow-lg" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\\'w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-lg shrink-0 shadow-inner\\\'>${initials}</div>';" />`
        : `<div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-lg shrink-0 shadow-inner">${initials}</div>`;

      const skillsArray = staff.skillsTags && staff.skillsTags.length > 0
        ? staff.skillsTags
        : (staff.skills ? staff.skills.split(",").map((s) => s.trim()).filter(Boolean) : ["Haircut", "Beard Trim"]);

      const skillsBadges = skillsArray.map((tag) => `
        <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-mono bg-slate-950 border border-slate-800 text-amber-300">#${tag}</span>
      `).join("");

      const upcomingCount = staff.upcomingBookingsCount || 0;

      return `
        <div class="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 space-y-4 shadow-xl hover:shadow-2xl transition group flex flex-col justify-between">
          
          <!-- Card Header: Avatar & Info -->
          <div class="space-y-3.5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3.5">
                <div class="relative shrink-0">
                  ${avatarHtml}
                  <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}" title="${isActive ? 'Online' : 'Offline'}"></span>
                </div>
                <div class="min-w-0">
                  <h3 class="font-extrabold text-white text-base tracking-tight truncate group-hover:text-amber-400 transition-colors">${staff.name}</h3>
                  <span class="text-xs text-amber-400/90 font-medium block truncate">💈 ${staff.specialty || "Master Barber"}</span>
                  <span class="text-[10px] font-mono text-slate-500 block mt-0.5">ID #${staff.id} • User #${staff.userId || "N/A"}</span>
                </div>
              </div>

              <div class="shrink-0">
                ${statusBadge}
              </div>
            </div>

            <!-- Skills Badges -->
            <div class="flex flex-wrap gap-1.5 pt-1">
              ${skillsBadges}
            </div>

            <!-- Contact Information -->
            <div class="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs font-mono">
              <div class="flex items-center justify-between">
                <span class="text-slate-400 flex items-center gap-1.5"><span>📞</span> Phone:</span>
                <span class="text-slate-200 font-bold">${staff.phone || "N/A"}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400 flex items-center gap-1.5"><span>✉️</span> Email:</span>
                <span class="text-slate-300 truncate max-w-[170px]" title="${staff.email}">${staff.email || "N/A"}</span>
              </div>
            </div>

            <!-- Weekly Roster Info & Upcoming Appointments -->
            <div class="space-y-2 text-xs">
              <div class="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span class="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-0.5">🗓️ Weekly Roster</span>
                <span class="text-[11px] text-slate-300 block leading-relaxed">${staff.scheduleSummary || "Sun-Thu: 09:00 - 21:00"}</span>
              </div>

              <div class="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <span class="text-[11px] text-slate-400 font-mono">Future Bookings:</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black ${upcomingCount > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'}">
                  ${upcomingCount} Active
                </span>
              </div>
            </div>
          </div>

          <!-- Card Footer: Status & Actions -->
          <div class="pt-3 border-t border-slate-800/80 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer staff-active-toggle" data-barber-id="${staff.id}" ${isActive ? "checked" : ""} />
                  <div class="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
                <span class="text-[11px] font-mono text-slate-400">${isActive ? "Accepting" : "Blocked"}</span>
              </div>

              <select class="staff-status-select bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-amber-400" data-barber-id="${staff.id}">
                <option value="ACTIVE" ${staff.status === "ACTIVE" ? "selected" : ""}>Active</option>
                <option value="BREAK" ${staff.status === "BREAK" ? "selected" : ""}>On Break</option>
                <option value="OFFLINE" ${staff.status === "OFFLINE" ? "selected" : ""}>Offline</option>
              </select>
            </div>

            <div class="space-y-2">
              <button class="view-staff-btn w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm" data-barber-id="${staff.id}">
                <span>👁️</span>
                <span>View Profile Details</span>
              </button>

              <div class="grid grid-cols-2 gap-2">
                <button class="edit-staff-btn py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5" data-barber-id="${staff.id}">
                  <span>✏️</span>
                  <span>Edit</span>
                </button>

                <button class="edit-schedule-btn py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5" data-barber-id="${staff.id}" data-barber-name="${staff.name}">
                  <span>🕒</span>
                  <span>Roster</span>
                </button>

                <button class="upload-avatar-btn py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5" data-barber-id="${staff.id}" data-barber-name="${staff.name}" data-avatar-url="${avatarSrc || ''}">
                  <span>📷</span>
                  <span>Photo</span>
                </button>

                <button class="delete-staff-btn py-2 rounded-xl bg-slate-900 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 font-bold text-xs transition flex items-center justify-center gap-1.5" data-barber-id="${staff.id}" data-barber-name="${staff.name}">
                  <span>🗑️</span>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      `;
    })
    .join("");
}

/* =========================================================================
 * 6. ATTACH STAFF ACTION LISTENERS
 * ========================================================================= */
function attachStaffActionListeners() {
  // View staff details modal trigger
  document.querySelectorAll(".view-staff-btn, .view-staff-name-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const barberId = btn.getAttribute("data-barber-id");
      openViewStaffModal(barberId);
    });
  });

  // Edit staff details modal trigger
  document.querySelectorAll(".edit-staff-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const barberId = btn.getAttribute("data-barber-id");
      openEditStaffModal(barberId);
    });
  });

  // Active/Inactive toggle
  document.querySelectorAll(".staff-active-toggle").forEach((toggle) => {
    toggle.addEventListener("change", async (e) => {
      const barberId = e.target.getAttribute("data-barber-id");
      const isActive = e.target.checked;
      await updateStaffStatus(barberId, { isActive, status: isActive ? "ACTIVE" : "OFFLINE" });
    });
  });

  // Status dropdown change
  document.querySelectorAll(".staff-status-select").forEach((select) => {
    select.addEventListener("change", async (e) => {
      const barberId = e.target.getAttribute("data-barber-id");
      const status = e.target.value;
      const isActive = status !== "OFFLINE";
      await updateStaffStatus(barberId, { status, isActive });
    });
  });

  // Edit Schedule & Breaks modal trigger
  document.querySelectorAll(".edit-schedule-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const barberId = btn.getAttribute("data-barber-id");
      const barberName = btn.getAttribute("data-barber-name");
      openScheduleModal(barberId, barberName);
    });
  });

  // Avatar Modal trigger
  document.querySelectorAll(".upload-avatar-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const barberId = btn.getAttribute("data-barber-id");
      const barberName = btn.getAttribute("data-barber-name");
      const avatarUrl = btn.getAttribute("data-avatar-url");
      openAvatarModal(barberId, barberName, avatarUrl);
    });
  });

  // Delete staff button trigger
  document.querySelectorAll(".delete-staff-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const barberId = btn.getAttribute("data-barber-id");
      const barberName = btn.getAttribute("data-barber-name");
      confirmDeleteStaff(barberId, barberName);
    });
  });
}

/* =========================================================================
 * 7. STATUS & LIFECYCLE MANAGEMENT WITH CONFLICT INTERCEPTION (409)
 * ========================================================================= */
async function updateStaffStatus(barberId, payload) {
  try {
    const res = await TenantContext.tenantFetch(`/api/portal/staff/${barberId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.status === 409) {
      const conflictData = await res.json().catch(() => ({}));
      showConflictModal(barberId, conflictData);
      renderStaff(); // Re-render to rollback toggle switch
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to update staff status");
    }

    const updated = await res.json();
    const idx = STATE.staffList.findIndex((s) => s.id == barberId);
    if (idx !== -1) {
      STATE.staffList[idx] = updated;
    }

    showToast(`Staff member #${barberId} status updated successfully.`, "success");
    renderStats();
    renderStaff();
  } catch (err) {
    console.error("Status update error:", err);
    showToast(err.message, "error");
    renderStaff(); // Rollback UI checkbox
  }
}

async function confirmDeleteStaff(barberId, barberName) {
  const confirmed = confirm(`Are you sure you want to remove "${barberName}" from the salon roster?\n\nNote: Active upcoming appointments must be reassigned or cancelled first.`);
  if (!confirmed) return;

  try {
    const res = await TenantContext.tenantFetch(`/api/portal/staff/${barberId}`, {
      method: "DELETE"
    });

    if (res.status === 409) {
      const conflictData = await res.json().catch(() => ({}));
      showConflictModal(barberId, conflictData);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to remove staff member");
    }

    STATE.staffList = STATE.staffList.filter((s) => s.id != barberId);
    showToast(`Barber "${barberName}" removed successfully from salon roster.`, "success");
    renderStats();
    renderStaff();
  } catch (err) {
    console.error("Delete staff error:", err);
    showToast(err.message, "error");
  }
}

function showConflictModal(barberId, conflictData) {
  const modal = document.getElementById("conflict-modal");
  const staff = STATE.staffList.find((s) => s.id == barberId);
  const barberName = staff ? staff.name : `Staff #${barberId}`;

  const msgEl = document.getElementById("conflict-modal-message");
  if (msgEl) {
    msgEl.innerText = conflictData.message || `Cannot deactivate or remove ${barberName} because future appointments are scheduled.`;
  }

  const badgeEl = document.getElementById("conflict-count-badge");
  const count = conflictData.conflictCount || conflictData.upcomingBookings?.length || 0;
  if (badgeEl) badgeEl.innerText = `${count} Active Booking${count !== 1 ? 's' : ''}`;

  const listEl = document.getElementById("conflict-bookings-list");
  if (listEl) {
    const bookings = conflictData.upcomingBookings || [];
    if (bookings.length === 0) {
      listEl.innerHTML = `<div class="p-3 text-center text-slate-500 font-mono text-xs">Active bookings detected in calendar.</div>`;
    } else {
      listEl.innerHTML = bookings
        .map((b) => `
          <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
            <div class="min-w-0">
              <span class="font-bold text-white block truncate">${b.customerName || "Customer"}</span>
              <span class="text-[11px] text-amber-400 font-medium block truncate">${b.serviceName || "Service"}</span>
              <span class="text-[10px] font-mono text-slate-400">${b.slotStart ? new Date(b.slotStart).toLocaleString() : ""}</span>
            </div>
            <div class="text-right shrink-0">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">${b.status}</span>
            </div>
          </div>
        `)
        .join("");
    }
  }

  const reassignLink = document.getElementById("conflict-reassign-link");
  if (reassignLink) {
    reassignLink.href = `../index.html#bookings`;
  }

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
}

function closeConflictModal() {
  const modal = document.getElementById("conflict-modal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
}

/* =========================================================================
 * 8. STAFF PROFILE VIEW & EDIT CONTROLLERS
 * ========================================================================= */
function openViewStaffModal(barberId) {
  const staff = STATE.staffList.find((s) => s.id == barberId);
  if (!staff) {
    showToast("Staff member profile not found.", "error");
    return;
  }

  const modal = document.getElementById("view-staff-modal");
  if (!modal) return;

  const initials = staff.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const isActive = staff.isActive !== false && staff.status !== "OFFLINE";
  const avatarSrc = formatAvatarUrl(staff.avatarUrl || staff.photoUrl);

  // Avatar Box
  const avatarBox = document.getElementById("view-staff-avatar-box");
  if (avatarBox) {
    if (avatarSrc) {
      avatarBox.innerHTML = `<img src="${avatarSrc}" alt="${staff.name}" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<span class=\\\'text-xl font-bold text-amber-300\\\'>${initials}</span>';" />`;
    } else {
      avatarBox.innerHTML = `<span class="text-xl font-bold text-amber-300">${initials}</span>`;
    }
  }

  // Status Indicator Dot
  const statusDot = document.getElementById("view-staff-status-dot");
  if (statusDot) {
    statusDot.className = `absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`;
  }

  // Name & Specialty
  const nameEl = document.getElementById("view-staff-name");
  if (nameEl) nameEl.innerText = staff.name;

  const specEl = document.getElementById("view-staff-specialty");
  if (specEl) specEl.innerText = `💈 ${staff.specialty || "Master Barber"}`;

  // Status Badge
  const statusBadgeEl = document.getElementById("view-staff-status-badge");
  if (statusBadgeEl) {
    if (!staff.isActive || staff.status === "OFFLINE") {
      statusBadgeEl.innerHTML = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>OFFLINE</span>`;
    } else if (staff.status === "ACTIVE") {
      statusBadgeEl.innerHTML = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>ACTIVE</span>`;
    } else if (staff.status === "BREAK") {
      statusBadgeEl.innerHTML = `<span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>ON BREAK</span>`;
    }
  }

  // ID Badges
  const idBadgeEl = document.getElementById("view-staff-id-badge");
  if (idBadgeEl) idBadgeEl.innerText = `Barber ID #${staff.id} • User Account #${staff.userId || "N/A"}`;

  // Contact Info
  const phoneEl = document.getElementById("view-staff-phone");
  if (phoneEl) phoneEl.innerText = staff.phone || "Not provided";

  const emailEl = document.getElementById("view-staff-email");
  const cleanEmail = staff.email && !staff.email.endsWith(".internal") ? staff.email : null;
  if (emailEl) {
    emailEl.innerText = cleanEmail || "Not provided (Optional)";
    emailEl.title = cleanEmail || "";
  }

  // Skills & Specialties Tags
  const skillsContainer = document.getElementById("view-staff-skills-container");
  if (skillsContainer) {
    const skillsArray = staff.skillsTags && staff.skillsTags.length > 0
      ? staff.skillsTags
      : (staff.skills ? staff.skills.split(",").map((s) => s.trim()).filter(Boolean) : ["Haircut", "Beard Trim"]);

    if (skillsArray.length > 0) {
      skillsContainer.innerHTML = skillsArray
        .map((tag) => `<span class="px-2.5 py-1 rounded-xl text-xs font-mono bg-slate-900 border border-slate-800 text-amber-300">#${tag}</span>`)
        .join("");
    } else {
      skillsContainer.innerHTML = `<span class="text-xs text-slate-500 italic">No skill tags assigned</span>`;
    }
  }

  // Weekly Working Roster
  const scheduleEl = document.getElementById("view-staff-schedule");
  if (scheduleEl) scheduleEl.innerText = staff.scheduleSummary || "Sun - Thu: 09:00 - 21:00 (Standard Shift)";

  // Manage Hours button inside view modal
  const manageHoursBtn = document.getElementById("view-staff-manage-hours-btn");
  if (manageHoursBtn) {
    manageHoursBtn.onclick = () => {
      closeViewStaffModal();
      openScheduleModal(staff.id, staff.name);
    };
  }

  // Calendar Workload Summary
  const bookingsEl = document.getElementById("view-staff-bookings-summary");
  const upcomingCount = staff.upcomingBookingsCount || 0;
  if (bookingsEl) {
    bookingsEl.innerText = `${upcomingCount} active upcoming appointment${upcomingCount !== 1 ? 's' : ''} scheduled`;
  }

  // Modal Footer Action Buttons
  const editBtn = document.getElementById("view-staff-edit-btn");
  if (editBtn) {
    editBtn.onclick = () => {
      closeViewStaffModal();
      openEditStaffModal(staff.id);
    };
  }

  const photoBtn = document.getElementById("view-staff-photo-btn");
  if (photoBtn) {
    photoBtn.onclick = () => {
      closeViewStaffModal();
      openAvatarModal(staff.id, staff.name, avatarSrc);
    };
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeViewStaffModal() {
  const modal = document.getElementById("view-staff-modal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
}

function openCreateStaffModal() {
  STATE.editingBarberId = null;
  const modal = document.getElementById("invite-modal");
  const title = document.getElementById("invite-modal-title");
  const subtitle = document.getElementById("invite-modal-subtitle");
  const submitText = document.getElementById("submit-invite-text");
  const submitIcon = document.getElementById("submit-invite-icon");

  if (title) title.innerText = "Add New Barber / Staff Member";
  if (subtitle) subtitle.innerText = "Auto-provisions login account & default 7-day schedule";
  if (submitText) submitText.innerText = "Create Staff Member";
  if (submitIcon) submitIcon.innerText = "+";

  document.getElementById("invite-staff-form")?.reset();
  const passInput = document.getElementById("invite-password");
  if (passInput) passInput.value = "Staff123!";
  const skillsInput = document.getElementById("invite-skills");
  if (skillsInput) skillsInput.value = "Haircut, Beard Trim, Hot Towel";
  const activeToggle = document.getElementById("invite-active-toggle");
  if (activeToggle) activeToggle.checked = true;

  const previewImg = document.getElementById("invite-avatar-preview-img");
  const placeholder = document.getElementById("invite-avatar-placeholder");
  if (previewImg) previewImg.classList.add("hidden");
  if (placeholder) placeholder.classList.remove("hidden");
  const urlInput = document.getElementById("invite-avatar-url");
  if (urlInput) urlInput.value = "";

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
}

function openEditStaffModal(barberId) {
  const staff = STATE.staffList.find((s) => s.id == barberId);
  if (!staff) {
    showToast("Staff member not found", "error");
    return;
  }
  STATE.editingBarberId = barberId;

  const modal = document.getElementById("invite-modal");
  const title = document.getElementById("invite-modal-title");
  const subtitle = document.getElementById("invite-modal-subtitle");
  const submitText = document.getElementById("submit-invite-text");
  const submitIcon = document.getElementById("submit-invite-icon");

  if (title) title.innerText = "Edit Barber / Staff Member";
  if (subtitle) subtitle.innerText = `Update profile and credentials for ${staff.name} (ID #${staff.id})`;
  if (submitText) submitText.innerText = "Save Changes";
  if (submitIcon) submitIcon.innerText = "💾";

  // Pre-populate fields
  const nameInput = document.getElementById("invite-name");
  if (nameInput) nameInput.value = staff.name || "";

  const specialtySelect = document.getElementById("invite-specialty");
  if (specialtySelect) {
    let found = false;
    for (let opt of specialtySelect.options) {
      if (opt.value === staff.specialty) {
        specialtySelect.value = staff.specialty;
        found = true;
        break;
      }
    }
    if (!found && staff.specialty) {
      const opt = document.createElement("option");
      opt.value = staff.specialty;
      opt.innerText = staff.specialty;
      specialtySelect.appendChild(opt);
      specialtySelect.value = staff.specialty;
    }
  }

  const skillsInput = document.getElementById("invite-skills");
  if (skillsInput) {
    skillsInput.value = staff.skills || (staff.skillsTags ? staff.skillsTags.join(", ") : "");
  }

  const phoneInput = document.getElementById("invite-phone");
  if (phoneInput) phoneInput.value = staff.phone || "";

  const emailInput = document.getElementById("invite-email");
  if (emailInput) emailInput.value = (staff.email && !staff.email.endsWith(".internal")) ? staff.email : "";

  const passInput = document.getElementById("invite-password");
  if (passInput) passInput.value = ""; // Leave blank unless changing password

  const activeToggle = document.getElementById("invite-active-toggle");
  if (activeToggle) activeToggle.checked = staff.isActive !== false && staff.status !== "OFFLINE";

  // Avatar preview
  const previewImg = document.getElementById("invite-avatar-preview-img");
  const placeholder = document.getElementById("invite-avatar-placeholder");
  const urlInput = document.getElementById("invite-avatar-url");
  const avatarUrl = staff.avatarUrl || staff.photoUrl;

  if (urlInput) urlInput.value = avatarUrl || "";
  if (avatarUrl && previewImg && placeholder) {
    previewImg.src = formatAvatarUrl(avatarUrl);
    previewImg.classList.remove("hidden");
    placeholder.classList.add("hidden");
  } else if (previewImg && placeholder) {
    previewImg.classList.add("hidden");
    placeholder.classList.remove("hidden");
  }

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
}

function closeInvite() {
  STATE.editingBarberId = null;
  const inviteModal = document.getElementById("invite-modal");
  inviteModal?.classList.add("hidden");
  inviteModal?.classList.remove("flex");
  document.getElementById("invite-staff-form")?.reset();
  const previewImg = document.getElementById("invite-avatar-preview-img");
  const placeholder = document.getElementById("invite-avatar-placeholder");
  if (previewImg) previewImg.classList.add("hidden");
  if (placeholder) placeholder.classList.remove("hidden");
  const urlInput = document.getElementById("invite-avatar-url");
  if (urlInput) urlInput.value = "";
  const title = document.getElementById("invite-modal-title");
  const subtitle = document.getElementById("invite-modal-subtitle");
  const submitText = document.getElementById("submit-invite-text");
  const submitIcon = document.getElementById("submit-invite-icon");
  if (title) title.innerText = "Add New Barber / Staff Member";
  if (subtitle) subtitle.innerText = "Auto-provisions login account & default 7-day schedule";
  if (submitText) submitText.innerText = "Create Staff Member";
  if (submitIcon) submitIcon.innerText = "+";
}

/* =========================================================================
 * 9. EVENT LISTENERS SETUP
 * ========================================================================= */
function initEventListeners() {
  // View mode switcher: Table vs Cards
  const tableBtn = document.getElementById("view-mode-table");
  const cardsBtn = document.getElementById("view-mode-cards");

  tableBtn?.addEventListener("click", () => {
    STATE.viewMode = "table";
    tableBtn.className = "px-3 py-1 rounded-lg text-xs font-black transition bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1.5";
    cardsBtn.className = "px-3 py-1 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white flex items-center gap-1.5";
    renderStaff();
  });

  cardsBtn?.addEventListener("click", () => {
    STATE.viewMode = "cards";
    cardsBtn.className = "px-3 py-1 rounded-lg text-xs font-black transition bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1.5";
    tableBtn.className = "px-3 py-1 rounded-lg text-xs font-bold transition text-slate-400 hover:text-white flex items-center gap-1.5";
    renderStaff();
  });

  // Search input
  const searchInput = document.getElementById("staff-search-input");
  searchInput?.addEventListener("input", (e) => {
    STATE.searchQuery = e.target.value;
    renderStaff();
  });

  // Filter buttons
  document.querySelectorAll(".staff-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".staff-filter-btn").forEach((b) => {
        b.className = "staff-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800";
      });
      btn.className = "staff-filter-btn px-3 py-1.5 rounded-xl text-xs font-black transition bg-amber-500 text-slate-950 border border-amber-400 shadow-md shadow-amber-500/20";
      STATE.filterStatus = btn.getAttribute("data-status");
      renderStaff();
    });
  });

  // Invite / Edit Modal open/close
  const inviteBtn = document.getElementById("open-invite-modal-btn");
  const closeInviteBtn = document.getElementById("close-invite-modal-btn");
  const cancelInviteBtn = document.getElementById("cancel-invite-btn");

  inviteBtn?.addEventListener("click", () => {
    openCreateStaffModal();
  });

  closeInviteBtn?.addEventListener("click", closeInvite);
  cancelInviteBtn?.addEventListener("click", closeInvite);

  // Integrated Profile Avatar file input inside Add Staff modal
  const inviteAvatarFileInput = document.getElementById("invite-avatar-file-input");
  inviteAvatarFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Avatar image size exceeds 2MB limit. Please choose a smaller photo.", "error");
      e.target.value = "";
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Only JPEG, PNG, and WebP images are supported.", "error");
      e.target.value = "";
      return;
    }

    // Live preview
    const reader = new FileReader();
    reader.onload = (re) => {
      const previewImg = document.getElementById("invite-avatar-preview-img");
      const placeholder = document.getElementById("invite-avatar-placeholder");
      if (previewImg && placeholder) {
        previewImg.src = re.target.result;
        previewImg.classList.remove("hidden");
        placeholder.classList.add("hidden");
      }
    };
    reader.readAsDataURL(file);

    // Pre-upload avatar image to obtain static public URL
    const formData = new FormData();
    formData.append("file", file);

    try {
      showToast("Uploading avatar photo...", "info");
      const res = await TenantContext.tenantFetch("/api/portal/staff/upload-avatar", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const urlInput = document.getElementById("invite-avatar-url");
        if (urlInput) urlInput.value = data.avatarUrl;
        showToast("Avatar photo uploaded successfully!", "success");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || "Failed to upload avatar.", "error");
      }
    } catch (err) {
      console.warn("Avatar upload error:", err);
    }
  });

  // Invite / Edit form submit
  document.getElementById("invite-staff-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("invite-name").value.trim();
    const specialty = document.getElementById("invite-specialty").value;
    const skills = document.getElementById("invite-skills")?.value.trim() || "Haircut, Beard Trim, Hot Towel";
    const phone = document.getElementById("invite-phone").value.trim();
    const email = document.getElementById("invite-email").value.trim();
    const password = document.getElementById("invite-password").value.trim();
    const avatarUrl = document.getElementById("invite-avatar-url")?.value.trim() || null;
    const isActive = document.getElementById("invite-active-toggle")?.checked ?? true;

    const submitBtn = document.getElementById("submit-invite-btn") || e.target.querySelector("button[type='submit']");
    const submitText = document.getElementById("submit-invite-text");
    const isEdit = !!STATE.editingBarberId;

    submitBtn.disabled = true;
    if (submitText) submitText.innerText = isEdit ? "Saving Changes..." : "Creating Staff...";

    try {
      const payload = {
        name,
        specialty,
        skills,
        phone,
        email: email || null,
        avatarUrl,
        photoUrl: avatarUrl,
        isActive,
        status: isActive ? "ACTIVE" : "OFFLINE"
      };
      if (password) {
        payload.password = password;
      }

      let res;
      if (isEdit) {
        res = await TenantContext.tenantFetch(`/api/portal/staff/${STATE.editingBarberId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        if (!payload.password) payload.password = "Staff123!";
        res = await TenantContext.tenantFetch("/api/portal/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.status === 409) {
        const conflictData = await res.json().catch(() => ({}));
        showConflictModal(STATE.editingBarberId, conflictData);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || (isEdit ? "Failed to update staff member" : "Failed to invite staff member"));
      }

      const result = await res.json();
      if (isEdit) {
        const idx = STATE.staffList.findIndex((s) => s.id == STATE.editingBarberId);
        if (idx !== -1) {
          STATE.staffList[idx] = result;
        }
        showToast(`Staff member "${result.name}" updated successfully!`, "success");
      } else {
        STATE.staffList.unshift(result);
        showToast(`Barber "${result.name}" created successfully! Default weekly roster assigned.`, "success");
      }

      closeInvite();
      renderStats();
      renderStaff();
    } catch (err) {
      console.error(isEdit ? "Update error:" : "Invite error:", err);
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      if (submitText) submitText.innerText = isEdit ? "Save Changes" : "Create Staff Member";
    }
  });

  // Avatar Modal close & upload
  const avatarModal = document.getElementById("avatar-modal");
  const closeAvatarModal = () => {
    avatarModal?.classList.add("hidden");
    avatarModal?.classList.remove("flex");
    const fileInput = document.getElementById("staff-avatar-file-input");
    if (fileInput) fileInput.value = "";
  };

  document.getElementById("close-avatar-modal-btn")?.addEventListener("click", closeAvatarModal);
  document.getElementById("cancel-avatar-btn")?.addEventListener("click", closeAvatarModal);

  // Avatar file input live preview
  const avatarFileInput = document.getElementById("staff-avatar-file-input");
  avatarFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Avatar image size exceeds 2MB limit. Please choose a smaller photo.", "error");
      e.target.value = "";
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Only JPEG, PNG, and WebP images are allowed.", "error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (re) => {
      const previewImg = document.getElementById("avatar-preview-img");
      const initialsSpan = document.getElementById("avatar-preview-initials");
      if (previewImg && initialsSpan) {
        previewImg.src = re.target.result;
        previewImg.classList.remove("hidden");
        initialsSpan.classList.add("hidden");
      }
    };
    reader.readAsDataURL(file);
  });

  // Save avatar button submit
  document.getElementById("save-avatar-btn")?.addEventListener("click", async () => {
    const barberId = document.getElementById("avatar-target-staff-id")?.value;
    const file = document.getElementById("staff-avatar-file-input")?.files?.[0];

    if (!file) {
      showToast("Please choose an image file first.", "warning");
      return;
    }

    const saveBtn = document.getElementById("save-avatar-btn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>⏳</span><span>Uploading...</span>`;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await TenantContext.tenantFetch(`/api/portal/staff/${barberId}/avatar`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to upload avatar photo");
      }

      const updated = await res.json();
      const idx = STATE.staffList.findIndex((s) => s.id == barberId);
      if (idx !== -1) {
        STATE.staffList[idx] = updated;
      }

      showToast("Staff avatar photo updated successfully!", "success");
      closeAvatarModal();
      renderStaff();
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast(err.message, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span>Upload Photo</span>`;
    }
  });

  // Schedule Modal close buttons
  document.getElementById("close-schedule-modal-btn")?.addEventListener("click", closeScheduleModal);
  document.getElementById("cancel-schedule-btn")?.addEventListener("click", closeScheduleModal);

  // Preset buttons
  document.getElementById("preset-standard-schedule")?.addEventListener("click", applyStandardPreset);
  document.getElementById("preset-fulltime-schedule")?.addEventListener("click", applyFullTimePreset);

  // Schedule form submit
  document.getElementById("schedule-form")?.addEventListener("submit", saveStaffSchedule);

  // Conflict Modal close buttons
  document.getElementById("close-conflict-modal-btn")?.addEventListener("click", closeConflictModal);
  document.getElementById("close-conflict-btn")?.addEventListener("click", closeConflictModal);

  // View Staff Profile Modal close buttons
  document.getElementById("close-view-staff-modal-btn")?.addEventListener("click", closeViewStaffModal);
  document.getElementById("close-view-staff-btn")?.addEventListener("click", closeViewStaffModal);
  document.getElementById("view-staff-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "view-staff-modal") closeViewStaffModal();
  });
}

function openAvatarModal(barberId, barberName, currentAvatarUrl) {
  const modal = document.getElementById("avatar-modal");
  const targetIdInput = document.getElementById("avatar-target-staff-id");
  const subtitle = document.getElementById("avatar-modal-subtitle");
  const previewImg = document.getElementById("avatar-preview-img");
  const initialsSpan = document.getElementById("avatar-preview-initials");
  const fileInput = document.getElementById("staff-avatar-file-input");

  if (targetIdInput) targetIdInput.value = barberId;
  if (subtitle) subtitle.innerText = `Barber: ${barberName} (ID #${barberId})`;
  if (fileInput) fileInput.value = "";

  const initials = barberName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  if (currentAvatarUrl) {
    if (previewImg) {
      previewImg.src = currentAvatarUrl;
      previewImg.classList.remove("hidden");
    }
    if (initialsSpan) initialsSpan.classList.add("hidden");
  } else {
    if (previewImg) previewImg.classList.add("hidden");
    if (initialsSpan) {
      initialsSpan.innerText = initials;
      initialsSpan.classList.remove("hidden");
    }
  }

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
}

/* =========================================================================
 * 9. WEEKLY SCHEDULE & BREAK SHIFTS MODAL
 * ========================================================================= */
async function openScheduleModal(barberId, barberName) {
  STATE.activeBarberForSchedule = barberId;
  const modal = document.getElementById("schedule-modal");
  const title = document.getElementById("schedule-modal-title");
  const subtitle = document.getElementById("schedule-modal-subtitle");
  const container = document.getElementById("schedule-days-container");

  if (title) title.innerText = `Work Schedule & Break Shifts`;
  if (subtitle) subtitle.innerText = `Barber: ${barberName} (ID #${barberId})`;

  modal?.classList.remove("hidden");
  modal?.classList.add("flex");

  if (container) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500 font-mono text-xs">Loading barber schedule from server...</div>`;
  }

  try {
    const res = await TenantContext.tenantFetch(`/api/portal/staff/${barberId}/schedule`);
    if (!res.ok) throw new Error("Failed to load schedule");
    const scheduleData = await res.json();
    STATE.currentSchedule = scheduleData;
    renderScheduleRows(scheduleData.days);
  } catch (err) {
    console.error("Load schedule error:", err);
    showToast(err.message, "error");
    closeScheduleModal();
  }
}

function closeScheduleModal() {
  const modal = document.getElementById("schedule-modal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
  STATE.activeBarberForSchedule = null;
  STATE.currentSchedule = null;
}

function renderScheduleRows(days) {
  const container = document.getElementById("schedule-days-container");
  if (!container) return;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Ensure all 7 days represented
  const fullDays = [];
  for (let d = 1; d <= 7; d++) {
    const existing = days?.find((item) => item.dayOfWeek === d);
    if (existing) {
      fullDays.push(existing);
    } else {
      fullDays.push({
        dayOfWeek: d,
        dayName: dayNames[d - 1],
        startTime: "09:00:00",
        endTime: "21:00:00",
        isOff: d === 6,
        breakStart: d === 6 ? null : "13:00:00",
        breakEnd: d === 6 ? null : "14:00:00"
      });
    }
  }

  container.innerHTML = fullDays
    .map((day) => {
      const isOff = day.isOff === true;
      const start = (day.startTime || "09:00").substring(0, 5);
      const end = (day.endTime || "21:00").substring(0, 5);
      const bStart = (day.breakStart || "13:00").substring(0, 5);
      const bEnd = (day.breakEnd || "14:00").substring(0, 5);

      return `
        <div class="schedule-day-row p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs" data-day="${day.dayOfWeek}">
          <div class="flex items-center justify-between md:w-36 shrink-0">
            <span class="font-extrabold text-white text-sm">${day.dayName || dayNames[day.dayOfWeek - 1]}</span>
            <label class="flex items-center gap-1.5 cursor-pointer text-[11px] font-mono text-slate-400">
              <input type="checkbox" class="day-off-toggle rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0" ${isOff ? "checked" : ""} />
              <span>Day Off</span>
            </label>
          </div>

          <div class="day-inputs-container grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 ${isOff ? "opacity-40 pointer-events-none" : ""}">
            <div>
              <span class="block text-[10px] text-slate-500 mb-1">Shift Start</span>
              <input type="time" class="shift-start-input w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400" value="${start}" />
            </div>
            <div>
              <span class="block text-[10px] text-slate-500 mb-1">Shift End</span>
              <input type="time" class="shift-end-input w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white font-mono focus:border-amber-400" value="${end}" />
            </div>
            <div>
              <span class="block text-[10px] text-slate-500 mb-1">Break Start</span>
              <input type="time" class="break-start-input w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-amber-400 font-mono focus:border-amber-400" value="${bStart}" />
            </div>
            <div>
              <span class="block text-[10px] text-slate-500 mb-1">Break End</span>
              <input type="time" class="break-end-input w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-amber-400 font-mono focus:border-amber-400" value="${bEnd}" />
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach toggle listener to disable inputs on "Day Off"
  container.querySelectorAll(".day-off-toggle").forEach((toggle) => {
    toggle.addEventListener("change", (e) => {
      const row = e.target.closest(".schedule-day-row");
      const inputs = row.querySelector(".day-inputs-container");
      if (e.target.checked) {
        inputs.classList.add("opacity-40", "pointer-events-none");
      } else {
        inputs.classList.remove("opacity-40", "pointer-events-none");
      }
    });
  });
}

function applyStandardPreset() {
  document.querySelectorAll(".schedule-day-row").forEach((row) => {
    const day = parseInt(row.getAttribute("data-day"));
    const isFriday = day === 6;
    const toggle = row.querySelector(".day-off-toggle");
    const inputs = row.querySelector(".day-inputs-container");

    toggle.checked = isFriday;
    if (isFriday) {
      inputs.classList.add("opacity-40", "pointer-events-none");
    } else {
      inputs.classList.remove("opacity-40", "pointer-events-none");
      row.querySelector(".shift-start-input").value = "09:00";
      row.querySelector(".shift-end-input").value = "21:00";
      row.querySelector(".break-start-input").value = "13:00";
      row.querySelector(".break-end-input").value = "14:00";
    }
  });
  showToast("Applied Standard 09:00 - 21:00 preset.", "success");
}

function applyFullTimePreset() {
  document.querySelectorAll(".schedule-day-row").forEach((row) => {
    const day = parseInt(row.getAttribute("data-day"));
    const toggle = row.querySelector(".day-off-toggle");
    const inputs = row.querySelector(".day-inputs-container");

    toggle.checked = false;
    inputs.classList.remove("opacity-40", "pointer-events-none");
    row.querySelector(".shift-start-input").value = "10:00";
    row.querySelector(".shift-end-input").value = "22:00";
    row.querySelector(".break-start-input").value = "14:00";
    row.querySelector(".break-end-input").value = "15:00";
  });
  showToast("Applied Full-Time 10:00 - 22:00 preset.", "success");
}

async function saveStaffSchedule(e) {
  e.preventDefault();
  const barberId = STATE.activeBarberForSchedule;
  if (!barberId) return;

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daysData = [];
  let validationError = null;

  document.querySelectorAll(".schedule-day-row").forEach((row) => {
    if (validationError) return;

    const dayOfWeek = parseInt(row.getAttribute("data-day"));
    const dayName = dayNames[dayOfWeek - 1] || `Day ${dayOfWeek}`;
    const isOff = row.querySelector(".day-off-toggle").checked;
    const startVal = row.querySelector(".shift-start-input").value;
    const endVal = row.querySelector(".shift-end-input").value;
    const bStartVal = row.querySelector(".break-start-input").value;
    const bEndVal = row.querySelector(".break-end-input").value;

    if (!isOff) {
      if (!startVal || !endVal) {
        validationError = `Start time and end time are required for ${dayName}.`;
        return;
      }
      if (endVal <= startVal) {
        validationError = `Shift end time (${endVal}) must be strictly after shift start time (${startVal}) for ${dayName}.`;
        return;
      }
      if (bStartVal || bEndVal) {
        if (!bStartVal || !bEndVal) {
          validationError = `Both break start and break end times must be specified for ${dayName}.`;
          return;
        }
        if (bEndVal <= bStartVal) {
          validationError = `Break end time (${bEndVal}) must be after break start time (${bStartVal}) for ${dayName}.`;
          return;
        }
        if (bStartVal < startVal || bEndVal > endVal) {
          validationError = `Break interval (${bStartVal} - ${bEndVal}) must fall within shift hours (${startVal} - ${endVal}) for ${dayName}.`;
          return;
        }
      }
    }

    const startTime = startVal ? startVal + ":00" : "09:00:00";
    const endTime = endVal ? endVal + ":00" : "21:00:00";
    const breakStart = isOff ? null : (bStartVal ? bStartVal + ":00" : null);
    const breakEnd = isOff ? null : (bEndVal ? bEndVal + ":00" : null);

    daysData.push({
      dayOfWeek,
      startTime,
      endTime,
      isOff,
      breakStart,
      breakEnd
    });
  });

  if (validationError) {
    showToast(validationError, "error");
    return;
  }

  const submitBtn = document.getElementById("save-schedule-btn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Saving Roster...";

  try {
    const res = await TenantContext.tenantFetch(`/api/portal/staff/${barberId}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barberId, days: daysData })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to save schedule");
    }

    showToast("Barber weekly working hours and breaks updated successfully!", "success");
    closeScheduleModal();
    await loadStaffList(); // Refresh table and cards roster summaries
  } catch (err) {
    console.error("Save schedule error:", err);
    showToast(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Save Working Schedule";
  }
}

/* =========================================================================
 * 10. TOAST NOTIFICATION UTILITY
 * ========================================================================= */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const isErr = type === "error";
  const isInfo = type === "info";

  let colorClasses = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  let icon = "✅";

  if (isErr) {
    colorClasses = "bg-red-500/10 text-red-300 border-red-500/30";
    icon = "⚠️";
  } else if (isInfo) {
    colorClasses = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    icon = "ℹ️";
  }

  toast.className = `p-4 rounded-2xl border text-xs font-bold shadow-2xl flex items-center gap-3 pointer-events-auto transition-all transform translate-y-2 opacity-0 ${colorClasses}`;
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.remove("translate-y-2", "opacity-0"));
  setTimeout(() => {
    toast.classList.add("translate-y-2", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
