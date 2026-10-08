/**
 * Customer Salons & Barber Shops Directory Module
 */

import { Store } from "./store.js";

document.addEventListener("DOMContentLoaded", () => {
  Store.init();
  renderDirectory();
  initDirectoryFilters();

  // Listen to real-time shop registrations or status updates
  Store.subscribe(() => {
    renderDirectory();
  });
});

let currentQuery = "";
let currentCityFilter = "ALL";

function renderDirectory() {
  const container = document.getElementById("shops-directory-grid");
  const countBadge = document.getElementById("directory-count-badge");
  if (!container) return;

  const shops = Store.getShops();

  const filtered = shops.filter((shop) => {
    const matchQuery =
      shop.name.toLowerCase().includes(currentQuery.toLowerCase()) ||
      (shop.city && shop.city.toLowerCase().includes(currentQuery.toLowerCase())) ||
      (shop.district && shop.district.toLowerCase().includes(currentQuery.toLowerCase()));

    const matchCity =
      currentCityFilter === "ALL" ||
      (shop.city && shop.city.toUpperCase() === currentCityFilter.toUpperCase());

    return matchQuery && matchCity;
  });

  if (countBadge) {
    countBadge.innerText = `${filtered.length} Salon${filtered.length === 1 ? "" : "s"} Available`;
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
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
              ✓ ${shop.status || "ACTIVE"}
            </span>
          </div>
          <div class="absolute bottom-3 left-3 right-3">
            <span class="text-[10px] uppercase font-bold tracking-wider text-[#F59E0B] bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-[#F59E0B]/30">
              📍 ${shop.district ? `${shop.district}, ` : ""}${shop.city || "Saudi Arabia"}
            </span>
          </div>
        </div>

        <!-- Shop Information Content -->
        <div class="p-5 space-y-3 flex-1 flex flex-col justify-between">
          <div>
            <h3 class="text-lg font-bold text-white group-hover:text-[#F59E0B] transition line-clamp-1">${shop.name}</h3>
            <p class="text-xs text-slate-400 mt-1 line-clamp-1">${shop.fullAddress || `${shop.district || ""}, ${shop.city || ""}`}</p>
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

          <!-- Book Button -->
          <div class="pt-3">
            <a href="./book.html?slug=${shop.slug}" class="w-full py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-[#F59E0B]/10">
              <span>Book Appointment</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join("");
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
