/**
 * Unified JWT Authentication & Post-Login Authority Router
 * Connects directly to backend AuthController (/api/auth/*)
 * Zero Mock Data & Zero Plaintext Fallbacks
 */

import { Store } from "./store.js";

function getBackendBase() {
  const isLocalhost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isLocalhost && window.location.port !== "8080") {
    return "http://localhost:8080";
  }
  return "";
}

document.addEventListener("DOMContentLoaded", () => {
  Store.init();

  const urlParams = new URLSearchParams(window.location.search);
  const isLogout = urlParams.get("logout") === "true";

  if (isLogout) {
    Store.logout();
    localStorage.removeItem("barber_current_user");
    localStorage.removeItem("token");
  } else {
    // If already authenticated, redirect immediately based on role
    const currentUser = Store.getCurrentUser();
    if (currentUser && (currentUser.token || currentUser.accessToken)) {
      redirectByAuthority(currentUser);
      return;
    }
  }

  initTabs();
  initSeedButtons();
  initLoginForm();
  initCustomerRegisterForm();
});

/* ---------------- TAB SWITCHING ---------------- */
function initTabs() {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("customer-register-form");
  const mainTitle = document.getElementById("auth-main-title");
  const mainDesc = document.getElementById("auth-main-desc");
  const seedSection = document.getElementById("seed-section");
  const errorAlert = document.getElementById("login-error-alert");
  const successAlert = document.getElementById("auth-success-alert");

  function setMode(mode) {
    errorAlert?.classList.add("hidden");
    successAlert?.classList.add("hidden");

    if (mode === "login") {
      tabLogin?.classList.add("border-[#F59E0B]", "text-[#F59E0B]");
      tabLogin?.classList.remove("border-transparent", "text-slate-400");
      tabRegister?.classList.remove("border-emerald-500", "text-emerald-400");
      tabRegister?.classList.add("border-transparent", "text-slate-400");

      loginForm?.classList.remove("hidden");
      registerForm?.classList.add("hidden");
      seedSection?.classList.remove("hidden");

      if (mainTitle) mainTitle.innerText = "Access Platform";
      if (mainDesc) mainDesc.innerText = "Sign in to your role dashboard or create a customer account";
    } else {
      tabRegister?.classList.add("border-emerald-500", "text-emerald-400");
      tabRegister?.classList.remove("border-transparent", "text-slate-400");
      tabLogin?.classList.remove("border-[#F59E0B]", "text-[#F59E0B]");
      tabLogin?.classList.add("border-transparent", "text-slate-400");

      loginForm?.classList.add("hidden");
      registerForm?.classList.remove("hidden");
      seedSection?.classList.add("hidden");

      if (mainTitle) mainTitle.innerText = "Customer Sign Up";
      if (mainDesc) mainDesc.innerText = "Create your customer profile to book appointments and track loyalty";
    }
  }

  tabLogin?.addEventListener("click", () => setMode("login"));
  tabRegister?.addEventListener("click", () => setMode("register"));

  // Check URL hash or param to pre-select register tab if requested
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mode") === "register" || window.location.hash === "#register") {
    setMode("register");
  }
}

/* ---------------- SEED BUTTONS ---------------- */
function initSeedButtons() {
  document.querySelectorAll(".seed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-email");
      const pass = btn.getAttribute("data-pass");

      // Switch to sign in tab if register is open
      document.getElementById("tab-login")?.click();

      const emailInput = document.getElementById("email");
      const passInput = document.getElementById("password");
      if (emailInput) emailInput.value = email;
      if (passInput) passInput.value = pass;

      document.getElementById("login-form")?.dispatchEvent(new Event("submit"));
    });
  });
}

/* ---------------- 1. SIGN IN FORM ---------------- */
function initLoginForm() {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  const rememberMe = document.getElementById("remember-me");
  const submitBtn = document.getElementById("submit-btn");
  const btnText = document.getElementById("btn-text");
  const btnSpinner = document.getElementById("btn-spinner");
  const errorAlert = document.getElementById("login-error-alert");
  const errorTitle = document.getElementById("error-title");
  const errorDesc = document.getElementById("error-desc");
  const successAlert = document.getElementById("auth-success-alert");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) return;

    // Loading State
    submitBtn.disabled = true;
    btnText.innerText = "Authenticating...";
    btnSpinner.classList.remove("hidden");
    errorAlert.classList.add("hidden");
    successAlert?.classList.add("hidden");

    try {
      const backendBase = getBackendBase();
      const response = await fetch(`${backendBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: rememberMe?.checked ?? true })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Invalid email or password.");
      }

      // Store token & user session
      const authData = {
        token: data.accessToken,
        accessToken: data.accessToken,
        role: data.user.role,
        userId: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        salonId: data.user.salonId,
        salonName: data.user.salonName,
        salonSlug: data.user.salonSlug || "golden-scissors"
      };

      Store.setCurrentUser(authData, rememberMe?.checked ?? true);
      localStorage.setItem("barber_current_user", JSON.stringify(authData));
      localStorage.setItem("token", data.accessToken);

      Store.addUserLogin(
        authData.email,
        authData.fullName || "User",
        authData.role,
        authData.salonName || (authData.role === "SUPER_ADMIN" ? "Global System" : "Assigned Salon"),
        "AUTH_LOGIN_SUCCESS"
      );

      btnText.innerText = "Success! Redirecting...";
      redirectByAuthority(authData);

    } catch (err) {
      console.error("Authentication error:", err);

      errorTitle.innerText = "Authentication Failed";
      errorDesc.innerText = err.message || "Invalid email or password. Please verify your credentials.";
      errorAlert.classList.remove("hidden");
      
      submitBtn.disabled = false;
      btnText.innerText = "Sign In";
      btnSpinner.classList.add("hidden");
    }
  });
}

/* ---------------- 2. CUSTOMER REGISTRATION FORM ---------------- */
function initCustomerRegisterForm() {
  const form = document.getElementById("customer-register-form");
  const nameInput = document.getElementById("reg-name");
  const phoneInput = document.getElementById("reg-phone");
  const emailInput = document.getElementById("reg-email");
  const passInput = document.getElementById("reg-password");
  const submitBtn = document.getElementById("reg-submit-btn");
  const btnText = document.getElementById("reg-btn-text");
  const btnSpinner = document.getElementById("reg-btn-spinner");
  const errorAlert = document.getElementById("login-error-alert");
  const errorTitle = document.getElementById("error-title");
  const errorDesc = document.getElementById("error-desc");
  const successAlert = document.getElementById("auth-success-alert");
  const successTitle = document.getElementById("success-title");
  const successDesc = document.getElementById("success-desc");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = nameInput.value.trim();
    let phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!fullName || !phone || !email || !password) {
      errorTitle.innerText = "Missing Fields";
      errorDesc.innerText = "Please fill in all required registration fields.";
      errorAlert.classList.remove("hidden");
      return;
    }

    // Saudi phone format validation & normalization
    // Accept 05XXXXXXXX, +9665XXXXXXXX, 9665XXXXXXXX
    phone = phone.replace(/\s+/g, "").replace(/-/g, "");
    if (phone.startsWith("+966")) {
      phone = "0" + phone.slice(4);
    } else if (phone.startsWith("966")) {
      phone = "0" + phone.slice(3);
    } else if (phone.startsWith("5") && phone.length === 9) {
      phone = "0" + phone;
    }

    if (!/^05[0-9]{8}$/.test(phone)) {
      errorTitle.innerText = "Invalid Saudi Phone";
      errorDesc.innerText = "Phone number must be a valid 10-digit Saudi number starting with 05 (e.g. 0512345678).";
      errorAlert.classList.remove("hidden");
      phoneInput.focus();
      return;
    }

    if (password.length < 6) {
      errorTitle.innerText = "Weak Password";
      errorDesc.innerText = "Password must be at least 6 characters in length.";
      errorAlert.classList.remove("hidden");
      passInput.focus();
      return;
    }

    // Loading State
    submitBtn.disabled = true;
    btnText.innerText = "Creating Account...";
    btnSpinner.classList.remove("hidden");
    errorAlert.classList.add("hidden");
    successAlert?.classList.add("hidden");

    try {
      const backendBase = getBackendBase();
      const response = await fetch(`${backendBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Customer registration failed");
      }

      // Store token & user session
      const authData = {
        token: data.accessToken,
        accessToken: data.accessToken,
        role: data.user.role || "CUSTOMER",
        userId: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        salonId: null,
        salonName: null,
        salonSlug: null
      };

      Store.setCurrentUser(authData, true);
      localStorage.setItem("barber_current_user", JSON.stringify(authData));
      localStorage.setItem("token", data.accessToken);

      Store.addUserLogin(
        authData.email,
        authData.fullName || "Customer",
        authData.role,
        "Customer Portal",
        "AUTH_REGISTER_SUCCESS"
      );

      // Show Success Box
      if (successTitle) successTitle.innerText = "Welcome to BarberApp!";
      if (successDesc) successDesc.innerText = "Your customer account was created successfully. Redirecting...";
      successAlert?.classList.remove("hidden");
      btnText.innerText = "Account Created!";

      setTimeout(() => {
        redirectByAuthority(authData);
      }, 1200);

    } catch (err) {
      console.error("Customer registration error:", err);

      errorTitle.innerText = "Registration Failed";
      errorDesc.innerText = err.message || "An error occurred during account creation. Please try again.";
      errorAlert.classList.remove("hidden");

      submitBtn.disabled = false;
      btnText.innerText = "Create Customer Account";
      btnSpinner.classList.add("hidden");
    }
  });
}

/* ---------------- DYNAMIC ROLE REDIRECTION ROUTER ---------------- */
function redirectByAuthority(user) {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get("redirect_to");
  const querySlug = urlParams.get("slug");
  const isInsideDashboard = window.location.pathname.includes("/dashboard/");

  if (redirectTo) {
    const isSuperAdminOnly = redirectTo.includes("salons.html") || redirectTo.includes("admin.html");
    if (isSuperAdminOnly && user.role !== "SUPER_ADMIN") {
      const slug = user.salonSlug || querySlug || "golden-scissors";
      window.location.href = `../portal/index.html?slug=${slug}#dashboard`;
      return;
    }
    window.location.href = redirectTo;
    return;
  }

  // Role Redirection Matrix
  if (user.role === "SUPER_ADMIN" || user.role === "SUPPORT_AGENT") {
    window.location.href = isInsideDashboard ? "./admin.html" : "./dashboard/admin.html";
  } else if (user.role === "SALON_OWNER") {
    const slug = user.salonSlug || querySlug || "golden-scissors";
    window.location.href = `./portal/index.html?slug=${slug}#dashboard`;
  } else if (user.role === "SALON_STAFF" || user.role === "BARBER") {
    const slug = user.salonSlug || querySlug || "golden-scissors";
    window.location.href = `./portal/index.html?slug=${slug}#bookings`;
  } else {
    // Role CUSTOMER
    if (querySlug) {
      window.location.href = `./booking/?slug=${querySlug}`;
    } else {
      window.location.href = `./booking/`;
    }
  }
}
