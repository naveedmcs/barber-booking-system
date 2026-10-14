# System Routing & API Specifications
## BarberApp KSA — Canonical Routes, APIs & Payloads

This document provides a single, authoritative reference for all user journeys, frontend routing definitions, redirect aliases, and REST API contracts across the platform.

---

## 1. Frontend Route Registry

All frontend applications are served as modern, responsive vanilla ES-module web clients.

| User Role / Journey | Canonical URL | File Path | Route Type & Notes |
| :--- | :--- | :--- | :--- |
| **Public Visitor / Landing** | `/index.html` or `/` | `frontend/index.html` | Public landing page, platform overview, CTA buttons. |
| **Customer Booking Funnel (Canonical)** | `/booking/?slug={slug}` | `frontend/booking/index.html` | **Single canonical physical booking page**. Role-aware (Customer, Staff, Salon Owner, Super Admin), 6-step funnel, concurrency hold timer, dual calendar export (.ics / Google). |
| **Customer Booking (HTTP Redirects)** | `/book`, `/book.html`, `/booking.html` | *Middleware Redirect* | **Server 302 redirect middleware** (`middleware.js` & `tunnel.sh`) cleanly mapping legacy paths to `/booking/` (preserving query params & hash). |
| **Public Salon Directory** | `/salons.html` | `frontend/salons.html` | Search, filter by city/rating, view salon cards and booking CTAs. |
| **Salon Onboarding** | `/register.html` | `frontend/register.html` | 4-step wizard: plan selection, owner info, salon creation, QR display. |
| **Unified Portal Login & Customer Sign-Up** | `/login.html` | `frontend/login.html` | Unified credentials login for Super Admins, Salon Owners, Staff, and Customer registration tab. |
| **Password Reset: Forgot Password** | `/forgot-password.html` | `frontend/forgot-password.html` | Password recovery initiation form (dispatches 32-byte recovery link). |
| **Password Reset: Set New Password** | `/reset-password.html?token={token}` | `frontend/reset-password.html` | Password update completion form validating single-use token. |
| **Salon Owner Portal** | `/portal/index.html` | `frontend/portal/index.html` | Multi-tenant salon dashboard, appointments, walk-in modal, calendar. |
| **Salon Portal: Staff** | `/portal/staff/index.html` | `frontend/portal/staff/index.html` | Team roster, invite barber, skills tags, shift scheduler. (Alias: `/portal/staff.html`) |
| **Salon Portal: Services** | `/portal/services/index.html` | `frontend/portal/services/index.html` | Service catalog, pricing, durations, categories. (Alias: `/portal/services.html`) |
| **Salon Portal: Settings** | `/portal/settings/index.html` | `frontend/portal/settings/index.html` | Operating hours matrix, branding logo/cover, bank info. (Alias: `/portal/settings.html`) |
| **Platform Super Admin** | `/dashboard/admin.html` | `frontend/dashboard/admin.html` | Full RBAC console, audit trail, salon management, system settings. |
| **Admin: Access Control** | `/admin/access-control.html` | `frontend/admin/access-control.html` | Redirects to `/dashboard/admin.html#access-control`. |
| **Admin: Salons Management**| `/admin/salons.html` | `frontend/admin/salons.html` | Redirects to `/dashboard/admin.html#salons`. |
| **Admin: System Settings** | `/admin/settings.html` | `frontend/admin/settings.html` | Redirects to `/dashboard/admin.html#settings`. |
| **Admin: Audit Log Viewer** | `/admin/audit.html` | `frontend/admin/audit.html` | Redirects to `/dashboard/admin.html#audit`. |
| **Salon Standalone Timetable** | `/dashboard/index.html?slug={slug}` | `frontend/dashboard/index.html` | Morning / Afternoon / Evening schedule timetable view with cross-tab broadcast. |

### 1.1 Multi-Role Awareness on `/booking/?slug={slug}`

The single canonical customer booking page (`frontend/booking/index.html`) automatically inspects the current user session (`Store.getCurrentUser()`) and dynamically adapts its UI and capabilities per role:

1. **Customer (Public / Unauthenticated)**:
   - **Default UI**: Full mobile-friendly 6-step booking stepper (Salon, Services, Barber, Slot, Details, Receipt) with 5-minute concurrency hold timer and dual calendar export (.ics / Google Calendar).
   - **Privacy Guardrail**: Individual barber phone numbers are strictly hidden from customers across all cards and summaries. Contact information is restricted solely to the verified salon business phone (`shop.phone`).
   - **Admin Bar**: Fully hidden (`class="hidden"`), no administrative controls rendered.

2. **Salon Owner & Salon Staff**:
   - **Role Utility Bar**: Subtle, high-contrast top bar displaying:
     - Identity pill: `👑 Salon Owner` or `💈 Salon Staff`.
     - Context indicator: `Viewing as [Staff Name / Owner] • [Salon Name]`.
     - Action toggle: `⚡ Switch to Walk-In Mode` (active state indicates `⚡ Walk-In Mode: ACTIVE`).
     - Dashboard shortcut: `← Return to Portal Dashboard` (`/portal/index.html#bookings`).
   - **Walk-In Mode Mechanics**:
     - Pre-fills the logged-in staff member or owner as the designated barber in Step 2.
     - Displays an active staff override banner during Step 4 ("Walk-In Mode Active — Auto-confirms appointment into staff portal schedule").
     - Modifies CTA button to `⚡ Confirm & Auto-Approve Walk-In (Direct to Schedule)`.
     - Automatically confirms the booking (`status: "CONFIRMED"`, `walkIn: true`) and records an audit log entry (`PORTAL_STAFF_WALKIN_BOOKED`).
     - Step 5 receipt provides a direct action link back to the live portal schedule.

3. **Platform Super Admin & Support Agent**:
   - **Role Banner**: Prominent purple administrative preview banner at the top of the viewport:
     - `🛡️ Platform Super Admin — Admin Preview Mode • Inspecting Storefront: [Salon Name]`.
     - Direct navigation link: `← Return to Salons Directory` (`/dashboard/admin.html#salons`).

---

## 2. Canonical Backend REST API Endpoints

Base URL in local development: `http://localhost:8080`.

### 2.1 Public Authentication, Registration & Password Reset (`/api/auth`, `/api/v1/auth`)

#### `POST /api/auth/login` (Alias: `POST /api/v1/auth/login`)
- **Description**: Authenticate user credentials against BCrypt database hash and return signed JWT bearer token.
- **Request Body**:
  ```json
  {
    "email": "owner@goldenscissors.sa",
    "password": "Owner123!",
    "rememberMe": true
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": 139,
      "email": "owner@goldenscissors.sa",
      "fullName": "Tariq Al-Mansoor",
      "phone": "0501234567",
      "role": "SALON_OWNER",
      "salonId": 53,
      "salonName": "Golden Scissors Salon",
      "salonSlug": "golden-scissors"
    }
  }
  ```
- **Errors**: `401 Unauthorized` (`{"error":"Invalid credentials","message":"Invalid email or password"}`), `403 Forbidden` (inactive user).

#### `POST /api/auth/register` (Alias: `POST /api/v1/auth/register`)
- **Description**: Public customer account registration. Atomically provisions `User` (`role: CUSTOMER`) and linked `Customer` record.
- **Request Body**:
  ```json
  {
    "fullName": "Fahad Al-Otaibi",
    "phone": "0512345678",
    "email": "fahad@example.sa",
    "password": "CustomerSecurePass123!"
  }
  ```
- **Response `201 Created`**: Returns `AuthResponseDTO` with signed JWT `accessToken` and user object (`role: "CUSTOMER"`).
- **Errors**: `409 Conflict` (Email or phone already registered), `400 Bad Request` (Invalid Saudi phone format).

#### `POST /api/auth/register-salon` (Alias: `POST /api/shops/register`)
- **Description**: Public business onboarding. Atomically provisions `Shop` entity and linked `User` (`role: SALON_OWNER`).
- **Request Body**:
  ```json
  {
    "ownerFullName": "Tariq Al-Mansoor",
    "ownerEmail": "tariq@newbarbers.sa",
    "ownerPassword": "SecureOwnerPass123!",
    "shopName": "New Barbers Lounge",
    "phone": "0551122334",
    "city": "Riyadh",
    "district": "Olaya",
    "region": "Riyadh Region",
    "subscriptionPlan": "MONTHLY"
  }
  ```
- **Response `201 Created`**: Returns `AuthResponseDTO` with signed JWT `accessToken` and user object bound via `salonId`.

#### `POST /api/auth/forgot-password`
- **Description**: Initiates password recovery. Dispatches single-use 32-byte cryptographic token with 60-minute expiry.
- **Request Body**:
  ```json
  {
    "email": "user@domain.sa"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Password reset instructions generated successfully.",
    "email": "user@domain.sa",
    "expiresInMinutes": 60,
    "resetLink": "/reset-password.html?token=8bc644394e0ef78850ee97d88c1fcd01481bb4261f68895af01a5653a013909c",
    "token": "8bc644394e0ef78850ee97d88c1fcd01481bb4261f68895af01a5653a013909c"
  }
  ```
- **Security Rule**: Returns `200 OK` even if email is not found to prevent user enumeration attacks.

#### `POST /api/auth/reset-password`
- **Description**: Validates token and updates user password with BCrypt encryption.
- **Request Body**:
  ```json
  {
    "token": "8bc644394e0ef78850ee97d88c1fcd01481bb4261f68895af01a5653a013909c",
    "newPassword": "NewStrongPassword456!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Password updated successfully. You may now log in with your new password.",
    "email": "user@domain.sa"
  }
  ```
- **Errors**: `400 Bad Request` (Token invalid, expired, or already used).

#### `GET /api/auth/me`
- **Description**: Returns authenticated user session profile. Requires `Authorization: Bearer <token>`.

#### `GET /api/dev/reset-links`
- **Description**: Development-only endpoint listing active reset links for zero-SMTP local testing.

---

### 2.2 Customer Booking Flow (`/api/bookings`, `/api/slots`)

#### `POST /api/bookings/public`
- **Description**: Public booking creation endpoint called directly by `booking-stepper.js`.
- **Request Body**:
  ```json
  {
    "shopId": 1,
    "shopSlug": "golden-scissors",
    "barberId": 2,
    "barberName": "Master Barber Ahmed",
    "serviceId": 10,
    "serviceName": "Signature Royal Haircut & Beard Shaping",
    "customerName": "Mohammed Al-Ghamdi",
    "customerPhone": "0512345678",
    "customerEmail": "customer@gmail.com",
    "date": "2026-10-14",
    "time": "11:00 AM",
    "slotStart": "2026-10-14T11:00:00",
    "notes": "Low skin fade, organic oils",
    "referenceCode": "BBR-84920"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "id": 142,
    "shopId": 1,
    "shopName": "Golden Scissors Salon",
    "barberId": 2,
    "barberName": "Master Barber Ahmed",
    "serviceName": "Signature Royal Haircut & Beard Shaping",
    "customerName": "Mohammed Al-Ghamdi",
    "customerPhone": "0512345678",
    "slotStart": "2026-10-14T11:00:00",
    "slotEnd": "2026-10-14T11:45:00",
    "status": "CONFIRMED",
    "notes": "Low skin fade, organic oils"
  }
  ```
- **Errors**: `400 Bad Request` (invalid phone or dates), `409 Conflict` (slot double-booked).

#### `POST /api/slots/hold`
- **Description**: Acquires a 5-minute concurrency hold on a slot via Redis distributed lock.
- **Request Body**:
  ```json
  {
    "shopId": 1,
    "barberId": 2,
    "serviceId": 10,
    "customerId": 55,
    "slotStart": "2026-10-14T11:00:00",
    "slotEnd": "2026-10-14T11:45:00"
  }
  ```
- **Response `201 Created`**: Booking entity with status `HOLD` and `holdExpiresAt` (+5 minutes).
- **Errors**: `409 Conflict` (`"Slot is currently held or already booked."`).

#### `GET /api/bookings/{id}/calendar`
- **Description**: Streams RFC-5545 `.ics` file for native calendar import.
- **Response `200 OK`**: Content-Type `text/calendar;charset=UTF-8`, attachment `appointment-{id}.ics`.

---

### 2.3 QR Code Generation Subsystem (`/api/shops/{id}/qr`)

| Method | Endpoint | Query Params | Response Content-Type | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/shops/{id}/qr/booking` | `format=png\|svg`, `size=300` | `image/png` or `image/svg+xml` | Encodes public booking URL (`http://localhost:3000/booking.html?slug={slug}`). |
| `GET` | `/api/shops/{id}/qr/login` | `format=png\|svg`, `size=300` | `image/png` or `image/svg+xml` | Encodes salon dashboard login URL. |
| `GET` | `/api/shops/{id}/qr/zip` | *(none)* | `application/zip` | Downloads bundled ZIP package with both SVG and PNG variants. |

---

### 2.4 Multi-Tenant Salon Owner Portal (`/api/portal/**`)

*All requests require header: `Authorization: Bearer <JWT>` with role `SALON_OWNER` or `SALON_STAFF`.*

#### 1. Context & Appointments
- `GET /api/portal/context?userId={id}`: Returns `{ salon, user, role, permissions }`.
- `GET /api/portal/bookings?date=YYYY-MM-DD`: Returns appointments for salon on selected date.
- `POST /api/portal/walk-in`: Quick manual walk-in appointment creation.
- `PATCH /api/portal/bookings/{id}/status`: Transition appointment status (`CONFIRMED`, `IN_SERVICE`, `COMPLETED`, `CANCELLED`).

#### 2. Staff Management
- `GET /api/portal/staff`: Roster of barbers, skills tags, status, and avatars.
- `POST /api/portal/staff/invite`: Provision new barber with credentials, skills tags, and avatar.
- `PATCH /api/portal/staff/{id}/status`: Toggle active status (checks upcoming booking conflicts).
- `DELETE /api/portal/staff/{id}`: Soft-delete barber (`deleted_at = NOW()`, validates conflict).
- `POST /api/portal/staff/upload-avatar`: Upload barber avatar (max 2MB, JPEG/PNG/WebP).

#### 3. Services Catalog
- `GET /api/portal/services`: Service items, categories, pricing, duration, and buffer times.
- `POST /api/portal/services`: Create new service item.
- `PUT /api/portal/services/{id}`: Update service item.
- `DELETE /api/portal/services/{id}`: Delete service item.

#### 4. Settings & Media
- `GET /api/portal/settings`: Operating hours matrix, branding logo/cover, bank details.
- `PUT /api/portal/settings`: Update salon profile and hours.
- `POST /api/portal/gallery/upload`: Upload gallery photo (max 5 photos, max 5MB each).
- `DELETE /api/portal/gallery/{imageId}`: Remove photo from gallery.

#### 5. Financial Analytics
- `GET /api/portal/analytics/revenue`: Real-time revenue metrics strictly from completed bookings.

---

### 2.5 Platform Super Admin (`/api/admin/**`)

*All requests require header: `Authorization: Bearer <JWT>` with role `SUPER_ADMIN`.*

- `GET /api/admin/users`: List platform administrators with roles and activity timestamps.
- `POST /api/admin/users/invite`: Invite platform user (`SUPER_ADMIN` or `SUPPORT_AGENT`).
- `PATCH /api/admin/users/{id}/role`: Update platform role.
- `PATCH /api/admin/users/{id}/status`: Toggle active/suspended state.
- `GET /api/admin/audit-logs`: Query immutable platform audit logs with pagination, user, shop, action, and date filters.
