# Quality Assurance Protocol & Automated Test Specifications
## BarberApp KSA — Enterprise Multi-Tenant Salon SaaS
**Target Environment**: Real Database Integration (MySQL 8.0 + Redis 7.0 + Spring Boot 3.3.5)  
**Standard**: ISO/IEC/IEEE 29119 Software Testing & OWASP ASVS 4.0  
**Status**: Authoritative Test Matrix & Quality Gate Specification  

---

## 1. Executive QA Strategy & Severity Classification

To guarantee enterprise data integrity, multi-tenant isolation, and high-concurrency safety, this test protocol explicitly forbids shallow UI snapshot tests. All test cases execute against live backend endpoints and real MySQL transactional tables to validate:
1. **Authentication & RBAC Security Boundaries**: Zero role escalation, zero tenant bleed.
2. **Deterministic State Transitions**: Correct state-machine progression (`HOLD` → `CONFIRMED` → `IN_SERVICE` → `COMPLETED`).
3. **Financial Accounting Integrity**: Absolute accuracy in revenue calculations in `SAR` (`Asia/Riyadh`).
4. **Concurrency & Race Conditions**: High-throughput distributed lock leases preventing chair double-booking.

### Severity Levels:
- 🔴 **Critical (P0 - Blocker)**: Privilege escalation, cross-tenant data leaks, double-booking race condition failures, financial revenue miscalculations, password token replay vulnerabilities.
- 🟠 **High (P1 - Major)**: Scope restriction bypasses, booking validation boundary violations, file storage cap overflows, active appointment cancellation policy failures.
- 🟡 **Medium (P2 - Normal)**: Input sanitization, notification formatting, localization anomalies, edge-case warning messages.

---

## 2. Comprehensive Test Matrix

### Module 1: Authentication & RBAC Security Boundaries

| Test ID | Test Name | Severity | Primary Target | Expected Behavior |
| :--- | :--- | :---: | :--- | :--- |
| **TC-AUTH-01** | Role Escalation Tamper Guard | 🔴 Critical | `POST /api/auth/register` | Public registration payload containing `"role": "SUPER_ADMIN"` or `"role": "SALON_STAFF"` is neutralized; user is created strictly with `CUSTOMER` role. |
| **TC-AUTH-02** | Multi-Role Credential Issuance & Routing | 🔴 Critical | `POST /api/auth/login` | Valid credentials for Admin, Owner, Staff, and Customer issue signed JWTs with accurate claims and route destinations (`/dashboard/admin.html`, `/portal/index.html#dashboard`, `/portal/index.html#bookings`, `/booking/`). |
| **TC-AUTH-03** | Cryptographic Password Reset Lifecycle | 🔴 Critical | `POST /api/auth/forgot-password`<br>`POST /api/auth/reset-password` | Dispatches 32-byte token with SHA-256 DB hash; updates BCrypt password; rejects expired tokens (>60m) and rejects token reuse (`HTTP 400`). |
| **TC-AUTH-04** | Cross-Tenant Boundary Isolation | 🔴 Critical | `GET/PUT/DELETE /api/portal/staff/{id}`<br>`GET/PUT/DELETE /api/portal/services/{id}`<br>`GET/PATCH /api/portal/bookings/{id}` | Salon Owner A (Tenant 1) cannot inspect, modify, or delete Salon Owner B's (Tenant 2) staff, services, or bookings via ID manipulation. Rejects with `403 Forbidden` or `404 Not Found`. |
| **TC-AUTH-05** | Deactivated User Access Block | 🟠 High | `POST /api/auth/login`<br>`GET /api/portal/bookings` | Inactive or soft-deleted users (`active = false`, `deleted_at IS NOT NULL`) are immediately denied login and their JWT bearer tokens are rejected (`401 Unauthorized` / `403 Forbidden`). |
| **TC-AUTH-06** | Saudi Mobile Phone Normalization | 🟡 Medium | `POST /api/auth/register` | Accepts `+9665xxxxxxxx`, `9665xxxxxxxx`, `05xxxxxxxx` and normalizes to standard 10-digit `05xxxxxxxx`. Rejects invalid phone lengths and non-Saudi prefixes with `400 Bad Request`. |

---

### Module 2: Salon Operations & Staff Scoping

| Test ID | Test Name | Severity | Primary Target | Expected Behavior |
| :--- | :--- | :---: | :--- | :--- |
| **TC-OPS-01** | Staff Chair Scoping Guard | 🔴 Critical | `GET /api/portal/bookings`<br>`PATCH /api/portal/bookings/{id}/status` | Logged-in Staff (`SALON_STAFF`) can only query and mutate bookings assigned to their own chair. Attempting to query or modify peer staff appointments returns `403 Forbidden`. |
| **TC-OPS-02** | Strict Financial Revenue Accounting | 🔴 Critical | `GET /api/portal/analytics/revenue` | Revenue strictly aggregates `SUM(service.price)` for bookings with status `COMPLETED`. Appointments with status `CANCELLED`, `NO_SHOW`, `HOLD`, `PENDING`, `CONFIRMED` are strictly excluded (0 SAR added). |
| **TC-OPS-03** | Salon Media Gallery 5-Photo Cap | 🟠 High | `POST /api/portal/gallery/upload` | Enforces a strict ceiling of 5 gallery photos per salon. The 6th photo upload is rejected with `HTTP 400 Bad Request` (`Gallery Limit Reached`). Rejects staff uploads (`403 Forbidden`). |
| **TC-OPS-04** | Active Appointment Staff Deactivation Guard | 🔴 Critical | `PATCH /api/portal/staff/{id}/status`<br>`DELETE /api/portal/staff/{id}` | Attempting to deactivate or soft-delete a staff member who has future active appointments (`CONFIRMED`, `HOLD`, `IN_SERVICE`) triggers `HTTP 409 Conflict` with conflict details. |
| **TC-OPS-05** | Staff Shift Status Persistence | 🟠 High | `PATCH /api/portal/shift` | Staff shift toggle (`ONLINE` / `OFFLINE`) is persisted in database and immediately impacts real-time appointment availability. |
| **TC-OPS-06** | Operational Status State Machine | 🟠 High | `PATCH /api/portal/bookings/{id}/status` | Staff members are permitted to update operational statuses (`ARRIVED`, `IN_SERVICE`, `COMPLETED`, `NO_SHOW`), but are forbidden from cancelling or blocking slots (`403 Forbidden`). |

---

### Module 3: Customer Booking Funnel & Slot Engine

| Test ID | Test Name | Severity | Primary Target | Expected Behavior |
| :--- | :--- | :---: | :--- | :--- |
| **TC-BOOK-01** | Slot Occupancy & Buffer Time Math | 🔴 Critical | `POST /api/slots/hold`<br>`BookingRepository.findConflictingBookings` | A 30-minute haircut with a 15-minute buffer reserves a 45-minute window (`slotStart` to `slotEnd`). Any subsequent booking overlapping this 45-minute window is blocked. |
| **TC-BOOK-02** | Concurrency Race Condition Guard | 🔴 Critical | `POST /api/slots/hold`<br>`SlotLockService` (Redis Redisson) | Two simultaneous requests attempting to lock the exact same barber slot at the identical millisecond result in exactly 1 success (`201 Created`) and 1 clean conflict rejection (`409 Conflict`). |
| **TC-BOOK-03** | Temporary Slot Hold 5-Minute Timeout | 🔴 Critical | `SlotHoldCleanupTask`<br>`POST /api/slots/hold` | A temporary slot hold (`status: HOLD`) automatically expires after 5 minutes (`holdExpiresAt < NOW()`). The slot lock is released, and the slot becomes bookable again. |
| **TC-BOOK-04** | RFC-5545 `.ics` Calendar Generation | 🟠 High | `GET /api/bookings/{id}/calendar` | Returns valid `text/calendar;charset=UTF-8` payload with `TZID:Asia/Riyadh`, start/end timestamps, location, booking reference, and `-PT1H` (1-hour before) alarm trigger. |
| **TC-BOOK-05** | Customer Cancellation Policy Window | 🟠 High | `PATCH /api/portal/bookings/{id}/status` | Cancellations attempted inside the non-refundable cancellation notice window (`minCancelNoticeHours = 2`) are rejected by policy. |
| **TC-BOOK-06** | Double-Booking Interval Overlap Prevention | 🔴 Critical | `POST /api/bookings/public` | Overlapping appointments on the same barber are strictly rejected using the temporal formula: `existing.slotStart < new.slotEnd AND existing.slotEnd > new.slotStart`. |
| **TC-BOOK-07** | Staff Walk-In Auto-Confirmation | 🟠 High | `POST /api/portal/bookings/walk-in` | Direct staff walk-in creation bypasses online payment and immediately confirms appointment (`status: CONFIRMED`, `walkIn: true`) with audit trail entry. |

---

### Module 4: End-to-End Customer Booking Journey

| Test ID | Test Name | Severity | Primary Target | Expected Behavior |
| :--- | :--- | :---: | :--- | :--- |
| **TC-E2E-01** | Full Customer Booking Flow & Receipt | 🔴 Critical | Customer Funnel (`/booking/?slug={slug}`) | Full lifecycle test: service selection → barber selection → slot selection → customer details entry → temporary hold acquisition → final booking confirmation → calendar receipt generation. |

---

## 3. Detailed Test Specifications & Assertions

### TC-AUTH-01: Role Escalation Tamper Guard
- **Pre-conditions**: Database active, `users` table accessible.
- **Request**:
  ```http
  POST /api/auth/register
  Content-Type: application/json

  {
    "fullName": "Malicious Actor",
    "phone": "0511223344",
    "email": "hacker@test.sa",
    "password": "Password123!",
    "role": "SUPER_ADMIN"
  }
  ```
- **Assertions**:
  - Response status is `201 Created`.
  - Response JSON body: `user.role` equals `"CUSTOMER"` (not `"SUPER_ADMIN"`).
  - Database row verification: `SELECT role FROM users WHERE email = 'hacker@test.sa'` equals `'CUSTOMER'`.

### TC-AUTH-04: Tenant Isolation & Data Bleed Prevention
- **Pre-conditions**:
  - Salon A (ID: 53, Owner: `owner@goldenscissors.sa`).
  - Salon B (ID: 2, Owner: `owner@royallounge.sa`).
  - Barber B belongs to Salon B (ID: 10).
- **Execution**:
  - Obtain JWT bearer token for Owner A.
  - Attempt to update Barber B using Owner A's token:
    ```http
    PUT /api/portal/staff/10
    Authorization: Bearer <TOKEN_OWNER_A>
    Content-Type: application/json

    {
      "name": "Tampered Barber Name"
    }
    ```
- **Assertions**:
  - Response status is `404 Not Found` or `403 Forbidden`.
  - Database verification: Barber 10 in Salon B remains completely unmodified.

### TC-OPS-02: Financial Calculations & Strict Completed Status Filter
- **Pre-conditions**: Clean test salon.
- **Test Dataset**:
  1. Booking 1: `COMPLETED`, Price = 60.00 SAR (Today)
  2. Booking 2: `COMPLETED`, Price = 40.00 SAR (Today)
  3. Booking 3: `CANCELLED`, Price = 100.00 SAR (Today)
  4. Booking 4: `NO_SHOW`, Price = 50.00 SAR (Today)
  5. Booking 5: `CONFIRMED`, Price = 80.00 SAR (Today)
- **Request**:
  ```http
  GET /api/portal/analytics/revenue
  Authorization: Bearer <OWNER_TOKEN>
  ```
- **Assertions**:
  - `todayEarnings` equals exactly `100.00` SAR (`60 + 40`).
  - `totalCompletedBookings` equals `2`.
  - Excluded statuses (`CANCELLED`, `NO_SHOW`, `CONFIRMED`) add exactly `0.00` SAR.
  - `currency` equals `"SAR"`.

### TC-BOOK-02: Concurrency Race Condition on Slot Hold
- **Pre-conditions**: Barber 1 has an open slot at `2026-10-15T14:00:00`.
- **Execution**:
  - Dispatch two concurrent asynchronous HTTP requests using `Promise.all`:
    ```javascript
    const [res1, res2] = await Promise.all([
      postHoldSlot({ barberId: 1, slotStart: "2026-10-15T14:00:00", slotEnd: "2026-10-15T14:30:00", customerId: 101 }),
      postHoldSlot({ barberId: 1, slotStart: "2026-10-15T14:00:00", slotEnd: "2026-10-15T14:30:00", customerId: 102 })
    ]);
    ```
- **Assertions**:
  - The array of status codes `[res1.status, res2.status].sort()` must be strictly `[201, 409]`.
  - Exactly 1 customer secures the slot hold.
  - The second request receives conflict message: `"Slot is currently held or being booked by another customer"`.
  - Database contains exactly 1 active `HOLD` booking for Barber 1 at `14:00:00`.

---

## 4. Test Runner & Execution Protocol

### Integration Runner Architecture:
- Lightweight test runner executing against the live Spring Boot API on port `8080` and real MySQL on port `3307`.
- **Zero Mock Policy**: Tests communicate over real HTTP/REST pipelines to validate filters, transactions, Redisson locks, and database constraints.
- **Idempotent Fixture Lifecycle**:
  - `beforeAll`: Validates backend server and MySQL availability; authenticates seed users.
  - `beforeEach`: Creates isolated unique test entities with unique prefixes (e.g., `test_cust_1729000@barberapp.sa`).
  - `afterEach` / `afterAll`: Cleans up transient test records, preventing database pollution.

### Master Verification Command:
```bash
npm test
```
Outputs individual test suite results, timing breakdown, and assertion coverage summary.
