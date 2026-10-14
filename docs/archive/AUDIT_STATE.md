# Technical Reverse-Engineering Audit & System Baseline
**Project**: Salon & Barber Booking SaaS Platform  
**Audit Date**: October 2026  
**Auditor**: Principal Systems Architect & Technical Product Manager  
**Repository Working Directory**: `/Users/naveed/.gemini/antigravity-ide/scratch/barber-booking-system`  
**Current Implementation Status**: Hybrid Functional Core with Substantial Client-Side Simulation (Dual-Brain Architecture)

---

## 1. Executive Architectural Summary

A comprehensive forensic audit of the **Salon & Barber Booking SaaS Platform** was conducted across the backend codebase (Spring Boot 3.3.5 / Java 21 / MySQL 8.0 / Redis 7.0 / Redisson 3.31.0) and the frontend web client (Vanilla ES6 Modules / HTML5 / Tailwind CSS).

### Primary Architectural Finding: The "Dual-Brain" Decoupling
The platform exhibits a severe architectural bifurcation between the backend API and frontend client:
1. **The Backend Brain**: Implements a Spring Boot 3.3 REST and STOMP architecture with Flyway database migrations, BCrypt/JJWT authentication, Redisson distributed locking on Redis, ZXing QR generation, and HMAC-verified Moyasar webhook handling. A standalone verification script (`scripts/verify-e2e.sh`) and a concurrency test (`BookingConcurrencyTest.java`) validate this pipeline in isolation.
2. **The Frontend Brain**: Rather than consuming the backend REST API, the frontend was architected around a client-side reactive store (`frontend/src/js/store.js`) backed by browser `localStorage` and `BroadcastChannel`. Across the entire frontend codebase, **only two backend endpoints are called** (`POST /api/shops/register` and `POST /api/v1/auth/login`). All subsequent user interactions (customer booking, 5-minute hold timer, calendar export, schedule timetable updates, walk-in reservations, admin shop approval/suspension, audit logs, and payments) execute entirely against browser local storage.

```
+--------------------------------------------------------------------------------------------------+
|                                    ACTUAL RUNTIME TOPOLOGY                                       |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +--------------------------+       Direct API Call       +---------------------------------+   |
|   |   frontend/register.js   | --------------------------> | POST /api/shops/register        |   |
|   +--------------------------+  (Drops custom barbers/     +---------------------------------+   |
|                                  services & photos)                        |                     |
|                                                                            v                     |
|   +--------------------------+       Direct API Call       +---------------------------------+   |
|   |    frontend/login.js     | --------------------------> | POST /api/v1/auth/login         |   |
|   +--------------------------+     (Fallback to mock)      +---------------------------------+   |
|                                                                            |                     |
|   ================================ G A P   B O U N D A R Y ===================================   |
|                                                                                                  |
|   +--------------------------+     Isolated In-Browser     +---------------------------------+   |
|   | frontend/booking-stepper | < - - - - - - - - - - - - > | POST /api/slots/hold (UNLINKED) |   |
|   |  - Step 1: Barbers (Mock)|     localStorage Store      | POST /api/bookings/confirm ( " )|   |
|   |  - Step 2: Svcs (Mock)   |                             | GET  /api/bookings/calendar ( ")|   |
|   |  - Step 3: Slots (Mock)  |                             +---------------------------------+   |
|   |  - Step 4: Form Submit   |                                                                   |
|   |  - Step 5: Static .ics   |                                                                   |
|   +--------------------------+                                                                   |
|                                                                                                  |
|   +--------------------------+     Isolated In-Browser     +---------------------------------+   |
|   |   frontend/dashboard.js  | < - - - - - - - - - - - - > | SlotEventPublisher.java (STUB)  |   |
|   |  - Render Timetable      |     BroadcastChannel Sync   | WebSocket Broker /ws (NO DATA)  |   |
|   |  - Walk-in Modal         |                             +---------------------------------+   |
|   +--------------------------+                                                                   |
|                                                                                                  |
|   +--------------------------+     Isolated In-Browser     +---------------------------------+   |
|   |     frontend/admin.js    | < - - - - - - - - - - - - > | NO Backend Endpoints Exist for: |   |
|   |  - Approve / Suspend     |     localStorage Store      |  - Admin shop status change     |   |
|   |  - Audit Log Table       |                             |  - Audit log query/export       |   |
|   |  - Payments Table        |                             |  - Payments list/query          |   |
|   +--------------------------+                             +---------------------------------+   |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. File Tree & Architecture Scan

### 2.1 Repository Directory Structure
```
barber-booking-system/
├── .env.example                               # Production environment variable template
├── .env.local                                 # Local development environment configuration
├── docker-compose.yml                         # MySQL 8.0 (port 3307) & Redis 7.0 (port 6379)
├── README.md                                  # Repository overview
├── USER_GUIDE.md                              # Operational runbook (Contains Next.js doc mismatch)
├── docs/
│   ├── .antigravity/rules                     # Developer prompt execution constraints
│   ├── BRD.md                                 # Approved initial business requirements document
│   └── DEPLOYMENT_PLAN.md                     # Production release & deployment plan
├── scripts/
│   ├── start-infra.sh                         # Health-checked Docker Compose orchestration
│   └── verify-e2e.sh                          # 6-step backend cURL integration test suite
├── backend/
│   ├── pom.xml                                # Maven build specification (Java 21, Spring Boot 3.3.5)
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/barberapp/
│   │   │   │   ├── BarberBookingApplication.java
│   │   │   │   ├── config/                    # RedissonConfig, WebSocketConfig, DatabaseSeeder
│   │   │   │   ├── controller/                # AuthController, ShopController, SlotBookingController, PaymentWebhookController
│   │   │   │   ├── dto/                       # LoginRequestDTO, LoginResponseDTO, ShopRegistrationDto, UserDTO
│   │   │   │   ├── entity/                    # User, Shop, Barber, ServiceItem, WorkingHours, Slot, Booking, Customer, Subscription, Payment, AuditLog
│   │   │   │   │   └── enums/                 # BookingStatus, PaymentProvider, PaymentStatus, ShopStatus, SubscriptionPlan, SubscriptionStatus, UserRole
│   │   │   │   ├── exception/                 # SlotAlreadyBookedException
│   │   │   │   ├── repository/                # AuditLogRepo, BarberRepo, BookingRepo, CustomerRepo, PaymentRepo, ServiceItemRepo, ShopRepo, SubscriptionRepo, UserRepo
│   │   │   │   ├── security/                  # JwtAuthenticationFilter, JwtService, SecurityConfig, UserPrincipal
│   │   │   │   └── service/                   # AuditLogService, CalendarService, QrCodeService, ShopService, SlotBookingService, SlotEventPublisher, SlotLockService
│   │   │   └── resources/
│   │   │       ├── application.yml            # Database, Redis, JWT & Webhook properties
│   │   │       └── db/migration/
│   │   │           ├── V1__init_schema.sql    # Base DDL (11 relational tables + constraints)
│   │   │           ├── V2__add_auth_and_tenant_fields.sql # users.salon_id & users.active
│   │   │           └── V3__add_salon_qr_codes_and_links.sql # shops.login_url, booking_url, qr data
│   │   └── test/
│   │       └── java/com/barberapp/service/
│   │           └── BookingConcurrencyTest.java # 20-thread Redisson lock race condition test
└── frontend/
    ├── package.json                           # Tailwind CLI devDependencies & npm run scripts
    ├── package-lock.json
    ├── tailwind.config.js                     # Tailwind theme config with @tailwindcss/forms & typography
    ├── index.html                             # Root router & authority-based redirector
    ├── login.html                             # Multi-tenant login page with seed credentials
    ├── register.html                          # Shop self-onboarding portal
    ├── salons.html                            # Super Admin global salon directory
    ├── book.html                              # Customer 5-step booking wizard
    ├── dashboard/
    │   ├── index.html                         # Salon Owner & Staff live schedule timetable
    │   └── admin.html                         # Super Admin global management console
    └── src/
        ├── css/
        │   ├── input.css                      # Tailwind base & custom components
        │   └── output.css                     # Pre-compiled Tailwind styles
        ├── images/                            # default-avatar.svg, favicon.svg
        └── js/
            ├── auth-guard.js                  # Route-level RBAC & tenant isolation guard
            ├── jszip.min.js                   # Client-side ZIP compilation library
            ├── qrcode.min.js                  # Client-side QR canvas renderer
            ├── qr-helper.js                   # QR rendering, SVG parsing, PNG/SVG/ZIP download
            ├── store.js                       # Client reactive state engine (localStorage + BroadcastChannel)
            ├── login.js                       # Auth controller with backend API + local fallback
            ├── register.js                    # Registration stepper with image auto-compression
            ├── directory.js                   # Salons directory filter & actions
            ├── booking-stepper.js             # Customer booking logic & 5-minute countdown timer
            ├── dashboard.js                   # Schedule timetable & walk-in reservation modal
            └── admin.js                       # Admin KPI metrics, table renders, and status toggles
```

---

## 3. Technology Stack & Runtime Infrastructure

| Layer | Component | Declared in Docs / Guide | Actual Implementation in Codebase | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Runtime** | Java Virtual Machine | Java 17 / 21 | Java 21 (`pom.xml: <java.version>21</java.version>`) | Verified |
| **API Framework** | Spring Boot | Spring Boot 3.3.x | Spring Boot 3.3.5 (`spring-boot-starter-parent`) | Verified |
| **Persistence Engine** | MySQL Database | MySQL 8.0 | MySQL 8.0 (`barber_saas`), port 3307 (Docker) | Verified |
| **Schema Migrations**| Flyway Migration | Versioned migrations | Flyway Core + Flyway MySQL (`V1`, `V2`, `V3`) | Verified |
| **Distributed Lock** | Redis & Redisson | Redis 7.0 + Redisson | Redisson 3.31.0 (`RLock.tryLock(0, 5, MINUTES)`) | Verified |
| **Security / Auth**  | Stateless JWT | JWT (BCrypt + JJWT) | JJWT 0.12.6 + Spring Security 6.3 Filter Chain | Verified |
| **Real-Time Layer**  | WebSocket / STOMP | SockJS + STOMP Broker | Spring WebSocket (`/ws`), SimpleBroker (`/topic`) | Verified (Broker up; publishing disconnected) |
| **Frontend Framework**| UI Framework | **Next.js 14 (TypeScript)** | **Vanilla JS (ES6 Modules) + Static HTML** | **Documentation Mismatch** |
| **Styling Framework**| CSS Engine | Tailwind CSS | Tailwind CLI 3.4.14 + Tailwind CDN runtime | Verified |
| **Testing Harness**  | Test Suite | Unit & Concurrency | 1 Concurrency Test (`BookingConcurrencyTest.java`) | Deficit (<15% coverage) |

---

## 4. Feature Inventory Matrix

The following matrix cross-examines every functional capability across backend endpoints, database models, and frontend client views.

| Feature Name | Module / Path | Status | Verified Working Logic | Technical Debt / Missing Pieces |
| :--- | :--- | :--- | :--- | :--- |
| **Shop Self-Registration** | `POST /api/shops/register`<br>`frontend/register.html`<br>`frontend/src/js/register.js` | **Partial** | Frontend validates SA phone format (`05XXXXXXXX`), compresses images (<5MB, 1200px), collects owner info. Backend creates `User` (role `SHOP_OWNER`), generates temp slug, persists `Shop` in `PENDING` status, generates dual QR codes. | **Severe Payload Drop**: Frontend collects multiple custom barbers, custom services, and shop photos, but backend `ShopRegistrationDto` omits them. Backend hardcodes 1 barber and 1 service. Photos never sent to backend. |
| **Payment Webhook Auto-Approval** | `POST /api/payments/webhook`<br>`PaymentWebhookController.java` | **Done** | Receives webhook payload, validates HMAC SHA-256 signature (`X-Webhook-Signature`), checks idempotency on `transactionId`, updates shop to `ACTIVE`, creates `Subscription`, records `Payment`, logs `SHOP_AUTO_APPROVED` audit event. | Webhook operates synchronously without asynchronous event worker. Failure retry mechanism not configured. |
| **Distributed Slot Hold (Redis Lock)** | `POST /api/slots/hold`<br>`SlotBookingService.java`<br>`SlotLockService.java` | **Done (Backend)**<br>**Stub (Frontend)** | Backend uses Redisson `RLock.tryLock(0, 5, MINUTES)` with key `lock:slot:{barberId}:{slotStart}`. Concurrently checks DB for existing HOLD/CONFIRMED booking. Rejects race condition with HTTP 409 Conflict. | **Frontend Disconnected**: `booking-stepper.js` NEVER calls this endpoint. It executes a local JavaScript countdown timer and saves to localStorage. **Backend Bug**: Expired HOLD records in DB block subsequent holds due to unique key constraint (`uk_no_double_book`). |
| **Booking Confirmation** | `POST /api/bookings/{id}/confirm`<br>`SlotBookingService.java` | **Done (Backend)**<br>**Stub (Frontend)** | Validates booking is in `HOLD` status, checks expiry timestamp, transitions status to `CONFIRMED`. | Frontend never calls this endpoint. Operates strictly inside localStorage `Store.addBooking()`. |
| **Calendar File Export (.ics)** | `GET /api/bookings/{id}/calendar`<br>`CalendarService.java` | **Done (Backend)**<br>**Stub (Frontend)** | Backend generates valid RFC-5545 calendar stream with UID, UTC timestamps, escape formatting, shop location. | Frontend `booking-stepper.js:downloadIcs()` generates a client-side hardcoded static string with date `2026-10-15` instead of calling the API. |
| **Dual QR Code Generation** | `GET /api/shops/{id}/qr/*`<br>`QrCodeService.java`<br>`frontend/src/js/qr-helper.js` | **Done** | Backend uses ZXing 3.5.3 to generate PNG, SVG, and combined ZIP archives containing login and booking QR codes. Frontend provides client-side canvas fallback with PNG/SVG/ZIP export. | In production, hardcoded localhost URLs (`http://localhost:3000`) in generated QR codes must be driven by dynamic domain configuration. |
| **JWT Authentication & RBAC** | `POST /api/v1/auth/login`<br>`GET /api/v1/auth/me`<br>`SecurityConfig.java`<br>`frontend/login.html` | **Done** | Spring Security filter chain validates Bearer token, sets `UserPrincipal` with roles (`SUPER_ADMIN`, `SALON_OWNER`, `SALON_STAFF`). Frontend `auth-guard.js` enforces route protection and tenant isolation. | **Config Key Mismatch**: `application.yml` defines `jwt.secret`, but `JwtService.java` injects `@Value("${app.jwt.secret}")`. Falls back to default string unless matched. |
| **Customer Booking Stepper** | `frontend/book.html`<br>`frontend/src/js/booking-stepper.js` | **Partial (Mock-Heavy)** | Beautiful 5-step UI: Barber selection, Service selection, Date/Time slot selection with 5-minute countdown, Customer info with SA phone validation, and Confirmation summary. | **100% Client-Side**: No API calls to load barbers, services, or slots from backend MySQL. No API call to acquire lock or confirm booking. |
| **Salon Schedule Timetable** | `frontend/dashboard/index.html`<br>`frontend/src/js/dashboard.js` | **Partial (Mock-Heavy)** | Sectioned timetable (Morning, Afternoon, Evening) displaying slot cards with status badges (`AVAILABLE`, `HOLD`, `CONFIRMED`), walk-in modal, and cross-tab sync via `BroadcastChannel`. | **Zero Backend Integration**: Backend has no endpoint to fetch schedule or slots by date. All slots generated in-memory. |
| **Walk-in Reservation** | `frontend/dashboard/index.html`<br>`frontend/src/js/dashboard.js` | **Stub** | Modal collects customer name, SA phone, barber, time, service, and updates timetable card status. | Saves purely to browser `localStorage`. Does not create customer, booking, or slot record in MySQL. |
| **Real-Time WebSocket Sync** | `WebSocketConfig.java`<br>`SlotEventPublisher.java`<br>`frontend/src/js/dashboard.js` | **Stub** | Spring WebSocket message broker configured on `/ws` with simple broker `/topic`. Frontend has WebSocket listener code. | **Completely Disconnected**: `SlotEventPublisher.publishSlotUpdate()` is NEVER invoked by any service in the backend! Frontend uses raw `WebSocket` without STOMP CONNECT frame, hardcoding `/topic/shop/1/slots`. |
| **Super Admin Console** | `frontend/dashboard/admin.html`<br>`frontend/src/js/admin.js` | **Stub (UI Only)** | Renders KPI cards (Total Salons, Audit Events, Monthly Revenue, Active Sessions), Salons list, Audit trail, Payments log, and User Sessions. Allows status toggling (Approve / Suspend). | **Zero Backend Endpoints**: Backend does not possess endpoints for admin shop approval/suspension, audit log retrieval, payment querying, or KPI metrics. All data driven by mock defaults in `store.js`. |
| **Salons Directory** | `frontend/salons.html`<br>`frontend/src/js/directory.js` | **Partial** | Searchable grid of registered salons with city filters, direct booking links, login links, and QR code downloads. Restricted to `SUPER_ADMIN`. | Reads exclusively from `Store.getShops()` (localStorage). Does not invoke `GET /api/shops`. |
| **Working Hours & Availability Engine** | `WorkingHours.java`<br>`Slot.java` | **Stub** | Entities and database tables exist in `V1__init_schema.sql`. | No repository queries, no service layer calculation, no REST endpoints to query open time windows for a date. |
| **Barber & Service Management** | `BarberRepository.java`<br>`ServiceItemRepository.java` | **Partial** | Read-only endpoints exist (`GET /api/shops/{id}/barbers`, `GET /api/shops/{id}/services`). | No CRUD endpoints to add, edit, or delete barbers or services post-registration. |

---

## 5. Gap Analysis vs Core Product Intent

### 5.1 What Complete Workflows Are Functional End-to-End?
1. **Infrastructure Stack Orchestration**:
   - `scripts/start-infra.sh` spins up MySQL 8.0 and Redis 7.0 via Docker Compose and polls container healthchecks successfully.
2. **Backend API Concurrency Pipeline (`scripts/verify-e2e.sh`)**:
   - Shop registration -> Moyasar HMAC webhook auto-approval -> 5-minute Redis slot hold -> Duplicate slot hold rejection (409 Conflict) -> Booking confirmation -> RFC-5545 `.ics` calendar generation.
   - All 6 backend steps pass when executed via cURL.
3. **Multi-Tenant Authentication & Route RBAC**:
   - `POST /api/v1/auth/login` verifies credentials and issues JWT with tenant claims.
   - Frontend `auth-guard.js` correctly prevents unauthorized access to Admin and restricts Salon Owners to their assigned `salonSlug`.
4. **Dual QR Code Generation Engine**:
   - `GET /api/shops/{id}/qr/login`, `/booking`, and `/zip` successfully stream compliant QR images and zip packages.

### 5.2 Critical Architectural Gaps to Reach Production MVP

```
                                  GAP TAXONOMY
┌─────────────────────────────────┬─────────────────────────────────┬─────────────────────────────────┐
│     Critical Data Pipeline      │    Business Logic & Engine      │     Security & Operations       │
├─────────────────────────────────┼─────────────────────────────────┼─────────────────────────────────┤
│ 1. Frontend-to-Backend Decouple │ 4. Working Hours Slot Generator │ 7. JWT Config Property Mismatch │
│ 2. Shop Registration Truncation │ 5. Expired Hold Sweeper Worker  │ 8. Missing Admin REST API       │
│ 3. Client-Side Booking Isolation│ 6. WebSocket Broker Publishing  │ 9. Single Concurrency Test Only │
└─────────────────────────────────┴─────────────────────────────────┴─────────────────────────────────┘
```

#### Gap 1: Disconnected Booking Stepper
- The customer booking stepper (`book.html` / `booking-stepper.js`) operates in a vacuum. It does not fetch the shop's real barbers or services from `/api/shops/{id}/barbers` and `/api/shops/{id}/services`.
- It does not hit `/api/slots/hold` or `/api/bookings/{id}/confirm`. As a consequence, customer bookings created in the UI **never reach the MySQL database**, and never trigger the Redis distributed lock.

#### Gap 2: Shop Registration Data Dropping
- `ShopRegistrationDto` lacks `barbers`, `services`, and `photos` lists.
- During shop onboarding, the owner configures staff and service menus with pricing and duration. Because the backend DTO drops these fields, the backend saves a dummy "Master Barber" and "Haircut & Beard Trim" while discarding the real data.

#### Gap 3: Missing Working Hours & Slot Availability Engine
- The platform lacks logic to generate available appointment slots dynamically based on `working_hours` (e.g. 09:00 to 21:00), service durations (e.g. 30 mins, 45 mins), barber shifts, breaks, and existing bookings.
- The UI currently renders static hardcoded buckets (`09:00 AM`, `09:30 AM`, etc.).

#### Gap 4: Expired Hold Sweeper & Database Constraint Collision
- In `bookings`, the database enforces `CONSTRAINT uk_no_double_book UNIQUE KEY (barber_id, slot_start, status)`.
- When a slot hold expires, the Redis key disappears, but the database row remains in `status = 'HOLD'`.
- There is no `@Scheduled` worker to expire stale holds to `CANCELLED`. If another customer attempts to hold that slot, inserting a new `status = 'HOLD'` row fails on duplicate key constraint rather than releasing the slot cleanly.

#### Gap 5: Inactive WebSocket Event Pipeline
- `SlotEventPublisher` is completely orphaned. No service calls it upon slot hold, booking confirmation, or cancellation.
- The shop owner dashboard never receives real-time push events from customer bookings.

#### Gap 6: Absence of Administrative Endpoints
- The Super Admin console cannot manage the platform because the backend is missing:
  - `PATCH /api/admin/shops/{id}/status` (Approve / Suspend / Reactivate)
  - `GET /api/admin/audit-logs` (Filtered audit trail with CSV export)
  - `GET /api/admin/payments` (Transaction history and subscription revenue)
  - `GET /api/admin/metrics` (Platform KPI counts)

#### Gap 7: JWT Configuration Property Name Mismatch
- `application.yml` contains:
  ```yaml
  jwt:
    secret: ${JWT_SECRET:...}
    expiration: ${JWT_EXPIRATION_MS:86400000}
  ```
- `JwtService.java` constructor injects:
  ```java
  @Value("${app.jwt.secret:SuperSecretKey...}") String secret,
  @Value("${app.jwt.expiration-ms:86400000}") long expirationMs
  ```
- As written, setting `JWT_SECRET` in `.env` has no effect on `JwtService`, forcing the application to use the hardcoded fallback secret in memory.

---

## 6. Comprehensive Data Model & Entity Specifications

```
                                ENTITY RELATIONSHIP MODEL
+-----------------------+              +-----------------------+              +-----------------------+
|        users          |              |         shops         |              |        barbers        |
+-----------------------+              +-----------------------+              +-----------------------+
| id (PK)               | 1          * | id (PK)               | 1          * | id (PK)               |
| email (UQ)            | <----------+ | owner_id (FK)         | <----------+ | shop_id (FK)          |
| password (BCrypt)     |              | name                  |              | user_id (FK, Nullable)|
| full_name             |              | slug (UQ)             |              | name                  |
| role (UserRole)       |              | phone (UQ)            |              | photo_url             |
| salon_id (Nullable)   |              | region, district, city|              +-----------------------+
| phone (UQ, Nullable)  |              | full_address          |                          | 1
| active (Boolean)      |              | map_address           |                          |
+-----------------------+              | subscription_plan     |                          | *
                                       | status (ShopStatus)   |              +-----------------------+
                                       | login_url, booking_url|              |     working_hours     |
                                       | login/booking_qr_data |              +-----------------------+
                                       +-----------------------+              | id (PK)               |
                                                   | 1                        | barber_id (FK)        |
                                                   |                          | day_of_week (1-7)     |
                                                   | *                        | start_time, end_time  |
+-----------------------+              +-----------------------+              | is_off (Boolean)      |
|       services        |              |       customers       |              +-----------------------+
+-----------------------+              +-----------------------+
| id (PK)               |              | id (PK)               |
| shop_id (FK)          |              | user_id (FK, Nullable)|
| name                  |              | full_name             |
| price (DECIMAL 10,2)  |              | email                 |
| duration_minutes      |              | phone (Saudi 10-digit)|
+-----------------------+              +-----------------------+
            | 1                                    | 1
            |                                      |
            +-------------------+  +---------------+
                                |  |
                                v  v
                     +---------------------------------------+
                     |               bookings                |
                     +---------------------------------------+
                     | id (PK)                               |
                     | shop_id (FK)                          |
                     | barber_id (FK)                        |
                     | service_id (FK)                       |
                     | customer_id (FK)                      |
                     | slot_start (DATETIME)                 |
                     | slot_end (DATETIME)                   |
                     | status (HOLD / CONFIRMED / CANCELLED) |
                     | hold_expires_at (DATETIME)            |
                     | version (Optimistic Lock)             |
                     | UK: (barber_id, slot_start, status)   |
                     +---------------------------------------+
```

### Table Specifications:
1. `users`: Stores system users (`SUPER_ADMIN`, `SALON_OWNER`, `SALON_STAFF`, `BARBER`, `CUSTOMER`). Includes `salon_id` foreign reference for tenant isolation.
2. `shops`: Central tenant registry. Holds physical location, subscription tier (`MONTHLY`, `YEARLY`), operational status (`PENDING`, `ACTIVE`, `SUSPENDED`), and pre-rendered QR code base64 strings.
3. `barbers`: Staff members assigned to a shop.
4. `services`: Catalog of grooming offerings per shop with duration and price in SAR.
5. `working_hours`: Weekly recurring operating schedule per barber (days 1–7).
6. `slots`: Pre-generated or bookable time intervals per barber.
7. `customers`: Customer directory containing validated Saudi contact information.
8. `bookings`: Reservation records with optimistic locking (`@Version`) and database uniqueness constraint against double-booking.
9. `subscriptions`: Recurring shop billing records with start/end validity periods and renewal flags.
10. `payments`: Audit ledger for inbound transactions processed via Moyasar, Mada, or STC Pay.
11. `audit_logs`: Immutable security audit trail recording IP address, actor, shop, and system operations.

---

## 7. Security & Concurrency Audit

### 7.1 Security Architecture
- **Stateless Bearer Tokens**: Validated on every non-whitelisted request by `JwtAuthenticationFilter`.
- **Role Hierarchy**: Mapped to Spring Security authorities (`ROLE_SUPER_ADMIN`, `ROLE_SALON_OWNER`, `ROLE_CUSTOMER`).
- **CSRF Strategy**: Disabled for stateless REST endpoints (`csrf -> csrf.disable()`), which complies with modern token-based API standards.
- **CORS Policy**: Configured to accept all origins (`*`) with credentials enabled. *Recommendation: In production, constrain `allowedOriginPatterns` to explicit deployment domains.*
- **HMAC Webhook Authentication**: Moyasar payment webhook enforces SHA-256 HMAC verification against `payment.webhook.secret`.

### 7.2 Concurrency Architecture
- **Redis Distributed Locking**: Redisson manages key `lock:slot:{barberId}:{yyyyMMddHHmm}` with a 5-minute lease time.
- **Optimistic Locking**: Handled via JPA `@Version private Long version` on `Booking`.
- **Database Unique Constraint**: `uk_no_double_book UNIQUE KEY (barber_id, slot_start, status)` provides final defensibility at the persistence layer.
- **Load Test Verification**: `BookingConcurrencyTest.java` verifies that 20 simultaneous threads racing for the identical slot yield exactly 1 success and 19 rejections.

---

## 8. Test Coverage Assessment

| Test Type | Target Area | Current Files | Current Status | Coverage Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Concurrency Load Test** | Slot booking race condition | `BookingConcurrencyTest.java` | Passing | **Adequate** (20 threads verified) |
| **E2E Integration Test** | Core backend HTTP endpoints | `scripts/verify-e2e.sh` | Passing | **Good** (6-step cURL verification) |
| **Unit Tests (Backend)** | Controllers, Services, Security | None | **Missing** | **0% Coverage** |
| **Integration Tests** | Flyway migrations, JPA queries | None | **Missing** | **0% Coverage** |
| **Frontend Tests** | Validation, Stepper, Store | None | **Missing** | **0% Coverage** |

**Summary**: Overall project code coverage is estimated below **15%**. The priority before production release is establishing automated Spring Boot `@WebMvcTest` and `@DataJpaTest` suites.
