/**
 * Super Admin Salons & Barber Shops Directory Module
 * Restricted strictly to SUPER_ADMIN authority
 */

import { Store } from "./store.js";
import { AuthGuard } from "./auth-guard.js";
import { QrHelper } from "./qr-helper.js";

// Execute AuthGuard immediately to intercept unauthorized access before render
AuthGuard.init();

let currentQuery = "";
let currentCityFilter = "ALL";

document.addEventListener("DOMContentLoaded", async () => {
  AuthGuard.init();
  Store.init();

  const user = Store.getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    // AuthGuard handles redirection for unauthenticated or non-admin users
    return;
  }

  initHeaderEvents();
  renderDirectory();
  initDirectoryFilters();

  // Listen to real-time shop registrations or status updates
  Store.subscribe(() => {
    renderDirectory();
  });

  // Keep synchronized with backend API
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
        localStorage.setItem("barber_saas_shops", JSON.stringify(merged));
        renderDirectory();
      }
    }
  } catch (err) {
    // offline fallback
  }
});

function initHeaderEvents() {
  const logoutBtn = document.getElementById("directory-logout-btn");
  logoutBtn?.addEventListener("click", () => {
    Store.logout();
    window.location.href = "./login.html";
  });
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "px-4 py-3 bg-slate-900/95 border border-[#F59E0B] text-white rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 pointer-events-auto transition-all";
  toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function renderDirectory() {
  const container = document.getElementById("shops-directory-grid");
  const countBadge = document.getElementById("directory-count-badge");
  if (!container) return;

  const shops = Store.getShops();

  const filtered = shops.filter((shop) => {
    const matchQuery =
      shop.name.toLowerCase().includes(currentQuery.toLowerCase()) ||
      (shop.city && shop.city.toLowerCase().includes(currentQuery.toLowerCase())) ||
      (shop.district && shop.district.toLowerCase().includes(currentQuery.toLowerCase())) ||
      (shop.owner && shop.owner.toLowerCase().includes(currentQuery.toLowerCase()));

    const matchCity =
      currentCityFilter === "ALL" ||
      (shop.city && shop.city.toUpperCase() === currentCityFilter.toUpperCase());

    return matchQuery && matchCity;
  });

  if (countBadge) {
    countBadge.innerText = `${filtered.length} Salon${filtered.length === 1 ? "" : "s"} Listed`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <span class="text-3xl block mb-2">💈</span>
        <h3 class="text-base font-bold text-white">No Salons Found</h3>
        <p class="text-xs text-slate-400 mt-1">Try adjusting your search terms or city filters</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((shop) => {
    const coverPhoto = shop.photos && shop.photos.length > 0 ? shop.photos[0].dataUrl : null;
    const barbersCount = shop.barbers ? shop.barbers.length : 0;
    const servicesCount = shop.services ? shop.services.length : 0;
    const status = shop.status || "ACTIVE";
    const origin = window.location.origin || "http://localhost:3000";
    const loginUrl = shop.loginUrl || `${origin}/dashboard/index.html?slug=${shop.slug}`;
    const bookingUrl = shop.bookingUrl || `${origin}/booking.html?slug=${shop.slug}`;

    const statusBadgeClass =
      status === "ACTIVE"
        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
        : status === "PENDING"
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : "bg-red-500/20 text-red-400 border-red-500/30";

    return `
      <div class="group backdrop-blur-md bg-white/5 border border-white/10 hover:border-[#F59E0B] rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-[#F59E0B]/10 flex flex-col justify-between">
        
        <!-- Shop Cover / Image Banner -->
        <div class="relative h-44 w-full bg-slate-900 overflow-hidden">
          ${coverPhoto ? `
            <img src="${coverPhoto}" alt="${shop.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ` : `
            <div class="w-full h-full bg-gradient-to-br from-slate-900 via-[#111827] to-slate-950 flex items-center justify-center relative">
              <span class="text-4xl opacity-30">✂️</span>
              <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
            </div>
          `}
          <div class="absolute top-3 right-3 flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border backdrop-blur-md ${statusBadgeClass}">
              ${status === "ACTIVE" ? "✓" : "•"} ${status}
            </span>
          </div>
          <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span class="text-[10px] uppercase font-bold tracking-wider text-[#F59E0B] bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-[#F59E0B]/30">
              📍 ${shop.district ? `${shop.district}, ` : ""}${shop.city || "Saudi Arabia"}
            </span>
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-300 bg-slate-950/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-800">
              ${shop.plan || "MONTHLY"}
            </span>
          </div>
        </div>

        <!-- Shop Information Content -->
        <div class="p-5 space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-lg font-bold text-white group-hover:text-[#F59E0B] transition line-clamp-1">${shop.name}</h3>
            </div>
            <p class="text-xs text-slate-400 mt-1 line-clamp-1">${shop.fullAddress || `${shop.district || ""}, ${shop.city || ""}`}</p>
            <div class="mt-2 text-[11px] text-slate-400 space-y-0.5">
              <p>Owner: <span class="text-slate-200 font-semibold">${shop.owner || "Registered Owner"}</span></p>
              <p>Contact: <span class="text-slate-300 font-mono">${shop.phone || shop.ownerPhone || "050XXXXXXX"}</span></p>
            </div>
          </div>

          <!-- Feature Pills -->
          <div class="flex items-center gap-3 pt-2 text-[11px] text-slate-300 border-t border-slate-800/80">
            <div class="flex items-center gap-1.5">
              <span class="text-[#F59E0B]">✂️</span>
              <span><strong>${barbersCount}</strong> Barber${barbersCount === 1 ? "" : "s"}</span>
            </div>
            <span class="text-slate-700">•</span>
            <div class="flex items-center gap-1.5">
              <span class="text-[#F59E0B]">💈</span>
              <span><strong>${servicesCount}</strong> Service${servicesCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          <!-- SUPER ADMIN CONTROLS -->
          <div class="pt-3 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <a href="./dashboard/index.html?slug=${shop.slug}" class="py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-[#F59E0B] font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm">
                <span>📋 Schedule</span>
              </a>
              <a href="./booking.html?slug=${shop.slug}" target="_blank" class="py-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition">
                <span>🔗 Booking</span>
              </a>
            </div>

            <!-- Toggle QR Drawer Button -->
            <button data-target="qr-drawer-${shop.slug}" class="btn-toggle-qr w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition">
              <span>📱 View QR Codes & Links</span>
            </button>

            <!-- DUAL QR CODES DRAWER -->
            <div id="qr-drawer-${shop.slug}" class="hidden p-3 bg-slate-950/90 border border-indigo-500/30 rounded-xl space-y-2.5">
              <div class="flex items-center justify-between text-xs font-bold text-indigo-300 border-b border-slate-800 pb-1.5">
                <span>Dual QR Codes</span>
                <button data-id="${shop.id}" data-slug="${shop.slug}" class="btn-dir-zip px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600 text-white rounded text-[10px] font-bold transition">
                  📦 ZIP
                </button>
              </div>

              <div class="grid grid-cols-2 gap-2 text-center">
                <!-- Login QR -->
                <div class="p-2 bg-slate-900 rounded-lg border border-purple-500/20 space-y-1">
                  <span class="text-[9px] font-extrabold uppercase text-purple-300 block">🔐 Login QR</span>
                  <div class="bg-white p-1 rounded w-[85px] h-[85px] mx-auto flex items-center justify-center">
                    <div id="dir-login-qr-${shop.slug}" class="w-full h-full flex items-center justify-center"></div>
                  </div>
                  <div class="text-[8px] font-mono text-purple-300 truncate select-all">${loginUrl}</div>
                  <div class="flex gap-1 justify-center pt-0.5">
                    <button data-url="${loginUrl}" class="btn-copy-link px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-200 rounded font-bold">Copy</button>
                    <button data-slug="${shop.slug}" data-type="login" data-format="png" class="btn-dir-png px-1.5 py-0.5 bg-purple-500/20 text-purple-200 rounded text-[9px] font-bold">PNG</button>
                    <button data-slug="${shop.slug}" data-type="login" data-format="svg" class="btn-dir-svg px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold">SVG</button>
                  </div>
                </div>

                <!-- Booking QR -->
                <div class="p-2 bg-slate-900 rounded-lg border border-[#F59E0B]/20 space-y-1">
                  <span class="text-[9px] font-extrabold uppercase text-[#F59E0B] block">🌐 Booking QR</span>
                  <div class="bg-white p-1 rounded w-[85px] h-[85px] mx-auto flex items-center justify-center">
                    <div id="dir-booking-qr-${shop.slug}" class="w-full h-full flex items-center justify-center"></div>
                  </div>
                  <div class="text-[8px] font-mono text-[#F59E0B] truncate select-all">${bookingUrl}</div>
                  <div class="flex gap-1 justify-center pt-0.5">
                    <button data-url="${bookingUrl}" class="btn-copy-link px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-200 rounded font-bold">Copy</button>
                    <button data-slug="${shop.slug}" data-type="booking" data-format="png" class="btn-dir-png px-1.5 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-[9px] font-bold">PNG</button>
                    <button data-slug="${shop.slug}" data-type="booking" data-format="svg" class="btn-dir-svg px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold">SVG</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Quick Status Override Toggle -->
            ${status === "ACTIVE" ? `
              <button data-id="${shop.id}" data-action="SUSPENDED" class="status-toggle-btn w-full py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1">
                <span>⏸️ Suspend Salon</span>
              </button>
            ` : `
              <button data-id="${shop.id}" data-action="ACTIVE" class="status-toggle-btn w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 font-bold text-[11px] rounded-xl transition flex items-center justify-center gap-1">
                <span>▶️ Approve & Activate Salon</span>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Attach QR drawer toggles & render QR on demand
  container.querySelectorAll(".btn-toggle-qr").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute("data-target");
      const drawer = document.getElementById(targetId);
      if (!drawer) return;

      const isHidden = drawer.classList.contains("hidden");
      if (isHidden) {
        drawer.classList.remove("hidden");
        btn.innerHTML = `<span>▲ Hide QR Codes</span>`;

        // Render QR codes if not rendered yet
        const slug = targetId.replace("qr-drawer-", "");
        const shop = shops.find((s) => s.slug === slug);
        if (shop && !shop._dirLoginQr) {
          const origin = window.location.origin || "http://localhost:3000";
          const loginUrl = shop.loginUrl || `${origin}/dashboard/index.html?slug=${shop.slug}`;
          const bookingUrl = shop.bookingUrl || `${origin}/booking.html?slug=${shop.slug}`;
          shop._dirLoginQr = await QrHelper.renderQr(`#dir-login-qr-${shop.slug}`, loginUrl, 85);
          shop._dirBookingQr = await QrHelper.renderQr(`#dir-booking-qr-${shop.slug}`, bookingUrl, 85);
        }
      } else {
        drawer.classList.add("hidden");
        btn.innerHTML = `<span>📱 View QR Codes & Links</span>`;
      }
    });
  });

  // Attach copy link listeners
  container.querySelectorAll(".btn-copy-link").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const url = btn.getAttribute("data-url");
      QrHelper.copyText(url, btn);
    });
  });

  // Attach PNG downloads
  container.querySelectorAll(".btn-dir-png").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const slug = btn.getAttribute("data-slug");
      const type = btn.getAttribute("data-type");
      const shop = shops.find((s) => s.slug === slug);
      if (!shop) return;
      const dataUrl = type === "login" ? shop._dirLoginQr?.pngDataUrl : shop._dirBookingQr?.pngDataUrl;
      QrHelper.downloadPng(dataUrl, `${slug}-${type}-qr.png`);
    });
  });

  // Attach SVG downloads
  container.querySelectorAll(".btn-dir-svg").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const slug = btn.getAttribute("data-slug");
      const type = btn.getAttribute("data-type");
      const shop = shops.find((s) => s.slug === slug);
      if (!shop) return;
      const svg = type === "login" ? shop._dirLoginQr?.svgString : shop._dirBookingQr?.svgString;
      QrHelper.downloadSvg(svg, `${slug}-${type}-qr.svg`);
    });
  });

  // Attach ZIP download
  container.querySelectorAll(".btn-dir-zip").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const slug = btn.getAttribute("data-slug");
      const shopId = btn.getAttribute("data-id");
      const shop = shops.find((s) => s.slug === slug);
      if (!shop) return;
      const origin = window.location.origin || "http://localhost:3000";
      const loginUrl = shop.loginUrl || `${origin}/dashboard/index.html?slug=${shop.slug}`;
      const bookingUrl = shop.bookingUrl || `${origin}/booking.html?slug=${shop.slug}`;

      QrHelper.downloadZip({
        filename: `${slug}-qr-codes.zip`,
        shopName: shop.name,
        slug: shop.slug,
        loginUrl,
        bookingUrl,
        loginPng: shop._dirLoginQr?.pngDataUrl,
        bookingPng: shop._dirBookingQr?.pngDataUrl,
        loginSvg: shop._dirLoginQr?.svgString,
        bookingSvg: shop._dirBookingQr?.svgString,
        shopId
      });
    });
  });

  // Attach status toggle listeners
  container.querySelectorAll(".status-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const shopId = btn.getAttribute("data-id");
      const targetAction = btn.getAttribute("data-action");
      Store.updateShopStatus(shopId, targetAction);
      showToast(`Salon status updated to ${targetAction}`);
      renderDirectory();
    });
  });
}

function initDirectoryFilters() {
  const searchInput = document.getElementById("directory-search");
  searchInput?.addEventListener("input", (e) => {
    currentQuery = e.target.value.trim();
    renderDirectory();
  });

  document.querySelectorAll(".city-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".city-filter-btn").forEach((b) => {
        b.className = "city-filter-btn px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white transition";
      });
      btn.className = "city-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-[#F59E0B] text-slate-950 border border-[#F59E0B] transition";
      currentCityFilter = btn.getAttribute("data-city") || "ALL";
      renderDirectory();
    });
  });
}
