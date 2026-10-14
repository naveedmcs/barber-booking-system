/**
 * Forgot Password Flow
 * Submits email to /api/auth/forgot-password and surfaces recovery link
 */

function getBackendBase() {
  const isLocalhost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isLocalhost && window.location.port !== "8080") {
    return "http://localhost:8080";
  }
  return "";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgot-form");
  const emailInput = document.getElementById("email");
  const submitBtn = document.getElementById("submit-btn");
  const btnText = document.getElementById("btn-text");
  const btnSpinner = document.getElementById("btn-spinner");
  const errorBox = document.getElementById("error-box");
  const errorTitle = document.getElementById("error-title");
  const errorDesc = document.getElementById("error-desc");
  const successBox = document.getElementById("success-box");
  const devLinkContainer = document.getElementById("dev-link-container");
  const devResetLink = document.getElementById("dev-reset-link");

  // Quick email selector buttons
  document.querySelectorAll(".quick-email-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-email");
      if (emailInput) {
        emailInput.value = email;
        emailInput.focus();
      }
    });
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email) return;

    // Reset UI alerts
    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");
    devLinkContainer.classList.add("hidden");

    // Loading State
    submitBtn.disabled = true;
    btnText.innerText = "Dispatching...";
    btnSpinner.classList.remove("hidden");

    try {
      const backendBase = getBackendBase();
      const response = await fetch(`${backendBase}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to process password reset.");
      }

      // Display Success State
      successBox.classList.remove("hidden");

      // Check if backend returned dev reset link
      if (data.resetLink || data.token) {
        const targetUrl = data.resetLink || `./reset-password.html?token=${data.token}`;
        devResetLink.href = targetUrl;
        devLinkContainer.classList.remove("hidden");
      }

      btnText.innerText = "Link Generated";
      submitBtn.disabled = false;
      btnSpinner.classList.add("hidden");

    } catch (err) {
      console.error("Forgot password error:", err);

      errorTitle.innerText = "Reset Request Failed";
      errorDesc.innerText = err.message || "An unexpected error occurred. Please try again.";
      errorBox.classList.remove("hidden");

      submitBtn.disabled = false;
      btnText.innerText = "Generate Reset Link";
      btnSpinner.classList.add("hidden");
    }
  });
});
