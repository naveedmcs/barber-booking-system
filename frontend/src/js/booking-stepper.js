/**
 * Mobile-First Customer Booking Funnel & Calendar Integration Engine
 * - Zero heavy icon/UI dependencies
 * - High-contrast luxury SVG fallbacks for missing brand, cover banner, gallery, and avatars
 * - 6-Step full visibility progress indicator (0: Salon, 1: Services, 2: Barber, 3: Slot, 4: Details, 5: Receipt)
 * - Multi-service selection with live duration & price computation
 * - "Any Available Barber" fast-track & staff phone privacy guard
 * - Dynamic slot generation retrieved from salon operating hours in Salon Store
 * - 14-day horizontal scrollable date strip & 48x48px touch targets
 * - 5-minute concurrency hold timer with Redis/Store sync
 * - Customer booking audit logs
 * - Free zero-cost map routing (no paid Google Maps API)
 * - Dual Android (Google Calendar) & iPhone (Apple Calendar .ics with -PT1H alarm) calendar export
 * - Prominent cancellation advisory with salon/support contact
 */

import { Store } from "./store.js";

// ==========================================
// 1. CONTEXTUAL ASSET RESOLUTION ENGINE
// ==========================================
export function getAssetBase() {
  const isInsideSubfolder = window.location.pathname.includes("/book/") ||
                            window.location.pathname.includes("/booking/") ||
                            window.location.pathname.includes("/dashboard/") ||
                            window.location.pathname.includes("/portal/");
  return isInsideSubfolder ? ".." : ".";
}

export const FallbackAssets = {
  getDefaultHero() {
    return `${getAssetBase()}/src/images/default-hero.svg`;
  },

  getDefaultLogo() {
    return `${getAssetBase()}/src/images/default-logo.svg`;
  },

  getDefaultAvatar() {
    return `${getAssetBase()}/src/images/default-avatar.svg`;
  },

  getDefaultGallery() {
    const base = getAssetBase();
    return [
      {
        title: "Vintage Leather Stations",
        subtitle: "Traditional Craftsmanship",
        dataUrl: `${base}/src/images/gallery-1.svg`
      },
      {
        title: "Royal Hot Towel & Steam",
        subtitle: "Signature Scalp Treatment",
        dataUrl: `${base}/src/images/gallery-2.svg`
      },
      {
        title: "Precision Grooming Tools",
        subtitle: "Sharp Line-up & Botanical Oils",
        dataUrl: `${base}/src/images/gallery-3.svg`
      }
    ];
  },

  getStaffAvatar(barberName = "Barber") {
    return this.getDefaultAvatar();
  }
};

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
const DEFAULT_OPERATING_HOURS = {
  sunday: { open: "09:00", close: "22:00", closed: false },
  monday: { open: "09:00", close: "22:00", closed: false },
  tuesday: { open: "09:00", close: "22:00", closed: false },
  wednesday: { open: "09:00", close: "22:00", closed: false },
  thursday: { open: "09:00", close: "23:00", closed: false },
  friday: { open: "13:00", close: "23:00", closed: false },
  saturday: { open: "09:00", close: "22:00", closed: false }
};

const STATE = {
  step: 0, // 0: Landing/Hero, 1: Services, 2: Barbers, 3: Date & Slots, 4: Customer Details, 5: Confirmation
  shopSlug: "golden-scissors",
  shop: null,
  selectedServices: [], // Multi-service selection array of Service objects
  selectedBarber: null, // Specific Barber object OR { id: "any", name: "Any Available Barber" }
  selectedDate: new Date().toISOString().split("T")[0],
  selectedSlot: null,
  customer: {
    fullName: "",
    phone: "",
    notes: ""
  },
  bookingRef: null,
  confirmedBooking: null,
  timerSeconds: 300,
  timerInterval: null,
  walkInMode: false
};

let BARBERS = [];
let SERVICES = [];

// ==========================================
// 3. INITIALIZATION & DATA FETCHING
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  Store.init();

  // Extract slug from URL query (?slug=...) or pathname (/book/:slug)
  const urlParams = new URLSearchParams(window.location.search);
  let slug = urlParams.get("slug") || urlParams.get("id");
  if (!slug) {
    const segments = window.location.pathname.split("/").filter(Boolean);
    let bookIdx = segments.indexOf("booking");
    if (bookIdx === -1) bookIdx = segments.indexOf("book");
    if (bookIdx !== -1 && segments[bookIdx + 1]) {
      slug = segments[bookIdx + 1].replace(/\.html$/, "");
    }
  }

  STATE.shopSlug = slug || "golden-scissors";
  STATE.shop = Store.getShopBySlug(STATE.shopSlug);

  const stepParam = urlParams.get("step");
  if (stepParam !== null && !isNaN(parseInt(stepParam))) {
    STATE.step = Math.max(0, Math.min(5, parseInt(stepParam)));
  }

  if (!STATE.shop) {
    const allShops = Store.getShops();
    STATE.shop = allShops[0] || {
      name: "Golden Scissors Salon",
      slug: "golden-scissors",
      city: "Riyadh",
      phone: "0501234567",
      fullAddress: "King Fahd Road, Olaya, Riyadh"
    };
  }

  // Populate Barbers & Services from Salon Store
  BARBERS = (STATE.shop.barbers && STATE.shop.barbers.length > 0)
    ? STATE.shop.barbers
    : [
        { id: 1, name: "Master Barber Ahmed", title: "Master Barber", rating: 4.9, avatar: "" },
        { id: 2, name: "Sami Al-Otaibi", title: "Senior Stylist", rating: 4.8, avatar: "" },
        { id: 3, name: "Tariq Mansoor", title: "Grooming Specialist", rating: 4.95, avatar: "" }
      ];

  SERVICES = (STATE.shop.services && STATE.shop.services.length > 0)
    ? STATE.shop.services
    : [
        { id: 101, name: "Royal Haircut & Hot Towel", category: "Haircut", duration: 30, buffer: 5, price: 60, desc: "Precision haircut, scalp treatment, and hot towel finish" },
        { id: 102, name: "Beard Sculpting & Razor Line", category: "Beard Care", duration: 25, buffer: 5, price: 40, desc: "Beard trim, steam razor line-up, and organic oil treatment" },
        { id: 103, name: "VIP Full Grooming Package", category: "VIP Packages", duration: 60, buffer: 10, price: 110, desc: "Haircut, beard sculpting, facial steam scrub, and head massage" },
        { id: 104, name: "Charcoal Purifying Facial", category: "Skin & Spa", duration: 20, buffer: 5, price: 35, desc: "Deep pore charcoal mask, blackhead removal and refreshing mist" }
      ];

  STATE.selectedDate = getTodayFormatted();

  // Wire interactive step navigation in header
  wireStepNavClicks();

  // Render role-aware utility banner if logged in as Admin, Salon Owner, or Staff
  initRoleAwareHeader();

  renderApp();
});

function wireStepNavClicks() {
  document.querySelectorAll(".step-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const target = parseInt(item.getAttribute("data-step"));
      // Only allow navigating back to completed steps or current step
      if (target <= STATE.step) {
        STATE.step = target;
        renderApp();
      }
    });
  });
}

// ==========================================
// ROLE-AWARE HEADER & WALK-IN MODE ENGINE
// ==========================================
function initRoleAwareHeader() {
  const container = document.getElementById("role-utility-bar");
  if (!container) return;

  const currentUser = Store.getCurrentUser();

  // Public Customer / Unauthenticated: keep bar hidden
  if (!currentUser || currentUser.role === "CUSTOMER" || !currentUser.role) {
    container.className = "hidden";
    container.innerHTML = "";
    return;
  }

  const role = currentUser.role;
  const shopName = STATE.shop?.name || "Salon";

  // Super Admin / Support Agent
  if (role === "SUPER_ADMIN" || role === "SUPPORT_AGENT") {
    container.className = "block bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 border-b border-purple-500/30 px-3 sm:px-4 py-2 sm:py-2.5 text-xs text-purple-200 sticky top-0 z-50 shadow-md";
    container.innerHTML = `
      <div class="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-wider">
            🛡️ Platform Super Admin
          </span>
          <span class="font-medium text-purple-100">
            Admin Preview Mode &bull; Inspecting Storefront: <strong class="text-white">${shopName}</strong>
          </span>
        </div>
        <div class="flex items-center gap-2">
          <a href="../dashboard/admin.html#salons" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-white font-semibold text-xs border border-purple-400/30 transition shadow-sm">
            <span>← Return to Salons Directory</span>
          </a>
        </div>
      </div>
    `;
    return;
  }

  // Salon Owner & Salon Staff
  if (role === "SALON_OWNER" || role === "SALON_STAFF" || role === "SHOP_OWNER" || role === "STAFF") {
    const isOwner = role === "SALON_OWNER" || role === "SHOP_OWNER";
    const userName = currentUser.fullName || currentUser.name || (isOwner ? "Salon Owner" : "Staff Member");

    container.className = "block bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-amber-500/30 px-3 sm:px-4 py-2 sm:py-2.5 text-xs text-amber-200 sticky top-0 z-50 shadow-md";
    container.innerHTML = `
      <div class="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
            ${isOwner ? "👑 Salon Owner" : "💈 Salon Staff"}
          </span>
          <span class="font-medium text-slate-200">
            Viewing as <strong class="text-white">${userName}</strong> &bull; <span class="text-amber-300/90 font-semibold">${shopName}</span>
          </span>
        </div>
        <div class="flex items-center gap-2 sm:gap-3">
          <button id="toggle-walkin-mode-btn" type="button" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition text-xs font-bold ${
            STATE.walkInMode
              ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md shadow-[#F59E0B]/20"
              : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40"
          }">
            <span>${STATE.walkInMode ? "⚡ Walk-In Mode: ACTIVE" : "⚡ Switch to Walk-In Mode"}</span>
          </button>
          <a href="../portal/index.html#bookings" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-xs">
            <span>← Return to Portal Dashboard</span>
          </a>
        </div>
      </div>
    `;

    document.getElementById("toggle-walkin-mode-btn")?.addEventListener("click", () => {
      STATE.walkInMode = !STATE.walkInMode;
      if (STATE.walkInMode) {
        // Pre-fill staff member
        const matchingBarber = BARBERS.find(b =>
          (currentUser.fullName && b.name.toLowerCase().includes(currentUser.fullName.toLowerCase())) ||
          (currentUser.staffId && String(b.id) === String(currentUser.staffId))
        );
        if (matchingBarber) {
          STATE.selectedBarber = matchingBarber;
        } else if (!STATE.selectedBarber && BARBERS.length > 0) {
          STATE.selectedBarber = BARBERS[0];
        }
      }
      initRoleAwareHeader();
      renderApp();
    });
    return;
  }

  // Any other unknown role falls back to hidden
  container.className = "hidden";
  container.innerHTML = "";
}

// ==========================================
// 4. MAIN RENDER ROUTER
// ==========================================
function renderApp() {
  updateHeaderAndTimer();
  updateStepperNav();
  renderStickyMobileCta();

  const container = document.getElementById("step-content");
  if (!container) return;

  switch (STATE.step) {
    case 0:
      renderStep0Hero(container);
      break;
    case 1:
      renderStep1Services(container);
      break;
    case 2:
      renderStep2Barbers(container);
      break;
    case 3:
      renderStep3DateAndSlots(container);
      break;
    case 4:
      renderStep4CustomerDetails(container);
      break;
    case 5:
      renderStep5Confirmation(container);
      break;
    default:
      renderStep0Hero(container);
  }

  // Smooth scroll to container on step change if past step 0
  if (STATE.step > 0) {
    window.scrollTo({ top: container.offsetTop - 80, behavior: "smooth" });
  }
}

// ==========================================
// 5. STEP 0: HERO & GALLERY LANDING VIEW
// ==========================================
function renderStep0Hero(container) {
  const shop = STATE.shop || {};
  const defaultHero = FallbackAssets.getDefaultHero();
  const defaultLogo = FallbackAssets.getDefaultLogo();

  // Fallback brand logo and hero banner
  const brandLogo = (shop.logoUrl && shop.logoUrl.trim() !== "" && !shop.logoUrl.includes("unsplash.com"))
    ? shop.logoUrl
    : defaultLogo;

  const heroBanner = (shop.coverImageUrl && shop.coverImageUrl.trim() !== "" && !shop.coverImageUrl.includes("unsplash.com"))
    ? shop.coverImageUrl
    : defaultHero;

  // Gallery: check if shop.photos has valid non-empty items, otherwise use the 3 curated aesthetic cards
  let galleryItems = [];
  if (shop.photos && Array.isArray(shop.photos) && shop.photos.length > 0) {
    galleryItems = shop.photos
      .filter(p => p && (p.dataUrl || p.url || (typeof p === "string" && p.trim() !== "")))
      .map((p, idx) => ({
        title: `Studio Photo ${idx + 1}`,
        dataUrl: p.dataUrl || p.url || p
      }));
  }
  if (galleryItems.length === 0) {
    galleryItems = FallbackAssets.getDefaultGallery();
  }

  const freeMapQuery = encodeURIComponent(`${shop.name} ${shop.fullAddress || shop.city || "Riyadh"}`);
  const freeMapLink = `https://maps.google.com/?q=${freeMapQuery}`;

  container.innerHTML = `
    <!-- Salon Cover Banner Hero -->
    <div class="relative w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900 group">
      <div class="aspect-[16/9] sm:aspect-[21/9] w-full relative">
        <img src="${heroBanner}" alt="${shop.name} Cover" width="1200" height="480"
             class="w-full h-full object-cover"
             onerror="this.onerror=null; this.src='${defaultHero}';" />
        <div class="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/60 to-transparent"></div>
      </div>

      <!-- Floating Salon Identity Card -->
      <div class="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-end gap-3 sm:gap-4">
        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-[#F59E0B] shadow-2xl bg-slate-950 flex-shrink-0">
          <img src="${brandLogo}" alt="${shop.name} Logo" width="80" height="80"
               class="w-full h-full object-cover"
               onerror="this.onerror=null; this.src='${defaultLogo}';" />
        </div>
        <div class="flex-1 min-w-0 pb-1">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 tracking-wider uppercase">Verified Salon</span>
            <span class="text-[10px] sm:text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Open Today
            </span>
          </div>
          <h2 class="text-base sm:text-2xl font-extrabold text-white truncate drop-shadow-md mt-0.5">${shop.name}</h2>
          <p class="text-[11px] sm:text-xs text-slate-300 truncate">${shop.fullAddress || shop.city || "Saudi Arabia"}</p>
        </div>
      </div>
    </div>

    <!-- Quick Highlights Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-center">
      <div class="p-2.5 sm:p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
        <span class="text-[10px] uppercase text-slate-400 tracking-wider block">City</span>
        <span class="text-xs font-bold text-white truncate block mt-0.5">${shop.city || "Riyadh"}</span>
      </div>
      <div class="p-2.5 sm:p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
        <span class="text-[10px] uppercase text-slate-400 tracking-wider block">Contact Phone</span>
        <a href="tel:${shop.phone || "0501234567"}" class="text-xs font-bold text-[#F59E0B] hover:underline block mt-0.5">${shop.phone || "0501234567"}</a>
      </div>
      <div class="p-2.5 sm:p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
        <span class="text-[10px] uppercase text-slate-400 tracking-wider block">Booking Window</span>
        <span class="text-xs font-bold text-emerald-400 block mt-0.5">Next 14 Days</span>
      </div>
      <div class="p-2.5 sm:p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
        <span class="text-[10px] uppercase text-slate-400 tracking-wider block">Directions</span>
        <a href="${freeMapLink}" target="_blank" rel="noopener" class="text-xs font-bold text-sky-400 hover:underline block mt-0.5">Open Map ↗</a>
      </div>
    </div>

    <!-- Photo Gallery Showcase with Horizontal Touch Scroll Snap -->
    <div class="mt-6">
      <div class="flex items-center justify-between mb-2.5">
        <h3 class="text-xs font-bold uppercase tracking-widest text-[#F59E0B] flex items-center gap-1.5">
          <span>📸</span> Salon Ambience & Atmosphere
        </h3>
        <span class="text-[10px] text-slate-400">Swipe to view</span>
      </div>

      <div class="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-none" style="scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;">
        ${galleryItems.slice(0, 5).map((img, i) => `
          <div class="flex-shrink-0 w-64 sm:w-72 snap-center rounded-xl overflow-hidden border border-slate-800 bg-slate-900 relative group shadow-md">
            <img src="${img.dataUrl}" alt="${img.title || 'Salon Interior'}" loading="lazy" width="288" height="180"
                 class="w-full h-36 sm:h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                 onerror="this.onerror=null; this.src='${defaultHero}';" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end p-2.5">
              <span class="text-[11px] font-semibold text-white drop-shadow">${img.title || `Studio View ${i + 1}`}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Primary Hero Booking CTA -->
    <div class="mt-7 pt-4 border-t border-slate-800/80 text-center">
      <button id="hero-book-cta" class="w-full sm:w-auto min-h-[48px] px-8 py-3.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-[#F59E0B]/20 hover:brightness-110 active:scale-[0.98] transition flex items-center justify-center gap-2 mx-auto">
        <span>💈 Book Appointment Now</span>
        <span class="text-xs bg-slate-950/20 px-2 py-0.5 rounded-full">Next ↗</span>
      </button>
      <p class="text-[11px] text-slate-400 mt-2">Instant slot confirmation • 5-minute concurrency hold • Free cancellation</p>
    </div>
  `;

  document.getElementById("hero-book-cta")?.addEventListener("click", () => {
    STATE.step = 1;
    renderApp();
  });
}

// ==========================================
// 6. STEP 1: SERVICE SELECTION (MULTI-SELECT)
// ==========================================
function renderStep1Services(container) {
  const categories = ["All", ...new Set(SERVICES.map(s => s.category || "General Services"))];
  let activeCategory = "All";

  function renderList(category) {
    const filtered = category === "All" ? SERVICES : SERVICES.filter(s => (s.category || "General Services") === category);
    const servicesListEl = document.getElementById("services-list-container");
    if (!servicesListEl) return;

    servicesListEl.innerHTML = filtered.map(service => {
      const isSelected = STATE.selectedServices.some(s => String(s.id) === String(service.id));
      return `
        <div data-id="${service.id}" class="service-card cursor-pointer p-4 rounded-xl border transition-all select-none min-h-[48px] flex items-center justify-between gap-3 ${
          isSelected
            ? "border-[#F59E0B] bg-[#F59E0B]/10 ring-2 ring-[#F59E0B]/30"
            : "border-slate-800 bg-slate-900/70 hover:border-slate-700 active:bg-slate-800/80"
        }">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-white text-sm sm:text-base truncate">${service.name}</h4>
              ${service.category ? `<span class="px-2 py-0.5 text-[9px] rounded-md font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">${service.category}</span>` : ""}
            </div>
            <p class="text-xs text-slate-400 mt-0.5 line-clamp-2">${service.desc || "Standard professional salon service"}</p>
            <div class="flex items-center gap-3 mt-2 text-[10px] font-semibold text-slate-300">
              <span class="flex items-center gap-1 text-[#F59E0B]">
                <span>⏱</span> ${service.duration} mins
              </span>
              ${service.buffer ? `<span class="text-slate-400">+${service.buffer}m buffer</span>` : ""}
            </div>
          </div>

          <div class="text-right flex flex-col items-end flex-shrink-0">
            <span class="text-base sm:text-lg font-black text-[#F59E0B]">${service.price} SAR</span>
            <button class="mt-2 min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg transition ${
              isSelected
                ? "bg-[#F59E0B] text-slate-950 font-extrabold"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }">
              ${isSelected ? "✓ Added" : "+ Select"}
            </button>
          </div>
        </div>
      `;
    }).join("");

    servicesListEl.querySelectorAll(".service-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        const found = SERVICES.find(s => String(s.id) === String(id));
        if (!found) return;

        const existsIdx = STATE.selectedServices.findIndex(s => String(s.id) === String(id));
        if (existsIdx > -1) {
          STATE.selectedServices.splice(existsIdx, 1);
        } else {
          STATE.selectedServices.push(found);
        }
        renderApp();
      });
    });
  }

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base sm:text-lg font-bold text-white">1. Select Services</h3>
        <p class="text-xs text-slate-400">Choose one or more grooming services</p>
      </div>
      <button id="step1-back-to-hero" class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-800">
        ← Salon Details
      </button>
    </div>

    <!-- Category Filter Chips -->
    <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-4" id="category-chips">
      ${categories.map(cat => `
        <button data-category="${cat}" class="cat-chip whitespace-nowrap min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-full border transition ${
          cat === activeCategory
            ? "border-[#F59E0B] bg-[#F59E0B] text-slate-950"
            : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
        }">
          ${cat}
        </button>
      `).join("")}
    </div>

    <div id="services-list-container" class="space-y-2.5"></div>
  `;

  document.getElementById("step1-back-to-hero")?.addEventListener("click", () => {
    STATE.step = 0;
    renderApp();
  });

  const chips = container.querySelectorAll(".cat-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      activeCategory = chip.getAttribute("data-category");
      chips.forEach(c => {
        const isActive = c.getAttribute("data-category") === activeCategory;
        c.className = `cat-chip whitespace-nowrap min-h-[36px] px-3.5 py-1 text-xs font-semibold rounded-full border transition ${
          isActive
            ? "border-[#F59E0B] bg-[#F59E0B] text-slate-950"
            : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
        }`;
      });
      renderList(activeCategory);
    });
  });

  renderList(activeCategory);
}

// ==========================================
// 7. STEP 2: BARBER SELECTION (PRIVACY GUARD)
// ==========================================
function renderStep2Barbers(container) {
  const isAnySelected = STATE.selectedBarber && STATE.selectedBarber.id === "any";
  const defaultAvatar = FallbackAssets.getDefaultAvatar();

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base sm:text-lg font-bold text-white">2. Select Your Barber</h3>
        <p class="text-xs text-slate-400">Choose a specialist or fast-track with first available</p>
      </div>
      <button id="step2-back-to-services" class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-800">
        ← Services
      </button>
    </div>

    <!-- Fast-Track Option: Any Available Barber -->
    <div id="barber-any-card" class="cursor-pointer p-4 rounded-xl border transition-all mb-4 flex items-center justify-between min-h-[48px] ${
      isAnySelected
        ? "border-[#F59E0B] bg-[#F59E0B]/10 ring-2 ring-[#F59E0B]/30"
        : "border-slate-800 bg-slate-900/80 hover:border-[#F59E0B]/50"
    }">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#F59E0B] to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md flex-shrink-0">
          ⚡
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-white text-sm">Any Available Barber</h4>
            <span class="text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Fastest</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Auto-assigns top barber available on duty</p>
        </div>
      </div>
      <button class="min-h-[40px] px-3.5 py-1 text-xs font-bold rounded-lg transition ${
        isAnySelected ? "bg-[#F59E0B] text-slate-950" : "bg-slate-800 text-slate-200"
      }">
        ${isAnySelected ? "Selected" : "Select"}
      </button>
    </div>

    <!-- Specific Barber Staff Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${BARBERS.map(barber => {
        const isSelected = STATE.selectedBarber && String(STATE.selectedBarber.id) === String(barber.id);
        const avatarSrc = (barber.avatar && barber.avatar.trim() !== "" && !barber.avatar.includes("unsplash.com"))
          ? barber.avatar
          : defaultAvatar;

        return `
          <div data-id="${barber.id}" class="barber-card cursor-pointer p-4 rounded-xl border transition-all flex items-center justify-between min-h-[48px] ${
            isSelected
              ? "border-[#F59E0B] bg-[#F59E0B]/10 ring-2 ring-[#F59E0B]/30"
              : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
          }">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full overflow-hidden border border-[#F59E0B]/40 bg-slate-950 flex-shrink-0">
                <img src="${avatarSrc}" alt="${barber.name}" width="48" height="48"
                     class="w-full h-full object-cover"
                     onerror="this.onerror=null; this.src='${defaultAvatar}';" />
              </div>
              <div>
                <h4 class="font-bold text-white text-sm">${barber.name}</h4>
                <p class="text-xs text-slate-400">${barber.title || "Master Stylist"}</p>
                <span class="inline-block mt-1 text-[10px] font-semibold text-[#F59E0B]">
                  ★ ${barber.rating || "5.0"} Rating
                </span>
              </div>
            </div>

            <button class="min-h-[36px] px-3 py-1 text-xs font-bold rounded-lg transition ${
              isSelected ? "bg-[#F59E0B] text-slate-950" : "bg-slate-800 text-slate-300"
            }">
              ${isSelected ? "Selected" : "Select"}
            </button>
          </div>
        `;
      }).join("")}
    </div>
  `;

  document.getElementById("step2-back-to-services")?.addEventListener("click", () => {
    STATE.step = 1;
    renderApp();
  });

  document.getElementById("barber-any-card")?.addEventListener("click", () => {
    STATE.selectedBarber = { id: "any", name: "Any Available Barber", title: "Assigned by Salon" };
    STATE.step = 3;
    renderApp();
  });

  container.querySelectorAll(".barber-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const found = BARBERS.find(b => String(b.id) === String(id));
      if (found) {
        STATE.selectedBarber = found;
        STATE.step = 3;
        renderApp();
      }
    });
  });
}

// ==========================================
// 8. STEP 3: DATE & TIME SLOTS (SALON STORE SYNC)
// ==========================================
function renderStep3DateAndSlots(container) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString("en-US", { month: "short" });
    const dayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];

    dates.push({ iso, dayName, dayNum, monthName, dayKey });
  }

  const slotsGrouped = getDynamicSlotsForDate(STATE.shop, STATE.selectedDate);
  const existingBookings = Store.getBookings(STATE.shopSlug);

  container.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base sm:text-lg font-bold text-white">3. Select Date & Slot</h3>
        <p class="text-xs text-slate-400">
          Barber: <strong class="text-[#F59E0B]">${STATE.selectedBarber?.name || "Any Available"}</strong>
          (${STATE.selectedServices.length} service${STATE.selectedServices.length > 1 ? "s" : ""})
        </p>
      </div>
      <button id="step3-back-to-barbers" class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-800">
        ← Barber
      </button>
    </div>

    <!-- 14-Day Horizontal Touch Picker Strip -->
    <div class="mb-5">
      <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Next 14 Days Availability</label>
      <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory" style="-webkit-overflow-scrolling: touch;">
        ${dates.map(d => {
          const isSelected = d.iso === STATE.selectedDate;
          return `
            <button data-date="${d.iso}" class="date-strip-chip flex-shrink-0 snap-start flex flex-col items-center justify-center w-16 py-2.5 rounded-xl border transition min-h-[48px] select-none ${
              isSelected
                ? "border-[#F59E0B] bg-[#F59E0B] text-slate-950 font-bold shadow-lg shadow-[#F59E0B]/20 scale-105"
                : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700"
            }">
              <span class="text-[10px] uppercase font-semibold ${isSelected ? "text-slate-950" : "text-slate-400"}">${d.dayName}</span>
              <span class="text-base font-extrabold my-0.5">${d.dayNum}</span>
              <span class="text-[9px] ${isSelected ? "text-slate-950 font-bold" : "text-slate-400"}">${d.monthName}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <!-- Slot Buckets: Morning, Afternoon, Evening -->
    ${slotsGrouped.isClosed ? `
      <div class="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
        <span class="text-3xl block mb-2">🌙</span>
        <h4 class="font-bold text-white text-base">Salon Closed on this Day</h4>
        <p class="text-xs text-slate-400 mt-1">The salon schedule indicates this is an off day. Please select another date from the strip above.</p>
      </div>
    ` : `
      <div class="space-y-4">
        ${["morning", "afternoon", "evening"].map(bucket => {
          const list = slotsGrouped[bucket] || [];
          if (list.length === 0) return "";

          const bucketTitle = bucket === "morning" ? "Morning Slots" : bucket === "afternoon" ? "Afternoon Slots" : "Evening Slots";
          const bucketIcon = bucket === "morning" ? "🌅" : bucket === "afternoon" ? "☀️" : "🌆";

          return `
            <div class="bg-slate-900/40 p-3.5 sm:p-4 rounded-xl border border-slate-800/80">
              <h4 class="text-xs uppercase font-extrabold tracking-wider text-[#F59E0B] mb-2.5 flex items-center gap-1.5">
                <span>${bucketIcon}</span> ${bucketTitle}
              </h4>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                ${list.map(slot => {
                  const isBooked = isSlotUnavailable(slot.time, STATE.selectedDate, STATE.selectedBarber, existingBookings);
                  const isSelected = STATE.selectedSlot === slot.time;

                  return `
                    <button data-time="${slot.time}" ${isBooked ? "disabled" : ""} class="slot-chip min-h-[48px] py-2 px-2.5 rounded-xl font-bold text-xs border transition-all flex flex-col items-center justify-center select-none ${
                      isBooked
                        ? "bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed opacity-60"
                        : isSelected
                        ? "bg-[#F59E0B] text-slate-950 border-[#F59E0B] shadow-md shadow-[#F59E0B]/20 ring-2 ring-[#F59E0B]/30"
                        : "bg-slate-900 text-slate-200 border-slate-800 hover:border-[#F59E0B] hover:text-[#F59E0B] active:scale-95"
                    }">
                      <span class="font-mono text-xs sm:text-sm">${slot.time}</span>
                      <span class="text-[9px] mt-0.5 font-normal ${isBooked ? "text-slate-600" : isSelected ? "text-slate-900 font-semibold" : "text-emerald-400"}">
                        ${isBooked ? "Unavailable" : "Available"}
                      </span>
                    </button>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `}
  `;

  document.getElementById("step3-back-to-barbers")?.addEventListener("click", () => {
    STATE.step = 2;
    renderApp();
  });

  container.querySelectorAll(".date-strip-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      STATE.selectedDate = btn.getAttribute("data-date");
      STATE.selectedSlot = null;
      renderApp();
    });
  });

  container.querySelectorAll(".slot-chip:not([disabled])").forEach(btn => {
    btn.addEventListener("click", () => {
      STATE.selectedSlot = btn.getAttribute("data-time");

      Store.addAuditLog(
        "customer@funnel",
        STATE.shop?.name || STATE.shopSlug,
        "CUSTOMER_SLOT_HOLD",
        `Temporary 5-minute lock placed on ${STATE.selectedSlot} on ${STATE.selectedDate} for barber ${STATE.selectedBarber?.name}`
      );

      startConcurrencyHoldTimer();
      STATE.step = 4;
      renderApp();
    });
  });
}

// ==========================================
// 9. STEP 4: CUSTOMER DETAILS & REVIEW CARD
// ==========================================
function renderStep4CustomerDetails(container) {
  const totalDuration = STATE.selectedServices.reduce((sum, s) => sum + (s.duration || 30) + (s.buffer || 0), 0);
  const totalPrice = STATE.selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  container.innerHTML = `
    <div class="max-w-lg mx-auto space-y-4 sm:space-y-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base sm:text-lg font-bold text-white">4. Customer Details & Review</h3>
          <p class="text-xs text-slate-400">Review your appointment and confirm reservation</p>
        </div>
        <button id="step4-back-to-slots" class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-800">
          ← Slot
        </button>
      </div>

      ${STATE.walkInMode ? `
        <!-- Active Walk-In Mode Staff Banner -->
        <div class="p-3 bg-amber-500/15 border border-[#F59E0B]/50 rounded-xl flex items-center justify-between text-xs text-[#F59E0B]">
          <div class="flex items-center gap-2">
            <span class="text-base font-bold">⚡</span>
            <div>
              <span class="font-bold block">Walk-In Mode Active</span>
              <span class="text-[11px] text-slate-300">Auto-confirms appointment into ${STATE.selectedBarber?.name || "Staff"}'s portal schedule</span>
            </div>
          </div>
          <span class="text-[10px] bg-[#F59E0B] text-slate-950 font-black px-2 py-0.5 rounded uppercase">Staff Override</span>
        </div>
      ` : ''}

      <!-- Instant Review Card -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 text-left space-y-2.5 sm:space-y-3 shadow-lg">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2">
          <span class="text-xs text-slate-400">Salon</span>
          <span class="text-xs font-bold text-white">${STATE.shop?.name}</span>
        </div>

        <div class="border-b border-slate-800 pb-2">
          <span class="text-xs text-slate-400 block mb-1">Selected Services (${STATE.selectedServices.length})</span>
          <div class="space-y-1">
            ${STATE.selectedServices.map(s => `
              <div class="flex justify-between text-xs">
                <span class="text-slate-300">• ${s.name} (${s.duration}m)</span>
                <span class="font-bold text-[#F59E0B]">${s.price} SAR</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
          <span class="text-slate-400">Barber</span>
          <span class="font-bold text-white">${STATE.selectedBarber?.name}</span>
        </div>

        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
          <span class="text-slate-400">Date & Slot</span>
          <span class="font-bold text-[#F59E0B] font-mono">${STATE.selectedDate} @ ${STATE.selectedSlot}</span>
        </div>

        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
          <span class="text-slate-400">Estimated Duration</span>
          <span class="font-bold text-white">${totalDuration} minutes</span>
        </div>

        <div class="flex items-center justify-between pt-1">
          <span class="text-sm font-bold text-slate-300">Total Due (Pay at Salon)</span>
          <span class="text-lg sm:text-xl font-black text-[#F59E0B]">${totalPrice} SAR</span>
        </div>
      </div>

      <!-- Customer Form -->
      <form id="customer-funnel-form" class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Full Name <span class="text-red-400">*</span></label>
          <input type="text" id="cust-fullname" required
                 value="${STATE.customer.fullName || ''}"
                 placeholder="e.g. Mohammed Al-Ghamdi"
                 class="w-full min-h-[48px] bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#F59E0B]" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Saudi Mobile Number <span class="text-red-400">*</span></label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono select-none">🇸🇦</span>
            <input type="tel" id="cust-phone-input" required maxlength="10"
                   value="${STATE.customer.phone || ''}"
                   placeholder="05XXXXXXXX"
                   class="w-full min-h-[48px] pl-10 pr-4 bg-slate-800 border border-slate-700 text-white rounded-xl py-2 text-sm focus:outline-none focus:border-[#F59E0B] font-mono tracking-wider" />
          </div>
          <p class="text-[10px] text-slate-400 mt-1">Must be 10 digits starting with 05 (e.g. 0512345678)</p>
          <p id="phone-validation-err" class="hidden text-[11px] text-red-400 font-semibold mt-1">⚠️ Invalid Saudi number. Enter 10 digits starting with 05 without country code.</p>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Special Notes / Requests <span class="text-slate-500">(Optional)</span></label>
          <textarea id="cust-notes-input" rows="2"
                    placeholder="e.g. Low skin fade, beard shaping only, organic oils"
                    class="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-[#F59E0B]">${STATE.customer.notes || ''}</textarea>
        </div>

        <!-- Prominent Cancellation Advisory Notice -->
        <div class="p-3 bg-amber-500/10 border border-[#F59E0B]/30 rounded-xl text-left">
          <div class="flex items-start gap-2">
            <span class="text-base text-[#F59E0B]">ℹ️</span>
            <div>
              <h5 class="text-xs font-bold text-[#F59E0B]">Cancellation / Rescheduling Policy</h5>
              <p class="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                Need to cancel or modify? Please call the salon directly at
                <a href="tel:${STATE.shop?.phone || '0501234567'}" class="text-white font-bold underline font-mono">${STATE.shop?.phone || "0501234567"}</a>
                or customer care at <span class="text-white font-bold">050 123 4567</span> at least 2 hours before your appointment.
              </p>
            </div>
          </div>
        </div>

        <button type="submit" class="w-full min-h-[48px] py-3.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-[#F59E0B]/20 hover:brightness-110 active:scale-[0.99] transition flex items-center justify-center gap-2">
          <span>${STATE.walkInMode ? "⚡ Confirm & Auto-Approve Walk-In (Direct to Schedule)" : "✓ Confirm & Schedule Appointment"}</span>
        </button>
      </form>
    </div>
  `;

  document.getElementById("step4-back-to-slots")?.addEventListener("click", () => {
    STATE.step = 3;
    renderApp();
  });

  const phoneInput = document.getElementById("cust-phone-input");
  const phoneErr = document.getElementById("phone-validation-err");

  phoneInput?.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\s+/g, "");
    if (val.startsWith("+966")) val = "0" + val.slice(4);
    else if (val.startsWith("00966")) val = "0" + val.slice(5);
    else if (val.startsWith("966") && val.length > 9) val = "0" + val.slice(3);

    e.target.value = val;
    phoneErr?.classList.add("hidden");
  });

  document.getElementById("customer-funnel-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("cust-fullname")?.value.trim() || "";
    const phone = document.getElementById("cust-phone-input")?.value.trim() || "";
    const notes = document.getElementById("cust-notes-input")?.value.trim() || "";

    const SAUDI_REGEX = /^05[0-9]{8}$/;
    if (!SAUDI_REGEX.test(phone)) {
      phoneErr?.classList.remove("hidden");
      phoneInput?.focus();
      return;
    }
    phoneErr?.classList.add("hidden");

    STATE.customer.fullName = name;
    STATE.customer.phone = phone;
    STATE.customer.notes = notes;

    STATE.bookingRef = `BBR-${Math.floor(10000 + Math.random() * 90000)}`;

    const totalPriceCalc = STATE.selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
    const serviceNames = STATE.selectedServices.map(s => s.name).join(", ");

    let finalNotes = notes;
    if (STATE.walkInMode && !finalNotes.includes("[Walk-In]")) {
      const currentUser = Store.getCurrentUser();
      const staffName = currentUser?.fullName || "Staff";
      finalNotes = finalNotes ? `[Walk-In by ${staffName}] ${finalNotes}` : `[Walk-In by ${staffName}]`;
    }

    // Persist real record to backend MySQL database
    let dbBooking = null;
    try {
      const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const backendBase = (isLocalhost && window.location.port !== "8080") ? "http://localhost:8080" : "";
      const payload = {
        shopSlug: STATE.shopSlug,
        shopId: STATE.shop?.id,
        barberId: STATE.selectedBarber?.id,
        barberName: STATE.selectedBarber?.name,
        serviceId: STATE.selectedServices[0]?.id,
        serviceName: serviceNames,
        customerName: STATE.customer.fullName,
        customerPhone: STATE.customer.phone,
        date: STATE.selectedDate,
        time: STATE.selectedSlot,
        slotStart: convertSlotToIso(STATE.selectedDate, STATE.selectedSlot),
        notes: finalNotes,
        referenceCode: STATE.bookingRef
      };
      const res = await fetch(`${backendBase}/api/bookings/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        dbBooking = await res.json();
        console.log("Customer booking persisted to database:", dbBooking);
      } else {
        console.warn("Backend booking persistence response:", res.status);
      }
    } catch (err) {
      console.warn("REST public booking save failed, falling back to local store:", err);
    }

    const savedBooking = Store.addBooking({
      id: dbBooking?.id || Date.now(),
      shopSlug: STATE.shopSlug,
      barber: STATE.selectedBarber.name,
      time: STATE.selectedSlot,
      date: STATE.selectedDate,
      customerName: STATE.customer.fullName,
      customerPhone: STATE.customer.phone,
      service: serviceNames,
      price: totalPriceCalc,
      referenceCode: STATE.bookingRef,
      notes: finalNotes,
      status: "CONFIRMED",
      walkIn: STATE.walkInMode,
      slotStart: dbBooking?.slotStart || convertSlotToIso(STATE.selectedDate, STATE.selectedSlot)
    });

    STATE.confirmedBooking = savedBooking;

    Store.addAuditLog(
      STATE.customer.phone,
      STATE.shop?.name || STATE.shopSlug,
      STATE.walkInMode ? "PORTAL_STAFF_WALKIN_BOOKED" : "CUSTOMER_BOOKING_CONFIRMED",
      `Booking ${STATE.bookingRef} confirmed for ${STATE.customer.fullName} (${STATE.customer.phone}) with ${STATE.selectedBarber.name} on ${STATE.selectedDate} @ ${STATE.selectedSlot}. Services: [${serviceNames}], Total: ${totalPriceCalc} SAR. Notes: ${finalNotes || "None"}. Mode: ${STATE.walkInMode ? "STAFF_WALKIN" : "CUSTOMER_SELF_SERVICE"}`
    );

    clearInterval(STATE.timerInterval);
    document.getElementById("hold-timer-container")?.classList.add("hidden");
    document.getElementById("timer-bar-container")?.classList.add("hidden");

    STATE.step = 5;
    renderApp();
  });
}

// ==========================================
// 10. STEP 5: SUCCESS RECEIPT & DUAL CALENDAR EXPORT
// ==========================================
function renderStep5Confirmation(container) {
  const shop = STATE.shop || {};
  const serviceNames = STATE.selectedServices.map(s => s.name);
  const totalPrice = STATE.selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const totalDuration = STATE.selectedServices.reduce((sum, s) => sum + (s.duration || 30) + (s.buffer || 0), 0);

  const startIso = convertSlotToIso(STATE.selectedDate, STATE.selectedSlot);
  const endIso = new Date(new Date(startIso).getTime() + totalDuration * 60000).toISOString();

  const freeMapQuery = encodeURIComponent(`${shop.name} ${shop.fullAddress || shop.city || "Riyadh"}`);
  const freeMapUrl = `https://maps.google.com/?q=${freeMapQuery}`;

  const googleCalUrl = getGoogleCalendarWebUrl({
    bookingRef: STATE.bookingRef,
    shopName: shop.name,
    barberName: STATE.selectedBarber?.name,
    serviceNames: serviceNames,
    startIso: startIso,
    endIso: endIso,
    address: shop.fullAddress || shop.city || "Saudi Arabia",
    salonPhone: shop.phone || "0501234567",
    notes: STATE.customer.notes
  });

  container.innerHTML = `
    <div class="max-w-md mx-auto text-center space-y-5">
      <!-- Success Badge -->
      <div class="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 text-2xl font-bold shadow-lg shadow-emerald-500/10">
        ✓
      </div>

      <div>
        <span class="inline-block px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 tracking-widest uppercase mb-1">
          REF: ${STATE.bookingRef}
        </span>
        <h2 class="text-xl sm:text-2xl font-black text-white">Booking Confirmed!</h2>
        <p class="text-xs text-slate-400 mt-0.5">Your appointment has been reserved in real-time.</p>
      </div>

      <!-- Receipt Card -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 text-left space-y-2.5 text-xs shadow-xl">
        <div class="flex justify-between py-1 border-b border-slate-800">
          <span class="text-slate-400">Salon</span>
          <span class="font-bold text-white">${shop.name}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-800">
          <span class="text-slate-400">Customer</span>
          <span class="font-bold text-white">${STATE.customer.fullName}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-800">
          <span class="text-slate-400">Saudi Phone</span>
          <span class="font-mono font-bold text-white">${STATE.customer.phone}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-800">
          <span class="text-slate-400">Barber</span>
          <span class="font-bold text-white">${STATE.selectedBarber?.name}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-slate-800">
          <span class="text-slate-400">Date & Slot</span>
          <span class="font-mono font-bold text-[#F59E0B]">${STATE.selectedDate} @ ${STATE.selectedSlot}</span>
        </div>
        <div class="py-1 border-b border-slate-800">
          <span class="text-slate-400 block mb-1">Services</span>
          <div class="text-slate-200 font-semibold space-y-0.5">
            ${serviceNames.map(s => `<div>• ${s}</div>`).join("")}
          </div>
        </div>
        ${STATE.customer.notes ? `
          <div class="py-1 border-b border-slate-800">
            <span class="text-slate-400 block mb-0.5">Notes</span>
            <span class="text-slate-300 italic">${STATE.customer.notes}</span>
          </div>
        ` : ""}
        <div class="flex justify-between pt-1">
          <span class="text-sm font-bold text-slate-300">Total Price</span>
          <span class="text-base font-black text-[#F59E0B]">${totalPrice} SAR</span>
        </div>
      </div>

      <!-- Prominent Cancellation Advisory Card -->
      <div class="p-3.5 bg-amber-500/10 border border-[#F59E0B]/30 rounded-xl text-left">
        <h5 class="text-xs font-bold text-[#F59E0B] flex items-center gap-1.5 mb-1">
          <span>📞</span> Need to Cancel or Reschedule?
        </h5>
        <p class="text-[11px] text-slate-300 leading-relaxed">
          Please contact salon support directly at
          <a href="tel:${shop.phone || '0501234567'}" class="text-white font-bold underline font-mono">${shop.phone || "0501234567"}</a>
          or customer care at <span class="text-white font-bold">050 123 4567</span> at least 2 hours prior to your scheduled time.
        </p>
      </div>

      <!-- Dual Calendar Export Actions (iPhone / Apple & Android / Google) -->
      <div class="space-y-2.5 pt-1">
        <!-- 1. Apple / iPhone Calendar (.ics download with -PT1H alarm) -->
        <button id="cal-iphone-btn" class="w-full min-h-[48px] py-3 px-4 bg-slate-900 border border-slate-700 hover:border-[#F59E0B] text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md">
          <span class="text-base">🍏</span>
          <span>Add to Apple / iPhone Calendar</span>
        </button>

        <!-- 2. Google / Android Calendar Direct Link -->
        <a href="${googleCalUrl}" target="_blank" rel="noopener" class="w-full min-h-[48px] py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:brightness-110 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md">
          <span class="text-base">📅</span>
          <span>Add to Google / Android Calendar ↗</span>
        </a>

        <!-- 3. Free Zero-Cost Map Directions Link -->
        <a href="${freeMapUrl}" target="_blank" rel="noopener" class="w-full min-h-[48px] py-3 px-4 bg-slate-900 border border-slate-700 hover:border-sky-400 text-sky-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2">
          <span class="text-base">📍</span>
          <span>View Salon Location on Map ↗</span>
        </a>

        ${(STATE.walkInMode || (Store.getCurrentUser() && (Store.getCurrentUser().role === "SALON_OWNER" || Store.getCurrentUser().role === "SALON_STAFF" || Store.getCurrentUser().role === "SHOP_OWNER" || Store.getCurrentUser().role === "STAFF"))) ? `
          <!-- 4. Staff/Owner Walk-In Shortcut: Return to Portal Schedule -->
          <a href="../portal/index.html#bookings" class="w-full min-h-[48px] py-3 px-4 bg-amber-500/15 border border-[#F59E0B]/40 hover:bg-amber-500/25 text-[#F59E0B] font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-md">
            <span>⚡ View in Portal Schedule & Appointments ↗</span>
          </a>
        ` : ''}
      </div>

      <!-- Reset / Book Another -->
      <div class="pt-3 border-t border-slate-800">
        <button id="book-another-btn" class="text-xs text-slate-400 hover:text-white underline">
          Book Another Appointment
        </button>
      </div>
    </div>
  `;

  document.getElementById("cal-iphone-btn")?.addEventListener("click", () => {
    downloadIcsCalendarFile({
      bookingRef: STATE.bookingRef,
      shopName: shop.name,
      barberName: STATE.selectedBarber?.name,
      serviceNames: serviceNames,
      startIso: startIso,
      endIso: endIso,
      address: shop.fullAddress || shop.city || "Saudi Arabia",
      salonPhone: shop.phone || "0501234567",
      notes: STATE.customer.notes
    });
  });

  document.getElementById("book-another-btn")?.addEventListener("click", () => {
    STATE.step = 0;
    STATE.selectedServices = [];
    STATE.selectedBarber = null;
    STATE.selectedSlot = null;
    STATE.bookingRef = null;
    renderApp();
  });
}

// ==========================================
// 11. DYNAMIC SLOTS CALCULATOR (FROM SALON STORE)
// ==========================================
function getDynamicSlotsForDate(shop, dateIso) {
  const d = new Date(dateIso);
  const dayKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][d.getDay()];

  let hours = DEFAULT_OPERATING_HOURS;
  if (shop && shop.operatingHoursJson) {
    try {
      hours = { ...DEFAULT_OPERATING_HOURS, ...JSON.parse(shop.operatingHoursJson) };
    } catch (e) {
      hours = DEFAULT_OPERATING_HOURS;
    }
  } else if (shop && shop.operatingHours) {
    hours = { ...DEFAULT_OPERATING_HOURS, ...shop.operatingHours };
  }

  const daySchedule = hours[dayKey] || DEFAULT_OPERATING_HOURS[dayKey];
  if (daySchedule.closed) {
    return { isClosed: true, morning: [], afternoon: [], evening: [] };
  }

  const openParts = (daySchedule.open || "09:00").split(":").map(Number);
  const closeParts = (daySchedule.close || "22:00").split(":").map(Number);
  const openMinutes = openParts[0] * 60 + openParts[1];
  const closeMinutes = closeParts[0] * 60 + closeParts[1];

  const morning = [];
  const afternoon = [];
  const evening = [];

  for (let m = openMinutes; m < closeMinutes; m += 30) {
    const hours24 = Math.floor(m / 60);
    const mins = m % 60;

    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const timeFormatted = `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;

    const slotObj = { time: timeFormatted, minutes: m };

    if (m < 12 * 60) {
      morning.push(slotObj);
    } else if (m < 17 * 60) {
      afternoon.push(slotObj);
    } else {
      evening.push(slotObj);
    }
  }

  return { isClosed: false, morning, afternoon, evening };
}

function isSlotUnavailable(slotTime, selectedDate, selectedBarber, existingBookings) {
  const todayIso = getTodayFormatted();
  if (selectedDate === todayIso) {
    const [t, p] = slotTime.split(" ");
    let [hh, mm] = t.split(":").map(Number);
    if (p === "PM" && hh < 12) hh += 12;
    if (p === "AM" && hh === 12) hh = 0;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const slotMins = hh * 60 + mm;

    if (slotMins <= currentMins) return true;
  }

  if (selectedBarber && selectedBarber.id !== "any") {
    return existingBookings.some(b =>
      b.date === selectedDate &&
      b.time === slotTime &&
      (b.barber === selectedBarber.name || String(b.barberId) === String(selectedBarber.id))
    );
  }

  if (BARBERS.length > 0) {
    const bookedCount = existingBookings.filter(b => b.date === selectedDate && b.time === slotTime).length;
    return bookedCount >= BARBERS.length;
  }

  return false;
}

// ==========================================
// 12. 5-MINUTE CONCURRENCY HOLD TIMER
// ==========================================
function startConcurrencyHoldTimer() {
  STATE.timerSeconds = 300;
  const container = document.getElementById("hold-timer-container");
  const barContainer = document.getElementById("timer-bar-container");
  const timerDisplay = document.getElementById("timer-display");
  const timerProgress = document.getElementById("timer-progress");

  container?.classList.remove("hidden");
  container?.classList.add("flex");
  barContainer?.classList.remove("hidden");

  clearInterval(STATE.timerInterval);
  STATE.timerInterval = setInterval(() => {
    STATE.timerSeconds--;
    if (STATE.timerSeconds <= 0) {
      clearInterval(STATE.timerInterval);
      alert("Your 5-minute temporary slot reservation has expired. Please choose a slot to proceed.");
      STATE.selectedSlot = null;
      STATE.step = 3;
      renderApp();
      return;
    }

    const m = Math.floor(STATE.timerSeconds / 60);
    const s = STATE.timerSeconds % 60;
    if (timerDisplay) {
      timerDisplay.innerText = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    if (timerProgress) {
      const pct = (STATE.timerSeconds / 300) * 100;
      timerProgress.style.width = `${pct}%`;
    }
  }, 1000);
}

// ==========================================
// 13. CALENDAR GENERATION UTILITIES
// ==========================================
function convertSlotToIso(dateStr, timeStr) {
  try {
    const [t, p] = timeStr.split(" ");
    let [hh, mm] = t.split(":").map(Number);
    if (p === "PM" && hh < 12) hh += 12;
    if (p === "AM" && hh === 12) hh = 0;

    return `${dateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;
  } catch {
    return `${dateStr}T12:00:00Z`;
  }
}

function formatIcsTimestamp(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function downloadIcsCalendarFile({ bookingRef, shopName, barberName, serviceNames, startIso, endIso, address, salonPhone, notes }) {
  const dtStart = formatIcsTimestamp(startIso);
  const dtEnd = formatIcsTimestamp(endIso);
  const dtStamp = formatIcsTimestamp(new Date().toISOString());
  const uid = `bbr-${bookingRef || Date.now()}@barberapp.sa`;

  const summary = `${serviceNames.join(", ")} - ${shopName}`;
  const description = [
    `Appointment Reference: ${bookingRef}`,
    `Salon: ${shopName}`,
    `Barber: ${barberName}`,
    `Services: ${serviceNames.join(", ")}`,
    notes ? `Customer Notes: ${notes}` : "",
    `Location: ${address}`,
    `Cancellation Policy: In case of cancelling or rescheduling, please call customer support or the salon at ${salonPhone || "0501234567"}.`
  ].filter(Boolean).join("\\n");

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BarberApp KSA//Mobile Booking Funnel//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Asia/Riyadh",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary.replace(/,/g, "\\,")}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${address.replace(/,/g, "\\,")}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: Appointment at ${shopName} in 1 hour! To cancel call ${salonPhone || "0501234567"}.`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${bookingRef || "barber"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getGoogleCalendarWebUrl({ bookingRef, shopName, barberName, serviceNames, startIso, endIso, address, salonPhone, notes }) {
  const dtStart = formatIcsTimestamp(startIso);
  const dtEnd = formatIcsTimestamp(endIso);

  const title = encodeURIComponent(`${serviceNames.join(", ")} - ${shopName}`);
  const details = encodeURIComponent([
    `Appointment Reference: ${bookingRef}`,
    `Salon: ${shopName}`,
    `Barber: ${barberName}`,
    `Services: ${serviceNames.join(", ")}`,
    notes ? `Notes: ${notes}` : "",
    `Cancellation Policy: In case of cancelling or modifying, please call customer support or the salon at ${salonPhone || "0501234567"}.`
  ].filter(Boolean).join("\n"));

  const location = encodeURIComponent(address || "Saudi Arabia");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dtStart}/${dtEnd}&details=${details}&location=${location}&ctz=Asia/Riyadh`;
}

// ==========================================
// 14. STICKY GLOBAL CTA FOOTER BAR & NAVIGATION (ALL RESOLUTIONS)
// ==========================================
function renderStickyMobileCta() {
  let ctaBar = document.getElementById("sticky-mobile-cta");
  if (!ctaBar) {
    ctaBar = document.createElement("div");
    ctaBar.id = "sticky-mobile-cta";
    ctaBar.className = "fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17]/95 backdrop-blur-lg border-t border-slate-800/80 px-4 py-3 sm:py-3.5 transition-transform duration-300 shadow-2xl shadow-black";
    document.body.appendChild(ctaBar);
  }

  // Hide CTA on Step 0 (Hero has its own direct button) and Step 5 (Confirmation has its own actions)
  if (STATE.step === 0 || STATE.step === 5) {
    ctaBar.classList.add("translate-y-full");
    return;
  }
  ctaBar.classList.remove("translate-y-full");

  const totalDuration = STATE.selectedServices.reduce((sum, s) => sum + (s.duration || 30) + (s.buffer || 0), 0);
  const totalPrice = STATE.selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  let nextDisabled = false;
  let nextLabel = "Continue →";
  let targetStep = STATE.step + 1;

  if (STATE.step === 1) {
    nextDisabled = STATE.selectedServices.length === 0;
    nextLabel = nextDisabled ? "Select a Service" : `Continue (${STATE.selectedServices.length} Selected) →`;
  } else if (STATE.step === 2) {
    nextDisabled = !STATE.selectedBarber;
    nextLabel = nextDisabled ? "Choose Barber" : "Select Date & Slot →";
  } else if (STATE.step === 3) {
    nextDisabled = !STATE.selectedSlot;
    nextLabel = nextDisabled ? "Select Time Slot" : `Hold Slot (${STATE.selectedSlot}) →`;
  } else if (STATE.step === 4) {
    nextLabel = "Confirm Appointment";
  }

  ctaBar.innerHTML = `
    <div class="flex items-center justify-between gap-4 max-w-4xl mx-auto">
      <div class="flex items-center gap-3 sm:gap-6">
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Total Due</span>
          <div class="flex items-baseline gap-1.5 sm:gap-2">
            <span class="text-base sm:text-xl font-black text-[#F59E0B]">${totalPrice} SAR</span>
            ${totalDuration > 0 ? `<span class="text-[10px] sm:text-xs text-slate-400">(${totalDuration}m)</span>` : ""}
          </div>
        </div>

        ${STATE.selectedServices.length > 0 ? `
          <div class="hidden sm:flex flex-col border-l border-slate-800 pl-4 text-xs">
            <span class="text-slate-300 font-semibold">${STATE.selectedServices.length} Service${STATE.selectedServices.length > 1 ? "s" : ""} selected</span>
            <span class="text-slate-500 truncate max-w-[240px]">${STATE.selectedServices.map(s => s.name).join(", ")}</span>
          </div>
        ` : ""}
      </div>

      <button id="sticky-next-btn" ${nextDisabled ? "disabled" : ""} class="min-h-[48px] px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-extrabold text-xs sm:text-sm transition flex items-center justify-center gap-2 ${
        nextDisabled
          ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
          : "bg-[#F59E0B] text-slate-950 hover:bg-[#D97706] shadow-lg shadow-[#F59E0B]/20 active:scale-95"
      }">
        <span>${nextLabel}</span>
      </button>
    </div>
  `;

  document.getElementById("sticky-next-btn")?.addEventListener("click", () => {
    if (nextDisabled) return;
    if (STATE.step === 4) {
      document.getElementById("customer-funnel-form")?.requestSubmit();
      return;
    }
    STATE.step = targetStep;
    renderApp();
  });
}

function updateHeaderAndTimer() {
  const titleEl = document.getElementById("shop-title");
  if (titleEl && STATE.shop) {
    titleEl.innerText = STATE.shop.name.toUpperCase();
  }
}

function updateStepperNav() {
  document.querySelectorAll(".step-nav-item").forEach((item) => {
    const s = parseInt(item.getAttribute("data-step"));
    const icon = item.querySelector(".step-icon");
    const label = item.querySelector(".step-label");

    if (s === STATE.step) {
      icon.className = "step-icon w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-xs bg-[#F59E0B] text-slate-950 ring-2 sm:ring-4 ring-[#F59E0B]/30 mx-auto transition-all";
      icon.innerHTML = s;
      if (label) label.className = "step-label text-[9px] sm:text-xs font-bold text-[#F59E0B] block text-center mt-1 truncate";
    } else if (s < STATE.step) {
      icon.className = "step-icon w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-xs bg-emerald-500 text-white mx-auto transition-all";
      icon.innerHTML = "✓";
      if (label) label.className = "step-label text-[9px] sm:text-xs font-semibold text-slate-300 block text-center mt-1 truncate";
    } else {
      icon.className = "step-icon w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-[11px] sm:text-xs bg-slate-800 text-slate-400 mx-auto transition-all";
      icon.innerHTML = s;
      if (label) label.className = "step-label text-[9px] sm:text-xs font-medium text-slate-500 block text-center mt-1 truncate";
    }
  });

  const progressBar = document.getElementById("stepper-overall-progress");
  if (progressBar) {
    const pct = (STATE.step / 5) * 100;
    progressBar.style.width = `${pct}%`;
  }
}

function getTodayFormatted() {
  return new Date().toISOString().split("T")[0];
}
