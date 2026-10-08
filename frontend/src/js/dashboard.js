import { Store } from "./store.js";

const SAUDI_PHONE_REGEX = /^(\+9665|05)[0-9]{8}$/;

let CURRENT_SHOP = null;
let SHOP_SLUG = "golden-scissors";

const DEFAULT_TIMES = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM"];

document.addEventListener("DOMContentLoaded", () => {
  Store.init();

  const urlParams = new URLSearchParams(window.location.search);
  SHOP_SLUG = urlParams.get("slug") || "golden-scissors";

  loadShopData();
  renderTimetable();
  initWebSocket();
  initModalEvents();

  // Real-time synchronization subscription
  Store.subscribe((event) => {
    if (event.eventType === "NEW_BOOKING") {
      showToast(`🔔 New Customer Booking: ${event.payload.customerName} for ${event.payload.barber}!`);
    } else if (event.eventType === "SHOP_STATUS_CHANGED") {
      showToast(`Shop status updated: ${event.payload.status}`);
      loadShopData();
    }
    renderTimetable();
  });
});

function loadShopData() {
  CURRENT_SHOP = Store.getShopBySlug(SHOP_SLUG);
  const titleEl = document.querySelector("header h1");
  if (titleEl && CURRENT_SHOP) {
    titleEl.innerText = `${CURRENT_SHOP.name} - Live Schedule`;
  }

  populateBarberFilter();
  populateWalkinOptions();
}

function populateBarberFilter() {
  const filterSelect = document.getElementById("barber-filter");
  if (!filterSelect || !CURRENT_SHOP) return;

  const barbers = CURRENT_SHOP.barbers || [];
  filterSelect.innerHTML = `<option value="ALL">All Barbers (${barbers.length})</option>` +
    barbers.map((b) => `<option value="${b.name}">${b.name}</option>`).join("");
}

function populateWalkinOptions() {
  const barberSelect = document.getElementById("walkin-barber");
  const serviceSelect = document.getElementById("walkin-service");
  if (!CURRENT_SHOP) return;

  if (barberSelect && CURRENT_SHOP.barbers) {
    barberSelect.innerHTML = CURRENT_SHOP.barbers.map((b) => `<option value="${b.name}">${b.name}</option>`).join("");
  }

  if (serviceSelect && CURRENT_SHOP.services) {
    serviceSelect.innerHTML = CURRENT_SHOP.services.map((s) => `<option value="${s.name}">${s.name} (${s.price} SAR)</option>`).join("");
  }
}

/* ---------------- TIMETABLE RENDER ---------------- */
function renderTimetable() {
  const filter = document.getElementById("barber-filter")?.value || "ALL";
  const container = document.getElementById("timetable-container");
  if (!container || !CURRENT_SHOP) return;

  const barbers = (CURRENT_SHOP.barbers || []).filter((b) => filter === "ALL" || b.name === filter);
  const bookings = Store.getBookings(SHOP_SLUG);

  let gridSlots = [];

  barbers.forEach((barber) => {
    DEFAULT_TIMES.forEach((time) => {
      const matchBooking = bookings.find((b) => b.barber === barber.name && b.time === time);
      if (matchBooking) {
        gridSlots.push({
          id: matchBooking.id,
          barber: barber.name,
          time: matchBooking.time,
          status: matchBooking.status || "CONFIRMED",
          customer: matchBooking.customerName,
          service: matchBooking.service
        });
      } else {
        gridSlots.push({
          id: `${barber.name}-${time}`,
          barber: barber.name,
          time: time,
          status: "AVAILABLE"
        });
      }
    });
  });

  const statusBadges = {
    AVAILABLE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    HOLD: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse",
    CONFIRMED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    BLOCKED: "bg-slate-800 text-slate-500 border-slate-700",
  };

  container.innerHTML = gridSlots.map((slot) => `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <span class="font-mono text-lg font-bold text-white">${slot.time}</span>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBadges[slot.status]}">
          ${slot.status}
        </span>
      </div>

      <div class="space-y-1 mb-4 text-xs">
        <p class="font-semibold text-slate-300">Barber: <span class="text-white">${slot.barber}</span></p>
        ${slot.customer ? `<p class="text-slate-400">Customer: <strong class="text-white">${slot.customer}</strong></p>` : ""}
        ${slot.service ? `<p class="text-[#F59E0B]">Service: ${slot.service}</p>` : ""}
      </div>

      <div class="pt-3 border-t border-slate-800 flex items-center justify-end">
        ${slot.status === "AVAILABLE" ? `
          <button data-barber="${slot.barber}" data-time="${slot.time}" class="reserve-walkin-btn px-3 py-1.5 bg-[#F59E0B]/10 hover:bg-[#F59E0B] text-[#F59E0B] hover:text-slate-950 font-bold text-xs rounded-xl transition">
            Reserve Walk-In
          </button>
        ` : `
          <span class="text-[10px] text-slate-500 font-mono">Booked</span>
        `}
      </div>
    </div>
  `).join("");

  // Attach event listener for walk-in buttons
  container.querySelectorAll(".reserve-walkin-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("walkin-barber").value = btn.getAttribute("data-barber");
      document.getElementById("walkin-time").value = btn.getAttribute("data-time");
      openModal();
    });
  });
}

document.getElementById("barber-filter")?.addEventListener("change", renderTimetable);

/* ---------------- STOMP WEBSOCKET LISTENER ---------------- */
function initWebSocket() {
  const wsBadge = document.getElementById("ws-badge");
  const wsDot = document.getElementById("ws-dot");
  const wsText = document.getElementById("ws-text");

  try {
    const socket = new WebSocket("ws://localhost:8080/ws/websocket");

    socket.onopen = () => {
      if (wsBadge) wsBadge.className = "px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      if (wsDot) wsDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
      if (wsText) wsText.innerText = "WS Live Sync";

      const subFrame = "SUBSCRIBE\nid:sub-0\ndestination:/topic/shop/1/slots\n\n\0";
      socket.send(subFrame);
    };

    socket.onmessage = (event) => {
      if (event.data.includes("MESSAGE")) {
        showToast("Live Slot Update Received!");
        renderTimetable();
      }
    };

    socket.onclose = () => {
      if (wsBadge) wsBadge.className = "px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20";
      if (wsText) wsText.innerText = "Reconnecting...";
    };
  } catch (err) {
    console.log("WebSocket client fallback mode");
  }
}

/* ---------------- TOAST NOTIFICATION ---------------- */
function showToast(msg) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "bg-[#F59E0B] text-slate-950 font-bold text-xs px-5 py-3 rounded-xl shadow-2xl animate-bounce flex items-center gap-2 pointer-events-auto";
  toast.innerHTML = `🔔 <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ---------------- WALK-IN MODAL LOGIC ---------------- */
function initModalEvents() {
  const openBtn = document.getElementById("open-walkin-modal");
  const closeBtn = document.getElementById("close-walkin-modal");
  const cancelBtn = document.getElementById("cancel-walkin-btn");
  const form = document.getElementById("walkin-form");

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("walkin-name").value.trim();
    const phone = document.getElementById("walkin-phone").value.trim();
    const barber = document.getElementById("walkin-barber").value;
    const time = document.getElementById("walkin-time").value;
    const service = document.getElementById("walkin-service").value;
    const phoneError = document.getElementById("phone-error");

    if (!SAUDI_PHONE_REGEX.test(phone)) {
      phoneError.classList.remove("hidden");
      return;
    }
    phoneError.classList.add("hidden");

    // Add new walk-in booking to Store
    Store.addBooking({
      shopSlug: SHOP_SLUG,
      barber,
      time,
      date: new Date().toISOString().split("T")[0],
      customerName: name + " (Walk-In)",
      customerPhone: phone,
      service,
      price: 50
    });

    renderTimetable();
    closeModal();
    showToast(`Walk-in confirmed for ${name}`);
  });
}

function openModal() {
  const modal = document.getElementById("walkin-modal");
  modal?.classList.remove("hidden");
  modal?.classList.add("flex");
}

function closeModal() {
  const modal = document.getElementById("walkin-modal");
  modal?.classList.add("hidden");
  modal?.classList.remove("flex");
  document.getElementById("phone-error")?.classList.add("hidden");
}

