# System Routing & API Specifications
## BarberApp KSA — Canonical Routes, APIs & Payloads

This document provides a single, authoritative reference for all user journeys, frontend routing definitions, redirect aliases, and REST API contracts across the platform.

---

## 1. Frontend Route Registry

All frontend applications are served as modern, responsive vanilla ES-module web clients.

| User Role / Journey | Canonical URL | File Path | Route Type & Notes |
| :--- | :--- | :--- | :--- |
| **Public Visitor / Landing** | `/index.html` or `/` | `frontend/index.html` | Public landing page, platform overview, CTA buttons. |
| **Customer Booking Funnel** | `/booking.html?slug={slug}` | `frontend/booking.html` | **Canonical 6-step customer booking funnel**. Full database sync, hold countdown timer, dual calendar export. |
| **Customer Booking (Subfolder)**| `/booking/?slug={slug}` | `frontend/booking/index.html` | Canonical directory alias for web servers mapping subfolders. |
| **Customer Booking (Legacy Alias)**| `/book.html?slug={slug}` | `frontend/book.html` | **Automatic client redirect** -> `/booking.html` (preserves query params & hash). |
| **Customer Booking (Legacy Subfolder)**| `/book/?slug={slug}` | `frontend/book/index.html` | **Automatic client redirect** -> `../booking.html` (preserves query params & hash). |
| **Public Salon Directory** | `/salons.html` | `frontend/salons.html` | Search, filter by city/rating, view salon cards and booking CTAs. |
| **Salon Onboarding** | `/register.html` | `frontend/register.html` | 4-step wizard: plan selection, owner info, salon creation, QR display. |
| **Unified Portal Login** | `/login.html` | `frontend/login.html` | Unified credentials login for Super Admins, Salon Owners, and Staff. |
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

---

## 2. Canonical Backend REST API Endpoints

Base URL in local development: `http://localhost:8080`.

### 2.1 Public Authentication & Onboarding (`/api/v1/auth`, `/api/shops`)

#### `POST /api/v1/auth/login`
- **Description**: Authenticate user credentials and return JWT bearer token.
- **Request Body**:
  ```json
  {
    "email": "owner@salon.sa",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "userId": 10,
    "email": "owner@salon.sa",
    "fullName": "Fahad Al-Harbi",
    "role": "SALON_OWNER",
    "salonId": 1,
    "salonSlug": "golden-scissors"
  }
  ```
- **Errors**: `401 Unauthorized` (invalid credentials), `403 Forbidden` (suspended account).

#### `POST /api/shops/register`
- **Description**: Register a new salon tenant and provision owner account.
- **Request Body**:
  ```json
  {
    "ownerName": "Fahad Al-Harbi",
    "ownerEmail": "owner@salon.sa",
    "password": "Password123!",
    "phone": "0501234567",
    "shopName": "Royal Fade Barber",
    "city": "Riyadh",
    "plan": "PROFESSIONAL"
  }
  ```
- **Response `201 Created`**: Returns created Shop entity with `bookingUrl` and `qrCodeUrl`.

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
