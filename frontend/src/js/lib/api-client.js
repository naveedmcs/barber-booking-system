/**
 * Unified REST API Client for Barber SaaS Platform
 */

export function getApiBaseUrl() {
  const isLocalhost = typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  
  if (isLocalhost && window.location.port !== "8080") {
    return "http://localhost:8080";
  }
  return "";
}

export async function apiClient(endpoint, options = {}) {
  const base = getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${base}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  // Auto-inject JWT Bearer token if present
  try {
    const raw = localStorage.getItem("barber_current_user");
    if (raw) {
      const user = JSON.parse(raw);
      const token = user?.token || user?.accessToken;
      if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    // Ignore localStorage parse errors
  }

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Unauthorized session
    console.warn("API 401 Unauthorized:", endpoint);
  }

  return response;
}
