/**
 * Shop Onboarding, Photos Auto-Compression, Barbers & Services Manager
 */

import { Store } from "./store.js";

const SAUDI_PHONE_REGEX = /^05[0-9]{8}$/;

let UPLOADED_PHOTOS = [];
let BARBERS = [
  { id: 1, name: "Master Barber Ahmed", photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" },
  { id: 2, name: "Sami Al-Otaibi", photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" }
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
  container.innerHTML = BARBERS.map((barber, idx) => `
    <div class="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 flex-1">
        <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-[#F59E0B] border border-[#F59E0B]/30">
          ✂️
        </div>
        <input type="text" value="${barber.name}" data-idx="${idx}" class="barber-name-input w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#F59E0B]" placeholder="Barber Full Name" />
      </div>
      <button type="button" data-idx="${idx}" class="remove-barber-btn px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold text-xs rounded-xl transition">
        Remove
      </button>
    </div>
  `).join("");

  container.querySelectorAll(".barber-name-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = parseInt(input.getAttribute("data-idx"));
      BARBERS[idx].name = e.target.value;
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
  BARBERS.push({ id: Date.now(), name: `Barber ${BARBERS.length + 1}` });
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
  phoneInput?.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\s+/g, "");
    if (val.startsWith("+966")) val = "0" + val.slice(4);
    else if (val.startsWith("00966")) val = "0" + val.slice(5);
    else if (val.startsWith("966") && val.length > 9) val = "0" + val.slice(3);
    e.target.value = val;
    phoneErr.classList.add("hidden");
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const phone = phoneInput.value.trim();
    if (!SAUDI_PHONE_REGEX.test(phone)) {
      phoneErr.classList.remove("hidden");
      phoneInput.focus();
      return;
    }
    phoneErr.classList.add("hidden");

    const ownerFullName = document.getElementById("ownerFullName").value.trim();
    const ownerEmail = document.getElementById("ownerEmail").value.trim();
    const shopName = document.getElementById("shopName").value.trim();
    const region = document.getElementById("region").value.trim();
    const district = document.getElementById("district").value.trim();
    const city = document.getElementById("city").value.trim();
    const fullAddress = document.getElementById("fullAddress").value.trim();
    const mapAddress = document.getElementById("mapAddress").value.trim();
    const subscriptionPlan = document.querySelector('input[name="subscriptionPlan"]:checked')?.value || "MONTHLY";

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
      status: "ACTIVE",
      registeredAt: new Date().toISOString().replace("T", " ").substring(0, 19),
      barbers: BARBERS.map((b, i) => ({
        id: b.id || (i + 1),
        name: b.name,
        rating: 5.0,
        avatar: b.photoUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
      })),
      services: SERVICES.map((s, i) => ({
        id: s.id || (101 + i),
        name: s.name,
        duration: parseInt(s.duration) || 30,
        price: parseFloat(s.price) || 50,
        desc: s.desc || `${s.name} - ${s.duration} mins`
      }))
    };

    // Save to central reactive store
    Store.saveShop(newShop);

    // Optional fetch call to backend API if live
    try {
      await fetch("/api/shops/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newShop)
      });
    } catch {
      console.log("Backend offline, shop saved to client store successfully.");
    }

    const bookingUrl = `${window.location.origin}/book.html?slug=${slug}`;
    publicLink.innerText = bookingUrl;
    publicLink.href = bookingUrl;
    bookingBtn.href = bookingUrl;

    const scheduleBtn = modal.querySelector('a[href="./dashboard/index.html"]');
    if (scheduleBtn) {
      scheduleBtn.href = `./dashboard/index.html?slug=${slug}`;
    }

    // Show Success Modal
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  });
}

