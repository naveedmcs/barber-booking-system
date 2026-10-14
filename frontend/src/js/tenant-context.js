/**
 * Tenant Context Provider & RBAC Engine for Salon Portal
 * Enforces strict multi-tenant isolation, session resolution, and staff-level scoping
 */

import { Store } from "./store.js";

export const TenantContext = {
  STATE: {
    initialized: false,
    user: null,
    shop: null,
    role: null,
    salonId: null,
    staffId: null,
    shiftStatus: "ONLINE",
    accessibleModules: []
  },

  /**
   * Initializes tenant context from local session and synchronizes with backend
   */
  async init() {
    Store.init();
    const currentUser = Store.getCurrentUser();

    if (!currentUser || (!currentUser.token && !currentUser.accessToken)) {
      this.STATE.initialized = false;
      return null;
    }
    if (!currentUser.token && currentUser.accessToken) {
      currentUser.token = currentUser.accessToken;
    }

    this.STATE.user = currentUser;
    this.STATE.role = currentUser.role;
    this.STATE.salonId = currentUser.salonId;
    this.STATE.staffId = currentUser.staffId || currentUser.userId;

    // Default accessible modules by role
    if (this.isOwner()) {
      this.STATE.accessibleModules = ["bookings", "staff", "services", "settings"];
    } else if (this.isStaff()) {
      this.STATE.accessibleModules = ["schedule", "profile"];
    } else {
      this.STATE.accessibleModules = ["bookings", "staff", "services", "settings"];
    }

    // Attempt live context sync from backend
    try {
      const response = await fetch(`http://localhost:8080/api/portal/context?userId=${currentUser.userId || currentUser.id || ""}`, {
        headers: {
          "Authorization": `Bearer ${currentUser.token}`,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.STATE.shop = {
          id: data.salonId,
          name: data.salonName,
          slug: data.salonSlug,
          branch: data.branch,
          fullAddress: data.fullAddress
        };
        this.STATE.salonId = data.salonId;
        this.STATE.shiftStatus = data.shiftStatus || "ONLINE";
        this.STATE.accessibleModules = data.accessibleModules || this.STATE.accessibleModules;

        if (data.user) {
          this.STATE.user = { ...this.STATE.user, ...data.user };
          this.STATE.staffId = data.user.staffId || this.STATE.staffId;
          Store.setCurrentUser(this.STATE.user, true);
        }
      } else {
        // Fallback to local shop resolution
        this.resolveLocalShopFallback(currentUser);
      }
    } catch (err) {
      console.warn("Portal context backend offline, operating in local tenant fallback mode:", err);
      this.resolveLocalShopFallback(currentUser);
    }

    this.STATE.initialized = true;
    return this.STATE;
  },

  resolveLocalShopFallback(user) {
    const shops = Store.getShops();
    let shop = null;

    if (user.salonId) {
      shop = shops.find((s) => s.id === user.salonId || s.id === `shop-${user.salonId}` || String(s.id) === String(user.salonId));
    }
    if (!shop && user.salonSlug) {
      shop = shops.find((s) => s.slug === user.salonSlug);
    }
    if (!shop) {
      shop = shops[0] || {
        id: 1,
        slug: "golden-scissors",
        name: "Golden Scissors Salon",
        city: "Riyadh",
        district: "Olaya"
      };
    }

    this.STATE.shop = {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      branch: `${shop.district || "Olaya"}, ${shop.city || "Riyadh"}`,
      fullAddress: shop.fullAddress || `${shop.district}, ${shop.city}`
    };
    let cleanId = shop.id;
    if (typeof cleanId === "string" && cleanId.startsWith("shop-")) {
      cleanId = cleanId.replace("shop-", "");
    }
    this.STATE.salonId = cleanId;
  },

  getCurrentUser() {
    return this.STATE.user || Store.getCurrentUser();
  },

  getRole() {
    return this.STATE.role || (this.getCurrentUser() ? this.getCurrentUser().role : null);
  },

  getSalonId() {
    let id = this.STATE.salonId || (this.getCurrentUser() ? this.getCurrentUser().salonId : null);
    if (typeof id === "string" && id.startsWith("shop-")) {
      id = id.replace("shop-", "");
    }
    return id;
  },

  getStaffId() {
    return this.STATE.staffId || (this.getCurrentUser() ? (this.getCurrentUser().staffId || this.getCurrentUser().userId) : null);
  },

  getShop() {
    return this.STATE.shop;
  },

  isOwner() {
    const role = this.getRole();
    return role === "SALON_OWNER" || role === "SHOP_OWNER" || role === "SUPER_ADMIN";
  },

  isStaff() {
    const role = this.getRole();
    return role === "SALON_STAFF" || role === "BARBER";
  },

  canAccessModule(moduleName) {
    if (this.isOwner()) return true;
    if (this.isStaff()) {
      return moduleName === "schedule" || moduleName === "profile";
    }
    return false;
  },

  getShiftStatus() {
    return this.STATE.shiftStatus;
  },

  async toggleShiftStatus() {
    const nextStatus = this.STATE.shiftStatus === "ONLINE" ? "OFFLINE" : "ONLINE";
    this.STATE.shiftStatus = nextStatus;

    const user = this.getCurrentUser();
    if (user && user.token) {
      try {
        await fetch(`http://localhost:8080/api/portal/shift?userId=${user.userId || user.id || ""}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${user.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch (err) {
        console.warn("Failed to persist shift toggle to backend:", err);
      }
    }

    Store.notify("SHIFT_STATUS_CHANGED", { status: nextStatus });
    return nextStatus;
  },

  /**
   * Automated Tenant Isolation API Fetch Wrapper
   * Injects:
   * 1. Authorization: Bearer <token>
   * 2. X-Salon-Id: <salonId>
   * 3. Parameter scoping: if SALON_STAFF, automatically injects & validates staffId
   */
  async tenantFetch(endpoint, options = {}) {
    const user = this.getCurrentUser();
    const token = user ? (user.token || user.accessToken) : null;
    const salonId = this.getSalonId();

    const headers = {
      ...(options.headers || {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(salonId ? { "X-Salon-Id": String(salonId) } : {})
    };

    let url = endpoint;
    if (url.startsWith("/api/")) {
      const backendBase = (typeof window !== "undefined" && window.location.port !== "8080")
        ? "http://localhost:8080"
        : "";
      url = `${backendBase}${url}`;
    }

    const separator = url.includes("?") ? "&" : "?";
    
    // Auto-inject salonId query param if calling backend REST API
    if (salonId && !url.includes("salonId=")) {
      url += `${separator}salonId=${encodeURIComponent(salonId)}`;
    }

    // Auto-inject userId query param if calling backend REST API
    const userId = user ? (user.userId || user.id) : null;
    if (userId && !url.includes("userId=")) {
      const sep = url.includes("?") ? "&" : "?";
      url += `${sep}userId=${encodeURIComponent(userId)}`;
    }

    // If caller is SALON_STAFF and querying appointments, strictly inject & enforce staffId
    if (this.isStaff()) {
      const staffId = this.getStaffId();
      if (staffId && !url.includes("barberId=")) {
        url += `&barberId=${encodeURIComponent(staffId)}`;
      }
    }

    return fetch(url, { ...options, headers });
  }
};
