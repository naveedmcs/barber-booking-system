# Product Feature Backlog & Implementation Status
**Project**: Salon & Barber Booking SaaS Platform  
**Target Market**: Saudi Arabia & GCC Region  
**Architecture**: Spring Boot 3.3.5 / MySQL 8.0 / Redis 7.0 / Vanilla JS (ES Modules) + Tailwind CSS  
**Last Updated**: October 2026  
**Document Status**: Active Product Backlog  

---

## 1. Feature Status Summary Matrix

| Feature Key | Module / Screen | Route / Endpoint | Status | Sprint / Milestone |
| :--- | :--- | :--- | :---: | :--- |
| **FEAT-DIR-01** | **Salon Directory Screen** | `/admin/salons`<br>`/dashboard/admin.html?view=salons` | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-DIR-02** | **Multi-Attribute Search & Filter** | Global search across Name, City, District, Region, CR #, Status | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-DIR-03** | **Salon Quick-Action Menu** | Profile inspection, Impersonate dashboard, Status toggle, Booking link | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-DIR-04** | **Explicit Status Modal & Audit Trail** | `PATCH /api/shops/{id}/status`<br>`audit_logs` table | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-DIR-05** | **Super Admin Impersonation Mode** | `/dashboard/index.html?slug={slug}&impersonate=true` | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-CFG-01** | **System Configuration Screen** | `/admin/settings`<br>`/dashboard/admin.html?view=settings` | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-CFG-02** | **Tabbed Configuration Engine** | General, Billing/Tax, SMS/Notification, Feature Flags | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-CFG-03** | **Field-Type Client Validation** | RFC Email, KSA Mobile (+966), ZATCA 15-digit TIN, Port bounds, Min/Max | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-CFG-04** | **Unsaved Changes Guard & Modal** | Tab switch, nav click, popstate, beforeunload warning | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-CFG-05** | **Safe State & Cache Sync** | Toast notifications, localStorage sync, store event dispatch | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-RBAC-01**| **Internal RBAC Two-Tab Console** | `/admin/access-control`<br>`/dashboard/admin.html?view=access-control` | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-RBAC-02**| **Internal Admin Staff Management & Invite** | Staff listing table, role badge, last login, invite modal, role edit | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-RBAC-03**| **Self-Lockout & Last Super Admin Guard** | Disables self-deactivation & last Super Admin demotion/deactivation | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-RBAC-04**| **Granular Capability Matrix & Persistence**| Screen permission matrix per platform role, dynamic checkbox sync | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-PORTAL-01**| **Salon Portal Layout & Multi-Tenant Context** | `/portal`<br>`/salon-dashboard` | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-02**| **Dynamic Role-Based Sidebar Navigation** | Owner: Bookings, Staff, Services, Settings<br>Staff: Schedule, Profile | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-03**| **Staff Scope Restriction & Route Guard** | Scopes queries by `staffId`, blocks other appointments & owner modules (403) | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-04**| **Staff Shift Status Management** | Header shift pill toggle (`ONLINE` / `OFFLINE`), persisted via PATCH `/api/portal/shift` | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-05**| **Multi-Format Calendar Engine (Day / Week / Timeline)** | `/portal#bookings`<br>`/portal#schedule` | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-06**| **Slot Status State-Machine & Conflict Guard** | Overlap check (409 Conflict), Optimistic UI rollback, Reassign, Block slot, Walk-In | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-07**| **Staff & Roster Management Engine** | `/portal/staff`<br>`GET/POST/PUT/PATCH /api/portal/staff` | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-08**| **Services & Catalog Management Engine** | `/portal/services`<br>`GET/POST/PUT/PATCH /api/portal/services` | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-09**| **Salon Profile & Operations Settings** | `/portal/settings`<br>`GET/PUT /api/portal/settings` | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-10**| **Walk-In Distributed Lock & Concurrency Guard** | Redis `acquireSlotHold` + MySQL `@Transactional` check prevents double booking | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-11**| **Owner Revenue & Financial Analytics Engine** | `/portal#dashboard`<br>`GET /api/portal/analytics/revenue` (Strict COMPLETED filter, SAR, Asia/Riyadh) | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-12**| **Salon Media Management & Photo Gallery (Max 5)** | `/portal/settings`<br>`GET/POST/PUT/DELETE /api/portal/gallery` (Max 5 photos, 5MB, static `/uploads/**`) | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-PORTAL-13**| **Staff Portrait Avatar Management** | `/portal/staff`<br>`POST /api/portal/staff/{id}/avatar` (Static asset URL, no Base64 in DB) | **COMPLETED** | Sprint 5 (Salon Portal) |
| **FEAT-AUD-01** | User Activity Audit Viewer | `/dashboard/admin.html?view=audit`<br>`GET /api/admin/audit-logs` | **COMPLETED** | Sprint 4 (Core Admin) |
| **FEAT-REG-01** | Shop Self-Registration Portal | `/register.html`<br>`POST /api/shops/register` | **COMPLETED** | Sprint 1 (Onboarding) |
| **FEAT-PAY-01** | Moyasar Payment Auto-Approval | `POST /api/payments/webhook` | **COMPLETED** | Sprint 1 (Payments) |
| **FEAT-SLOT-01**| 5-Minute Slot Hold with Redis Locks | `POST /api/slots/hold` | **COMPLETED** | Sprint 2 (Concurrency) |
| **FEAT-SLOT-02**| Booking Confirmation & RFC-5545 .ics | `POST /api/bookings/{id}/confirm`<br>`GET /api/bookings/{id}/calendar` | **COMPLETED** | Sprint 2 (Booking) |
| **FEAT-BOOK-01**| **Customer Booking Funnel (Mobile-First)** | `/booking/?slug={slug}` (Canonical single physical source of truth)<br>Role-Aware (Public Customer, Salon Owner, Staff, Admin) | **COMPLETED** | Sprint 6 (Customer Funnel) |
| **FEAT-MOD-01** | **Route De-duplication & Canonicalization** | Canonical: `frontend/booking/index.html`<br>Deleted `book.html`, `book/index.html`, `booking.html`<br>HTTP 302 middleware for legacy aliases | **COMPLETED** | Sprint 7 (Architecture & Refactor) |
| **FEAT-BOOK-02**| **Booking Route Consolidation & Role Header** | `/booking/?slug={slug}` dynamic session detection, Walk-In Mode toggle, Admin Preview banner, staff phone privacy guard | **COMPLETED** | Sprint 7 (Architecture & Refactor) |
| **FEAT-MOD-02** | **Dependency & Integration Pruning** | Pruned `@tailwindcss/forms`, `@tailwindcss/typography`, SockJS/Stomp CDN | **COMPLETED** | Sprint 7 (Architecture & Refactor) |
| **FEAT-MOD-03** | **Module Decomposition & Types/Lib Extraction**| `/types/enums.js`, `/lib/validators.js`, `/lib/formatting.js`, `/lib/calendar.js`, `/lib/api-client.js` | **COMPLETED** | Sprint 7 (Architecture & Refactor) |
| **FEAT-WS-01**  | Live Schedule Synchronization | WebSocket STOMP Broker `/ws`<br>`/topic/shop/{id}/slots` | **COMPLETED** | Sprint 3 (Real-Time) |
| **FEAT-AUTH-01**| **Centralized Auth & BCrypt Password Encryption** | `/api/auth/login` (purged mocks & plaintext fallbacks, BCrypt cost 10) | **COMPLETED** | Sprint 8 (Unified Auth & Security) |
| **FEAT-AUTH-02**| **Public Customer Registration & Phone Normalization** | `/api/auth/register`<br>`frontend/login.html#register` (Saudi 05xxxxxxxx regex) | **COMPLETED** | Sprint 8 (Unified Auth & Security) |
| **FEAT-AUTH-03**| **Atomic Salon Owner Registration & Multi-Tenant Binding** | `/api/auth/register-salon`<br>`@Transactional` Shop + User with `salonId` | **COMPLETED** | Sprint 8 (Unified Auth & Security) |
| **FEAT-AUTH-04**| **Cryptographic Password Reset Engine** | `POST /api/auth/forgot-password`<br>`POST /api/auth/reset-password`<br>`V9__create_password_resets_table.sql` | **COMPLETED** | Sprint 8 (Unified Auth & Security) |
| **FEAT-AUTH-05**| **Role-Governed Authority Router & Redirection** | Dynamic post-login matrix across Admin, Salon Owner, Staff, Customer | **COMPLETED** | Sprint 8 (Unified Auth & Security) |
| **FEAT-AUTH-06**| **Super Admin CLI Seed Provisioning** | Idempotent CLI script `npm run seed:admin` (`scripts/seed-admin.js`) | **COMPLETED** | Sprint 8 (Unified Auth & Security) |

---

## 2. Feature Specification: Salon Directory Screen (`/admin/salons`)

### 2.1 Overview & Architecture
The Salon Directory Screen serves as the primary operational registry for Super Administrators to oversee, inspect, and moderate tenant salons across Saudi Arabia.

- **Frontend Routes**:
  - `/admin/salons` (clean URL routed via `/admin/salons/index.html`)
  - `/admin/salons.html` (direct page redirection)
  - `/dashboard/admin.html?view=salons#salons` (embedded workspace in Super Admin portal)
- **Backend Endpoints**:
  - `GET /api/shops` (fetches full list of registered tenant shops)
  - `PATCH /api/shops/{id}/status` & `PUT /api/shops/{id}/status` (updates shop status and records audit log)
  - `GET /api/admin/audit-logs` (reads recorded audit trail events)

### 2.2 Implemented Capabilities

#### 1. Paginated Listing of All Registered Salons
- **Customizable Page Size**: Selector supports 5, 10, 20, or 50 salons per page.
- **Dynamic Boundary Indicators**: "Showing X to Y of Z registered salons".
- **Boundary Navigation**: First (`«`), Previous (`‹`), Numbered page pills with active state, Next (`›`), and Last (`»`).
- **Data Table Presentation**:
  - Salon Name, initial avatar, slug link, Commercial Registration number badge (`CR-1010XXXX`).
  - National address, City, District, Region, and direct Google Maps search link.
  - Verified shop owner name, email address, and Saudi contact phone number (`05XXXXXXXX`).
  - Active subscription tier badge (`MONTHLY` 20 SAR / `YEARLY` 200 SAR).
  - Live status indicator pill with animated color-coded pulsing dot.

#### 2. Comprehensive Multi-Attribute Search & Filtering
- **Real-Time Reactive Search Input**:
  - Matches dynamically across:
    * Salon Name
    * City (e.g. Riyadh, Jeddah, Dammam)
    * District (e.g. Olaya, Al-Hamra, Al-Malqa)
    * Region (e.g. Riyadh Region, Makkah Region)
    * Commercial Registration Number (`CR-1010XXXX`), ID (`#12`), phone number, or slug
    * Status (`ACTIVE`, `PENDING`, `SUSPENDED`)
- **Category Filter Dropdowns**:
  - Status Filter: All, Active, Pending, Suspended (with dynamic counts).
  - Region Filter: Dynamic list of all populated regions.
  - Sort By: Newest Registered, Oldest Registered, Salon Name (A-Z / Z-A), City, Status.
- **Filter State Management**:
  - Removable active filter chips for instant clearing.
  - One-click "Reset Filters" action button.
  - Friendly empty state when no salons match search parameters.

#### 3. Quick-Action Menu
For every registered salon row:
1. **View Profile**:
   - Opens the `#salon-profile-drawer` slide-over drawer displaying:
     * Full business metadata, tenant ID, and onboarding timestamp.
     * Owner communications and verified contact information.
     * Geolocation, street address, and Plus Code Google Maps integration.
     * Dual QR code interactive preview (Customer Booking QR & Owner Staff Login QR).
     * Single-click QR export buttons: PNG, SVG, and Full ZIP archive.
     * Direct navigation to the customer booking flow and owner dashboard.
2. **Impersonate / Inspect Salon Dashboard**:
   - Launches `/dashboard/index.html?slug={slug}&impersonate=true` in a new browser tab.
   - Activates **Super Admin Inspection Mode** with a persistent amber alert banner confirming administrative authority and attributing manual bookings to audit credentials.
   - Includes a quick-return link to exit back to the Salon Directory.
3. **Change Operational Status**:
   - Color-coded action button (Suspend for active salons, Activate / Approve for suspended/pending salons).
   - Triggers the **Explicit Confirmation Modal**.
4. **Additional Row Actions**:
   - Copy Customer Booking URL to clipboard.
   - View Public Booking Page (`/book.html?slug={slug}`).
   - Mark as Pending Review.

### 2.3 Acceptance Criteria Validation: Explicit Confirmation Modal & Audit Trail
- **Enforcement**: Status modifications are strictly prohibited from occurring without explicit modal confirmation.
- **Modal Workflow**:
  1. Opens `#status-confirm-modal` with background blur and focus trap.
  2. Displays clear visual state transition banner (e.g. `ACTIVE` ➔ `SUSPENDED`).
  3. Displays detailed impact warning explaining the operational consequences:
     - Suspension halts public bookings, invalidates slot holds, and locks owner scheduling.
     - Activation publishes public booking pages and restores scheduling.
  4. Mandatory reason category selection from compliance categories:
     - Regulatory Compliance / Municipal Notice
     - Commercial Registration (CR) Verification Required
     - Payment Default / Subscription Overdue
     - Shop Owner Voluntary Deactivation
     - Customer Quality & Service Dispute
     - Scheduled Maintenance / Relocation
     - Administrative Review & Approval
     - Other / Custom Administrative Override
  5. Mandatory compliance rationale notes input textarea.
  6. Explicit confirmation checkbox required before submit button unlocks:
     *"I confirm that this status change is authorized and acknowledge that this action will be permanently recorded under admin@barberapp.sa in the immutable audit trail."*
  7. On confirmation, sends `PATCH /api/shops/{id}/status` to persist changes in MySQL, creates a permanent row in `audit_logs` under actor `admin@barberapp.sa`, updates local store for offline resilience, and alerts the administrator with a toast link to the User Audit view.

---

## 3. Feature Specification: System Configuration Screen (`/admin/settings`)

### 3.1 Overview & Architecture
The System Configuration Screen provides Super Administrators with a centralized, reactive control center to manage application runtime parameters, tax and payment configurations, telecommunications gateways, and real-time feature flags without requiring application redeployment.

- **Frontend Routes**:
  - `/admin/settings` (clean directory route via `/admin/settings/index.html`)
  - `/admin/settings.html` (direct page redirection)
  - `/dashboard/admin.html?view=settings#settings` (integrated workspace within Super Admin portal)
- **Data Persistence & Cache Layer**:
  - Primary Store: `Store.getSettings()`, `Store.saveSettings(newSettings)`, `Store.resetSettings()` in `frontend/src/js/store.js`.
  - Cache Key: `localStorage.getItem("barber_saas_system_settings")`.
  - Cross-Window Reactive Event Bus: Emits `SETTINGS_UPDATED` storage events to maintain multi-tab state parity.

### 3.2 Four Configuration Domains (Tabbed Layout)

#### 1. General App Config (`general`)
- **Platform Name**: Global branding text displayed across public booking and admin titles (`BarberApp KSA`).
- **Support Email**: RFC-compliant public contact email address.
- **Support Emergency Phone**: Validated Saudi telecommunication number (`+966 50 123 4567`).
- **Timezone**: Operational timezone selector (`Asia/Riyadh - UTC+03:00 (Makkah Standard Time)`).
- **Default Currency**: Fixed monetary unit (`SAR - Saudi Riyal`).
- **Slot Hold Lease Duration**: Numeric TTL in minutes controlling Redis distributed lock retention (1 to 60 minutes).
- **Platform Maintenance Mode**: Master toggle disabling public customer reservations while maintaining administrative access.
- **Maintenance Broadcast Notice**: Customizable banner message rendered when maintenance mode is active.

#### 2. Billing & Tax Settings (`billing`)
- **ZATCA VAT Rate**: Tax percentage configured to Kingdom standard (`15.0%`).
- **ZATCA Tax Identification Number (TIN)**: Official 15-digit tax identifier strictly verified to begin and end with digit `3` (e.g. `300123456700003`).
- **Sequential Invoice Prefix**: Alphanumeric prefix for ZATCA-compliant e-invoicing (`INV-KSA-`).
- **Monthly Subscription Price**: Tenant monthly subscription fee in SAR (e.g. `20.00`).
- **Yearly Subscription Price**: Discounted annual tenant fee in SAR (e.g. `200.00`).
- **Moyasar Gateway Mode**: Environment toggle between `Sandbox (Test)` and `Live (Production)`.
- **Moyasar Publishable & Secret Keys**: Key inputs with interactive eye toggle to reveal/mask sensitive credentials.
- **Auto-Approve Paid Salons**: Toggle allowing instant activation upon verified webhook receipt.
- **Test Gateway Ping**: On-demand simulated connection check confirming API credential integrity.

#### 3. Notification & SMS Gateway Settings (`notifications`)
- **Master SMS Notifications**: Toggle activating or suppressing outward SMS traffic.
- **SMS Gateway Provider**: CITC-compatible provider selection (`Taqnyat (Saudi Licensed)`, `Unifonic (Saudi Enterprise)`, `Twilio (International)`, `Mock Provider (Local Dev)`).
- **CITC Sender ID**: Approved 11-character alphanumeric sender mask (`BARBER-APP`).
- **SMS API Key**: Masked authentication token for telecom gateway.
- **Instant Booking SMS**: Toggle for real-time customer SMS confirmations.
- **Pre-Appointment Reminder Lead Time**: Configurable reminder window in minutes (15 to 1440 min).
- **Master Email Notifications**: Master toggle for outward email traffic.
- **SMTP Relay Configuration**: SMTP host, port (1-65535), and sender address.
- **Test SMS Dispatch Action**: On-demand modal test triggering a mock SMS to the configured emergency contact.

#### 4. Feature Flags (`features`)
Eight runtime switches enabling continuous deployment and zero-downtime feature experimentation:
- **Multi-Barber Selection**: Allows customers to select specific barbers during booking.
- **Slot Hold Countdown Timer**: Displays animated 5-minute countdown bar on checkout.
- **Walk-in Quick Booking Queue**: Enables rapid booking interface for shop front-desk tablets.
- **Public Salon Directory**: Allows visitors to discover and search all registered salons.
- **Mada & Apple Pay Fast Checkout**: Activates Saudi national payment rails for express checkout.
- **Force Luxury Dark Theme**: Enforces dark obsidian palette across all tenant dashboards.
- **Google Maps Geolocation Routing**: Enables interactive Plus Code mapping and route directions.
- **Automated Daily Audit Archiving**: Automatically batches and compresses audit trail records.

### 3.3 Client-Side Validation Per Field Type
- **Email Validation**: Strict regex enforcing standard RFC structure (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
- **Saudi Mobile Validation**: RegEx pattern enforcing Saudi numbering conventions (`+966 5XXXXXXXX` or `05XXXXXXXX`).
- **ZATCA TIN Validation**: Exactly 15 numeric digits starting with `3` and ending with `3` (`/^\d{15}$/`).
- **Numeric & Range Boundaries**: Port numbers validated within range `1 - 65535`; subscription fees and Redis TTL required to be strictly positive numbers.
- **Real-Time Visual Feedback**: Invalid inputs are outlined with red borders (`border-red-500`) and render clear inline warning messages beneath the respective fields.

### 3.4 Acceptance Criteria Validation

#### 1. Unsaved Changes Warning Interception
- **Dirty State Tracking**: Automatically sets `STATE.settingsDirty = true` upon any field modification or toggle switch, displaying an amber warning banner and navigation badge (`● Unsaved Edits`).
- **Tab Switching Guard**: Intercepts tab clicks when changes are pending and displays `#unsaved-changes-modal`.
- **Navigation Guard**: Intercepts sidebar links (`.nav-item`) and browser history events (`popstate`).
- **Browser Unload Guard**: Registers `window.addEventListener("beforeunload")` prompting browser native safety dialogs.
- **Three-Path Modal Resolution**:
  1. *Stay on Tab*: Dismisses modal and keeps user in current editing state.
  2. *Discard Changes*: Rolls back dirty modifications to the stored state and resumes navigation.
  3. *Save & Proceed*: Runs validation, writes updates safely to `Store`, displays success toast, and completes pending navigation.

#### 2. Safe Cache & Application State Updates
- **Local Cache Updating**: Updates `localStorage[barber_saas_system_settings]` atomically without page reload.
- **Status Toast Notification**: Emits affirmative floating toast notification (`"System configuration updated and cache synchronized successfully."`) upon commit.
- **Sync Badge**: Toggles header status indicator to `✓ Cache Synced`.
- **Factory Reset**: Dedicated reset flow to restore original factory defaults with explicit user confirmation.

---

## 4. Feature Specification: Internal Access Control & RBAC Console (`/admin/access-control`)

### 4.1 Overview & Architecture
The Access Control Management Console transforms internal platform administration from a static matrix into a high-security, dynamic Role-Based Access Control console.

- **Frontend Routes**:
  * `/admin/access-control` (clean URL routed via `/admin/access-control/index.html`)
  * `/admin/access-control.html` (direct page redirection)
  * `/dashboard/admin.html?view=access-control#access-control` (embedded console in Super Admin portal)
- **Backend Endpoints**:
  * `GET /api/admin/users`: Fetches list of all internal platform staff (`SUPER_ADMIN`, `SUPPORT_AGENT`, `AUDIT_INSPECTOR`)
  * `POST /api/admin/users`: Invites and provisions a new internal administrator with validation and audit logging
  * `PUT /api/admin/users/{id}/role`: Updates an existing staff member's platform role
  * `PATCH /api/admin/users/{id}/status` & `PUT /api/admin/users/{id}/status`: Activates or suspends internal staff account
  * `GET /api/admin/roles`: Returns platform roles and their granular capability permissions map
  * `PUT /api/admin/roles/{role}/permissions`: Updates and persists capability permissions for a platform role
- **Domain Cleanliness & Tenant Segregation**:
  * Strict segregation between internal platform roles (`PlatformRole`: `SUPER_ADMIN`, `SUPPORT_AGENT`, `AUDIT_INSPECTOR`) and tenant domain roles (`TenantRole`: `SALON_OWNER`, `SALON_STAFF`, `CUSTOMER`).
  * Tenant users and barbers never leak into or get manipulated from the internal platform staff console.

### 4.2 Implemented Capabilities

#### 1. Tab A: "Admin Users" (Platform Staff Management)
- **Staff Directory Table**:
  * User avatar with role-colored badge, Name, and unique Staff ID.
  * Contact credentials: RFC-compliant Email and Saudi Phone Number.
  * Assigned Platform Role badge (`Super Admin` [amber], `Support Agent` [blue], `Audit Inspector` [purple]).
  * Last Login timestamp formatted with relative or exact Riyadh timezone.
  * Operational Status badge (`Active` [emerald] / `Suspended` [red]).
  * Action controls: Edit Role button, Suspend/Activate toggle switch button.
- **Search & Filter Controls**:
  * Real-time live query input searching across Name, Email, and Phone number.
  * Role filter dropdown (`All Roles`, `SUPER_ADMIN`, `SUPPORT_AGENT`, `AUDIT_INSPECTOR`).
  * Status filter dropdown (`All Statuses`, `Active`, `Suspended`).
- **"Invite Internal Admin" Modal (`#invite-admin-modal`)**:
  * Modal input fields: Full Name, RFC Email, Saudi Mobile (`+966 5XXXXXXXX` or `05XXXXXXXX`), and Platform Role selection.
  * Form validation with real-time feedback.
  * Submits via `POST /api/admin/users`, generates a secure default password, auto-activates, and logs `USER_INVITED` audit event.
- **"Edit Platform Role" Modal (`#edit-role-modal`)**:
  * Displays current user identity and allows reassigning role between `SUPER_ADMIN`, `SUPPORT_AGENT`, and `AUDIT_INSPECTOR`.
  * Protects against self-demotion or demoting the last active Super Admin.

#### 2. Tab B: "System Roles & Permissions"
- **Interactive Capability Checklist Matrix**:
  * Columns represent internal platform roles (`SUPER_ADMIN`, `SUPPORT_AGENT`, `AUDIT_INSPECTOR`).
  * Rows represent granular platform capabilities mapped to Super Admin screens:
    - User Audit Module: View Audit Logs (`audit.view`), Export Audit Logs (`audit.export`)
    - Salon Directory Module: View Salon Directory (`salon.view`), Change Salon Status (`salon.status_change`), Impersonate Salon Dashboard (`salon.impersonate`)
    - System Configuration Module: View Configuration (`config.view`), Edit Configuration (`config.edit`)
    - Access Control Module: View Access Control (`rbac.view`), Manage Roles & Users (`rbac.manage`)
  * Interactive checkboxes allowing Super Admin to adjust permissions for non-Super Admin roles (`SUPPORT_AGENT`, `AUDIT_INSPECTOR`).
  * Super Admin role has immutable full administrative authorization across all screens.
  * "Save Permissions" action persists configuration via `PUT /api/admin/roles/{role}/permissions` with instant feedback toast.

### 4.3 Acceptance Criteria Validation: Safety Rules & Guards

#### 1. Self-Lockout Prevention
- **Active Session Identification**: The frontend identifies the logged-in user (`admin@barberapp.sa`).
- **Disabled Self-Deactivation**:
  * The Status toggle button is permanently disabled for the logged-in user's own row.
  * Tooltip warning: `"Cannot deactivate your own account"`.
  * Backend validation in `AdminUserService` throws `BAD_REQUEST` (`"Cannot modify active status of your own account"`) if attempted via direct API.
- **Disabled Self-Demotion**:
  * Backend prevents demoting one's own role to ensure administrative continuity.

#### 2. Last Active Super Admin Protection
- **Platform-Level Safeguard**:
  * System queries active Super Admins via `userRepository.countByRoleAndActiveTrue(UserRole.SUPER_ADMIN)`.
  * If count is 1 and the target user is that active `SUPER_ADMIN`, deactivation or demoting role is blocked.
  * UI displays disabled button with warning: `"Cannot deactivate the last active Super Admin"`.
  * Backend rejects requests with `BAD_REQUEST` (`"Cannot deactivate the last active Super Admin"` or `"Cannot demote the last active Super Admin"`).

#### 3. Audit Logging
- Every administrative invite, role change, and status change creates an immutable event in `audit_logs` capturing the actor email, action type (`ADMIN_USER_INVITED`, `ADMIN_USER_ROLE_UPDATED`, `ADMIN_USER_STATUS_UPDATED`), IP address, and details JSON.

---

## 5. Feature Specification: Salon Portal Architecture, Tenant Isolation & Shared Layout (`/portal`)

### 5.1 Overview & Architecture
The Salon Portal provides dedicated, multi-tenant workspace environments for salon owners and their staff barbers across Saudi Arabia.

- **Frontend Routes**:
  * `/portal` & `/portal/index.html` (primary portal layout shell)
  * `/salon-dashboard` & `/salon-dashboard/index.html` (clean redirect routes to `/portal`)
  * `/portal#bookings` (Calendar & Master Bookings - `SALON_OWNER`)
  * `/portal#staff` (Staff & Barber Management - `SALON_OWNER`)
  * `/portal#services` (Services & Pricing Catalogue - `SALON_OWNER`)
  * `/portal#settings` (Salon Profile & Branch Settings - `SALON_OWNER`)
  * `/portal#schedule` (Personal Schedule & Assigned Appointments - `SALON_STAFF`)
  * `/portal#profile` (Staff Barber Profile & Working Hours - `SALON_STAFF`)
- **Backend Endpoints**:
  * `GET /api/portal/context`: Returns authenticated tenant identity, shop details, user role, staff ID, shift status, and permitted module keys.
  * `GET /api/portal/bookings`: Tenant-isolated appointment schedule. Automatically enforces `salonId` and staff scoping rules.
  * `GET /api/portal/staff`: Restricted to `SALON_OWNER`. Returns barbers, chairs, and assigned staff for the tenant shop. Returns HTTP 403 for staff.
  * `GET /api/portal/services`: Returns services catalogue for the authenticated `salonId`.
  * `PATCH /api/portal/shift`: Updates current user's shift status (`ONLINE` / `OFFLINE`).

### 5.2 Multi-Tenant Isolation & Session Resolution Architecture
1. **Session Start Resolution**:
   - On authentication (`POST /api/v1/auth/login` or `GET /api/v1/auth/me`), the backend resolves the user's role:
     * For `SALON_OWNER`: Resolves `shop` via `shopRepository.findByOwnerId(user.getId())`. Sets `userDTO.salonId = shop.getId()`, `salonName = shop.getName()`, and `salonSlug = shop.getSlug()`.
     * For `SALON_STAFF`: Resolves `barber` via `barberRepository.findByUserId(user.getId())`. Resolves tenant `shop` via `barber.getShop()`. Sets `userDTO.salonId = shop.getId()`, `salonName = shop.getName()`, `salonSlug = shop.getSlug()`, and `userDTO.staffId = barber.getId()`.
2. **Context Provider (`tenant-context.js`)**:
   - Initializes on page load, synchronizing with `GET /api/portal/context` or falling back to authenticated session storage.
   - Provides immutable accessor methods: `getSalonId()`, `getStaffId()`, `isOwner()`, `isStaff()`, `canAccessModule(moduleId)`.
   - Wraps API communication via `tenantFetch(url, options)`:
     * Injects `Authorization: Bearer <token>`
     * Injects `X-Salon-Id: <salonId>` header
     * Automatically appends `staffId` scoping parameter if active user is `SALON_STAFF`.

### 5.3 RBAC Navigation & Staff Scope Restrictions
1. **Dynamic Navigation Shell**:
   - Common Header: Displays Salon Name, active branch badge (`📍 Olaya, Riyadh`), role indicator badge (`👑 SALON_OWNER` vs `✂️ SALON_STAFF`), live shift toggle (`Online` [emerald pulse] / `Offline` [slate]), user avatar, and Sign Out.
   - Owner Navigation: Calendar / Bookings, Staff Management, Services & Pricing, Salon Profile & Settings.
   - Staff Navigation: My Schedule / Bookings, Profile & Working Hours.
2. **Staff Scope Restriction**:
   - When `SALON_STAFF` accesses bookings, queries strictly filter by `salonId` AND `barberId = currentUser.staffId`.
   - Staff members are barred from viewing or editing appointments of peer barbers unless granted supervisor privileges.
   - Backend returns HTTP 403 Forbidden (`"Staff Scope Restriction: You are not authorized to view schedules of other staff members"`) if a staff member attempts to pass a different barber ID.
   - Frontend `AuthGuard` and `portal.js` intercept any URL hash navigation by staff to owner-only modules (`#staff`, `#services`, `#settings`) with a 403 Forbidden security toast and fallback to `#schedule`.

### 5.4 Booking & Slot Management Engine (`/portal/bookings` & `/portal/schedule`)
1. **Functional Calendar Views**:
   - **Day View (`DAY`)**: Hourly time slots (09:00 to 22:00). For Owner: multi-column side-by-side view across all staff barbers or filtered by single barber; each empty slot features a `+ Walk-In` quick reservation trigger. For Staff: strictly single column locked to the user's chair.
   - **Week View (`WEEK`)**: 7-day overview with active appointments grouped under each day with time, customer, service, and status pills.
   - **Gantt Timeline View (`TIMELINE`)**: Horizontal time track with staff chairs on the Y-axis and hourly time slots on the X-axis for rapid scheduling inspection.
2. **Slot Status State-Machine**:
   - Supported statuses: `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `WALK_IN_RESERVED`, `BLOCKED`.
   - Dedicated visual themes: Confirmed [emerald], Arrived [blue], In-Service [amber pulse], Completed [slate], Cancelled [red line-through], No-Show [orange], Walk-in [purple], Blocked [rose dashed].
3. **Role-Based Permissions & Filtering**:
   - **Salon Owner Mode (`/portal/bookings`)**:
     * Full multi-barber schedule filter (`All Barbers` or specific staff member).
     * Reassign booking modal: moves appointment between barbers with target availability validation.
     * Cancel booking modal: selects cancellation reason from predefined options (`Customer Requested`, `Staff Unavailable`, `Salon Maintenance`, `Duplicate`, `Other`).
     * Mark completed: sets status to `COMPLETED`.
     * Block slot modal: reserves chair for maintenance, breaks, or sanitization (`status: BLOCKED`).
     * Walk-in reservation modal: creates immediate `WALK_IN_RESERVED` booking.
   - **Salon Staff Mode (`/portal/schedule`)**:
     * Locked chair filter: staff can only view and interact with their own chair.
     * Quick Walk-In: pre-locks chair to staff ID and records walk-in guest.
     * Operational status updates: buttons to transition appointment to `Arrived`, `In-Service`, `Completed`, or `No-Show`.
     * Safety rules: staff cannot cancel or delete historical bookings or override business hours without owner permission.
4. **Backend Concurrency Conflict Check & Optimistic UI**:
   - `findConflictingBookings`: checks interval overlap `[slotStart, slotEnd)` against active conflicting statuses (`HOLD`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `WALK_IN_RESERVED`, `BLOCKED`). Rejects conflicts with **HTTP 409 Conflict**.
   - Optimistic UI updates: client state mutates instantly for snappy UX; if the API call encounters a conflict or error, client automatically rolls back to previous state and displays a warning toast.

### 5.5 Staff & Roster Management Engine (`/portal/staff`)
1. **Decoupled Architecture & Dedicated Routes**:
   - Route: `/portal/staff` (clean routing via `/portal/staff/index.html` and fallback `/portal/staff.html`).
   - Script: Dedicated `/src/js/portal-staff.js` modular engine ensuring zero bloat in `/portal/index.html`.
2. **Staff Directory & Dual View Presentation**:
   - **Dual Views**: Seamless toggle between Dense Table View and Luxury Cards Grid View.
   - **Card & Table Fields**: Barber avatar with dynamic initials fallback, full name, specialty / professional title (`Master Barber`, `Senior Stylist`, `Colorist`), skills & specialties badges (`#Haircut`, `#BeardTrim`, `#HotTowel`), contact phone and email, upcoming bookings count indicator, and current shift status pill (`Active`, `Break`, `Offline`).
   - **Real-Time KPI Summary**: Total Staff count, Currently Active count, On-Break count, and Inactive/Offline count.
3. **Staff Actions & Modals**:
   - **"Add New Barber / Staff" Modal**: Full Name, Professional Title, Skills tags input (comma-separated with live tag pill preview), Email, Contact Phone, Password, Initial Active Status toggle, and Integrated Profile Avatar Uploader (strictly validated <= 2MB, stored as public URL reference `/uploads/salons/{salonId}/avatars/...`, zero Base64 in DB).
   - **Weekly Working Schedule & Availability Modal**: 7-day schedule grid (Sunday to Saturday) with shift start/end times and mid-shift break intervals (`breakStart`, `breakEnd`). Includes day-off toggles and "Apply to All Weekdays" bulk shortcut. Persisted via `PUT /api/portal/staff/{id}/schedule`.
   - **Availability Engine Boundary Validations**: Strictly enforces `endTime > startTime` and verifies break interval falls within shift boundaries (`breakStart >= startTime && breakEnd <= endTime`).
   - **Data Integrity Guard & Soft-Deletion (HTTP 409 Conflict)**:
     * Deactivating (`PATCH /status`) or deleting (`DELETE /{id}`) a barber with upcoming active appointments (`CONFIRMED`, `HOLD`, `WALK_IN_RESERVED`, `IN_SERVICE` where `slot_end >= NOW()`) is rejected with **HTTP 409 Conflict**.
     * Triggers the `#conflict-modal` displaying the total conflicting appointments count, appointment list, and direct redirect link to the booking calendar to reassign or cancel appointments.
     * Safe soft-deletion sets `deleted_at = NOW()`, `is_active = false`, and `status = 'OFFLINE'`, deactivating the linked user login while preserving historical booking and financial reporting integrity.

### 5.6 Services & Catalog Management Engine (`/portal/services`)
1. **Decoupled Architecture & Dedicated Routes**:
   - Route: `/portal/services` (clean routing via `/portal/services/index.html` and fallback `/portal/services.html`).
   - Script: Dedicated `/src/js/portal-services.js` modular engine.
2. **Category & Service Catalog**:
   - Categories: Haircut, Beard & Shave, Facial & Spa, Hair Treatments, Grooming Packages.
   - Quick Filter Pills: `All`, `Haircuts`, `Beard & Shave`, `Facial & Spa`, `Packages` with item count indicators.
   - Per-Service Attributes: Name, Category badge, Duration (minutes), Price (SAR), Cleanup Buffer Time (minutes cleanup interval between appointments), Qualified Assigned Staff badges.
3. **Service Management Actions**:
   - **Add / Edit Service Modal**: Name, category selection, price (SAR), duration (15 to 180 min), buffer cleanup interval (0 to 60 min), and multi-select staff checkboxes of barbers qualified to perform the service.
   - **Public Visibility Toggle**: Direct switch toggling `isVisible`. Hidden services are immediately excluded from the customer booking flow while preserved in the owner catalog.
   - **Delete Service**: Action with confirmation guard to prune discontinued offerings.

### 5.7 Salon Profile & Operations Settings (`/portal/settings`)
1. **Decoupled Architecture & Dedicated Routes**:
   - Route: `/portal/settings` (clean routing via `/portal/settings/index.html` and fallback `/portal/settings.html`).
   - Script: Dedicated `/src/js/portal-settings.js` modular engine.
2. **Settings Domains**:
   - **Commercial Identity**: Legal salon name, contact phone, logo URL (1:1 square preview), and hero cover image URL (16:9 banner preview).
   - **Address & Geocoding**: Region, City, District, Full Street Address, Landmark description, and GPS Coordinates (Latitude, Longitude) with one-click presets for Riyadh, Jeddah, and Dammam.
   - **Global Operating Schedule**: 7-day salon open/close hours (Sunday to Saturday) with day-off toggles, serialized to `operating_hours_json`.
   - **Booking Rules & Policies**:
     * Minimum cancellation notice (hours before appointment start, e.g. 2 hours).
     * Maximum advance booking window (days into the future, e.g. 14 days).
     * Auto-confirm staff walk-ins policy toggle.
   - **Public Storefront & QR Access**: Displays public booking address (`http://localhost:3000/booking.html?slug=...`) with one-click copy and live navigation anchor.

### 5.8 Walk-In Concurrency & Distributed Lock Architecture
1. **Double-Booking Race Condition Prevention**:
   - When salon staff or owner registers a walk-in via `POST /api/portal/bookings/walkin`, the API acquires a distributed Redis lock via `slotLockService.acquireSlotHold(barberId, slotStart)`.
   - If an online customer attempts to checkout the exact same slot concurrently, the Redis lock serializes the operation.
2. **Transactional Database Conflict Verification**:
   - Within `@Transactional`, executes `bookingRepository.findConflictingBookings(shopId, barberId, slotStart, slotEnd, activeStatuses, excludeId)`.
   - Rejects the request with **HTTP 409 Conflict** if any active booking (`HOLD`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `WALK_IN_RESERVED`, `BLOCKED`) exists for the barber in that interval.
   - Verifies barber is active (`barber.getIsActive() == true`).
3. **Guaranteed Lock Release**:
   - Distributed lock release is executed in a `finally` block to ensure zero dangling locks on either success or rollback.

### 5.9 Feature Specification: Owner Revenue & Financial Analytics (`/portal#dashboard`)
1. **Strict Accounting Filter**:
   - Calculated strictly from `COMPLETED` appointments (`BookingStatus.COMPLETED`).
   - Excludes all other statuses (`PENDING`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `CANCELLED`, `NO_SHOW`, `BLOCKED`).
2. **KPI Analytics Cards**:
   - **Today's Earnings**: Today vs. Yesterday revenue with delta percentage pill (`+X%` or `-X%`) and completed visit count.
   - **Current Week Velocity**: Current week total vs. Previous week total with percentage delta.
   - **Monthly Trend**: Current month total vs. Previous month total with percentage delta and monthly completed count.
   - **Average Ticket Size**: Gross completed revenue divided by total completed appointments.
   - **Top Performer**: #1 gross revenue generating barber with photo, specialty, revenue, and visits.
3. **7-Day Velocity Bar Chart**:
   - Sunday through Saturday revenue visual bars with interactive tooltips showing date, revenue, and visits.
   - Daily breakdown audit table displaying date, appointments, gross revenue, and average ticket size.
4. **Currency & Localization**:
   - Denominated in Saudi Riyal (`SAR` / `ر.س`).
   - Localized to `Asia/Riyadh` (`AST UTC+3`).

### 5.10 Feature Specification: Salon Media Management & Static Storage
1. **Salon Photo Gallery (`/portal/settings`)**:
   - Multi-image uploader capped at strict maximum of 5 photos per salon (`salon_images` table).
   - Real-time slot count badge (e.g. `1/5 Photos`) and cap reach warning alert.
   - Reordering controls (`display_order` index) and single cover photo toggle (`is_cover`).
   - Delete action with entity cleanup and disk file removal.
2. **Staff Profile Avatars (`/portal/staff`)**:
   - Portrait avatar upload per barber chair (`/api/portal/staff/{id}/avatar`).
   - Displays avatar image in staff directory table with fallback initials badge.
3. **Storage & Security**:
   - Strict prohibition of raw Base64 data strings in relational database columns.
   - Local disk storage hierarchy under `/uploads/salons/{salonId}/...`.
   - MIME validation (`image/jpeg`, `image/png`, `image/webp`) + binary magic bytes verification + max 5MB size limit.

### 5.11 Feature Specification: Customer Booking Funnel (`/book/:salonSlug`)
1. **Mobile-First UX & Core Web Vitals**:
   - FCP < 1.0s, LCP < 1.5s, CLS < 0.1 with zero render-blocking heavy UI icon libraries.
   - Strict minimum 48x48px hit target bounds on all interactive slot chips and navigation buttons.
   - Sticky mobile bottom CTA bar with real-time price/duration tally and thumb-reachable action.
2. **Contextual Zero-Broken-Image Fallbacks (`FallbackAssets`)**:
   - Dynamic luxury monogram SVG brand logos with `#F59E0B` gold accents.
   - 16:9 responsive dark luxury vector hero banners with barbershop shears watermark and salon title.
   - Pre-curated 3-photo aesthetic studio cards with horizontal scroll snap (`scroll-snap-type: x mandatory`).
   - Circular dual-tone gradient staff avatar badges with initials.
3. **Step-by-Step State Machine Journey**:
   - Step 0: Salon Landing / Hero View with verified badges and ambient studio gallery.
   - Step 1: Multi-service selection with categories, duration, buffer times, and live price calculator.
   - Step 2: Barber selection with "Any Available Barber" fast track and staff phone privacy guard.
   - Step 3: 14-day horizontal date strip with dynamic slot generation from salon store operating hours (`shop.operatingHours`), Morning/Afternoon/Evening buckets, past slot detection, and 5-minute concurrency hold.
   - Step 4: Fast mobile customer form with Saudi mobile format verification (`05XXXXXXXX`), optional customer notes, and prominent cancellation advisory.
   - Step 5: Order receipt with unique `BBR-XXXXX` reference code, Apple/iPhone Calendar export (.ics with -PT1H alarm), Google/Android Calendar web intent, and free zero-cost map routing.
4. **Audit Logging & Concurrency Sweeper**:
   - Emits `CUSTOMER_SLOT_HOLD` and `CUSTOMER_BOOKING_CONFIRMED` audit records.
   - Background `@Scheduled` worker (`SlotHoldCleanupTask`) automatically sweeps expired holds and releases Redisson locks.

---

## 6. Product Backlog - Future Sprints

### 6.1 Sprint 6 (Upcoming): Hardening & Expansion
- **US-6.1**: Multi-Barber & Service Customization during Registration (Persist custom barbers and services to MySQL).
- **US-6.2**: Automatic Stale Hold Sweeper Worker (`@Scheduled` cron task in Spring Boot to release expired Redis holds).
- **US-6.3**: Real-Time STOMP Event Emitters in `SlotEventPublisher` to push slot changes to shop owner dashboards.
- **US-6.4**: Multi-Language Support (Arabic RTL toggle for customer booking and shop owner dashboards).
- **US-6.5**: Export Salon Directory Data to CSV/Excel format.


