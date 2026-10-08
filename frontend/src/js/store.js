/**
 * Centralized Store & Real-Time Sync Engine for Barber SaaS
 * Manages Shops, Barbers, Services, Bookings, Audit Logs, and Cross-Tab Real-Time Events
 */

const STORAGE_KEYS = {
  SHOPS: "barber_saas_shops",
  BOOKINGS: "barber_saas_bookings",
  AUDIT_LOGS: "barber_saas_audit_logs",
};

// BroadcastChannel for instant cross-tab sync
const syncChannel = new BroadcastChannel("barber_saas_realtime_channel");

const DEFAULT_SHOPS = [
  {
    id: "shop-1",
    slug: "golden-scissors",
    name: "Golden Scissors Salon",
    owner: "Tariq Al-Mansoor",
    ownerEmail: "owner@goldenscissors.sa",
    phone: "+966501234567",
    city: "Riyadh",
    district: "Olaya",
    region: "Riyadh Region",
    fullAddress: "King Fahd Road, Building 42, Olaya",
    mapAddress: "7JQC+RP Riyadh",
    photos: [],
    plan: "MONTHLY",
    status: "ACTIVE",
    registeredAt: "2026-09-17 10:00:00",
    barbers: [
      { id: 1, name: "Master Barber Ahmed", rating: 4.9, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" },
      { id: 2, name: "Sami Al-Otaibi", rating: 4.8, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" },
      { id: 3, name: "Tariq Mansoor", rating: 4.95, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150" }
    ],
    services: [
      { id: 101, name: "Royal Haircut & Hot Towel", duration: 30, price: 60, desc: "Precision haircut, scalp treatment, and hot towel finish" },
      { id: 102, name: "Beard Sculpting & Razor Line", duration: 25, price: 40, desc: "Beard trim, steam razor line-up, and organic oil treatment" },
      { id: 103, name: "VIP Full Grooming Package", duration: 60, price: 110, desc: "Haircut, beard sculpting, facial scrub, and head massage" }
    ]
  },
  {
    id: "shop-2",
    slug: "royal-barber-lounge",
    name: "Royal Barber Lounge",
    owner: "Fahad Mansoor",
    ownerEmail: "fahad@royallounge.sa",
    phone: "+966509876543",
    city: "Jeddah",
    district: "Al-Hamra",
    region: "Makkah Region",
    fullAddress: "Corniche Road, Building 18",
    mapAddress: "8HPR+2M Jeddah",
    photos: [],
    plan: "YEARLY",
    status: "PENDING",
    registeredAt: "2026-09-17 14:20:00",
    barbers: [
      { id: 10, name: "Khaled Al-Zahrani", rating: 4.7, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150" },
      { id: 11, name: "Omar Al-Ghamdi", rating: 4.9, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150" }
    ],
    services: [
      { id: 201, name: "Classic Haircut", duration: 30, price: 50, desc: "Standard haircut with wash" },
      { id: 202, name: "Beard Trim & Oil", duration: 20, price: 35, desc: "Beard line-up with premium beard oil" }
    ]
  }
];

const DEFAULT_BOOKINGS = [
  { id: 1, shopSlug: "golden-scissors", barber: "Master Barber Ahmed", time: "09:00 AM", date: "2026-09-18", customerName: "Fahad Al-Harbi", customerPhone: "+966501112233", service: "Royal Haircut & Hot Towel", price: 60, status: "CONFIRMED" },
  { id: 2, shopSlug: "golden-scissors", barber: "Sami Al-Otaibi", time: "09:30 AM", date: "2026-09-18", customerName: "Omar Saeed", customerPhone: "+966504445566", service: "Beard Sculpting & Razor Line", price: 40, status: "CONFIRMED" }
];

const DEFAULT_AUDIT_LOGS = [
  { id: 101, timestamp: "2026-09-17 21:30:00", user: "system@barberapp.sa", shop: "Golden Scissors Salon", action: "SHOP_AUTO_APPROVED", details: "Moyasar payment webhook success transaction tx_99812", ip: "192.168.1.1" },
  { id: 102, timestamp: "2026-09-17 18:45:00", user: "owner@goldenscissors.sa", shop: "Golden Scissors Salon", action: "SHOP_REGISTERED", details: "Initial self-registration completed with 3 barbers & 3 services", ip: "172.16.0.22" }
];

export const Store = {
  // Initialize storage if missing
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.SHOPS)) {
      localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(DEFAULT_SHOPS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.BOOKINGS)) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(DEFAULT_BOOKINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(DEFAULT_AUDIT_LOGS));
    }
  },

  getShops() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOPS)) || DEFAULT_SHOPS;
    } catch {
      return DEFAULT_SHOPS;
    }
  },

  getShopBySlug(slug) {
    const shops = this.getShops();
    return shops.find((s) => s.slug === slug) || shops[0];
  },

  saveShop(shop) {
    const shops = this.getShops();
    const existingIdx = shops.findIndex((s) => s.slug === shop.slug || s.id === shop.id);
    if (existingIdx >= 0) {
      shops[existingIdx] = { ...shops[existingIdx], ...shop };
    } else {
      shops.unshift(shop);
    }
    localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(shops));

    // Audit Log
    this.addAuditLog(shop.ownerEmail || "owner@barber.sa", shop.name, "SHOP_REGISTERED", `Onboarding completed with ${shop.barbers?.length || 0} barbers & ${shop.services?.length || 0} services`);

    // Broadcast Real-Time Update
    this.notify("SHOP_REGISTERED", shop);
  },

  updateShopStatus(idOrSlug, status) {
    const shops = this.getShops();
    const target = shops.find((s) => s.id === idOrSlug || s.slug === idOrSlug);
    if (target) {
      target.status = status;
      localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(shops));
      this.addAuditLog("admin@barberapp.sa", target.name, `SHOP_STATUS_${status}`, `Manual admin override status update to ${status}`);
      this.notify("SHOP_STATUS_CHANGED", target);
    }
  },

  getBookings(shopSlug = null) {
    this.init();
    try {
      const bookings = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS)) || DEFAULT_BOOKINGS;
      if (shopSlug) {
        return bookings.filter((b) => b.shopSlug === shopSlug);
      }
      return bookings;
    } catch {
      return DEFAULT_BOOKINGS;
    }
  },

  addBooking(booking) {
    const bookings = this.getBookings();
    const newBooking = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: "CONFIRMED",
      ...booking
    };
    bookings.unshift(newBooking);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));

    const shop = this.getShopBySlug(booking.shopSlug);
    this.addAuditLog(booking.customerPhone || "customer", shop ? shop.name : booking.shopSlug, "BOOKING_CONFIRMED", `Slot ${booking.time} reserved with ${booking.barber} for ${booking.service}`);

    // Broadcast Real-Time Event
    this.notify("NEW_BOOKING", newBooking);
    return newBooking;
  },

  getAuditLogs() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) || DEFAULT_AUDIT_LOGS;
    } catch {
      return DEFAULT_AUDIT_LOGS;
    }
  },

  addAuditLog(user, shop, action, details) {
    const logs = this.getAuditLogs();
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      user,
      shop,
      action,
      details,
      ip: "127.0.0.1"
    };
    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  },

  notify(eventType, payload) {
    const eventData = { eventType, payload, timestamp: Date.now() };
    syncChannel.postMessage(eventData);
    window.dispatchEvent(new CustomEvent("barber_saas_update", { detail: eventData }));
  },

  subscribe(callback) {
    const handler = (e) => callback(e.detail);
    window.addEventListener("barber_saas_update", handler);

    const channelHandler = (e) => callback(e.data);
    syncChannel.addEventListener("message", channelHandler);

    const storageHandler = (e) => {
      if (e.key && e.key.startsWith("barber_saas_")) {
        callback({ eventType: "STORAGE_SYNC", timestamp: Date.now() });
      }
    };
    window.addEventListener("storage", storageHandler);

    return () => {
      window.removeEventListener("barber_saas_update", handler);
      syncChannel.removeEventListener("message", channelHandler);
      window.removeEventListener("storage", storageHandler);
    };
  }
};
