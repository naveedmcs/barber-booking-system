/**
 * Vanilla JS 5-Step Customer Booking Stepper
 */

import { Store } from "./store.js";

const STATE = {
  step: 1,
  shopSlug: "golden-scissors",
  shop: null,
  selectedBarber: null,
  selectedService: null,
  selectedDate: new Date().toISOString().split("T")[0],
  selectedSlot: null,
  customer: { fullName: "", phone: "" },
  holdBookingId: null,
  timerSeconds: 300,
  timerInterval: null,
};

let BARBERS = [];
let SERVICES = [];

const DEFAULT_SLOTS = {
  morning: [
    { time: "09:00 AM", available: true },
    { time: "09:30 AM", available: true },
    { time: "10:00 AM", available: true },
    { time: "10:30 AM", available: true },
  ],
  afternoon: [
    { time: "01:30 PM", available: true },
    { time: "02:00 PM", available: true },
    { time: "02:30 PM", available: true },
    { time: "03:00 PM", available: true },
  ],
  evening: [
    { time: "05:00 PM", available: true },
    { time: "05:30 PM", available: true },
    { time: "06:00 PM", available: true },
    { time: "06:30 PM", available: true },
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  Store.init();

  const urlParams = new URLSearchParams(window.location.search);
  STATE.shopSlug = urlParams.get("slug") || "golden-scissors";

  STATE.shop = Store.getShopBySlug(STATE.shopSlug);
  if (STATE.shop) {
    const titleEl = document.getElementById("shop-title");
    if (titleEl) titleEl.innerText = STATE.shop.name.toUpperCase();

    BARBERS = STATE.shop.barbers && STATE.shop.barbers.length > 0 ? STATE.shop.barbers : [
      { id: 1, name: "Master Barber Ahmed", rating: 4.9, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" },
      { id: 2, name: "Sami Al-Otaibi", rating: 4.8, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" }
    ];

    SERVICES = STATE.shop.services && STATE.shop.services.length > 0 ? STATE.shop.services : [
      { id: 101, name: "Royal Haircut & Hot Towel", duration: 30, price: 60, desc: "Precision haircut, scalp treatment, and hot towel finish" },
      { id: 102, name: "Beard Sculpting & Razor Line", duration: 25, price: 40, desc: "Beard trim, steam razor line-up, and organic oil treatment" }
    ];
  }

  renderStep();
});

function renderStep() {
  updateNavHeader();
  const container = document.getElementById("step-content");

  if (STATE.step === 1) renderStep1(container);
  else if (STATE.step === 2) renderStep2(container);
  else if (STATE.step === 3) renderStep3(container);
  else if (STATE.step === 4) renderStep4(container);
  else if (STATE.step === 5) renderStep5(container);
}

function updateNavHeader() {
  document.querySelectorAll(".step-nav-item").forEach((item) => {
    const s = parseInt(item.getAttribute("data-step"));
    const icon = item.querySelector(".step-icon");
    const label = item.querySelector("span");

    if (s === STATE.step) {
      icon.className = "step-icon w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-[#F59E0B] text-slate-950 ring-4 ring-[#F59E0B]/20";
      label.className = "text-xs font-semibold text-white";
    } else if (s < STATE.step) {
      icon.className = "step-icon w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-emerald-500 text-white";
      icon.innerHTML = "✓";
      label.className = "text-xs font-semibold text-slate-300";
    } else {
      icon.className = "step-icon w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-slate-800 text-slate-400";
      icon.innerHTML = s;
      label.className = "text-xs font-semibold text-slate-400";
    }
  });
}

/* ---------------- STEP 1: BARBERS ---------------- */
function renderStep1(container) {
  const shopPhotos = STATE.shop?.photos || [];

  container.innerHTML = `
    <div class="mb-6">
      <h2 class="text-xl font-bold text-white mb-1">Select Your Master Barber</h2>
      <p class="text-xs text-slate-400">Shop Location: ${STATE.shop?.fullAddress || STATE.shop?.city || "Saudi Arabia"}</p>
    </div>

    ${shopPhotos.length > 0 ? `
      <div class="mb-6">
        <p class="text-xs font-bold text-[#F59E0B] uppercase tracking-wider mb-2">Salon Gallery & Ambience</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${shopPhotos.slice(0, 4).map((p) => `
            <img src="${p.dataUrl}" alt="Salon photo" class="w-full h-24 object-cover rounded-xl border border-slate-800" />
          `).join("")}
        </div>
      </div>
    ` : ""}

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      ${BARBERS.map((b) => `
        <div data-id="${b.id}" class="barber-card group cursor-pointer p-5 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center space-y-3 ${
          STATE.selectedBarber?.id === b.id
            ? "border-[#F59E0B] bg-[#F59E0B]/10 ring-2 ring-[#F59E0B]/30"
            : "border-slate-800 bg-slate-900/60 hover:border-[#F59E0B]/50"
        }">
          <img src="${b.avatar || b.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}" alt="${b.name}" class="w-20 h-20 rounded-full object-cover border-2 border-[#F59E0B]/40 group-hover:scale-105 transition-transform" />
          <div>
            <h3 class="font-bold text-white text-sm">${b.name}</h3>
            <span class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
              ★ ${b.rating || 5.0} Rating
            </span>
          </div>
          <button class="w-full py-2 bg-slate-800 group-hover:bg-[#F59E0B] group-hover:text-slate-950 text-xs font-bold rounded-xl transition">
            Choose Barber
          </button>
        </div>
      `).join("")}
    </div>
  `;

  container.querySelectorAll(".barber-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      STATE.selectedBarber = BARBERS.find((b) => String(b.id) === String(id)) || BARBERS[0];
      STATE.step = 2;
      renderStep();
    });
  });
}

/* ---------------- STEP 2: SERVICES ---------------- */
function renderStep2(container) {
  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Select Service</h2>
        <p class="text-xs text-slate-400">Chosen Barber: <strong class="text-[#F59E0B]">${STATE.selectedBarber.name}</strong></p>
      </div>
      <button id="back-to-1" class="text-xs text-slate-400 hover:text-white transition">← Change Barber</button>
    </div>

    <div class="space-y-3">
      ${SERVICES.map((s) => `
        <div data-id="${s.id}" class="service-card cursor-pointer p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
          STATE.selectedService?.id === s.id
            ? "border-[#F59E0B] bg-[#F59E0B]/10 ring-2 ring-[#F59E0B]/30"
            : "border-slate-800 bg-slate-900/60 hover:border-[#F59E0B]/50"
        }">
          <div>
            <h3 class="font-bold text-white text-base">${s.name}</h3>
            <p class="text-xs text-slate-400 mt-1">${s.desc || ""}</p>
            <span class="inline-block mt-2 text-[10px] font-semibold bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md">
              ⏱ ${s.duration} minutes
            </span>
          </div>
          <div class="text-right flex flex-col items-end">
            <span class="text-xl font-extrabold text-[#F59E0B]">${s.price} SAR</span>
            <button class="mt-2 px-4 py-1.5 bg-[#F59E0B] text-slate-950 font-bold text-xs rounded-xl hover:opacity-90 transition">
              Select
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  document.getElementById("back-to-1").addEventListener("click", () => {
    STATE.step = 1;
    renderStep();
  });

  container.querySelectorAll(".service-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      STATE.selectedService = SERVICES.find((s) => String(s.id) === String(id)) || SERVICES[0];
      STATE.step = 3;
      renderStep();
    });
  });
}

/* ---------------- STEP 3: DATE & SLOT GRID ---------------- */
function renderStep3(container) {
  const existingBookings = Store.getBookings(STATE.shopSlug);

  container.innerHTML = `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Select Date & Time Slot</h2>
        <p class="text-xs text-slate-400">${STATE.selectedService.name} (${STATE.selectedService.duration} mins)</p>
      </div>
      <button id="back-to-2" class="text-xs text-slate-400 hover:text-white transition">← Back to Services</button>
    </div>

    <!-- Date Picker Input -->
    <div class="mb-6 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
      <label class="text-xs text-slate-400 block mb-1 font-medium">Select Booking Date</label>
      <input type="date" id="date-picker" value="${STATE.selectedDate}" class="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#F59E0B]" />
    </div>

    <!-- Bucket Slots -->
    <div class="space-y-6">
      ${["morning", "afternoon", "evening"].map((bucket) => `
        <div>
          <h3 class="text-xs uppercase tracking-wider text-[#F59E0B] font-bold mb-3">${bucket.toUpperCase()} SLOTS</h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            ${DEFAULT_SLOTS[bucket].map((slot) => {
              const isBooked = existingBookings.some(
                (b) => b.barber === STATE.selectedBarber.name && b.time === slot.time && b.date === STATE.selectedDate
              );
              return `
                <button data-time="${slot.time}" ${isBooked ? "disabled" : ""} class="slot-btn py-3 px-4 rounded-xl font-semibold text-xs border transition-all ${
                  isBooked
                    ? "bg-slate-900/40 text-slate-600 border-slate-800/40 cursor-not-allowed"
                    : STATE.selectedSlot === slot.time
                    ? "bg-[#F59E0B] text-slate-950 border-[#F59E0B] font-bold shadow-lg"
                    : "bg-slate-900 text-slate-200 border-slate-800 hover:border-[#F59E0B] hover:text-[#F59E0B]"
                }">
                  ${slot.time}
                  ${isBooked ? `<span class="block text-[9px] font-normal text-slate-600">Booked</span>` : `<span class="block text-[9px] font-semibold text-emerald-400">Available</span>`}
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;

  document.getElementById("back-to-2").addEventListener("click", () => {
    STATE.step = 2;
    renderStep();
  });

  document.getElementById("date-picker").addEventListener("change", (e) => {
    STATE.selectedDate = e.target.value;
    renderStep3(container);
  });

  container.querySelectorAll(".slot-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      STATE.selectedSlot = btn.getAttribute("data-time");
      startHoldTimer();
      STATE.step = 4;
      renderStep();
    });
  });
}

/* ---------------- STEP 4: CUSTOMER FORM ---------------- */
function renderStep4(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto space-y-6">
      <div class="text-center">
        <h2 class="text-xl font-bold text-white">Customer Information</h2>
        <p class="text-xs text-slate-400 mt-1">Provide your contact details to reserve your appointment</p>
      </div>

      <form id="customer-form" class="space-y-4 bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
          <input type="text" id="cust-name" required value="${STATE.customer.fullName}" placeholder="e.g. Mohammed Al-Ghamdi" class="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#F59E0B]" />
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Saudi Mobile Number (05XXXXXXXX)</label>
          <input type="tel" id="cust-phone" required maxlength="10" value="${STATE.customer.phone}" placeholder="05XXXXXXXX" class="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#F59E0B] font-mono tracking-wider" />
          <p class="text-[10px] text-slate-400 mt-1">Format: 10-digit Saudi mobile starting with 05 (without 00966 or +966)</p>
          <p id="phone-error" class="hidden text-[11px] text-red-400 font-semibold mt-1">⚠️ Invalid Saudi phone format. Please enter a 10-digit number starting with 05 (e.g. 0512345678) without 00966 or country code.</p>
        </div>

        <button type="submit" class="w-full py-3 bg-[#F59E0B] text-slate-950 font-bold text-xs rounded-xl hover:bg-[#D97706] transition shadow-lg shadow-[#F59E0B]/20">
          Confirm Appointment
        </button>
      </form>
    </div>
  `;

  const phoneInput = document.getElementById("cust-phone");
  const phoneError = document.getElementById("phone-error");

  // Real-time auto-cleaning: strip country codes if typed or pasted
  phoneInput.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\s+/g, "");
    if (val.startsWith("+966")) val = "0" + val.slice(4);
    else if (val.startsWith("00966")) val = "0" + val.slice(5);
    else if (val.startsWith("966") && val.length > 9) val = "0" + val.slice(3);

    e.target.value = val;
    phoneError.classList.add("hidden");
  });

  document.getElementById("customer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cust-name").value.trim();
    const phone = document.getElementById("cust-phone").value.trim();

    // Strict Saudi Phone Regex (without 00966 / +966 / 966)
    const SAUDI_PHONE_REGEX = /^05[0-9]{8}$/;
    if (!SAUDI_PHONE_REGEX.test(phone)) {
      phoneError.classList.remove("hidden");
      return;
    }
    phoneError.classList.add("hidden");

    STATE.customer.fullName = name;
    STATE.customer.phone = phone;

    // Persist real booking to Store & sync real-time
    Store.addBooking({
      shopSlug: STATE.shopSlug,
      barber: STATE.selectedBarber.name,
      time: STATE.selectedSlot,
      date: STATE.selectedDate,
      customerName: STATE.customer.fullName,
      customerPhone: STATE.customer.phone,
      service: STATE.selectedService.name,
      price: STATE.selectedService.price
    });

    STATE.step = 5;
    renderStep();
  });
}

/* ---------------- STEP 5: CONFIRMATION & QR ---------------- */
function renderStep5(container) {
  clearInterval(STATE.timerInterval);
  document.getElementById("hold-timer-container").classList.add("hidden");
  document.getElementById("timer-bar-container").classList.add("hidden");

  container.innerHTML = `
    <div class="max-w-md mx-auto text-center space-y-6">
      <div class="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 text-2xl font-bold">
        ✓
      </div>
      <h2 class="text-2xl font-extrabold text-white">Booking Confirmed!</h2>
      <p class="text-xs text-slate-400">Your appointment at <strong class="text-white">${STATE.shop?.name}</strong> has been successfully scheduled.</p>

      <!-- Summary Card -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-left space-y-3">
        <div class="flex justify-between text-xs py-1 border-b border-slate-800">
          <span class="text-slate-400">Shop</span>
          <span class="font-bold text-white">${STATE.shop?.name}</span>
        </div>
        <div class="flex justify-between text-xs py-1 border-b border-slate-800">
          <span class="text-slate-400">Customer Name</span>
          <span class="font-bold text-white">${STATE.customer.fullName}</span>
        </div>
        <div class="flex justify-between text-xs py-1 border-b border-slate-800">
          <span class="text-slate-400">Saudi Phone</span>
          <span class="font-bold text-white font-mono">${STATE.customer.phone}</span>
        </div>
        <div class="flex justify-between text-xs py-1 border-b border-slate-800">
          <span class="text-slate-400">Barber</span>
          <span class="font-bold text-white">${STATE.selectedBarber.name}</span>
        </div>
        <div class="flex justify-between text-xs py-1 border-b border-slate-800">
          <span class="text-slate-400">Service</span>
          <span class="font-bold text-white">${STATE.selectedService.name}</span>
        </div>
        <div class="flex justify-between text-xs py-1 border-b border-slate-800">
          <span class="text-slate-400">Date & Time</span>
          <span class="font-bold text-[#F59E0B]">${STATE.selectedDate} @ ${STATE.selectedSlot}</span>
        </div>
        <div class="flex justify-between text-xs py-1">
          <span class="text-slate-400">Total Price</span>
          <span class="font-extrabold text-white text-sm">${STATE.selectedService.price} SAR</span>
        </div>
      </div>

      <!-- Action Triggers -->
      <div class="flex flex-col sm:flex-row gap-3 pt-2">
        <button id="download-ics" class="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition">
          📅 Download .ics Calendar
        </button>
        <button id="download-qr" class="flex-1 py-3 bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-bold text-xs rounded-xl transition">
          📱 Download Entry QR Code
        </button>
      </div>
    </div>
  `;

  document.getElementById("download-ics").addEventListener("click", downloadIcs);
  document.getElementById("download-qr").addEventListener("click", downloadQr);
}

/* ---------------- 5-MINUTE HOLD TIMER LOGIC ---------------- */
function startHoldTimer() {
  STATE.timerSeconds = 300;
  const timerContainer = document.getElementById("hold-timer-container");
  const timerBarContainer = document.getElementById("timer-bar-container");
  const timerDisplay = document.getElementById("timer-display");
  const timerProgress = document.getElementById("timer-progress");

  timerContainer.classList.remove("hidden");
  timerContainer.classList.add("flex");
  timerBarContainer.classList.remove("hidden");

  clearInterval(STATE.timerInterval);
  STATE.timerInterval = setInterval(() => {
    STATE.timerSeconds--;
    if (STATE.timerSeconds <= 0) {
      clearInterval(STATE.timerInterval);
      alert("Your 5-minute slot hold has expired. Please select a slot again.");
      STATE.step = 3;
      renderStep();
      return;
    }

    const m = Math.floor(STATE.timerSeconds / 60);
    const s = STATE.timerSeconds % 60;
    timerDisplay.innerText = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    const percent = (STATE.timerSeconds / 300) * 100;
    timerProgress.style.width = `${percent}%`;
  }, 1000);
}

/* ---------------- ICS & QR ACTIONS ---------------- */
function downloadIcs() {
  const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BarberApp//NONSGML Booking//EN
BEGIN:VEVENT
UID:booking-${Date.now()}@barberapp.sa
DTSTAMP:20260917T210000Z
DTSTART:20261015T140000Z
DTEND:20261015T143000Z
SUMMARY:${STATE.selectedService.name} with ${STATE.selectedBarber.name}
DESCRIPTION:Appointment at ${STATE.shop?.name}. Service: ${STATE.selectedService.name}
LOCATION:${STATE.shop?.fullAddress || "Riyadh"}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${STATE.shopSlug}.ics`;
  a.click();
}

function downloadQr() {
  const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#0B0F17"/><text x="50%" y="50%" fill="#F59E0B" font-size="14" text-anchor="middle" dominant-baseline="middle">ENTRY QR: ${STATE.shopSlug}</text></svg>`;
  const blob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shop-qr-${STATE.shopSlug}.svg`;
  a.click();
}

