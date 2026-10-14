# Sprint Backlog & Production Launch Roadmap
**Project**: Salon & Barber Booking SaaS Platform  
**Target Architecture**: Spring Boot 3.3.5 / MySQL 8.0 / Redis 7.0 / Vanilla JS (ES Modules) + Tailwind CSS  
**Auditor & PM**: Principal Systems Architect & Technical Product Manager  
**Planning Horizon**: Sprint 1 through Sprint 5 (Target: Production Launch)  
**Document Status**: Approved Baseline Backlog  

---

## 1. Executive Sprint Roadmap Overview

```
+--------------------------------------------------------------------------------------------------+
|                                    LAUNCH EXECUTION ROADMAP                                      |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|   +-------------------------------------------------------+                                      |
|   | SPRINT 1: Unified Data Pipeline & Registration        |   Duration: 2 Weeks                  |
|   |  - Bridge frontend-backend divide for shop onboarding |   Points: 34 SP                      |
|   |  - Ingest custom barbers, services, and photo data    |   Milestone: Zero Payload Drop       |
|   |  - Fix JWT configuration property name mismatch       |                                      |
|   +-------------------------------------------------------+                                      |
|                               |                                                                  |
|                               v                                                                  |
|   +-------------------------------------------------------+                                      |
|   | SPRINT 2: Booking Engine, Concurrency & Lock Sweeper  |   Duration: 2 Weeks                  |
|   |  - Connect booking-stepper.js to REST endpoints       |   Points: 40 SP                      |
|   |  - Dynamic working hours & slot availability engine   |   Milestone: Real Redis Lock Flow    |
|   |  - Background cron sweeper for expired HOLD records   |                                      |
|   +-------------------------------------------------------+                                      |
|                               |                                                                  |
|                               v                                                                  |
|   +-------------------------------------------------------+                                      |
|   | SPRINT 3: Real-Time WebSockets & Walk-In Engine       |   Duration: 2 Weeks                  |
|   |  - Wire SlotEventPublisher into booking lifecycles    |   Points: 28 SP                      |
|   |  - Connect STOMP client in dashboard.js               |   Milestone: Live Schedule Push      |
|   |  - Persistent backend Walk-In reservation API         |                                      |
|   +-------------------------------------------------------+                                      |
|                               |                                                                  |
|                               v                                                                  |
|   +-------------------------------------------------------+                                      |
|   | SPRINT 4: Super Admin API, Audit Trail & Payments     |   Duration: 2 Weeks                  |
|   |  - Admin REST APIs (Status, Metrics, Audit, Payments) |   Points: 32 SP                      |
|   |  - Wire admin.js and salons directory to real data    |   Milestone: Full Admin Control      |
|   |  - CSV export streaming & financial ledger validation |                                      |
|   +-------------------------------------------------------+                                      |
|                               |                                                                  |
|                               v                                                                  |
|   +-------------------------------------------------------+                                      |
|   | SPRINT 5: Test Automation, Hardening & Launch Ready   |   Duration: 2 Weeks                  |
|   |  - Complete unit & integration test suite (>80% cov)  |   Points: 26 SP                      |
|   |  - Production security hardening (CORS, Rate limits)  |   Milestone: Production Go-Live      |
|   |  - Reconcile USER_GUIDE.md & RTL Arabic UI support    |                                      |
|   +-------------------------------------------------------+                                      |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. Sprint 1: Unified Data Pipeline & Registration Ingestion
**Goal**: Eliminate the "Dual-Brain" divide in shop registration by updating the backend DTO to ingest custom barbers, services, and photo metadata, resolve configuration defects, and ensure all onboarding data is persisted to MySQL.

### User Stories & Tasks

#### US-1.1: Expand Backend Shop Registration DTO & Persistence
- **ID**: `S1-US-01` | **Points**: 13 SP | **Priority**: Critical
- **Description**: As a Salon Owner registering my shop, I want my submitted staff list (barbers) and service menu (items, prices, durations) to be saved to the database, so that my public booking portal reflects my real salon offerings.
- **Acceptance Criteria**:
  1. `ShopRegistrationDto` is updated with nested collections:
     - `List<BarberDto> barbers` (name, photoUrl)
     - `List<ServiceItemDto> services` (name, durationMinutes, price, description)
     - `List<String> photoUrls` (or photo metadata)
  2. `ShopService.registerShop()` iterates over the incoming collections and persists all provided barbers and services into `barbers` and `services` tables.
  3. Hardcoded creation of dummy "Master Barber" and "Haircut & Beard Trim" is removed when custom entities are supplied.
  4. Database rollback (`@Transactional`) guarantees atomic creation of owner, shop, barbers, and services.

#### US-1.2: Wire Frontend Registration Stepper to Full API Payload
- **ID**: `S1-US-02` | **Points**: 8 SP | **Priority**: Critical
- **Description**: As a Frontend Engineer, I want `register.js` to send the complete payload of barbers, services, and compressed photos to `POST /api/shops/register`, so that client state matches the server state.
- **Acceptance Criteria**:
  1. `frontend/src/js/register.js` constructs the JSON payload matching the expanded `ShopRegistrationDto`.
  2. Backend HTTP response status is verified (`201 CREATED`); errors are displayed in a non-blocking toast/alert rather than swallowed silently.
  3. Client store (`store.js`) is updated using the entity ID and slug returned from the backend response.

#### US-1.3: Fix JWT Configuration Property Mismatch
- **ID**: `S1-US-03` | **Points**: 5 SP | **Priority**: High
- **Description**: As a Systems Architect, I want `JwtService.java` to inject configuration keys aligned with `application.yml`, so that environment variables (`JWT_SECRET`, `JWT_EXPIRATION_MS`) take effect in runtime containers.
- **Acceptance Criteria**:
  1. `JwtService.java` constructor values changed to:
     - `@Value("${jwt.secret:${app.jwt.secret:SuperSecret...}}")`
     - `@Value("${jwt.expiration:${app.jwt.expiration-ms:86400000}}")`
  2. Verified that updating `.env.local` changes the signing key and token lifetime without breaking existing tests.

#### US-1.4: Refactor Salons Directory to Consume Backend REST API
- **ID**: `S1-US-04` | **Points**: 8 SP | **Priority**: Medium
- **Description**: As a Super Admin viewing `salons.html`, I want the directory to fetch live shops via `GET /api/shops`, so that newly registered salons appear immediately across different browser sessions.
- **Acceptance Criteria**:
  1. `frontend/src/js/directory.js` executes `fetch("http://localhost:8080/api/shops", { headers: authHeader })`.
  2. Salons list displays real database shops with fallback to cached data if the network is disconnected.
  3. City and search filters operate against the live server dataset.

---

## 3. Sprint 2: Booking Engine, Concurrency & Lock Sweeper
**Goal**: Connect the customer booking wizard directly to backend slot locking and booking endpoints, build the dynamic availability engine, and resolve the database unique constraint collision on expired holds.

### User Stories & Tasks

#### US-2.1: Implement Dynamic Working Hours & Slot Availability Engine
- **ID**: `S2-US-01` | **Points**: 13 SP | **Priority**: Critical
- **Description**: As a Customer booking an appointment, I want to see real available time slots based on the barber's working hours, breaks, and existing bookings, so that I cannot pick unavailable times.
- **Acceptance Criteria**:
  1. Implement `WorkingHoursRepository` and `WorkingHoursService`.
  2. Expose endpoint `GET /api/shops/{shopId}/barbers/{barberId}/available-slots?date=YYYY-MM-DD&serviceId={serviceId}`.
  3. The service calculates slot intervals (e.g. 30 mins) between `start_time` and `end_time` for the specified day of week.
  4. Intervals overlapping with any existing `HOLD` (unexpired) or `CONFIRMED` booking in MySQL or active Redisson lock are marked `available: false`.

#### US-2.2: Integrate Customer Booking Wizard with Distributed Slot Hold
- **ID**: `S2-US-02` | **Points**: 8 SP | **Priority**: Critical
- **Description**: As a Customer selecting a slot on `book.html`, I want my selection to immediately trigger `POST /api/slots/hold`, so that the slot is safely reserved for me for 5 minutes via Redis.
- **Acceptance Criteria**:
  1. `frontend/src/js/booking-stepper.js` fetches barbers via `GET /api/shops/{id}/barbers` and services via `GET /api/shops/{id}/services`.
  2. Selecting a slot calls `POST /api/slots/hold`.
  3. If another customer holds the slot first, the UI intercepts HTTP 409 Conflict, displays an alert, and refreshes the slot grid.
  4. The 5-minute countdown bar starts synchronously with the backend `holdExpiresAt`.

#### US-2.3: Wire Booking Confirmation & Dynamic RFC-5545 Calendar Generation
- **ID**: `S2-US-03` | **Points**: 8 SP | **Priority**: High
- **Description**: As a Customer submitting my details in Step 4, I want my appointment confirmed via `POST /api/bookings/{id}/confirm` and to download a real `.ics` calendar invitation from the server.
- **Acceptance Criteria**:
  1. Form submission calls `POST /api/bookings/{id}/confirm`.
  2. "Download .ics Calendar" button triggers `GET /api/bookings/{id}/calendar`.
  3. The downloaded `.ics` file contains exact appointment start/end dates, shop address, and barber name matching the database record.

#### US-2.4: Implement Background Sweeper for Expired Slot Holds
- **ID**: `S2-US-04` | **Points**: 11 SP | **Priority**: Critical
- **Description**: As a Database Administrator, I want expired `HOLD` bookings to be automatically updated to `CANCELLED`, so that subsequent customers can book the slot without violating the unique constraint `uk_no_double_book`.
- **Acceptance Criteria**:
  1. Enable Spring scheduling (`@EnableScheduling`) in `BarberBookingApplication`.
  2. Create `SlotHoldCleanupService` with a scheduled job running every 60 seconds (`@Scheduled(fixedRate = 60000)`).
  3. Query `bookings` table for `status = 'HOLD' AND hold_expires_at < NOW()`.
  4. Update matching records to `status = 'CANCELLED'`.
  5. Add test verifying that a slot with an expired hold can be re-held immediately without throwing `DataIntegrityViolationException`.

---

## 4. Sprint 3: Real-Time WebSockets & Walk-In Reservation Engine
**Goal**: Activate live push updates across connected dashboards using the STOMP message broker, and establish backend persistence for walk-in customer reservations.

### User Stories & Tasks

#### US-3.1: Activate Slot Event Publishing in Backend Services
- **ID**: `S3-US-01` | **Points**: 8 SP | **Priority**: Critical
- **Description**: As a Systems Architect, I want `SlotBookingService` to trigger `SlotEventPublisher` whenever a slot is held, confirmed, or cancelled, so that real-time events are emitted to the WebSocket broker.
- **Acceptance Criteria**:
  1. Inject `SlotEventPublisher` into `SlotBookingService`.
  2. Call `publishSlotUpdate(shopId, event)` in `holdSlot()`, `confirmBooking()`, and in the expired hold cleanup worker.
  3. Event payload includes: `shopId`, `barberId`, `slotStart`, `slotEnd`, `eventType` (`SLOT_HELD`, `BOOKING_CONFIRMED`, `SLOT_RELEASED`), `status`.

#### US-3.2: Implement Resilient STOMP Client in Salon Dashboard
- **ID**: `S3-US-02` | **Points**: 8 SP | **Priority**: High
- **Description**: As a Salon Owner viewing the live schedule timetable, I want my screen to update automatically within 2 seconds when an online customer books a slot, without manual page refreshing.
- **Acceptance Criteria**:
  1. Refactor `dashboard.js:initWebSocket()` to use standard STOMP over SockJS (`/ws`).
  2. Establish valid STOMP `CONNECT` handshake with automatic reconnection (exponential backoff).
  3. Subscribe dynamically to `/topic/shop/{currentShopId}/slots`.
  4. Upon receiving a frame, parse JSON payload, display a notification toast, and dynamically toggle the target slot badge between `AVAILABLE`, `HOLD`, and `CONFIRMED`.

#### US-3.3: Persistent Backend Walk-In Reservation Endpoint
- **ID**: `S3-US-03` | **Points**: 12 SP | **Priority**: High
- **Description**: As a Salon Staff member recording a walk-in customer, I want to submit their details to a backend endpoint, so that the walk-in reservation is officially stored in MySQL and blocked from online booking.
- **Acceptance Criteria**:
  1. Create endpoint `POST /api/shops/{shopId}/walk-in`.
  2. Request accepts: `barberId`, `serviceId`, `customerName`, `customerPhone`, `slotStart`, `slotEnd`.
  3. Creates or resolves `Customer` entity by phone number.
  4. Creates `Booking` directly with `status = 'CONFIRMED'`.
  5. Emits `BOOKING_CONFIRMED` event over WebSocket to all active dashboard sessions.
  6. Wire `dashboard.js` walk-in modal form submission to this API.

---

## 5. Sprint 4: Super Admin Control Center, Audit Logs & Financial Ledgers
**Goal**: Build missing administrative REST endpoints, connect the Super Admin console to live database records, and implement audit logging and financial reporting streams.

### User Stories & Tasks

#### US-4.1: Super Admin Shop Management Endpoints (Approve / Suspend)
- **ID**: `S4-US-01` | **Points**: 8 SP | **Priority**: High
- **Description**: As a Super Admin, I want to manually override any shop's status via REST API, so that I can approve compliant salons or suspend non-compliant ones.
- **Acceptance Criteria**:
  1. Implement `PATCH /api/admin/shops/{id}/status` secured with `@PreAuthorize("hasRole('SUPER_ADMIN')")`.
  2. Accepts target status: `ACTIVE`, `SUSPENDED`, or `PENDING`.
  3. Updates shop entity, generates final slug/QR codes if moving to `ACTIVE`, and records an `AuditLog` event (`SHOP_APPROVED_MANUALLY` or `SHOP_SUSPENDED`).
  4. Wire "Approve" and "Suspend" buttons in `admin.js` to this endpoint.

#### US-4.2: Super Admin Platform KPI Metrics API
- **ID**: `S4-US-02` | **Points**: 5 SP | **Priority**: Medium
- **Description**: As a Super Admin, I want a single metrics endpoint returning aggregated system stats, so that the top summary cards reflect real platform data.
- **Acceptance Criteria**:
  1. Implement `GET /api/admin/metrics`.
  2. Returns: `totalShops`, `activeSubscriptions`, `totalRevenueSar`, `totalAuditEvents`, `activeUsersCount`.
  3. Wire `admin.js:renderOptionBadges()` to consume this endpoint.

#### US-4.3: Audit Trail Querying & CSV Streaming Endpoint
- **ID**: `S4-US-03` | **Points**: 11 SP | **Priority**: Medium
- **Description**: As a Compliance Officer, I want to filter and export system audit logs from the database, so that administrative actions can be tracked and archived.
- **Acceptance Criteria**:
  1. Add pagination and filtering methods to `AuditLogRepository` (by shop, user, date range, action).
  2. Implement `GET /api/admin/audit-logs` returning paginated JSON.
  3. Implement `GET /api/admin/audit-logs/export-csv` streaming RFC-4180 CSV byte data.
  4. Wire `admin.js` audit table and "Export CSV" button to these endpoints.

#### US-4.4: Payments & Subscription Ledger API
- **ID**: `S4-US-04` | **Points**: 8 SP | **Priority**: Medium
- **Description**: As a Finance Manager, I want to view all inbound subscription payments ingested via webhooks, so that subscription revenue is auditable.
- **Acceptance Criteria**:
  1. Implement `GET /api/admin/payments` returning payment records joined with shop and subscription metadata.
  2. Wire `admin.js:renderPaymentsTable()` to consume this endpoint.

---

## 6. Sprint 5: Test Automation, Hardening & Launch Readiness
**Goal**: Establish comprehensive unit and integration test coverage (>80%), harden API security, reconcile user documentation, and complete production go-live verification.

### User Stories & Tasks

#### US-5.1: Automated Unit & Controller Integration Test Suite
- **ID**: `S5-US-01` | **Points**: 13 SP | **Priority**: High
- **Description**: As a QA Lead, I want an automated test suite covering all REST controllers and core business services, so that regressions are caught in CI/CD before deployment.
- **Acceptance Criteria**:
  1. Implement `@WebMvcTest` suites for:
     - `AuthControllerTest` (Login success, invalid credentials, suspended user 403)
     - `ShopControllerTest` (Registration, QR generation, barber/service listings)
     - `SlotBookingControllerTest` (Hold slot, double-hold 409, confirm, ics generation)
     - `PaymentWebhookControllerTest` (Valid HMAC signature, invalid signature 401, idempotency)
  2. Implement `@DataJpaTest` for repository queries and constraints.
  3. Minimum combined code coverage exceeds 80%.

#### US-5.2: Production Security Hardening & Rate Limiting
- **ID**: `S5-US-02` | **Points**: 5 SP | **Priority**: High
- **Description**: As a Security Engineer, I want public endpoints protected against brute-force and scraping, and CORS locked down to authorized domains.
- **Acceptance Criteria**:
  1. Replace `allowedOriginPatterns("*")` in `SecurityConfig.java` with configurable allowed origins from `application.yml`.
  2. Add rate limiting filter to `POST /api/v1/auth/login` and `POST /api/slots/hold` (e.g. max 10 requests per minute per IP).
  3. Ensure sensitive properties (`JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`) trigger startup failure if left as default keys in production profile.

#### US-5.3: Reconcile Operational Documentation & RTL Arabic UI Check
- **ID**: `S5-US-03` | **Points**: 8 SP | **Priority**: Medium
- **Description**: As a Technical Writer and Product Manager, I want the operational runbook and user guides to accurately describe the Vanilla JS + Tailwind architecture and prepare for Arabic RTL localization.
- **Acceptance Criteria**:
  1. Update `USER_GUIDE.md` to remove inaccurate references to "Next.js 14" and replace with accurate Vanilla JS + Tailwind runbook instructions.
  2. Verify all UI components support RTL layout direction (`dir="rtl"`) with IBM Plex Sans Arabic font support for Phase 2 readiness.
  3. Verify all deployment scripts in `scripts/start-infra.sh` and `scripts/verify-e2e.sh` execute cleanly on standard Linux/macOS environments.

---

## 7. Definition of Done (DoD)

A backlog item or user story is considered **Done** only when all of the following criteria are satisfied:
1. **Code Completeness**: Implemented according to user story acceptance criteria without hardcoded mock workarounds.
2. **Database Integrity**: Relational constraints, cascading rules, and unique indices verified against MySQL 8.0.
3. **Security Standards**: RBAC enforced at both REST API (`@PreAuthorize`) and frontend route guard levels; all sensitive inputs validated.
4. **Automated Testing**: Unit and integration tests written and passing locally and in CI/CD pipeline.
5. **Real-Time Validation**: WebSocket events propagate within < 2 seconds across open client browser tabs.
6. **Code Review & Static Analysis**: Zero critical linting or compiler warnings; documentation docstrings preserved.
