# Product Feature Backlog & Sprint Execution Matrix

## 1. Status Legend

- 🟢 **`Verified`**: Implemented, integrated with live database, and passing automated test suite (`npm test`).
- 🔵 **`Completed`**: Implemented, verified in browser UI, and deployed to codebase.
- 🟡 **`In-Progress`**: Currently under active implementation.
- ⚪ **`Backlog`**: Prioritized roadmap item for upcoming sprints.

---

## 2. Feature Implementation Status Matrix

| Feature ID | Module / Screen | Capability & Technical Scope | Target Route / Endpoint | Status | Sprint |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **FEAT-REG-01** | Shop Onboarding | 4-step salon self-registration wizard with subscription tiers | `/register.html`<br>`POST /api/shops/register` | `Completed` | Sprint 1 |
| **FEAT-PAY-01** | Payments | Moyasar payment auto-approval webhook handler | `POST /api/payments/webhook` | `Completed` | Sprint 1 |
| **FEAT-SLOT-01** | Concurrency Engine | 5-minute temporary slot hold with Redis Redisson distributed lock | `POST /api/slots/hold` | `Verified` | Sprint 2 |
| **FEAT-SLOT-02** | Booking Engine | Appointment confirmation and RFC-5545 `.ics` calendar generation | `POST /api/bookings/{id}/confirm`<br>`GET /api/bookings/{id}/calendar` | `Verified` | Sprint 2 |
| **FEAT-WS-01** | Real-Time Sync | WebSocket STOMP live appointment schedule broadcast broker | `/ws`<br>`/topic/shop/{id}/slots` | `Completed` | Sprint 3 |
| **FEAT-DIR-01** | Admin Directory | Super Admin paginated tenant salon directory table | `/dashboard/admin.html#salons`<br>`GET /api/shops` | `Completed` | Sprint 4 |
| **FEAT-DIR-02** | Admin Directory | Multi-attribute search and filtering (Name, City, District, CR #) | `/dashboard/admin.html#salons` | `Completed` | Sprint 4 |
| **FEAT-DIR-03** | Admin Directory | Salon quick-action menu (Impersonate, Edit, Booking link) | `/dashboard/admin.html#salons` | `Completed` | Sprint 4 |
| **FEAT-DIR-04** | Admin Directory | Salon status transition modal (`ACTIVE`, `PENDING`, `SUSPENDED`) | `PATCH /api/shops/{id}/status` | `Completed` | Sprint 4 |
| **FEAT-DIR-05** | Admin Directory | Super Admin impersonation mode banner and context bridge | `/dashboard/index.html?slug={slug}&impersonate=true` | `Completed` | Sprint 4 |
| **FEAT-CFG-01** | Admin Settings | Platform system configuration screen with tabbed panels | `/dashboard/admin.html#settings` | `Completed` | Sprint 4 |
| **FEAT-CFG-02** | Admin Settings | Multi-panel configuration engine (General, Billing/Tax, SMS, Flags) | `/dashboard/admin.html#settings` | `Completed` | Sprint 4 |
| **FEAT-CFG-03** | Admin Settings | Field validation (RFC Email, Saudi Mobile, ZATCA 15-digit TIN) | `/dashboard/admin.html#settings` | `Completed` | Sprint 4 |
| **FEAT-CFG-04** | Admin Settings | Unsaved changes guard and navigation interception modal | `/dashboard/admin.html#settings` | `Completed` | Sprint 4 |
| **FEAT-CFG-05** | Admin Settings | Cache sync and cross-tab state event dispatching | `localStorage`<br>`Store.events` | `Completed` | Sprint 4 |
| **FEAT-RBAC-01**| Platform RBAC | Internal staff management & screen permission matrix console | `/dashboard/admin.html#access-control` | `Completed` | Sprint 4 |
| **FEAT-RBAC-02**| Platform RBAC | Staff invitation modal, role badge assignment, and edit actions | `POST /api/admin/users/invite` | `Completed` | Sprint 4 |
| **FEAT-RBAC-03**| Platform RBAC | Self-lockout guard and last Super Admin demotion protection | `/dashboard/admin.html#access-control` | `Completed` | Sprint 4 |
| **FEAT-RBAC-04**| Platform RBAC | Granular capability matrix persistence per internal staff role | `GET/PUT /api/admin/permissions` | `Completed` | Sprint 4 |
| **FEAT-AUD-01** | Platform Audit | Security and administrative audit trail viewer table | `/dashboard/admin.html#audit`<br>`GET /api/admin/audit-logs` | `Completed` | Sprint 4 |
| **FEAT-PORTAL-01**| Salon Portal | Dedicated multi-tenant salon dashboard with shop context header | `/portal/index.html` | `Completed` | Sprint 5 |
| **FEAT-PORTAL-02**| Salon Portal | Role-aware sidebar navigation (Owner vs Staff menu items) | `/portal/index.html` | `Completed` | Sprint 5 |
| **FEAT-PORTAL-03**| Salon Portal | Staff scoping restriction (Locked to assigned chair, peer reads blocked) | `GET /api/portal/bookings` | `Verified` | Sprint 5 |
| **FEAT-PORTAL-04**| Salon Portal | Header staff shift status toggle pill (`ONLINE` / `OFFLINE`) | `PATCH /api/portal/shift` | `Verified` | Sprint 5 |
| **FEAT-PORTAL-05**| Salon Portal | Multi-format appointment calendar engine (Day / Week / Timeline) | `/portal/index.html#bookings` | `Completed` | Sprint 5 |
| **FEAT-PORTAL-06**| Salon Portal | Appointment state machine (`HOLD` &rarr; `CONFIRMED` &rarr; `IN_SERVICE` &rarr; `COMPLETED`) | `PATCH /api/portal/bookings/{id}/status` | `Verified` | Sprint 5 |
| **FEAT-PORTAL-07**| Salon Portal | Staff roster directory, avatar upload, and shift management | `/portal/staff/index.html`<br>`GET/POST/PUT /api/portal/staff` | `Completed` | Sprint 5 |
| **FEAT-PORTAL-08**| Salon Portal | Service menu catalog with duration, pricing, and buffer minutes | `/portal/services/index.html`<br>`GET/POST/PUT /api/portal/services` | `Completed` | Sprint 5 |
| **FEAT-PORTAL-09**| Salon Portal | Salon operations settings (Operating hours JSON, storefront info) | `/portal/settings/index.html`<br>`GET/PUT /api/portal/settings` | `Completed` | Sprint 5 |
| **FEAT-PORTAL-10**| Salon Portal | Fast walk-in creation with Redis lock & auto-confirmation | `POST /api/portal/bookings/walk-in` | `Verified` | Sprint 5 |
| **FEAT-PORTAL-11**| Salon Portal | Revenue analytics in SAR strictly filtering `COMPLETED` bookings | `GET /api/portal/analytics/revenue` | `Verified` | Sprint 5 |
| **FEAT-PORTAL-12**| Salon Portal | Salon media photo gallery with strict maximum 5-photo ceiling | `GET/POST/DELETE /api/portal/gallery` | `Verified` | Sprint 5 |
| **FEAT-PORTAL-13**| Salon Portal | Staff portrait avatar image upload to static disk storage | `POST /api/portal/staff/{id}/avatar` | `Completed` | Sprint 5 |
| **FEAT-BOOK-01**| Customer Funnel | Mobile-first 6-step customer booking flow with 14-day date strip | `/booking/?slug={slug}` | `Verified` | Sprint 6 |
| **FEAT-BOOK-02**| Customer Funnel | Role-aware booking experience (Customer, Staff Walk-In, Admin preview) | `/booking/?slug={slug}` | `Verified` | Sprint 6 |
| **FEAT-MOD-01** | Architecture | Route canonicalization: single physical `/booking/index.html`, 302 redirects | `/book`, `/book.html`, `/booking.html` | `Completed` | Sprint 7 |
| **FEAT-MOD-02** | Architecture | Unused dependency pruning (purge unneeded CSS plugins and CDN shims) | `package.json`, `tailwind.config.js` | `Completed` | Sprint 7 |
| **FEAT-MOD-03** | Architecture | Frontend modularization: extract `/types/enums.js`, `/lib/*` utilities | `frontend/src/js/lib/*` | `Completed` | Sprint 7 |
| **FEAT-AUTH-01**| Unified Auth | Centralized authentication and BCrypt password encryption (Cost 10) | `POST /api/auth/login` | `Verified` | Sprint 8 |
| **FEAT-AUTH-02**| Unified Auth | Customer self-registration with Saudi mobile normalization (`05XXXXXXXX`) | `POST /api/auth/register` | `Verified` | Sprint 8 |
| **FEAT-AUTH-03**| Unified Auth | Atomic business onboarding (`Shop` + `User` role `SALON_OWNER` with `salonId`) | `POST /api/auth/register-salon` | `Verified` | Sprint 8 |
| **FEAT-AUTH-04**| Unified Auth | Cryptographic single-use 60m password reset (`V9__create_password_resets_table`) | `POST /api/auth/forgot-password`<br>`POST /api/auth/reset-password` | `Verified` | Sprint 8 |
| **FEAT-AUTH-05**| Unified Auth | Dynamic post-login authority router across Admin, Owner, Staff, Customer | `frontend/src/js/auth.js` | `Verified` | Sprint 8 |
| **FEAT-AUTH-06**| Unified Auth | Idempotent Super Admin provisioning CLI script | `npm run seed:admin`<br>`scripts/seed-admin.js` | `Completed` | Sprint 8 |
| **FEAT-QA-01**  | Quality Assurance | Automated integration and E2E test suite (Vitest + Live DB, 23/23 tests) | `npm test`<br>`tests/integration/*`, `tests/e2e/*` | `Verified` | Sprint 9 |

---

## 3. Product Roadmap & Upcoming Backlog

| Feature ID | Planned Milestone | Scope Description | Priority | Target Status |
| :--- | :--- | :--- | :---: | :---: |
| **FEAT-HARD-01**| Sprint 10 (Hardening) | Rate limiting (Bucket4j/Redis) on auth endpoints & strict CORS origins | High | `In-Progress` |
| **FEAT-LOC-01** | Sprint 10 (Hardening) | Arabic RTL localization toggle for customer booking and portal screens | High | `In-Progress` |
| **FEAT-NOTIF-01**| Sprint 11 (Notifications)| SMS / WhatsApp confirmation & reminder notifications via Unifonic/Twilio | Medium | `Backlog` |
| **FEAT-EXP-01** | Sprint 11 (Operations) | Financial reports & appointments export to CSV and Excel format | Medium | `Backlog` |
| **FEAT-REV-01** | Sprint 12 (Engagement) | Post-service customer rating & review submission engine | Low | `Backlog` |
