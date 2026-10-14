/**
 * Salon Portal - Salon Profile & Operations Settings Engine (/portal/settings)
 */

import { Store } from "./store.js";
import { TenantContext } from "./tenant-context.js";
import { AuthGuard } from "./auth-guard.js";

const DAYS = [
  { key: "sunday", label: "Sunday", ar: "الأحد" },
  { key: "monday", label: "Monday", ar: "الإثنين" },
  { key: "tuesday", label: "Tuesday", ar: "الثلاثاء" },
  { key: "wednesday", label: "Wednesday", ar: "الأربعاء" },
  { key: "thursday", label: "Thursday", ar: "الخميس" },
  { key: "friday", label: "Friday", ar: "الجمعة" },
  { key: "saturday", label: "Saturday", ar: "السبت" }
];

const DEFAULT_HOURS = {
  sunday: { open: "09:00", close: "22:00", closed: false },
  monday: { open: "09:00", close: "22:00", closed: false },
  tuesday: { open: "09:00", close: "22:00", closed: false },
  wednesday: { open: "09:00", close: "22:00", closed: false },
  thursday: { open: "09:00", close: "23:00", closed: false },
  friday: { open: "13:00", close: "23:00", closed: false },
  saturday: { open: "09:00", close: "22:00", closed: false }
};

const STATE = {
  settings: null,
  operatingHours: { ...DEFAULT_HOURS },
  galleryImages: [],
  isSubmitting: false
};

document.addEventListener("DOMContentLoaded", async () => {
  if (!AuthGuard.requireAuth()) return;

  const context = await TenantContext.init();
  if (!context) {
    showToast("Failed to initialize salon tenant session.", "error");
    return;
  }

  // RBAC Guard: Only Owner can access Salon Operations Settings
  if (TenantContext.isStaff()) {
    showToast("Access Denied: Staff members are restricted from salon settings.", "error");
    setTimeout(() => {
      window.location.href = "../index.html#schedule";
    }, 1200);
    return;
  }

  initHeader(context);
  initSidebar(context);
  initEventListeners();
  await loadSalonSettings();
  await loadSalonGallery();
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
    { id: "services", label: "Services & Pricing", icon: "✂️", sub: "Catalogue and durations", href: "../services/index.html" },
    { id: "settings", label: "Salon Profile & Settings", icon: "⚙️", sub: "Location, rules & QR", href: "index.html", active: true }
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
 * 3. DATA LOADING & POPULATION
 * ========================================================================= */
async function loadSalonSettings() {
  const loadingOverlay = document.getElementById("settings-loading-overlay");
  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

  try {
    const res = await TenantContext.tenantFetch("/api/portal/settings");
    if (!res.ok) throw new Error("Failed to load salon settings");
    const data = await res.json();
    STATE.settings = data;

    // Parse operating hours JSON
    if (data.operatingHoursJson) {
      try {
        STATE.operatingHours = { ...DEFAULT_HOURS, ...JSON.parse(data.operatingHoursJson) };
      } catch (e) {
        console.warn("Could not parse operating hours JSON, using defaults:", e);
        STATE.operatingHours = { ...DEFAULT_HOURS };
      }
    } else {
      STATE.operatingHours = { ...DEFAULT_HOURS };
    }

    populateFormFields(data);
    renderOperatingHours();
  } catch (err) {
    console.error("Settings load error:", err);
    showToast(err.message, "error");
  } finally {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }
}

function populateFormFields(data) {
  // Identity & Profile
  setInputValue("setting-name", data.name || "");
  setInputValue("setting-phone", data.phone || "");
  setInputValue("setting-region", data.region || "Riyadh Province");
  setInputValue("setting-city", data.city || "Riyadh");
  setInputValue("setting-district", data.district || "Al-Olaya");
  setInputValue("setting-full-address", data.fullAddress || "");
  setInputValue("setting-map-address", data.mapAddress || "");

  // Coordinates
  setInputValue("setting-latitude", data.latitude !== undefined && data.latitude !== null ? data.latitude : "24.7136");
  setInputValue("setting-longitude", data.longitude !== undefined && data.longitude !== null ? data.longitude : "46.6753");

  // Media
  setInputValue("setting-logo-url", data.logoUrl || "");
  setInputValue("setting-cover-url", data.coverImageUrl || "");
  updateMediaPreviews(data.logoUrl, data.coverImageUrl);

  // Booking Rules
  setInputValue("setting-min-cancel-hours", data.minCancelNoticeHours !== undefined ? data.minCancelNoticeHours : 2);
  setInputValue("setting-max-advance-days", data.maxAdvanceBookingDays !== undefined ? data.maxAdvanceBookingDays : 14);

  const autoConfirmCheckbox = document.getElementById("setting-auto-confirm-walkins");
  if (autoConfirmCheckbox) {
    autoConfirmCheckbox.checked = data.autoConfirmWalkins !== false;
  }

  // Public Booking & QR Info
  const bookingUrl = data.bookingUrl || `http://localhost:3000/booking/?slug=${data.slug || "golden-scissors"}`;
  const bookingUrlDisplay = document.getElementById("booking-url-display");
  if (bookingUrlDisplay) bookingUrlDisplay.innerText = bookingUrl;

  const publicLinkAnchor = document.getElementById("public-booking-anchor");
  if (publicLinkAnchor) publicLinkAnchor.href = bookingUrl;

  // Header Salon Name Sync
  const headerName = document.getElementById("header-salon-name");
  if (headerName && data.name) headerName.innerText = data.name;

  const headerBranch = document.getElementById("header-branch-text");
  if (headerBranch && (data.district || data.city)) {
    headerBranch.innerText = `${data.district || ""}, ${data.city || ""}`.replace(/^, |, $/g, "");
  }
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

const DEFAULT_LOGO_URL = "/favicon.svg";
const DEFAULT_COVER_URL = "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80";

function formatMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("/uploads/")) {
    const backendBase = (typeof window !== "undefined" && window.location.port !== "8080")
      ? "http://localhost:8080"
      : "";
    return `${backendBase}${url}`;
  }
  return url;
}

function isValidHttpUrl(str) {
  return typeof str === "string" && (
    str.startsWith("http://") ||
    str.startsWith("https://") ||
    str.startsWith("data:image/") ||
    str.startsWith("/")
  );
}

/**
 * Client-Side Image Auto-Compressor
 * Automatically resizes high-resolution camera images down to target dimensions
 * and re-encodes to high quality JPEG, shrinking 5MB-15MB files to ~150KB-350KB.
 */
async function autoCompressImage(file, options = {}) {
  const maxWidth = options.maxWidth || 1920;
  const maxHeight = options.maxHeight || 1080;
  const quality = options.quality || 0.84;
  const mimeType = "image/jpeg";
  const originalSize = file.size;

  if (file.type === "image/svg+xml") {
    return { file, originalSize, compressedSize: originalSize, savingsPercent: 0 };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ file, originalSize, compressedSize: originalSize, savingsPercent: 0 });
    };

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        resolve({ file, originalSize, compressedSize: originalSize, savingsPercent: 0 });
      };

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Prevent black background on transparent PNGs by using dark slate
        if (file.type === "image/png") {
          ctx.fillStyle = "#0B0F17";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve({ file, originalSize, compressedSize: originalSize, savingsPercent: 0 });
              return;
            }

            const cleanBase = file.name.replace(/\.[^/.]+$/, "");
            const compressedFile = new File([blob], `${cleanBase}.jpg`, {
              type: mimeType,
              lastModified: Date.now()
            });

            const compressedSize = compressedFile.size;
            const savingsPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

            console.log(
              `Auto-compressed: ${file.name} (${(originalSize / 1024).toFixed(0)}KB ➔ ${(compressedSize / 1024).toFixed(0)}KB, -${savingsPercent}%)`
            );

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize,
              savingsPercent,
              width,
              height
            });
          },
          mimeType,
          quality
        );
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}

function updateMediaPreviews(logoUrl, coverUrl) {
  // Brand Logo Preview with fallback to /favicon.svg
  const logoPreview = document.getElementById("logo-preview-img");
  const logoBadge = document.getElementById("logo-badge");
  const logoCompressInfo = document.getElementById("logo-compress-info");

  if (logoPreview) {
    const effectiveLogo = (logoUrl && isValidHttpUrl(logoUrl)) ? formatMediaUrl(logoUrl) : DEFAULT_LOGO_URL;
    logoPreview.src = effectiveLogo;
    logoPreview.classList.remove("hidden");

    const isDefault = !logoUrl || effectiveLogo === DEFAULT_LOGO_URL || effectiveLogo.endsWith("/favicon.svg");
    if (logoBadge) {
      logoBadge.innerText = isDefault ? "Default Favicon" : "Custom Logo";
      logoBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
        isDefault
          ? "bg-slate-800 text-slate-300 border border-slate-700"
          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
      }`;
    }

    if (logoCompressInfo) {
      logoCompressInfo.innerText = isDefault
        ? "Using default brand favicon (/favicon.svg)"
        : "Square 1:1 • Auto-compresses on upload";
    }
  }

  // Cover Banner Preview with fallback
  const coverPreview = document.getElementById("cover-preview-img");
  const coverBadge = document.getElementById("cover-badge");
  const coverCompressInfo = document.getElementById("cover-compress-info");

  if (coverPreview) {
    const effectiveCover = (coverUrl && isValidHttpUrl(coverUrl)) ? formatMediaUrl(coverUrl) : DEFAULT_COVER_URL;
    coverPreview.src = effectiveCover;
    coverPreview.classList.remove("hidden");

    const isDefault = !coverUrl || effectiveCover === DEFAULT_COVER_URL;
    if (coverBadge) {
      coverBadge.innerText = isDefault ? "Default Banner" : "Custom Banner";
      coverBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
        isDefault
          ? "bg-slate-800 text-slate-300 border border-slate-700"
          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
      }`;
    }

    if (coverCompressInfo) {
      coverCompressInfo.innerText = isDefault
        ? "Using default storefront banner"
        : "Wide 16:9 • Auto-compresses on upload";
    }
  }
}

/* =========================================================================
 * 4. OPERATING HOURS RENDERER
 * ========================================================================= */
function renderOperatingHours() {
  const container = document.getElementById("operating-hours-container");
  if (!container) return;

  container.innerHTML = DAYS.map((d) => {
    const dayConfig = STATE.operatingHours[d.key] || { open: "09:00", close: "22:00", closed: false };
    const isClosed = !!dayConfig.closed;

    return `
      <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-700">
        <!-- Day Label -->
        <div class="flex items-center gap-3 w-40">
          <span class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold font-mono text-amber-400">
            ${d.key.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <span class="text-sm font-bold text-white block">${d.label}</span>
            <span class="text-[11px] text-slate-500 font-arabic block">${d.ar}</span>
          </div>
        </div>

        <!-- Times & Closed Controls -->
        <div class="flex items-center gap-4 flex-wrap flex-1 justify-end">
          <div class="flex items-center gap-2 ${isClosed ? "opacity-30 pointer-events-none" : ""}">
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-mono text-slate-400">Open:</span>
              <input type="time" data-day="${d.key}" data-field="open" value="${dayConfig.open || "09:00"}"
                class="hour-input bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono" />
            </div>

            <span class="text-slate-600 font-bold">—</span>

            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-mono text-slate-400">Close:</span>
              <input type="time" data-day="${d.key}" data-field="close" value="${dayConfig.close || "22:00"}"
                class="hour-input bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono" />
            </div>
          </div>

          <!-- Closed Toggle -->
          <label class="flex items-center gap-2 cursor-pointer select-none bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <input type="checkbox" data-day="${d.key}" data-field="closed" ${isClosed ? "checked" : ""} class="closed-checkbox rounded text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 bg-slate-950 border-slate-700" />
            <span class="text-xs font-mono font-bold ${isClosed ? "text-rose-400" : "text-slate-400"}">
              ${isClosed ? "Closed All Day" : "Open Day"}
            </span>
          </label>
        </div>
      </div>
    `;
  }).join("");

  // Attach event listeners for inputs
  container.querySelectorAll(".hour-input").forEach((input) => {
    input.addEventListener("change", (e) => {
      const day = e.target.getAttribute("data-day");
      const field = e.target.getAttribute("data-field");
      if (STATE.operatingHours[day]) {
        STATE.operatingHours[day][field] = e.target.value;
      }
    });
  });

  container.querySelectorAll(".closed-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const day = e.target.getAttribute("data-day");
      const checked = e.target.checked;
      if (STATE.operatingHours[day]) {
        STATE.operatingHours[day].closed = checked;
      }
      renderOperatingHours();
    });
  });
}

/* =========================================================================
 * 5. SAVE SETTINGS SUBMISSION
 * ========================================================================= */
async function saveSalonSettings(e) {
  e?.preventDefault();
  if (STATE.isSubmitting) return;

  const saveBtn = document.getElementById("save-settings-btn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-950 inline" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Saving Settings...
    `;
  }
  STATE.isSubmitting = true;

  try {
    const name = document.getElementById("setting-name")?.value.trim();
    if (!name) {
      throw new Error("Salon Name is required.");
    }

    const phone = document.getElementById("setting-phone")?.value.trim();
    const region = document.getElementById("setting-region")?.value.trim();
    const city = document.getElementById("setting-city")?.value.trim();
    const district = document.getElementById("setting-district")?.value.trim();
    const fullAddress = document.getElementById("setting-full-address")?.value.trim();
    const mapAddress = document.getElementById("setting-map-address")?.value.trim();

    const latVal = parseFloat(document.getElementById("setting-latitude")?.value);
    const lngVal = parseFloat(document.getElementById("setting-longitude")?.value);

    const logoUrl = document.getElementById("setting-logo-url")?.value.trim();
    const coverImageUrl = document.getElementById("setting-cover-url")?.value.trim();

    const minCancelNoticeHours = parseInt(document.getElementById("setting-min-cancel-hours")?.value, 10) || 2;
    const maxAdvanceBookingDays = parseInt(document.getElementById("setting-max-advance-days")?.value, 10) || 14;
    const autoConfirmWalkins = document.getElementById("setting-auto-confirm-walkins")?.checked !== false;

    const operatingHoursJson = JSON.stringify(STATE.operatingHours);

    const payload = {
      name,
      phone,
      region,
      city,
      district,
      fullAddress,
      mapAddress,
      latitude: isNaN(latVal) ? null : latVal,
      longitude: isNaN(lngVal) ? null : lngVal,
      logoUrl: logoUrl || null,
      coverImageUrl: coverImageUrl || null,
      minCancelNoticeHours,
      maxAdvanceBookingDays,
      autoConfirmWalkins,
      operatingHoursJson
    };

    const res = await TenantContext.tenantFetch("/api/portal/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Failed to update salon settings.");
    }

    const data = await res.json();
    showToast(data.message || "Salon settings saved successfully!", "success");

    // Refresh Header Title
    const headerName = document.getElementById("header-salon-name");
    if (headerName) headerName.innerText = name;

    const headerBranch = document.getElementById("header-branch-text");
    if (headerBranch && (district || city)) {
      headerBranch.innerText = `${district || ""}, ${city || ""}`.replace(/^, |, $/g, "");
    }

    updateMediaPreviews(logoUrl, coverImageUrl);
  } catch (err) {
    console.error("Save settings error:", err);
    showToast(err.message, "error");
  } finally {
    STATE.isSubmitting = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span>💾</span><span>Save All Settings</span>`;
    }
  }
}

/* =========================================================================
 * 6. EVENT LISTENERS & COPY ACTIONS
 * ========================================================================= */
function initEventListeners() {
  const form = document.getElementById("salon-settings-form");
  form?.addEventListener("submit", saveSalonSettings);

  const saveBtn = document.getElementById("save-settings-btn");
  saveBtn?.addEventListener("click", saveSalonSettings);

  // Logo & Cover Preview Live Updates
  const logoInput = document.getElementById("setting-logo-url");
  logoInput?.addEventListener("input", (e) => {
    updateMediaPreviews(e.target.value, document.getElementById("setting-cover-url")?.value);
  });

  const coverInput = document.getElementById("setting-cover-url");
  coverInput?.addEventListener("input", (e) => {
    updateMediaPreviews(document.getElementById("setting-logo-url")?.value, e.target.value);
  });

  // Copy Booking URL Button
  const copyBtn = document.getElementById("copy-booking-url-btn");
  copyBtn?.addEventListener("click", () => {
    const text = document.getElementById("booking-url-display")?.innerText;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast("Public booking engine URL copied to clipboard!", "success");
      }).catch(() => {
        showToast("Could not copy URL automatically.", "warning");
      });
    }
  });

  // Preset Geo Location buttons (Riyadh, Jeddah, Dammam)
  document.querySelectorAll(".city-preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = btn.getAttribute("data-lat");
      const lng = btn.getAttribute("data-lng");
      const city = btn.getAttribute("data-city");
      const dist = btn.getAttribute("data-district");

      if (lat) setInputValue("setting-latitude", lat);
      if (lng) setInputValue("setting-longitude", lng);
      if (city) setInputValue("setting-city", city);
      if (dist) setInputValue("setting-district", dist);
      showToast(`Location coordinates preset to ${city} (${lat}, ${lng})`, "info");
    });
  });

  // Default Favicon & Banner Buttons
  document.getElementById("default-logo-favicon-btn")?.addEventListener("click", () => {
    const input = document.getElementById("setting-logo-url");
    if (input) input.value = "/favicon.svg";
    updateMediaPreviews("/favicon.svg", document.getElementById("setting-cover-url")?.value);
    showToast("Default brand favicon (/favicon.svg) applied!", "success");
  });

  document.getElementById("default-cover-btn")?.addEventListener("click", () => {
    const input = document.getElementById("setting-cover-url");
    if (input) input.value = DEFAULT_COVER_URL;
    updateMediaPreviews(document.getElementById("setting-logo-url")?.value, DEFAULT_COVER_URL);
    showToast("Default luxury storefront cover banner applied!", "success");
  });

  // Logo Upload Trigger & Input
  const logoTriggerBtn = document.getElementById("trigger-logo-upload-btn");
  const logoFileInput = document.getElementById("setting-logo-file-input");
  logoTriggerBtn?.addEventListener("click", () => {
    logoFileInput?.click();
  });
  logoFileInput?.addEventListener("change", handleLogoUpload);

  // Cover Upload Trigger & Input
  const coverTriggerBtn = document.getElementById("trigger-cover-upload-btn");
  const coverFileInput = document.getElementById("setting-cover-file-input");
  coverTriggerBtn?.addEventListener("click", () => {
    coverFileInput?.click();
  });
  coverFileInput?.addEventListener("change", handleCoverUpload);

  // Gallery Upload Trigger & Input
  const triggerBtn = document.getElementById("trigger-upload-btn");
  const fileInput = document.getElementById("gallery-file-input");
  triggerBtn?.addEventListener("click", () => {
    if (STATE.galleryImages.length >= 5) {
      showToast("Gallery cap reached (maximum 5 photos). Please delete an existing photo first.", "warning");
      return;
    }
    fileInput?.click();
  });

  fileInput?.addEventListener("change", handleGalleryUpload);
}

/* =========================================================================
 * 6.1 SALON GALLERY ENGINE (STRICT MAX 5 PHOTOS, STATIC /UPLOADS/** URLS)
 * ========================================================================= */
async function loadSalonGallery() {
  try {
    const res = await TenantContext.tenantFetch("/api/portal/gallery");
    if (!res.ok) throw new Error("Failed to load salon gallery");
    STATE.galleryImages = await res.json();
    renderGallery();
  } catch (err) {
    console.error("Gallery load error:", err);
    showToast("Could not load gallery photos.", "warning");
  }
}

function renderGallery() {
  const badge = document.getElementById("gallery-count-badge");
  const grid = document.getElementById("gallery-grid");
  const limitWarning = document.getElementById("gallery-limit-warning");
  const triggerBtn = document.getElementById("trigger-upload-btn");

  const count = STATE.galleryImages.length;
  if (badge) {
    badge.innerText = `${count} / 5 Photos`;
    badge.className = `px-3 py-1 rounded-full text-xs font-mono font-bold border ${
      count >= 5
        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
    }`;
  }

  if (count >= 5) {
    limitWarning?.classList.remove("hidden");
    if (triggerBtn) {
      triggerBtn.classList.add("opacity-50", "cursor-not-allowed");
      triggerBtn.setAttribute("disabled", "true");
    }
  } else {
    limitWarning?.classList.add("hidden");
    if (triggerBtn) {
      triggerBtn.classList.remove("opacity-50", "cursor-not-allowed");
      triggerBtn.removeAttribute("disabled");
    }
  }

  if (!grid) return;

  if (count === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-10 px-4 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/80">
        <span class="text-3xl block mb-2">📸</span>
        <span class="text-xs font-bold block text-slate-400">No Gallery Photos Uploaded Yet</span>
        <span class="text-[11px] text-slate-600 block mt-1">Upload up to 5 photos to showcase your salon storefront and chairs.</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = STATE.galleryImages
    .map((img, idx) => {
      const isCover = Boolean(img.isCover);
      const isFirst = idx === 0;
      const isLast = idx === count - 1;

      return `
        <div class="group relative bg-slate-950/80 border ${isCover ? "border-amber-500/60 shadow-lg shadow-amber-500/10" : "border-slate-800"} rounded-2xl overflow-hidden flex flex-col transition hover:border-slate-700">
          <!-- Thumbnail & Cover Badge -->
          <div class="relative h-36 bg-slate-900 overflow-hidden">
            <img src="${img.imageUrl}" alt="${img.caption || 'Salon Photo'}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            
            <!-- Order Indicator Pill -->
            <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-[10px] font-mono font-bold text-white">
              #${idx + 1}
            </div>

            <!-- Cover Photo Badge -->
            ${
              isCover
                ? `
              <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                <span>★</span>
                <span>COVER</span>
              </div>
            `
                : ""
            }
          </div>

          <!-- Card Body: Caption & Actions -->
          <div class="p-3 flex-1 flex flex-col justify-between space-y-2.5">
            <div class="min-w-0">
              <span class="text-xs font-bold text-white block truncate" title="${img.caption || 'No caption'}">
                ${img.caption || '<span class="text-slate-500 font-normal italic">No caption</span>'}
              </span>
              <span class="text-[10px] font-mono text-slate-500 block truncate mt-0.5">
                ${img.imageUrl.split("/").pop()}
              </span>
            </div>

            <!-- Action Controls Row -->
            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
              <!-- Reorder Buttons -->
              <div class="flex items-center gap-1">
                <button type="button" class="gallery-move-btn p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs disabled:opacity-30 disabled:pointer-events-none transition" data-id="${img.id}" data-dir="-1" ${isFirst ? 'disabled' : ''} title="Move Left / Earlier">
                  ‹
                </button>
                <button type="button" class="gallery-move-btn p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs disabled:opacity-30 disabled:pointer-events-none transition" data-id="${img.id}" data-dir="1" ${isLast ? 'disabled' : ''} title="Move Right / Later">
                  ›
                </button>
              </div>

              <div class="flex items-center gap-1.5">
                ${
                  !isCover
                    ? `
                  <button type="button" class="gallery-cover-btn px-2 py-1 rounded-lg bg-slate-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-800 hover:border-amber-500/40 text-[10px] font-bold transition" data-id="${img.id}">
                    Set Cover
                  </button>
                `
                    : ""
                }
                <button type="button" class="gallery-delete-btn p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 text-xs transition" data-id="${img.id}" title="Delete Photo">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  attachGalleryActionListeners();
}

function attachGalleryActionListeners() {
  // Set Cover Photo
  document.querySelectorAll(".gallery-cover-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      await setCoverImage(Number(id));
    });
  });

  // Reorder Images
  document.querySelectorAll(".gallery-move-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-id"));
      const dir = Number(btn.getAttribute("data-dir"));
      await moveImageOrder(id, dir);
    });
  });

  // Delete Image
  document.querySelectorAll(".gallery-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.getAttribute("data-id"));
      if (confirm("Are you sure you want to delete this photo from your salon gallery?")) {
        await deleteGalleryImage(id);
      }
    });
  });
}

async function handleGalleryUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validation: Max 5 Photos
  if (STATE.galleryImages.length >= 5) {
    showToast("Strict maximum of 5 photos reached. Please remove a photo first.", "error");
    e.target.value = "";
    return;
  }

  // Validation: MIME types
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    showToast("Invalid file format. Only JPEG, PNG, and WebP images are permitted.", "error");
    e.target.value = "";
    return;
  }

  const captionInput = document.getElementById("gallery-caption-input");
  const coverCheckbox = document.getElementById("gallery-cover-checkbox");
  const caption = captionInput?.value.trim() || "";
  const isCover = Boolean(coverCheckbox?.checked);

  const triggerBtn = document.getElementById("trigger-upload-btn");
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = `<span>⏳</span><span>Compressing & Uploading...</span>`;
  }

  try {
    // Client-side auto-compression before upload
    const { file: compressedFile, originalSize, compressedSize, savingsPercent } = await autoCompressImage(file, {
      maxWidth: 1600,
      maxHeight: 1200,
      quality: 0.85
    });

    const origKb = (originalSize / 1024).toFixed(0);
    const compKb = (compressedSize / 1024).toFixed(0);

    const formData = new FormData();
    formData.append("file", compressedFile);
    if (caption) formData.append("caption", caption);
    if (isCover) formData.append("isCover", "true");

    const res = await TenantContext.tenantFetch("/api/portal/gallery/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to upload image.");
    }

    const created = await res.json();
    showToast(`Gallery photo uploaded! Auto-compressed: ${origKb}KB ➔ ${compKb}KB (${savingsPercent}% saved)`, "success");

    // Reset inputs
    e.target.value = "";
    if (captionInput) captionInput.value = "";
    if (coverCheckbox) coverCheckbox.checked = false;

    // Reload gallery
    await loadSalonGallery();

    // If marked as cover, also update cover preview in Settings
    if (isCover || created.isCover) {
      const coverUrlInput = document.getElementById("setting-cover-url");
      if (coverUrlInput) coverUrlInput.value = created.imageUrl;
      updateMediaPreviews(document.getElementById("setting-logo-url")?.value, created.imageUrl);
    }
  } catch (err) {
    console.error("Gallery upload error:", err);
    showToast(err.message, "error");
    e.target.value = "";
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = `<span>+</span><span>Choose & Upload</span>`;
    }
  }
}

/* =========================================================================
 * 6.2 BRAND LOGO & HERO COVER UPLOADS (AUTO-COMPRESSED)
 * ========================================================================= */
async function handleLogoUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const btn = document.getElementById("trigger-logo-upload-btn");
  const infoEl = document.getElementById("logo-compress-info");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span><span>Compressing & Uploading...</span>`;
  }
  if (infoEl) infoEl.innerText = "Auto-compressing logo...";

  try {
    // 1. Client-side auto-compression (800x800 square for logo)
    const { file: compressedFile, originalSize, compressedSize, savingsPercent } = await autoCompressImage(file, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.85
    });

    const origKb = (originalSize / 1024).toFixed(0);
    const compKb = (compressedSize / 1024).toFixed(0);
    if (infoEl) {
      infoEl.innerText = `Compressed: ${origKb}KB ➔ ${compKb}KB (${savingsPercent}% saved)`;
    }

    // 2. Upload to backend
    const formData = new FormData();
    formData.append("file", compressedFile);

    const res = await TenantContext.tenantFetch("/api/portal/settings/upload-logo", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to upload logo.");
    }

    const data = await res.json();
    const logoUrl = data.logoUrl;

    const input = document.getElementById("setting-logo-url");
    if (input) input.value = logoUrl;

    updateMediaPreviews(logoUrl, document.getElementById("setting-cover-url")?.value);
    showToast(`Brand logo uploaded! Auto-compressed: ${origKb}KB ➔ ${compKb}KB (${savingsPercent}% saved)`, "success");
  } catch (err) {
    console.error("Logo upload error:", err);
    showToast(err.message, "error");
    if (infoEl) infoEl.innerText = "Upload failed";
  } finally {
    e.target.value = "";
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>📤</span><span>Upload & Auto-Compress Logo</span>`;
    }
  }
}

async function handleCoverUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const btn = document.getElementById("trigger-cover-upload-btn");
  const infoEl = document.getElementById("cover-compress-info");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span><span>Compressing & Uploading...</span>`;
  }
  if (infoEl) infoEl.innerText = "Auto-compressing banner...";

  try {
    // 1. Client-side auto-compression (1920x1080 16:9 for cover)
    const { file: compressedFile, originalSize, compressedSize, savingsPercent } = await autoCompressImage(file, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.85
    });

    const origKb = (originalSize / 1024).toFixed(0);
    const compKb = (compressedSize / 1024).toFixed(0);
    if (infoEl) {
      infoEl.innerText = `Compressed: ${origKb}KB ➔ ${compKb}KB (${savingsPercent}% saved)`;
    }

    // 2. Upload to backend
    const formData = new FormData();
    formData.append("file", compressedFile);

    const res = await TenantContext.tenantFetch("/api/portal/settings/upload-cover", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to upload cover banner.");
    }

    const data = await res.json();
    const coverUrl = data.coverImageUrl;

    const input = document.getElementById("setting-cover-url");
    if (input) input.value = coverUrl;

    updateMediaPreviews(document.getElementById("setting-logo-url")?.value, coverUrl);
    showToast(`Cover banner uploaded! Auto-compressed: ${origKb}KB ➔ ${compKb}KB (${savingsPercent}% saved)`, "success");
  } catch (err) {
    console.error("Cover upload error:", err);
    showToast(err.message, "error");
    if (infoEl) infoEl.innerText = "Upload failed";
  } finally {
    e.target.value = "";
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>📤</span><span>Upload & Auto-Compress Cover</span>`;
    }
  }
}

async function setCoverImage(imageId) {
  try {
    const orders = STATE.galleryImages.map((img, idx) => ({
      id: img.id,
      displayOrder: idx,
      isCover: img.id === imageId
    }));

    const res = await TenantContext.tenantFetch("/api/portal/gallery/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orders)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to update cover photo.");
    }

    showToast("Cover photo updated!", "success");
    await loadSalonGallery();

    const newCover = STATE.galleryImages.find((img) => img.id === imageId);
    if (newCover) {
      const coverUrlInput = document.getElementById("setting-cover-url");
      if (coverUrlInput) coverUrlInput.value = newCover.imageUrl;
      updateMediaPreviews(document.getElementById("setting-logo-url")?.value, newCover.imageUrl);
    }
  } catch (err) {
    console.error("Cover update error:", err);
    showToast(err.message, "error");
  }
}

async function moveImageOrder(imageId, direction) {
  const currentIndex = STATE.galleryImages.findIndex((img) => img.id === imageId);
  if (currentIndex === -1) return;

  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= STATE.galleryImages.length) return;

  // Swap
  const temp = STATE.galleryImages[currentIndex];
  STATE.galleryImages[currentIndex] = STATE.galleryImages[targetIndex];
  STATE.galleryImages[targetIndex] = temp;

  const orders = STATE.galleryImages.map((img, idx) => ({
    id: img.id,
    displayOrder: idx,
    isCover: Boolean(img.isCover)
  }));

  try {
    const res = await TenantContext.tenantFetch("/api/portal/gallery/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orders)
    });

    if (!res.ok) throw new Error("Failed to reorder gallery.");
    showToast("Photo order updated.", "info");
    renderGallery();
  } catch (err) {
    console.error("Reorder error:", err);
    showToast(err.message, "error");
    await loadSalonGallery(); // revert on failure
  }
}

async function deleteGalleryImage(imageId) {
  try {
    const res = await TenantContext.tenantFetch(`/api/portal/gallery/${imageId}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to delete image.");
    }

    showToast("Photo deleted from salon gallery.", "success");
    await loadSalonGallery();
  } catch (err) {
    console.error("Delete error:", err);
    showToast(err.message, "error");
  }
}

/* =========================================================================
 * 7. NOTIFICATIONS / TOAST HELPER
 * ========================================================================= */
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.log(`[Toast ${type}]: ${message}`);
    return;
  }

  const toast = document.createElement("div");
  const bgStyles = {
    success: "bg-emerald-950/90 border-emerald-500/50 text-emerald-200",
    error: "bg-red-950/90 border-red-500/50 text-red-200",
    warning: "bg-amber-950/90 border-amber-500/50 text-amber-200",
    info: "bg-sky-950/90 border-sky-500/50 text-sky-200"
  };

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠️",
    info: "ℹ️"
  };

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto max-w-md ${
    bgStyles[type] || bgStyles.info
  }`;

  toast.innerHTML = `
    <span class="text-sm font-black shrink-0">${icons[type] || "•"}</span>
    <span class="text-xs font-semibold flex-1 leading-snug">${message}</span>
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
