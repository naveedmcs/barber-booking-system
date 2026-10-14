/**
 * Global Test Setup & Real Database Integration Test Harness
 * Connects directly to Spring Boot backend (port 8080) and MySQL (port 3307)
 */

export const API_BASE = "http://localhost:8080";
export const FRONTEND_BASE = "http://localhost:3000";

let cachedTokens = {
  admin: null,
  owner: null,
  staff: null
};

/**
 * Universal JSON/REST Request Helper
 */
export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const config = {
    method: options.method || "GET",
    headers
  };

  if (options.body) {
    if (typeof options.body === "object" && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    } else {
      config.body = options.body;
    }
  }

  const response = await fetch(url, config);

  const contentType = response.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    data
  };
}

/**
 * Ensures backend server is healthy before test suites run
 */
export async function ensureBackendReady() {
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`${API_BASE}/api/shops`);
      if (res.status < 500) return true;
    } catch (err) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Spring Boot backend is not responding at ${API_BASE}`);
}

/**
 * Super Admin Auth Token
 */
export async function getAdminToken() {
  if (cachedTokens.admin) return cachedTokens.admin;
  const res = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@barberapp.sa", password: "Admin123!" }
  });
  if (!res.ok || !res.data.accessToken) {
    throw new Error(`Failed to authenticate admin: ${JSON.stringify(res.data)}`);
  }
  cachedTokens.admin = res.data.accessToken;
  return cachedTokens.admin;
}

/**
 * Salon Owner Auth Token (Golden Scissors, Salon ID 53)
 */
export async function getOwnerToken() {
  if (cachedTokens.owner) return cachedTokens.owner;
  const res = await request("/api/auth/login", {
    method: "POST",
    body: { email: "owner@goldenscissors.sa", password: "Owner123!" }
  });
  if (!res.ok || !res.data.accessToken) {
    throw new Error(`Failed to authenticate salon owner: ${JSON.stringify(res.data)}`);
  }
  cachedTokens.owner = res.data.accessToken;
  return cachedTokens.owner;
}

/**
 * Salon Staff Auth Token (Golden Scissors, Barber staff)
 */
export async function getStaffToken() {
  if (cachedTokens.staff) return cachedTokens.staff;
  const res = await request("/api/auth/login", {
    method: "POST",
    body: { email: "staff@goldenscissors.sa", password: "Staff123!" }
  });
  if (!res.ok || !res.data.accessToken) {
    throw new Error(`Failed to authenticate salon staff: ${JSON.stringify(res.data)}`);
  }
  cachedTokens.staff = res.data.accessToken;
  return cachedTokens.staff;
}

/**
 * Creates unique test customer and returns credentials & token
 */
export async function createTestCustomer(prefix = "cust") {
  const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const phoneSuffix = String(Math.floor(10000000 + Math.random() * 90000000));
  const phone = `05${phoneSuffix}`;
  const email = `${prefix}_${uniqueId}@barberapp.sa`;
  const password = "TestPassword123!";
  const fullName = `Test Customer ${uniqueId}`;

  const res = await request("/api/auth/register", {
    method: "POST",
    body: { fullName, phone, email, password }
  });

  if (!res.ok) {
    throw new Error(`Failed to register test customer: ${JSON.stringify(res.data)}`);
  }

  return {
    id: res.data.user.id,
    token: res.data.accessToken,
    email,
    phone,
    fullName,
    password
  };
}

/**
 * Returns real dynamic shop details, barbers, and services
 */
export async function getShopDetails(shopId = 53) {
  const [shopRes, barbersRes, servicesRes] = await Promise.all([
    request(`/api/shops/${shopId}`),
    request(`/api/shops/${shopId}/barbers`),
    request(`/api/shops/${shopId}/services`)
  ]);
  return {
    shop: shopRes.data,
    barbers: barbersRes.data,
    services: servicesRes.data
  };
}

/**
 * Generates random Saudi mobile number
 */
export function generateSaudiPhone() {
  return "05" + Math.floor(10000000 + Math.random() * 90000000);
}

export function formatLocalISO(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Generates collision-free future ISO slot range (e.g. 2027-xx-xxTxx:xx:00)
 */
export function generateUniqueSlot(durationMinutes = 30) {
  const futureBase = new Date(Date.now() + 86400000 * (40 + Math.floor(Math.random() * 400)));
  const hour = 9 + Math.floor(Math.random() * 10);
  const min = Math.floor(Math.random() * 12) * 5;
  futureBase.setHours(hour, min, 0, 0);
  const start = formatLocalISO(futureBase);
  const endDate = new Date(futureBase.getTime() + durationMinutes * 60000);
  const end = formatLocalISO(endDate);
  return { start, end, startDate: futureBase, endDate };
}
