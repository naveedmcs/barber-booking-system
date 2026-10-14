# Business Requirements Document (BRD) - Baseline Specification
**Product**: Salon & Barber Booking SaaS Platform  
**Version**: 1.1-BASELINE (Reverse-Engineered from Running Codebase)  
**Author**: Principal Systems Architect & Technical Product Manager  
**Date**: October 2026  
**Target Market**: Saudi Arabia & GCC Region  
**Document Status**: Baseline Approved for Sprint Planning  

---

## 1. Document Control & History

| Version | Date | Description | Author | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1.0** | Sep 2026 | Initial Product Requirements & Conceptual BRD | Product Owner | Archived |
| **1.1-BASELINE** | Oct 2026 | Forensic Reverse-Engineered Baseline Document reflecting actual codebase implementation, architectural boundaries, and operational gaps | Principal Systems Architect | **Active Baseline** |

---

## 2. Business Problem & Strategic Vision

### 2.1 The Core Problem
In the Saudi Arabian and wider GCC personal grooming sector, barbershops and salons operate overwhelmingly on uncoordinated walk-in traffic. This leads to:
1. **Severe Customer Friction**: Prolonged, unpredictable wait times (45–90 minutes during peak evening and weekend hours).
2. **Suboptimal Chair Utilization**: Barbers experience uneven throughput—severe overcrowding during evenings alternating with completely idle morning hours.
3. **No Digital Discovery or Advance Booking**: Salons lack lightweight, multi-tenant digital infrastructure to publish real-time barber availability, accept bookings, and manage schedules without expensive custom software.

### 2.2 Product Value Proposition
The **Salon & Barber Booking SaaS Platform** delivers an all-in-one multi-tenant solution allowing salon owners to self-register, establish immediate digital booking portals, generate instant QR codes for store-front marketing, and coordinate appointments in real-time.

```
+--------------------------------------------------------------------------------------------------+
|                                    PLATFORM VALUE CHAIN                                          |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +-----------------------+       Auto-Approved Webhook       +------------------------------+   |
|   |   Salon Owner Signs   | --------------------------------> |  Dedicated Booking Portal    |   |
|   |  Up & Selects Plan    |      (Moyasar: 20 or 200 SAR)     |  book.barberapp.sa/[slug]    |   |
|   +-----------------------+                                   +------------------------------+   |
|                                                                               |                  |
|                                                                               v                  |
|   +-----------------------+         5-Minute Redis Lock       +------------------------------+   |
|   |  Customer Walks In /  | <-------------------------------- |  Customer Selects Barber,    |   |
|   |  Scans Front QR Code  |      Zero Double-Booking Risk     |  Service, & 30-min Slot      |   |
|   +-----------------------+                                   +------------------------------+   |
|               |                                                               |                  |
|               v                                                               v                  |
|   +-----------------------+                                   +------------------------------+   |
|   | Salon Live Timetable  | <-------------------------------- |  Appointment Confirmed +     |   |
|   | Updates Automatically |      Live WebSockets & ICS Sync   |  Calendar (.ics) Downloaded  |   |
|   +-----------------------+                                   +------------------------------+   |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. User Personas & Permissions (RBAC)

### 3.1 User Personas

| Persona | Role Identifier | Profile & Operational Responsibility |
| :--- | :--- | :--- |
| **Super Administrator** | `SUPER_ADMIN` | Platform operator overseeing all tenants, subscriptions, payment transaction streams, and security audit logs. Holds authority to manually approve, suspend, or reactivate any salon. |
| **Salon Owner** | `SALON_OWNER` | Shop entrepreneur managing business profile, subscription tier, staff roster (barbers), service offerings, pricing, and viewing schedule revenue. |
| **Salon Staff / Barber** | `SALON_STAFF` / `BARBER` | Individual grooming professional managing daily appointment timetable, servicing customers, and recording walk-in reservations. |
| **Customer** | `CUSTOMER` | Public user accessing a shop's public booking portal via direct URL or store-front QR code to reserve a specific barber and service slot. |
| **Payment Gateway** | `SYSTEM_GATEWAY` | External automated system (Moyasar, Mada, STC Pay) issuing HMAC-signed webhook callbacks upon subscription payment execution. |

### 3.2 Permission & Tenant Boundary Matrix

| Capability / Resource | Super Admin | Salon Owner | Salon Staff | Public Customer |
| :--- | :---: | :---: | :---: | :---: |
| Self-Register Shop | Yes | Yes | No | No |
| Access Global Salons Directory | **Yes** | No (403 Forbidden) | No (403 Forbidden) | No |
| Manual Shop Override (Approve/Suspend) | **Yes** | No | No | No |
| View System Audit & Payment Ledgers | **Yes** | No | No | No |
| View Assigned Salon Timetable | Yes | **Yes (Tenant-isolated)** | **Yes (Assigned Shop)** | No |
| Create Walk-In Reservation | Yes | **Yes** | **Yes** | No |
| Browse Shop Public Booking Page | Yes | Yes | Yes | **Yes (Public)** |
| Acquire Slot Hold & Confirm Booking | Yes | Yes | Yes | **Yes (Public)** |
| Download RFC-5545 `.ics` Calendar | Yes | Yes | Yes | **Yes (Public)** |

---

## 4. Current System Boundaries & Implementation State

To establish an accurate engineering baseline, this section delineates what is verified working in production code versus what is simulated in client state:

```
+--------------------------------------------------------------------------------------------------+
|                            ACTUAL SYSTEM BOUNDARIES & SUBSYSTEMS                                 |
+--------------------------------------------------------------------------------------------------+
| [VERIFIED PRODUCTION CORE]                                                                       |
|  * Docker Compose Stack: MySQL 8.0 (Port 3307) & Redis 7.0 (Port 6379)                           |
|  * Flyway Schema Migrations: V1, V2, V3 creating 11 relational tables                            |
|  * Spring Security Stateless JWT Filter Chain with UserPrincipal RBAC                           |
|  * Redisson Distributed Slot Lock (Key: lock:slot:{barberId}:{slotStart}, 5-min TTL)             |
|  * HMAC SHA-256 Verified Webhook Auto-Approval Engine                                            |
|  * ZXing 3.5.3 Dual QR Code Generation (PNG, SVG, ZIP Bundle)                                    |
|  * Client Image Pre-compression Engine (HTML5 Canvas, 1200px, 0.75 quality)                      |
|                                                                                                  |
| [SIMULATED / CLIENT-SIDE STORE CORE]                                                             |
|  * Customer Booking Stepper: Operates on in-memory/localStorage state; no API lock call          |
|  * Salon Timetable: Renders from localStorage mock data; no DB persistence                       |
|  * Super Admin Status Toggling: Updates localStorage; no backend PATCH endpoint                  |
|  * Walk-in Booking: Saves to localStorage; no backend booking created                            |
|  * Audit Trail & Payments Table: Reads client defaults; no backend GET endpoints                |
|  * WebSocket Live Updates: Broker is active but backend never publishes slot events              |
+--------------------------------------------------------------------------------------------------+
```

---

## 5. Reverse-Engineered Functional Requirements

### Module 1: Authentication & Tenant Security (AUTH)
- **FR-AUTH-101 (Multi-Tenant Login)**: The system shall provide a unified authentication endpoint (`POST /api/v1/auth/login`) accepting email or Saudi mobile phone (`05XXXXXXXX`) and password.
- **FR-AUTH-102 (Credential Verification)**: Passwords shall be validated using BCrypt hashing, with plaintext comparison supported during initial migration/seeding.
- **FR-AUTH-103 (Account Status Check)**: Inactive or suspended accounts (`active == false`) must be blocked with HTTP 403 Forbidden ("Account suspended").
- **FR-AUTH-104 (JWT Token Generation)**: Upon valid authentication, the system shall issue a signed HMAC-SHA256 JWT bearer token containing claims: `userId`, `email`, `role`, `salonId`, and expiration timestamp (default 24 hours).
- **FR-AUTH-105 (Route Authority Guard)**: The frontend shall implement an authoritative route guard (`auth-guard.js`) intercepting unauthorized route transitions:
  - Root (`/` or `/index.html`) automatically routes authenticated sessions by authority (`SUPER_ADMIN` -> `/dashboard/admin.html`, `SALON_OWNER` -> `/dashboard/index.html?slug={slug}`).
  - Non-admin sessions attempting to access `/dashboard/admin.html` or `/salons.html` shall be blocked with HTTP 403 Forbidden.
  - Salon owners attempting to access another salon's dashboard slug shall be redirected to their assigned tenant slug.

---

### Module 2: Shop Onboarding & Registration (SHOP)
- **FR-SHOP-201 (Public Onboarding Portal)**: The system shall provide a multi-step public onboarding page (`register.html`) accessible without prior login.
- **FR-SHOP-202 (Saudi Phone Validation)**: Phone numbers must strictly adhere to the Saudi mobile format: exactly 10 digits starting with `05` (`^05[0-9]{8}$`). Leading prefixes (`+966`, `00966`, `966`) must be automatically stripped.
- **FR-SHOP-203 (Client Image Pre-Compression)**: Uploaded salon photos (up to 10 images, max 5MB each) must be automatically down-sampled and compressed via client HTML5 Canvas to a maximum width of 1200px at 0.75 JPEG quality before submission.
- **FR-SHOP-204 (Dynamic Staff & Service Catalog)**: The onboarding form must allow the owner to dynamically add, edit, and remove barbers (name, photo) and service offerings (name, duration in minutes, price in SAR).
- **FR-SHOP-205 (Subscription Tier Selection)**: The owner must select between two plans:
  - `MONTHLY`: 20 SAR / month
  - `YEARLY`: 200 SAR / year (Save 40 SAR)
- **FR-SHOP-206 (Registration Persistence)**: `POST /api/shops/register` shall create a new `User` record (role `SHOP_OWNER`), allocate a slug, create a `Shop` entity in `PENDING` status, and initialize default staff.
- **FR-SHOP-207 (Dual QR Code Generation)**: The system must automatically synthesize two separate QR codes upon registration:
  1. **Private Salon Admin Login QR**: Points to `/dashboard/index.html?slug={slug}`.
  2. **Public Customer Booking QR**: Points to `/book.html?slug={slug}`.
  Both QR codes must be exportable as PNG, SVG, and bundled ZIP archives containing a plaintext URL directory.

---

### Module 3: Payment Ingestion & Webhook Auto-Approval (PAY)
- **FR-PAY-301 (Webhook Endpoint)**: The system shall expose a secure webhook endpoint `POST /api/payments/webhook` to ingest payment status notifications from Moyasar and Mada.
- **FR-PAY-302 (HMAC Signature Verification)**: Inbound webhooks must supply an `X-Webhook-Signature` header computed via HMAC-SHA256 of the `transactionId` against `payment.webhook.secret`. Unauthorized requests must be rejected with HTTP 401 Unauthorized.
- **FR-PAY-303 (Idempotency Guarantee)**: If a `transactionId` has already been recorded in the `payments` table, the endpoint must immediately terminate processing and respond with HTTP 200 OK ("Event already processed") without modifying state.
- **FR-PAY-304 (Auto-Approval Transition)**: Upon receiving status `SUCCESS` or `PAID`:
  - The associated shop status must transition from `PENDING` to `ACTIVE`.
  - A definitive unique URL slug must be locked.
  - A `Subscription` entity must be generated with validity window matching the plan tier.
  - A `Payment` entity must be logged.
  - An `AuditLog` entry `SHOP_AUTO_APPROVED` must be persisted with client IP and transaction details.

---

### Module 4: Customer Booking Journey (BOOK)
- **FR-BOOK-401 (Dedicated Shop Portal)**: Each active shop shall be publicly accessible via `book.html?slug={shopSlug}`.
- **FR-BOOK-402 (Step 1 - Barber Selection)**: Customer browses barbers assigned to the shop with ratings and photo avatars.
- **FR-BOOK-403 (Step 2 - Service Selection)**: Customer browses services with duration (minutes) and price (SAR).
- **FR-BOOK-404 (Step 3 - Date & Slot Selection)**: Customer selects a target appointment date and chooses an available 30-minute interval across Morning, Afternoon, or Evening buckets.
- **FR-BOOK-405 (Distributed Slot Hold)**: Selecting a slot initiates a 5-minute reservation hold:
  - Redis distributed lock key `lock:slot:{barberId}:{slotStart}` acquired via Redisson.
  - A `Booking` record with `status = 'HOLD'` and `hold_expires_at = now + 5 min` is created.
  - Conflicting requests for the same barber and start time return HTTP 409 Conflict.
- **FR-BOOK-406 (Step 4 - Customer Identification)**: Customer provides Full Name and validated Saudi Mobile Number (`05XXXXXXXX`).
- **FR-BOOK-407 (Step 5 - Confirmation & Calendar Sync)**:
  - Booking transitions to `CONFIRMED`.
  - Customer receives summary confirmation.
  - Customer can download an RFC-5545 compliant `.ics` calendar invitation file.

---

### Module 5: Salon Live Schedule & Timetable (DASH)
- **FR-DASH-501 (Timetable Layout)**: The shop schedule (`dashboard/index.html?slug={slug}`) shall render operating slots categorized into Morning (09:00–11:59 AM), Afternoon (12:00–04:59 PM), and Evening (05:00–09:00 PM).
- **FR-DASH-502 (Slot Status Badging)**: Slot cards must visually indicate:
  - `AVAILABLE` (Emerald green badge, clickable for walk-in reservation)
  - `HOLD` (Amber badge with live CSS pulse animation)
  - `CONFIRMED` (Blue badge with customer name and service)
  - `BLOCKED` (Muted gray badge for breaks/holidays)
- **FR-DASH-503 (Walk-in Customer Reservation)**: Salon staff must be able to record on-the-spot walk-in customers through a modal popup, reserving the slot immediately.
- **FR-DASH-504 (Real-Time Push Synchronization)**: The schedule must connect to the backend STOMP WebSocket broker at `/ws` and subscribe to `/topic/shop/{shopId}/slots` to receive immediate push updates when slots are held or booked.

---

### Module 6: Super Administrator Global Console (ADMIN)
- **FR-ADMIN-601 (Platform Operational Metrics)**: The admin dashboard (`dashboard/admin.html`) must display real-time KPI counter cards: Total Salons, Audit Trail Event Count, Monthly Revenue in SAR, Active User Sessions, and Total Generated QR Codes.
- **FR-ADMIN-602 (Salons Registry & Override)**: Super Admin must view all registered salons and execute one-click status overrides:
  - `Approve`: Instantly transitions `PENDING` or `SUSPENDED` shop to `ACTIVE`.
  - `Suspend`: Instantly transitions `ACTIVE` shop to `SUSPENDED`, revoking customer bookings.
- **FR-ADMIN-603 (Salon Audit Trail)**: Displays system-wide operational events with timestamp, shop name, actor email, action code, details, and IP address.
- **FR-ADMIN-604 (Payments & Subscription Ledger)**: Displays all transactions with transaction ID, salon name, amount, currency (SAR), plan type, payment provider, and status.
- **FR-ADMIN-605 (Audit Trail CSV Export)**: Super Admin must be able to export filtered audit log tables directly to a CSV spreadsheet.
- **FR-ADMIN-606 (Global QR Code Hub)**: Consolidated asset management view allowing Super Admin to inspect, test, and batch-download QR packages for any onboarded salon.

---

## 6. Non-Functional Requirements (NFR)

| Identifier | Category | Requirement Specification |
| :--- | :--- | :--- |
| **NFR-PERF-01** | Performance | Backend REST endpoints must respond within **< 300ms (p95)** under standard operating load. |
| **NFR-PERF-02** | Page Load | Frontend static web assets and CSS must achieve First Contentful Paint (FCP) in **< 1.5 seconds** over standard 4G mobile connections. |
| **NFR-CONC-01** | Concurrency Safety | Zero double-bookings permitted under high concurrent traffic. Must pass 20-thread simultaneous lock acquisition tests with exactly 1 success and 19 rejections. |
| **NFR-AVAIL-01** | Availability | Core SaaS platform availability target: **99.9% uptime** outside scheduled maintenance. |
| **NFR-SEC-01** | Data Protection | All network traffic in transit must enforce TLS 1.3 / HTTPS. All passwords hashed using BCrypt. JWT secrets must have minimum 256 bits entropy. |
| **NFR-COMP-01** | Compliance | Customer phone numbers, addresses, and transaction audit records must adhere to Saudi National Data Management Office (NDMO) data residency guidelines. |
| **NFR-MOB-01** | Responsiveness | 100% mobile-first viewport design accommodating all iOS Safari and Android Chrome form factors down to 360px viewport width. |

---

## 7. Comprehensive Data Dictionary

### Table: `users`
| Column | Type | Nullable | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | BIGINT | No | PK, Auto-Increment | Unique user identifier |
| `email` | VARCHAR(255) | No | Unique | User login email address |
| `password` | VARCHAR(255) | No | | BCrypt hashed password |
| `full_name` | VARCHAR(255) | No | | User display name |
| `role` | VARCHAR(50) | No | Enum (`UserRole`) | Role: SUPER_ADMIN, SALON_OWNER, SALON_STAFF, CUSTOMER |
| `salon_id` | BIGINT | Yes | FK -> shops.id | Assigned tenant salon reference |
| `active` | BOOLEAN | No | Default TRUE | Account active/suspended flag |
| `phone` | VARCHAR(30) | Yes | Unique | Saudi mobile phone number |
| `created_at` | TIMESTAMP | No | Auto-timestamp | Record creation timestamp |
| `updated_at` | TIMESTAMP | No | Auto-timestamp | Record modification timestamp |

### Table: `shops`
| Column | Type | Nullable | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | BIGINT | No | PK, Auto-Increment | Unique shop identifier |
| `owner_id` | BIGINT | No | FK -> users.id | Foreign key to shop owner |
| `name` | VARCHAR(255) | No | | Commercial shop name |
| `slug` | VARCHAR(255) | No | Unique | Public URL identifier slug |
| `phone` | VARCHAR(30) | No | Unique | Saudi business contact phone |
| `region` | VARCHAR(100) | No | | Saudi administrative region |
| `district` | VARCHAR(100) | No | | City district / neighborhood |
| `city` | VARCHAR(100) | No | | City name |
| `full_address` | TEXT | No | | Physical street address |
| `map_address` | VARCHAR(255) | Yes | | Google Plus Code / Short address |
| `subscription_plan` | VARCHAR(50) | No | Enum | MONTHLY or YEARLY |
| `status` | VARCHAR(50) | No | Enum, Default 'PENDING' | PENDING, ACTIVE, SUSPENDED |
| `login_url` | VARCHAR(512) | Yes | | Private salon dashboard login URL |
| `booking_url` | VARCHAR(512) | Yes | | Public customer booking portal URL |
| `login_qr_code_data`| LONGTEXT | Yes | Base64 PNG | Embedded base64 PNG data URL for login QR |
| `booking_qr_code_data`| LONGTEXT | Yes | Base64 PNG | Embedded base64 PNG data URL for booking QR |

### Table: `barbers`
| Column | Type | Nullable | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | BIGINT | No | PK, Auto-Increment | Unique barber identifier |
| `shop_id` | BIGINT | No | FK -> shops.id | Parent shop reference |
| `user_id` | BIGINT | Yes | FK -> users.id | Optional linked user login account |
| `name` | VARCHAR(255) | No | | Barber professional name |
| `photo_url` | VARCHAR(512) | Yes | | Avatar image URL |

### Table: `services`
| Column | Type | Nullable | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | BIGINT | No | PK, Auto-Increment | Unique service item identifier |
| `shop_id` | BIGINT | No | FK -> shops.id | Parent shop reference |
| `name` | VARCHAR(255) | No | | Service title (e.g. Royal Haircut) |
| `description` | TEXT | Yes | | Service description |
| `price` | DECIMAL(10,2) | No | | Service price in SAR |
| `duration_minutes` | INT | No | | Duration in minutes (e.g. 30) |

### Table: `bookings`
| Column | Type | Nullable | Constraints | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | BIGINT | No | PK, Auto-Increment | Unique booking identifier |
| `shop_id` | BIGINT | No | FK -> shops.id | Shop identifier |
| `barber_id` | BIGINT | No | FK -> barbers.id | Barber identifier |
| `service_id` | BIGINT | No | FK -> services.id | Service identifier |
| `customer_id` | BIGINT | No | FK -> customers.id | Customer identifier |
| `slot_start` | DATETIME | No | Composite Unique | Appointment start datetime |
| `slot_end` | DATETIME | No | | Appointment end datetime |
| `status` | VARCHAR(50) | No | Enum, Default 'HOLD' | HOLD, CONFIRMED, CANCELLED, COMPLETED |
| `hold_expires_at` | DATETIME | Yes | | 5-minute hold expiration timestamp |
| `version` | BIGINT | No | Default 0 | JPA Optimistic Lock Version |
| *Constraint* | **uk_no_double_book** | | `UNIQUE(barber_id, slot_start, status)` | Double-booking prevention key |

---

## 8. Requirements Traceability Matrix

| Requirement ID | Conceptual BRD Intent | Baseline Implementation State | Gap Severity | Target Sprint |
| :--- | :--- | :--- | :---: | :---: |
| **FR-AUTH-101** | Multi-Tenant Login | Implemented (`AuthController.java`, `login.html`) | Low | Sprint 1 |
| **FR-SHOP-206** | Shop Self-Registration | Implemented with payload drop (`ShopService.java`) | **High** | Sprint 1 |
| **FR-PAY-304** | Webhook Auto-Approval | Fully implemented with HMAC signature verification | None | Complete |
| **FR-BOOK-405** | 5-Minute Slot Hold | Backend verified; Frontend unlinked | **Critical** | Sprint 2 |
| **FR-BOOK-407** | Booking Confirmation & ICS | Backend verified; Frontend generates static string | **High** | Sprint 2 |
| **FR-DASH-503** | Walk-in Reservation | Frontend modal works; Does not persist to MySQL | **High** | Sprint 3 |
| **FR-DASH-504** | Real-Time Live Sync | STOMP Broker configured; Publisher unlinked | **Critical** | Sprint 3 |
| **FR-ADMIN-602** | Shop Status Override | Frontend UI works; Backend endpoints missing | **High** | Sprint 4 |
| **FR-ADMIN-603** | User & System Audit Trail | Backend logger exists; Query API missing | **Medium** | Sprint 4 |
| **FR-ADMIN-604** | Payments Ledger | Payments table exists; Query API missing | **Medium** | Sprint 4 |
