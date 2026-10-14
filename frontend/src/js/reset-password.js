/**
 * Reset Password Handler
 * Reads token from URL and posts new password to /api/auth/reset-password
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
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const form = document.getElementById("reset-form");
  const tokenInput = document.getElementById("reset-token");
  const newPassInput = document.getElementById("new-password");
  const confirmPassInput = document.getElementById("confirm-password");
  const submitBtn = document.getElementById("submit-btn");
  const btnText = document.getElementById("btn-text");
  const btnSpinner = document.getElementById("btn-spinner");
  const missingTokenBox = document.getElementById("missing-token-box");
  const errorBox = document.getElementById("error-box");
  const errorTitle = document.getElementById("error-title");
  const errorDesc = document.getElementById("error-desc");
  const successBox = document.getElementById("success-box");

  if (!token || token.trim() === "") {
    form.classList.add("hidden");
    missingTokenBox.classList.remove("hidden");
    return;
  }

  tokenInput.value = token.trim();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newPassword = newPassInput.value;
    const confirmPassword = confirmPassInput.value;

    errorBox.classList.add("hidden");
    successBox.classList.add("hidden");

    if (newPassword !== confirmPassword) {
      errorTitle.innerText = "Passwords Do Not Match";
      errorDesc.innerText = "Please ensure both password fields match exactly.";
      errorBox.classList.remove("hidden");
      confirmPassInput.focus();
      return;
    }

    if (newPassword.length < 6) {
      errorTitle.innerText = "Password Too Short";
      errorDesc.innerText = "New password must be at least 6 characters in length.";
      errorBox.classList.remove("hidden");
      newPassInput.focus();
      return;
    }

    // Loading State
    submitBtn.disabled = true;
    btnText.innerText = "Updating Password...";
    btnSpinner.classList.remove("hidden");

    try {
      const backendBase = getBackendBase();
      const response = await fetch(`${backendBase}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenInput.value,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to reset password.");
      }

      // Success
      form.classList.add("hidden");
      successBox.classList.remove("hidden");

      setTimeout(() => {
        window.location.href = "./login.html";
      }, 2500);

    } catch (err) {
      console.error("Reset password error:", err);

      errorTitle.innerText = "Password Reset Failed";
      errorDesc.innerText = err.message || "The reset token is invalid, expired, or has already been used.";
      errorBox.classList.remove("hidden");

      submitBtn.disabled = false;
      btnText.innerText = "Confirm & Update Password";
      btnSpinner.classList.add("hidden");
    }
  });
});
