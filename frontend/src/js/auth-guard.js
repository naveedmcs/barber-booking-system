/**
 * Startup Route Verifier & Authority Route Guard
 * Handles root routing, tenant isolation, and path normalization
 */

import { Store } from "./store.js";

export const AuthGuard = {
  requireAuth(targetRole = null) {
    Store.init();
    const user = Store.getCurrentUser();
    if (!user || (!user.token && !user.accessToken)) {
      window.location.href = "/login.html";
      return false;
    }
    if (targetRole && user.role !== targetRole) {
      alert("⚠️ HTTP 403 Forbidden: Insufficient permissions.");
      return false;
    }
    return true;
  },

  init() {
    Store.init();
    const user = Store.getCurrentUser();
    const path = window.location.pathname;
    const isInsideDashboard = path.includes("/dashboard/");

    // Strict path checks (avoid matching /dashboard/index.html as root)
    const isRoot = path === "/" || path === "/index.html" || path.endsWith("/frontend/") || path.endsWith("/frontend/index.html");
    const isLogin = path.includes("/login.html");
    const isAdmin = path.includes("/dashboard/admin.html") || path.includes("/admin/") || path.endsWith("/admin") || path.includes("/admin.html");
    const isPortal = path.includes("/portal/") || path.includes("/portal.html") || path.endsWith("/portal") || path.includes("/salon-dashboard");
    const isSalonDash = path.includes("/dashboard/index.html") && !isAdmin;
    const isSalonsList = path.includes("/salons.html");

    // Path helper for clean relative navigation
    const getTargetUrl = (type, slug = "golden-scissors") => {
      const isSub = isInsideDashboard || isPortal;
      if (type === "login") {
        return isSub ? "../login.html" : "./login.html";
      }
      if (type === "admin") {
        return isSub ? "../dashboard/admin.html" : "./dashboard/admin.html";
      }
      if (type === "portal") {
        return isSub ? `../portal/index.html?slug=${slug}` : `./portal/index.html?slug=${slug}`;
      }
      if (type === "salon") {
        return isSub ? `../portal/index.html?slug=${slug}` : `./portal/index.html?slug=${slug}`;
      }
      return "./login.html";
    };

    // 1. Root / Startup Route Handler
    if (isRoot) {
      if (!user || !user.token) {
        window.location.href = getTargetUrl("login");
        return;
      }
      // Authenticated -> bypass login & route by authority
      if (user.role === "SUPER_ADMIN") {
        window.location.href = getTargetUrl("admin");
      } else if (user.role === "SALON_STAFF" || user.role === "BARBER") {
        window.location.href = getTargetUrl("portal", user.salonSlug || "golden-scissors") + "#schedule";
      } else {
        const slug = user.salonSlug || "golden-scissors";
        window.location.href = getTargetUrl("portal", slug) + "#bookings";
      }
      return;
    }

    // 2. Protected Admin Dashboard Guard
    if (isAdmin) {
      if (!user || !user.token) {
        const loginUrl = getTargetUrl("login") + `?redirect_to=${encodeURIComponent(window.location.href)}`;
        window.location.href = loginUrl;
        return;
      }

      if (user.role !== "SUPER_ADMIN") {
        alert("⚠️ HTTP 403 Forbidden: You do not have Super Admin authority to access global system settings.");
        const slug = user.salonSlug || "golden-scissors";
        window.location.href = getTargetUrl("portal", slug);
        return;
      }
    }

    // 3. Protected Salon Portal Guard (Multi-Tenant Context & RBAC)
    if (isPortal) {
      if (!user || !user.token) {
        const loginUrl = getTargetUrl("login") + `?redirect_to=${encodeURIComponent(window.location.href)}`;
        window.location.href = loginUrl;
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const requestedSlug = urlParams.get("slug");
      const requestedSalonId = urlParams.get("salonId");

      if (user.role !== "SUPER_ADMIN") {
        // Enforce strict tenant isolation
        if (requestedSlug && user.salonSlug && requestedSlug !== user.salonSlug) {
          alert(`⚠️ HTTP 403 Forbidden: Access denied. You are only authorized to view your assigned salon (${user.salonName || user.salonSlug}).`);
          window.location.href = getTargetUrl("portal", user.salonSlug);
          return;
        }
        if (requestedSalonId && user.salonId && String(requestedSalonId) !== String(user.salonId)) {
          alert(`⚠️ HTTP 403 Forbidden: Access denied. You are only authorized to view your assigned salon ID ${user.salonId}.`);
          window.location.href = getTargetUrl("portal", user.salonSlug || "golden-scissors");
          return;
        }

        // RBAC Module Guard for Staff
        const isStaff = user.role === "SALON_STAFF" || user.role === "BARBER";
        const hash = window.location.hash;
        const ownerOnlyViews = ["#staff", "#services", "#settings"];
        if (isStaff && ownerOnlyViews.includes(hash)) {
          alert("⚠️ HTTP 403 Forbidden: Staff members are restricted to Booking Schedule and Personal Profile.");
          window.location.hash = "#schedule";
          return;
        }
      }
    }

    // 4. Legacy Protected Salon Dashboard Guard
    if (isSalonDash) {
      if (!user || !user.token) {
        const loginUrl = getTargetUrl("login") + `?redirect_to=${encodeURIComponent(window.location.href)}`;
        window.location.href = loginUrl;
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const requestedSlug = urlParams.get("slug");

      if (user.role !== "SUPER_ADMIN" && requestedSlug && user.salonSlug && requestedSlug !== user.salonSlug) {
        alert(`⚠️ HTTP 403 Forbidden: Access denied. You are only authorized to view your assigned salon (${user.salonName || user.salonSlug}).`);
        window.location.href = getTargetUrl("salon", user.salonSlug);
        return;
      }
    }

    // 5. Protected Salons List (Restricted to SUPER_ADMIN only)
    if (isSalonsList) {
      if (!user || !user.token) {
        const loginUrl = getTargetUrl("login") + `?redirect_to=${encodeURIComponent(window.location.href)}`;
        window.location.href = loginUrl;
        return;
      }

      if (user.role !== "SUPER_ADMIN") {
        alert("⚠️ HTTP 403 Forbidden: The Salons Directory is restricted to Super Admin only.");
        const slug = user.salonSlug || "golden-scissors";
        window.location.href = getTargetUrl("portal", slug);
        return;
      }
    }
  }
};
