/**
 * Shop Onboarding, Photos Auto-Compression, Barbers & Services Manager
 */

import { Store } from "./store.js";
import { QrHelper } from "./qr-helper.js";

const SAUDI_PHONE_REGEX = /^05[0-9]{8}$/;

export const DEFAULT_BARBER_AVATAR = "./src/images/default-avatar.svg";

let UPLOADED_PHOTOS = [];
let BARBERS = [
  { id: 1, name: "Master Barber Ahmed", photoUrl: "" },
  { id: 2, name: "Sami Al-Otaibi", photoUrl: "" }
];

let SERVICES = [
  { id: 1, name: "Haircut & Styling", duration: 30, price: 60, desc: "Classic or modern haircut with hot towel finish" },
  { id: 2, name: "Beard Sculpting & Trim", duration: 25, price: 40, desc: "Beard shaping, razor line-up, and beard oil treatment" }
];

document.addEventListener("DOMContentLoaded", () => {
  Store.init();
  initPhotosUpload();
  renderBarbersList();
  renderServicesList();
  initFormSubmission();
});

/* ---------------- PHOTO UPLOAD & AUTO-COMPRESSION ---------------- */
function initPhotosUpload() {
  const photoInput = document.getElementById("salon-photos");
  const countBadge = document.getElementById("photo-count-badge");

  photoInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);

    if (UPLOADED_PHOTOS.length + files.length > 10) {
      alert("Maximum 10 photos allowed per shop.");
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} exceeds 5MB limit.`);
        continue;
      }

      // Auto-compress large image files
      const compressedFile = await compressImage(file, 1200, 0.75);
      const dataUrl = await readFileAsDataURL(compressedFile);

      UPLOADED_PHOTOS.push({
        id: Date.now() + Math.random(),
        name: file.name,
        originalSize: (file.size / 1024).toFixed(1) + " KB",
        compressedSize: (compressedFile.size / 1024).toFixed(1) + " KB",
        dataUrl
      });
    }

    renderPhotosPreview();
  });
}

function renderPhotosPreview() {
  const grid = document.getElementById("photos-preview-grid");
  const countBadge = document.getElementById("photo-count-badge");
  countBadge.innerText = `${UPLOADED_PHOTOS.length} / 10 Photos Uploaded`;

  grid.innerHTML = UPLOADED_PHOTOS.map((photo, idx) => `
    <div class="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900 aspect-square shadow-md">
      <img src="${photo.dataUrl}" alt="${photo.name}" class="w-full h-full object-cover" />
      <button type="button" data-idx="${idx}" class="remove-photo-btn absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg hover:bg-red-600 transition">
        ✕
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-slate-950/80 p-1 text-[9px] text-slate-300 text-center truncate">
        ${photo.compressedSize}
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".remove-photo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      UPLOADED_PHOTOS.splice(idx, 1);
      renderPhotosPreview();
    });
  });
}

function compressImage(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    if (file.size < 400 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

/* ---------------- DYNAMIC BARBERS MANAGEMENT ---------------- */
function renderBarbersList() {
  const container = document.getElementById("barbers-list-container");
  container.innerHTML = BARBERS.map((barber, idx) => {
    const avatarSrc = (barber.photoUrl && !barber.photoUrl.includes("unsplash.com")) ? barber.photoUrl : DEFAULT_BARBER_AVATAR;
    const hasCustomPhoto = Boolean(barber.photoUrl && !barber.photoUrl.includes("unsplash.com"));

    return `
      <div class="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3 flex-1">
          <!-- Avatar Preview & Upload Trigger -->
          <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#F59E0B]/40 bg-slate-950 relative group cursor-pointer shadow-md flex items-center justify-center" title="Click to upload barber photo">
            <img src="${avatarSrc}" alt="${barber.name}" onerror="this.onerror=null;this.src='./src/images/default-avatar.svg';" class="w-full h-full object-cover" />
            <label class="absolute inset-0 rounded-full bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold cursor-pointer transition">
              📷
              <input type="file" accept="image/*" data-idx="${idx}" class="barber-photo-input hidden" />
            </label>
          </div>

          <!-- Name & Upload Photo Button -->
          <div class="flex-1 space-y-1">
            <input type="text" value="${barber.name}" data-idx="${idx}" class="barber-name-input w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#F59E0B]" placeholder="Barber Full Name" />
            <div class="flex items-center gap-2 text-[10px]">
              <label class="text-[#F59E0B] hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                <span>📷 ${hasCustomPhoto ? "Change Photo" : "Upload Photo (Optional)"}</span>
                <input type="file" accept="image/*" data-idx="${idx}" class="barber-photo-input hidden" />
              </label>
              ${hasCustomPhoto ? `
                <button type="button" data-idx="${idx}" class="remove-barber-photo-btn text-red-400 hover:underline">
                  ✕ Remove Photo
                </button>
              ` : `
                <span class="text-slate-500 font-mono">Default avatar</span>
              `}
            </div>
          </div>
        </div>

        <button type="button" data-idx="${idx}" class="remove-barber-btn px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold text-xs rounded-xl transition self-end sm:self-center">
          Remove
        </button>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".barber-name-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(input.getAttribute("data-idx"));
      BARBERS[idx].name = e.target.value;
    });
  });

  // Handle photo upload per barber
  container.querySelectorAll(".barber-photo-input").forEach((input) => {
    input.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const idx = parseInt(input.getAttribute("data-idx"));
      try {
        const compressed = await compressImage(file, 400, 0.8);
        const dataUrl = await readFileAsDataURL(compressed);
        BARBERS[idx].photoUrl = dataUrl;
        BARBERS[idx].avatar = dataUrl;
        renderBarbersList();
      } catch (err) {
        console.error("Error uploading barber photo:", err);
      }
    });
  });

  // Handle remove photo per barber
  container.querySelectorAll(".remove-barber-photo-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      BARBERS[idx].photoUrl = "";
      BARBERS[idx].avatar = "";
      renderBarbersList();
    });
  });

  container.querySelectorAll(".remove-barber-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      BARBERS.splice(idx, 1);
      renderBarbersList();
    });
  });
}

document.getElementById("add-barber-btn")?.addEventListener("click", () => {
  BARBERS.push({ id: Date.now(), name: `Barber ${BARBERS.length + 1}`, photoUrl: "" });
  renderBarbersList();
});

/* ---------------- DYNAMIC SERVICES MANAGEMENT ---------------- */
function renderServicesList() {
  const container = document.getElementById("services-list-container");
  container.innerHTML = SERVICES.map((service, idx) => `
    <div class="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
      <div class="flex items-center justify-between gap-3">
        <input type="text" value="${service.name}" data-idx="${idx}" class="service-name-input font-bold text-white bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs flex-1 focus:outline-none focus:border-[#F59E0B]" placeholder="Service Name" />
        <button type="button" data-idx="${idx}" class="remove-service-btn px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold text-xs rounded-xl transition">
          Remove
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label class="text-[10px] text-slate-400 block mb-1">Duration (minutes)</label>
          <input type="number" value="${service.duration}" data-idx="${idx}" class="service-duration-input w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1 text-xs focus:outline-none focus:border-[#F59E0B]" />
        </div>
        <div>
          <label class="text-[10px] text-slate-400 block mb-1">Price (SAR)</label>
          <input type="number" value="${service.price}" data-idx="${idx}" class="service-price-input w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1 text-xs focus:outline-none focus:border-[#F59E0B]" />
        </div>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".service-name-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(input.getAttribute("data-idx"));
      SERVICES[idx].name = e.target.value;
    });
  });

  container.querySelectorAll(".service-duration-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(input.getAttribute("data-idx"));
      SERVICES[idx].duration = parseInt(e.target.value) || 30;
    });
  });

  container.querySelectorAll(".service-price-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(input.getAttribute("data-idx"));
      SERVICES[idx].price = parseFloat(e.target.value) || 0;
    });
  });

  container.querySelectorAll(".remove-service-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      SERVICES.splice(idx, 1);
      renderServicesList();
    });
  });
}

document.getElementById("add-service-btn")?.addEventListener("click", () => {
  SERVICES.push({ id: Date.now(), name: `New Service ${SERVICES.length + 1}`, duration: 30, price: 50 });
  renderServicesList();
});

/* ---------------- FORM SUBMISSION ---------------- */
function initFormSubmission() {
  const form = document.getElementById("onboarding-form");
  const phoneInput = document.getElementById("phone");
  const phoneErr = document.getElementById("phone-err");
  const modal = document.getElementById("success-modal");
  const publicLink = document.getElementById("public-link");
  const bookingBtn = document.getElementById("booking-btn");

  // Radio card interactive selection styling for Payment Method
  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".pay-method-card").forEach((card) => {
        card.classList.remove("border-[#F59E0B]", "bg-[#F59E0B]/10");
        card.classList.add("border-slate-800", "bg-slate-900/60");
      });
      const selected = radio.closest(".pay-method-card");
      if (selected) {
        selected.classList.remove("border-slate-800", "bg-slate-900/60");
        selected.classList.add("border-[#F59E0B]", "bg-[#F59E0B]/10");
      }
    });
  });

  // Radio card interactive selection styling for Subscription Plan
  document.querySelectorAll('input[name="subscriptionPlan"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".plan-card").forEach((card) => {
        card.classList.remove("border-[#F59E0B]", "bg-[#F59E0B]/10");
        card.classList.add("border-slate-800", "bg-slate-900/60");
      });
      const selected = radio.closest(".plan-card");
      if (selected) {
        selected.classList.remove("border-slate-800", "bg-slate-900/60");
        selected.classList.add("border-[#F59E0B]", "bg-[#F59E0B]/10");
      }
    });
  });

  phoneInput?.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\s+/g, "");
    if (val.startsWith("+966")) val = "0" + val.slice(4);
    else if (val.startsWith("00966")) val = "0" + val.slice(5);
    else if (val.startsWith("966") && val.length > 9) val = "0" + val.slice(3);
    e.target.value = val;
    if (phoneErr) phoneErr.classList.add("hidden");
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = phoneInput ? phoneInput.value.trim() : "";
    if (!SAUDI_PHONE_REGEX.test(phone)) {
      if (phoneErr) phoneErr.classList.remove("hidden");
      phoneInput?.focus();
      return;
    }
    if (phoneErr) phoneErr.classList.add("hidden");

    const ownerFullName = document.getElementById("ownerFullName")?.value.trim() || "";
    const ownerEmail = document.getElementById("ownerEmail")?.value.trim() || "";
    const shopName = document.getElementById("shopName")?.value.trim() || "";
    const region = document.getElementById("region")?.value.trim() || "";
    const district = document.getElementById("district")?.value.trim() || "";
    const city = document.getElementById("city")?.value.trim() || "";
    const fullAddress = document.getElementById("fullAddress")?.value.trim() || "";
    const mapAddress = document.getElementById("mapAddress")?.value.trim() || "";
    const subscriptionPlan = document.querySelector('input[name="subscriptionPlan"]:checked')?.value || "MONTHLY";
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "CASH";

    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "golden-scissors";

    // Build real Shop Object
    const newShop = {
      id: "shop-" + Date.now(),
      slug,
      name: shopName,
      owner: ownerFullName,
      ownerEmail,
      phone,
      city,
      district,
      region,
      fullAddress,
      mapAddress,
      photos: UPLOADED_PHOTOS,
      plan: subscriptionPlan,
      paymentMethod,
      status: "ACTIVE",
      registeredAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      barbers: BARBERS.map((b, i) => ({
        id: b.id || (i + 1),
        name: b.name,
        rating: 5.0,
        avatar: (b.photoUrl && !b.photoUrl.includes("unsplash.com")) ? b.photoUrl : "",
        photoUrl: (b.photoUrl && !b.photoUrl.includes("unsplash.com")) ? b.photoUrl : ""
      })),
      services: SERVICES.map((s, i) => ({
        id: s.id || (101 + i),
        name: s.name,
        duration: parseInt(s.duration) || 30,
        price: parseFloat(s.price) || 50,
        desc: s.desc || `${s.name} - ${s.duration} mins`
      }))
    };

    // URLs
    const origin = window.location.origin || "http://localhost:3000";
    const loginUrl = `${origin}/dashboard/index.html?slug=${slug}`;
    const bookingUrl = `${origin}/booking.html?slug=${slug}`;

    newShop.loginUrl = loginUrl;
    newShop.bookingUrl = bookingUrl;

    // Record subscription payment in central store
    Store.addPayment({
      salonName: shopName,
      salonSlug: slug,
      amount: subscriptionPlan === "YEARLY" ? 200 : 20,
      currency: "SAR",
      plan: subscriptionPlan,
      provider: paymentMethod === "CASH" ? "Cash" : "STC Pay",
      status: "COMPLETED"
    });

    // Send to backend API
    let registeredShopId = null;
    try {
      const ownerPassword = document.getElementById("ownerPassword")?.value.trim() || "Owner123!";
      const backendPayload = {
        ownerFullName,
        ownerEmail,
        ownerPassword,
        shopName,
        phone,
        region,
        district,
        city,
        fullAddress,
        mapAddress,
        subscriptionPlan
      };
      const response = await fetch("http://localhost:8080/api/shops/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backendPayload)
      });
      if (response.ok) {
        const backendShop = await response.json();
        registeredShopId = backendShop.id;
        newShop.id = backendShop.id;
      }
    } catch {
      console.log("Backend offline or registration saved to client store successfully.");
    }

    // Render Dual QR Codes into Success Modal
    const loginQrRes = await QrHelper.renderQr("#modal-login-qr-container", loginUrl, 160);
    const bookingQrRes = await QrHelper.renderQr("#modal-booking-qr-container", bookingUrl, 160);

    newShop.loginQrCodeData = loginQrRes?.pngDataUrl;
    newShop.bookingQrCodeData = bookingQrRes?.pngDataUrl;
    newShop.loginQrSvg = loginQrRes?.svgString;
    newShop.bookingQrSvg = bookingQrRes?.svgString;

    // Save to central reactive store with QR persistence
    Store.saveShop(newShop);

    // Update Modal Note
    const modalPaymentNote = document.getElementById("modal-payment-note");
    if (modalPaymentNote) {
      modalPaymentNote.innerText = `Payment Method: ${paymentMethod === "CASH" ? "Pay by Cash" : "Via STC Pay"} • Status: ACTIVE • QR Codes Generated`;
    }

    // Populate Readable Links Text
    const loginLinkTextEl = document.getElementById("modal-login-link-text");
    if (loginLinkTextEl) loginLinkTextEl.innerText = loginUrl;

    const bookingLinkTextEl = document.getElementById("modal-booking-link-text");
    if (bookingLinkTextEl) bookingLinkTextEl.innerText = bookingUrl;

    // Wire Copy buttons
    document.getElementById("copy-login-link-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      QrHelper.copyText(loginUrl, e.currentTarget);
    });

    document.getElementById("copy-booking-link-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      QrHelper.copyText(bookingUrl, e.currentTarget);
    });

    // Wire Download Individual PNG/SVG buttons
    document.getElementById("download-login-png-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      QrHelper.downloadPng(loginQrRes?.pngDataUrl, `${slug}-login-qr.png`);
    });

    document.getElementById("download-login-svg-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      QrHelper.downloadSvg(loginQrRes?.svgString, `${slug}-login-qr.svg`);
    });

    document.getElementById("download-booking-png-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      QrHelper.downloadPng(bookingQrRes?.pngDataUrl, `${slug}-booking-qr.png`);
    });

    document.getElementById("download-booking-svg-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      QrHelper.downloadSvg(bookingQrRes?.svgString, `${slug}-booking-qr.svg`);
    });

    // Wire Bulk Download ZIP button
    document.getElementById("download-both-zip-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      QrHelper.downloadZip({
        filename: `${slug}-qr-codes.zip`,
        shopName,
        slug,
        loginUrl,
        bookingUrl,
        loginPng: loginQrRes?.pngDataUrl,
        bookingPng: bookingQrRes?.pngDataUrl,
        loginSvg: loginQrRes?.svgString,
        bookingSvg: bookingQrRes?.svgString,
        shopId: registeredShopId
      });
    });

    // Wire Download Links (.txt) button
    document.getElementById("download-links-txt-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const txtContent = `=====================================================
Salon Name: ${shopName}
Salon Slug: ${slug}
Registered At: ${new Date().toISOString()}
=====================================================

1. PRIVATE SALON LOGIN & DASHBOARD LINK:
${loginUrl}

2. PUBLIC CUSTOMER BOOKING LINK:
${bookingUrl}

Barber SaaS Platform • Saudi Arabia & GCC
`;
      QrHelper.downloadText(txtContent, `${slug}-links.txt`);
    });

    // Navigation buttons
    const visitBookingBtn = document.getElementById("modal-visit-booking-btn");
    if (visitBookingBtn) visitBookingBtn.href = bookingUrl;

    const openScheduleBtn = document.getElementById("modal-open-schedule-btn");
    if (openScheduleBtn) openScheduleBtn.href = loginUrl;

    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    }
  });
}

