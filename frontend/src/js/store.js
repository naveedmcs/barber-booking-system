/**
 * Centralized Store & Real-Time Sync Engine for Barber SaaS
 * Manages Shops, Barbers, Services, Bookings, Audit Logs, and Cross-Tab Real-Time Events
 */

const STORAGE_KEYS = {
  SHOPS: "barber_saas_shops",
  BOOKINGS: "barber_saas_bookings",
  AUDIT_LOGS: "barber_saas_audit_logs",
  PAYMENTS: "barber_saas_payments",
  USER_LOGINS: "barber_saas_user_logins",
  SETTINGS: "barber_saas_system_settings",
  ADMIN_USERS: "barber_saas_admin_users",
  ADMIN_ROLES: "barber_saas_admin_roles"
};

export const DEFAULT_SYSTEM_SETTINGS = {
  // 1. General App Config
  platformName: "BarberApp KSA",
  supportEmail: "support@barberapp.sa",
  supportPhone: "+966 50 123 4567",
  timezone: "Asia/Riyadh",
  defaultCurrency: "SAR",
  slotHoldTimeoutMinutes: 5,
  maintenanceMode: false,
  maintenanceNotice: "Scheduled platform upgrade in progress. Normal operations will resume shortly.",

  // 2. Billing / Tax Settings
  vatRate: 15.0,
  vatRegistrationNumber: "300123456700003",
  monthlySubscriptionPrice: 20.00,
  yearlySubscriptionPrice: 200.00,
  moyasarGatewayMode: "sandbox",
  moyasarSecretKey: "sk_test_mockKey9981244A7",
  moyasarWebhookSecret: "whsec_liveMockSaudiMada2026",
  autoApprovePaidShops: true,
  invoicePrefix: "INV-KSA-",

  // 3. Notification / SMS Gateway Settings
  smsProvider: "Taqnyat",
  smsApiKey: "tq_live_998124890a",
  smsSenderId: "BarberApp",
  smsEnabled: true,
  smsAppointmentConfirm: true,
  smsReminderHoursBefore: 2,
  smtpHost: "smtp.mail.sa-east.internal",
  smtpPort: 587,
  smtpSenderEmail: "noreply@barberapp.sa",
  emailNotificationsEnabled: true,

  // 4. Feature Flags
  enableMultiBarberSelect: true,
  enableSlotHoldCountdown: true,
  enableWalkinQuickBooking: true,
  enablePublicSalonDirectory: true,
  enableMadaApplePay: true,
  enableDarkThemeDefault: true,
  enableGoogleMapsRouting: true,
  enableAutomatedAuditExport: true
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
    phone: "0501234567",
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
      { id: 1, name: "Master Barber Ahmed", rating: 4.9, avatar: "" },
      { id: 2, name: "Sami Al-Otaibi", rating: 4.8, avatar: "" },
      { id: 3, name: "Tariq Mansoor", rating: 4.95, avatar: "" }
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
    phone: "0509876543",
    city: "Jeddah",
    district: "Al-Hamra",
    region: "Makkah Region",
    fullAddress: "Corniche Road, Building 18",
    mapAddress: "8HPR+2M Jeddah",
    photos: [],
    plan: "YEARLY",
    status: "ACTIVE",
    registeredAt: "2026-09-17 14:20:00",
    barbers: [
      { id: 10, name: "Khaled Al-Zahrani", rating: 4.7, avatar: "" },
      { id: 11, name: "Omar Al-Ghamdi", rating: 4.9, avatar: "" }
    ],
    services: [
      { id: 201, name: "Classic Haircut", duration: 30, price: 50, desc: "Standard haircut with wash" },
      { id: 202, name: "Beard Trim & Oil", duration: 20, price: 35, desc: "Beard line-up with premium beard oil" }
    ]
  },
  {
    id: "shop-3",
    slug: "al-ghamdi-luxury-grooming",
    name: "Al-Ghamdi Luxury Grooming",
    owner: "Abdulrahman Al-Ghamdi",
    ownerEmail: "owner@alghamdi.sa",
    phone: "0541122334",
    city: "Dammam",
    district: "Al-Shati",
    region: "Eastern Province",
    fullAddress: "Prince Mohammed Bin Fahd Road, Al-Shati, Dammam",
    mapAddress: "Dammam Corniche",
    photos: [],
    plan: "MONTHLY",
    status: "ACTIVE",
    registeredAt: "2026-09-18 11:30:00",
    barbers: [
      { id: 21, name: "Yousef Al-Ghamdi", rating: 4.85, avatar: "" }
    ],
    services: [
      { id: 301, name: "Executive Haircut & Beard Trim", duration: 45, price: 75, desc: "Premium styling, hot towel and conditioning" }
    ]
  },
  {
    id: "shop-4",
    slug: "al-raqaqah-executive-grooming",
    name: "Al-Raqaqah Executive Grooming",
    owner: "Majed Al-Mutairi",
    ownerEmail: "owner@alraqaqah.sa",
    phone: "0567788990",
    city: "Riyadh",
    district: "Al-Nakheel",
    region: "Riyadh Region",
    fullAddress: "Northern Ring Branch Rd, Al-Nakheel, Riyadh",
    mapAddress: "Al-Nakheel Plaza",
    photos: [],
    plan: "YEARLY",
    status: "ACTIVE",
    registeredAt: "2026-09-19 15:00:00",
    barbers: [
      { id: 31, name: "Hamad Al-Mutairi", rating: 4.9, avatar: "" }
    ],
    services: [
      { id: 401, name: "Royal Beard Grooming", duration: 30, price: 55, desc: "Steam hot towel, organic oils and razor sculpting" }
    ]
  },
  {
    id: "shop-5",
    slug: "salon-1-hair-cut",
    name: "Salon 1 hair Cut",
    owner: "Rami Haddad",
    ownerEmail: "owner@salon1.sa",
    phone: "0534455667",
    city: "Jeddah",
    district: "Al-Rawdah",
    region: "Makkah Region",
    fullAddress: "Al Kayyal St, Al-Rawdah, Jeddah",
    mapAddress: "Al-Rawdah Commercial",
    photos: [],
    plan: "MONTHLY",
    status: "ACTIVE",
    registeredAt: "2026-09-20 09:15:00",
    barbers: [
      { id: 41, name: "Ziad Haddad", rating: 4.75, avatar: "" }
    ],
    services: [
      { id: 501, name: "Signature Hair Cut & Wash", duration: 30, price: 50, desc: "Precision scissor cut, hair wash and quick blow dry" }
    ]
  }
];

const DEFAULT_BOOKINGS = [];

const DEFAULT_AUDIT_LOGS = [
  { id: 101, timestamp: "2026-10-08 21:30:00", user: "system@barberapp.sa", shop: "Golden Scissors Salon", action: "SHOP_AUTO_APPROVED", details: "Moyasar payment webhook success transaction tx_99812", ip: "192.168.1.1" },
  { id: 102, timestamp: "2026-10-08 18:45:00", user: "owner@goldenscissors.sa", shop: "Golden Scissors Salon", action: "SHOP_REGISTERED", details: "Initial self-registration completed with 3 barbers & 3 services", ip: "172.16.0.22" }
];

const DEFAULT_PAYMENTS = [
  { id: "tx_99812", timestamp: "2026-10-08 21:30:00", salonName: "Golden Scissors Salon", salonSlug: "golden-scissors", amount: 20, currency: "SAR", plan: "MONTHLY", provider: "Moyasar", status: "COMPLETED", invoiceUrl: "#" },
  { id: "tx_99813", timestamp: "2026-10-08 22:15:00", salonName: "Royal Barber Lounge", salonSlug: "royal-barber-lounge", amount: 200, currency: "SAR", plan: "YEARLY", provider: "Moyasar", status: "COMPLETED", invoiceUrl: "#" },
  { id: "tx_99814", timestamp: "2026-10-09 01:10:00", salonName: "Elite Cuts Center", salonSlug: "elite-cuts", amount: 20, currency: "SAR", plan: "MONTHLY", provider: "Apple Pay", status: "COMPLETED", invoiceUrl: "#" }
];

const DEFAULT_USER_LOGINS = [
  { id: 501, timestamp: "2026-10-09 03:25:10", email: "admin@barberapp.sa", fullName: "Super Administrator", role: "SUPER_ADMIN", salonName: "Global System", action: "AUTH_LOGIN_SUCCESS", ip: "127.0.0.1", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)" },
  { id: 502, timestamp: "2026-10-09 02:50:44", email: "owner@goldenscissors.sa", fullName: "Tariq Al-Mansoor", role: "SALON_OWNER", salonName: "Golden Scissors Salon", action: "AUTH_LOGIN_SUCCESS", ip: "192.168.1.45", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS)" },
  { id: 503, timestamp: "2026-10-09 01:15:20", email: "owner@royallounge.sa", fullName: "Fahad Mansoor", role: "SALON_OWNER", salonName: "Royal Barber Lounge", action: "AUTH_LOGIN_SUCCESS", ip: "192.168.1.89", userAgent: "Mozilla/5.0 (Windows NT 10.0)" }
];

export const DEFAULT_ADMIN_USERS = [
  {
    id: 30,
    fullName: "Super Administrator",
    email: "admin@barberapp.sa",
    phone: "0500000000",
    role: "SUPER_ADMIN",
    active: true,
    lastLogin: "2026-10-12 16:34:11",
    createdAt: "2026-10-10 12:00:00"
  },
  {
    id: 31,
    fullName: "Tariq Al-Harbi",
    email: "support@barberapp.sa",
    phone: "0551122334",
    role: "SUPPORT_AGENT",
    active: true,
    lastLogin: null,
    createdAt: "2026-10-11 09:30:00"
  },
  {
    id: 32,
    fullName: "Noura Al-Dosari",
    email: "inspector@barberapp.sa",
    phone: "0559988776",
    role: "AUDIT_INSPECTOR",
    active: true,
    lastLogin: null,
    createdAt: "2026-10-11 14:15:00"
  }
];

export const DEFAULT_ADMIN_ROLES = [
  {
    role: "SUPER_ADMIN",
    name: "Super Administrator",
    description: "Full unrestricted access across all platform entities and configuration",
    userCount: 1,
    permissions: [
      "audit.view", "audit.export",
      "salon.view", "salon.status_change", "salon.impersonate",
      "config.view", "config.edit",
      "rbac.view", "rbac.manage"
    ],
    systemProtected: true
  },
  {
    role: "SUPPORT_AGENT",
    name: "Support Agent",
    description: "Operational support for salon moderation, status adjustments, and inquiries",
    userCount: 1,
    permissions: [
      "audit.view",
      "salon.view", "salon.status_change",
      "config.view",
      "rbac.view"
    ],
    systemProtected: false
  },
  {
    role: "AUDIT_INSPECTOR",
    name: "Audit Inspector",
    description: "Compliance and security audit inspection with read-only audit exports",
    userCount: 1,
    permissions: [
      "audit.view", "audit.export",
      "salon.view",
      "config.view",
      "rbac.view"
    ],
    systemProtected: false
  }
];

export const Store = {
  // Initialize storage if missing
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.SHOPS)) {
      localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(DEFAULT_SHOPS));
    } else {
      // Clean legacy unsplash stock photos if present
      try {
        const storedShops = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOPS));
        if (Array.isArray(storedShops)) {
          let updated = false;
          storedShops.forEach((s) => {
            if (s.barbers) {
              s.barbers.forEach((b) => {
                if (b.avatar && b.avatar.includes("unsplash.com")) {
                  b.avatar = "";
                  updated = true;
                }
              });
            }
          });
          if (updated) {
            localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(storedShops));
          }
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.BOOKINGS)) {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(DEFAULT_BOOKINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(DEFAULT_AUDIT_LOGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS)) {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(DEFAULT_PAYMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USER_LOGINS)) {
      localStorage.setItem(STORAGE_KEYS.USER_LOGINS, JSON.stringify(DEFAULT_USER_LOGINS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ADMIN_USERS)) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(DEFAULT_ADMIN_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ADMIN_ROLES)) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_ROLES, JSON.stringify(DEFAULT_ADMIN_ROLES));
    }
  },

  getShops() {
    this.init();
    try {
      const shops = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOPS)) || DEFAULT_SHOPS;
      const origin = window.location.origin || "http://localhost:3000";
      return shops.map((s) => ({
        ...s,
        loginUrl: s.loginUrl || `${origin}/dashboard/index.html?slug=${s.slug}`,
        bookingUrl: s.bookingUrl || `${origin}/booking.html?slug=${s.slug}`
      }));
    } catch {
      return DEFAULT_SHOPS;
    }
  },

  getShopBySlug(slug) {
    const shops = this.getShops();
    return shops.find((s) => s.slug === slug) || shops[0];
  },

  getCurrentUser() {
    try {
      const local = localStorage.getItem("barber_saas_current_user");
      const session = sessionStorage.getItem("barber_saas_current_user");
      return JSON.parse(local || session);
    } catch {
      return null;
    }
  },

  setCurrentUser(user, remember = true) {
    if (user) {
      const str = JSON.stringify(user);
      if (remember) {
        localStorage.setItem("barber_saas_current_user", str);
        sessionStorage.removeItem("barber_saas_current_user");
      } else {
        sessionStorage.setItem("barber_saas_current_user", str);
        localStorage.removeItem("barber_saas_current_user");
      }
    } else {
      localStorage.removeItem("barber_saas_current_user");
      sessionStorage.removeItem("barber_saas_current_user");
    }
    this.notify("AUTH_CHANGED", user);
  },

  getAuthHeader() {
    const user = this.getCurrentUser();
    if (user && user.token) {
      return { "Authorization": `Bearer ${user.token}` };
    }
    return {};
  },

  logout() {
    localStorage.removeItem("barber_saas_current_user");
    sessionStorage.removeItem("barber_saas_current_user");
    this.notify("AUTH_CHANGED", null);
  },

  loginSalonAdmin(emailOrPhone) {
    const shops = this.getShops();
    const clean = (emailOrPhone || "").trim();

    // Super Admin fallback support
    if (clean.toLowerCase() === "admin@barberapp.sa" || clean.toLowerCase() === "admin") {
      const adminUser = {
        token: "mock-jwt-token-super-admin-" + Date.now(),
        role: "SUPER_ADMIN",
        userId: 999,
        email: "admin@barberapp.sa",
        fullName: "Super Administrator",
        salonId: null,
        salonSlug: null,
        salonName: "Global System"
      };
      this.setCurrentUser(adminUser, true);
      return { success: true, shop: null, user: adminUser };
    }

    const matchedShop = shops.find((s) => 
      (s.ownerEmail && s.ownerEmail.toLowerCase() === clean.toLowerCase()) ||
      (s.phone && s.phone === clean) ||
      (s.slug && s.slug === clean) ||
      (s.id && s.id === clean)
    );

    if (matchedShop) {
      const sessionUser = {
        token: "mock-jwt-token-salon-owner-" + Date.now(),
        role: "SALON_OWNER",
        userId: 139,
        email: matchedShop.ownerEmail || "owner@goldenscissors.sa",
        fullName: matchedShop.owner || "Tariq Al-Mansoor",
        salonId: (matchedShop.slug === "golden-scissors" || matchedShop.id === 1) ? 53 : matchedShop.id,
        salonSlug: matchedShop.slug,
        salonName: matchedShop.name
      };
      this.setCurrentUser(sessionUser, true);
      return { success: true, shop: matchedShop, user: sessionUser };
    }
    return { success: false, message: "No registered salon matched this email/phone." };
  },

  saveShop(shop) {
    const origin = window.location.origin || "http://localhost:3000";
    if (!shop.loginUrl) {
      shop.loginUrl = `${origin}/dashboard/index.html?slug=${shop.slug}`;
    }
    if (!shop.bookingUrl) {
      shop.bookingUrl = `${origin}/booking.html?slug=${shop.slug}`;
    }
    const shops = this.getShops();
    const existingIdx = shops.findIndex((s) => s.slug === shop.slug || s.id === shop.id);
    if (existingIdx >= 0) {
      shops[existingIdx] = { ...shops[existingIdx], ...shop };
    } else {
      shops.unshift(shop);
    }
    localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(shops));

    // Audit Log
    this.addAuditLog(shop.ownerEmail || "owner@barber.sa", shop.name, "SHOP_REGISTERED", `Onboarding completed with QR codes generated for login and public bookings`);

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

  getPayments() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS)) || DEFAULT_PAYMENTS;
    } catch {
      return DEFAULT_PAYMENTS;
    }
  },

  addPayment(payment) {
    const payments = this.getPayments();
    const newPayment = {
      id: "tx_" + Date.now(),
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      status: "COMPLETED",
      ...payment
    };
    payments.unshift(newPayment);
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
    this.notify("PAYMENT_RECEIVED", newPayment);
  },

  getUserLogins() {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_LOGINS)) || DEFAULT_USER_LOGINS;
    } catch {
      return DEFAULT_USER_LOGINS;
    }
  },

  addUserLogin(email, fullName, role, salonName = "N/A", action = "AUTH_LOGIN_SUCCESS") {
    const logins = this.getUserLogins();
    const newLogin = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      email,
      fullName,
      role,
      salonName,
      action,
      ip: "127.0.0.1",
      userAgent: navigator.userAgent || "Web Browser"
    };
    logins.unshift(newLogin);
    localStorage.setItem(STORAGE_KEYS.USER_LOGINS, JSON.stringify(logins));
    this.notify("USER_LOGIN_EVENT", newLogin);

    // Also persist to audit log trail
    this.addAuditLog(
      email,
      salonName !== "N/A" ? salonName : "Global Platform",
      "LOGIN",
      `User ${fullName} (${role}) logged in successfully`
    );
  },

  addAuditLog(user, shop, action, details) {
    const logs = this.getAuditLogs();
    const userEmail = typeof user === "string" ? user : (user?.email || "system@barberapp.sa");
    const shopName = typeof shop === "string" ? shop : (shop?.name || (shop ? String(shop) : "Global Platform"));
    const detailsStr = typeof details === "object" ? JSON.stringify(details) : String(details || "");

    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      user: userEmail,
      shop: shopName,
      action,
      details: detailsStr,
      ip: "127.0.0.1"
    };
    logs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));

    // Forward to backend API asynchronously for real persistent database audit trail
    try {
      const userObj = this.getCurrentUser();
      const token = userObj?.token;
      fetch("http://localhost:8080/api/admin/audit-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userEmail: userEmail,
          shopName: shopName,
          action: action,
          details: detailsStr,
          ipAddress: "127.0.0.1"
        })
      }).catch((err) => {
        // Non-blocking offline fallback
      });
    } catch (e) {
      // non-blocking
    }
  },

  getSettings() {
    this.init();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("Failed to parse system settings:", e);
    }
    return { ...DEFAULT_SYSTEM_SETTINGS };
  },

  saveSettings(newSettings) {
    this.init();
    const merged = { ...DEFAULT_SYSTEM_SETTINGS, ...newSettings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    this.notify("SETTINGS_UPDATED", merged);
    return merged;
  },

  resetSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SYSTEM_SETTINGS));
    this.notify("SETTINGS_UPDATED", DEFAULT_SYSTEM_SETTINGS);
    return { ...DEFAULT_SYSTEM_SETTINGS };
  },

  getAdminUsers() {
    this.init();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ADMIN_USERS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to read cached admin users:", e);
    }
    return [...DEFAULT_ADMIN_USERS];
  },

  async fetchAdminUsers() {
    this.init();
    try {
      const response = await fetch("http://localhost:8080/api/admin/users", {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() }
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(data));
          this.notify("ADMIN_USERS_UPDATED", data);
          return data;
        }
      }
    } catch (e) {
      console.warn("Backend API /api/admin/users unreachable, falling back to local store:", e);
    }
    return this.getAdminUsers();
  },

  async inviteAdminUser(userData) {
    this.init();
    try {
      const response = await fetch("http://localhost:8080/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify(userData)
      });
      if (response.ok) {
        const created = await response.json();
        const users = this.getAdminUsers();
        users.push(created);
        localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(users));
        this.notify("ADMIN_USERS_UPDATED", users);
        return { success: true, user: created };
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || "Failed to invite internal admin");
      }
    } catch (e) {
      if (e.message && e.message.includes("Failed to invite")) throw e;
      // Offline fallback
      const users = this.getAdminUsers();
      if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase().trim())) {
        throw new Error(`A user with email ${userData.email} already exists.`);
      }
      const newAdmin = {
        id: Date.now(),
        fullName: userData.fullName.trim(),
        email: userData.email.trim().toLowerCase(),
        phone: userData.phone ? userData.phone.trim() : null,
        role: userData.role,
        active: true,
        lastLogin: null,
        createdAt: new Date().toISOString()
      };
      users.push(newAdmin);
      localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(users));
      this.notify("ADMIN_USERS_UPDATED", users);
      return { success: true, user: newAdmin };
    }
  },

  async updateAdminRole(userId, newRole) {
    this.init();
    const currentUser = this.getCurrentUser();
    const currentId = currentUser ? (currentUser.id || currentUser.userId) : 30;
    const currentEmail = currentUser ? currentUser.email : "admin@barberapp.sa";

    const users = this.getAdminUsers();
    const target = users.find(u => String(u.id) === String(userId));
    if (!target) throw new Error("Target admin user not found.");

    // Safety checks
    const isSelf = String(currentId) === String(userId) || (target.email && target.email.toLowerCase() === currentEmail.toLowerCase());
    if (isSelf && target.role === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
      throw new Error("Safety Violation: Super Admin cannot revoke SUPER_ADMIN authority from their own active session account.");
    }

    if (target.role === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
      const activeSuperAdmins = users.filter(u => u.role === "SUPER_ADMIN" && u.active).length;
      if (activeSuperAdmins <= 1) {
        throw new Error("Safety Violation: Cannot reassign the last remaining active SUPER_ADMIN.");
      }
    }

    try {
      const response = await fetch(`http://localhost:8080/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        const updated = await response.json();
        const updatedUsers = users.map(u => String(u.id) === String(userId) ? updated : u);
        localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(updatedUsers));
        this.notify("ADMIN_USERS_UPDATED", updatedUsers);
        return { success: true, user: updated };
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || "Failed to update role");
      }
    } catch (e) {
      if (e.message && (e.message.includes("Safety Violation") || e.message.includes("Failed to update"))) throw e;
      target.role = newRole;
      localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(users));
      this.notify("ADMIN_USERS_UPDATED", users);
      return { success: true, user: target };
    }
  },

  async toggleAdminUserStatus(userId, activeState) {
    this.init();
    const currentUser = this.getCurrentUser();
    const currentId = currentUser ? (currentUser.id || currentUser.userId) : 30;
    const currentEmail = currentUser ? currentUser.email : "admin@barberapp.sa";

    const users = this.getAdminUsers();
    const target = users.find(u => String(u.id) === String(userId));
    if (!target) throw new Error("Target admin user not found.");

    // Safety checks
    const isSelf = String(currentId) === String(userId) || (target.email && target.email.toLowerCase() === currentEmail.toLowerCase());
    if (isSelf && !activeState) {
      throw new Error("Safety Violation: Super Admin cannot deactivate or suspend their own current session account.");
    }

    if (target.role === "SUPER_ADMIN" && !activeState) {
      const activeSuperAdmins = users.filter(u => u.role === "SUPER_ADMIN" && u.active).length;
      if (activeSuperAdmins <= 1) {
        throw new Error("Safety Violation: Cannot deactivate or suspend the last active SUPER_ADMIN.");
      }
    }

    try {
      const response = await fetch(`http://localhost:8080/api/admin/users/${userId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify({ active: activeState })
      });
      if (response.ok) {
        const updated = await response.json();
        const updatedUsers = users.map(u => String(u.id) === String(userId) ? updated : u);
        localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(updatedUsers));
        this.notify("ADMIN_USERS_UPDATED", updatedUsers);
        return { success: true, user: updated };
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || "Failed to update status");
      }
    } catch (e) {
      if (e.message && (e.message.includes("Safety Violation") || e.message.includes("Failed to update"))) throw e;
      target.active = activeState;
      localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, JSON.stringify(users));
      this.notify("ADMIN_USERS_UPDATED", users);
      return { success: true, user: target };
    }
  },

  getAdminRoles() {
    this.init();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ADMIN_ROLES);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Failed to read cached admin roles:", e);
    }
    return [...DEFAULT_ADMIN_ROLES];
  },

  async fetchAdminRoles() {
    this.init();
    try {
      const response = await fetch("http://localhost:8080/api/admin/roles", {
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() }
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem(STORAGE_KEYS.ADMIN_ROLES, JSON.stringify(data));
          this.notify("ADMIN_ROLES_UPDATED", data);
          return data;
        }
      }
    } catch (e) {
      console.warn("Backend API /api/admin/roles unreachable, using cached roles:", e);
    }
    return this.getAdminRoles();
  },

  async saveRolePermissions(roleName, permissions) {
    this.init();
    try {
      const response = await fetch(`http://localhost:8080/api/admin/roles/${roleName}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...this.getAuthHeader() },
        body: JSON.stringify({ permissions })
      });
      if (response.ok) {
        const updated = await response.json();
        const roles = this.getAdminRoles();
        const updatedRoles = roles.map(r => r.role === roleName ? updated : r);
        localStorage.setItem(STORAGE_KEYS.ADMIN_ROLES, JSON.stringify(updatedRoles));
        this.notify("ADMIN_ROLES_UPDATED", updatedRoles);
        return { success: true, role: updated };
      }
    } catch (e) {
      console.warn("Backend API roles update unreachable, updating locally:", e);
    }

    const roles = this.getAdminRoles();
    const target = roles.find(r => r.role === roleName);
    if (target) {
      target.permissions = [...permissions];
      localStorage.setItem(STORAGE_KEYS.ADMIN_ROLES, JSON.stringify(roles));
      this.notify("ADMIN_ROLES_UPDATED", roles);
      return { success: true, role: target };
    }
    return { success: false, message: "Role not found" };
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
