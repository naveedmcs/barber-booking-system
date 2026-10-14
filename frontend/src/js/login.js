/**
 * JWT Authentication & Post-Login Authority Router
 */

import { Store } from "./store.js";

document.addEventListener("DOMContentLoaded", () => {
  Store.init();

  // If already authenticated, redirect immediately based on role
  const currentUser = Store.getCurrentUser();
  if (currentUser && currentUser.token) {
    redirectByAuthority(currentUser);
    return;
  }

  initSeedButtons();
  initLoginForm();
});

function initSeedButtons() {
  document.querySelectorAll(".seed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-email");
      const pass = btn.getAttribute("data-pass");

      document.getElementById("email").value = email;
      document.getElementById("password").value = pass;
      document.getElementById("login-form").dispatchEvent(new Event("submit"));
    });
  });
}

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

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) return;

    // Loading State
    submitBtn.disabled = true;
    btnText.innerText = "Signing in...";
    btnSpinner.classList.remove("hidden");
    errorAlert.classList.add("hidden");

    try {
      // Attempt backend login
      const response = await fetch("http://localhost:8080/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe: rememberMe.checked })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Authentication failed");
      }

      // Store token & user session
      const authData = {
        token: data.accessToken,
        role: data.user.role,
        userId: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        salonId: data.user.salonId,
        salonName: data.user.salonName,
        salonSlug: data.user.salonSlug || "golden-scissors"
      };

      Store.setCurrentUser(authData, rememberMe.checked);
      Store.addUserLogin(
        authData.email,
        authData.fullName || "User",
        authData.role,
        authData.salonName || (authData.role === "SUPER_ADMIN" ? "Global System" : "Assigned Salon"),
        "AUTH_LOGIN_SUCCESS"
      );
      redirectByAuthority(authData);

    } catch (err) {
      console.warn("Backend auth offline or failed, attempting local store fallback authentication...", err);

      // Client Fallback Authentication
      const fallbackRes = Store.loginSalonAdmin(email, password);
      if (fallbackRes.success) {
        redirectByAuthority(fallbackRes.user);
      } else {
        errorTitle.innerText = "Authentication Failed";
        errorDesc.innerText = err.message || fallbackRes.message || "Invalid email or password.";
        errorAlert.classList.remove("hidden");
        
        submitBtn.disabled = false;
        btnText.innerText = "Sign In";
        btnSpinner.classList.add("hidden");
      }
    }
  });
}

function redirectByAuthority(user) {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get("redirect_to");
  const isInsideDashboard = window.location.pathname.includes("/dashboard/");

  if (redirectTo) {
    const isSuperAdminOnly = redirectTo.includes("salons.html") || redirectTo.includes("admin.html");
    if (isSuperAdminOnly && user.role !== "SUPER_ADMIN") {
      const slug = user.salonSlug || "golden-scissors";
      window.location.href = `../portal/index.html?slug=${slug}`;
      return;
    }
    window.location.href = redirectTo;
    return;
  }

  if (user.role === "SUPER_ADMIN") {
    window.location.href = isInsideDashboard ? "./admin.html" : "./dashboard/admin.html";
  } else if (user.role === "SALON_STAFF" || user.role === "BARBER") {
    const slug = user.salonSlug || "golden-scissors";
    window.location.href = `./portal/index.html?slug=${slug}#schedule`;
  } else {
    const slug = user.salonSlug || "golden-scissors";
    window.location.href = `./portal/index.html?slug=${slug}#bookings`;
  }
}
