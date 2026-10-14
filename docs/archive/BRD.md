BUSINESS REQUIREMENTS DOCUMENT (BRD)
Salon & Barber Booking & Appointment Management System
Document Version: 1.0
Date: 2026
Prepared For: Development Team / Google Antigravity AI Build Tool
Prepared By: Product Owner
Status: Approved for Build
Classification: Internal
Table of Contents
1. Document Control
Document Title: Salon & Barber Booking & Appointment Management System – BRD
Version: 1.0
Date: 2026
Prepared For: Development Team / Google Antigravity AI Build Tool
Prepared By: Product Owner
Status: Draft – Ready for Build
Related Documents: Technical Design Doc (TDD), Test Plan, Deployment Runbook
2. Executive Summary
The Salon & Barber Booking System is a multi-tenant SaaS web platform that allows barber shops and salons to register, manage their barbers, publish available time slots, and accept customer bookings online. The core problem being solved is that walk-in customers face long wait times because all barbers are busy with no visibility into availability.
This system enables:
Shop owners to self-register and get auto-approved upon successful payment.
Customers to book appointments by time slot for a specific barber.
Real-time slot updates, calendar sync, QR code store entry, and Google Maps integration.
A subscription-based revenue model (20 SAR/month or 200 SAR/year).
Target Market: Saudi Arabia (initial), GCC region (expansion).
3. Business Objectives
Eliminate walk-in waiting time by enabling advance slot booking.
Give salon owners a real-time dashboard of barber availability.
Create a recurring revenue stream through monthly/yearly subscriptions.
Provide auto-approval on successful payment with admin override capability.
Ensure zero double-booking under concurrent traffic.
Deliver a mobile-first, fast-loading, responsive experience.
4. Scope
4.1 In-Scope
Shop self-registration portal
Auto-approval upon successful payment
Admin override + full user activity audit
Barber dashboard with time-slot management
Public customer booking page (per shop) + QR code
Payment integration (Mada, Card, STC Pay)
Live slot sync + customer calendar (.ics) export
Responsive, modern UI
Automated test coverage
4.2 Out-of-Scope (Phase 2)
Native mobile apps (iOS/Android)
Loyalty programs / coupons
Multi-language RTL toggle (Phase 2 – Arabic UI)
SMS gateway (only calendar + email in Phase 1)
5. Stakeholders
Super Admin: Override approvals, monitor audit logs, manage subscriptions
Shop Owner: Register, manage barbers, view bookings, override slots
Barber: View own schedule, mark availability
Customer: Browse shop, book slot, receive calendar invite
Payment Gateway: Process subscriptions
System: Enforce slot locking, send notifications
6. Functional Requirements
FR-1: Shop Registration Webpage
FR-1.1: Public registration page accessible without login.
FR-1.2 Mandatory fields: Shop Name, Phone Number (unique, validated SA format), Region, District, City, Full Address, Google Map short address / Plus Code, Subscription Plan (Monthly / Yearly).
FR-1.3 Optional but recommended fields: Shop photos (up to 10, max 5MB each), Multiple barbers: each with Name + Photo or Avatar.
FR-1.4 Subscription selection: Monthly (20 SAR / month), Yearly (200 SAR / year – save 40 SAR).
FR-1.5 Payment Integration: Accept Mada, Visa/Mastercard, STC Pay; on success -> auto-approve shop; on failure -> retain form data, show retry.
FR-1.6 Validation: Phone (Saudi format +966 5XXXXXXXX), Email (RFC-compliant), Duplicate phone -> block registration.
FR-2: Admin Panel
FR-2.1 Dashboard: Total shops, active subscriptions, revenue chart, auto-approval log.
FR-2.2 Shop Override: List of active/pending/suspended shops, actions (Suspend / Reactivate / Manually Approve), auto-generate public booking URL + QR on approve.
FR-2.3 User Audit Page: Full activity log, filters (user, action type, date range, IP), export CSV.
FR-2.4 Subscription Management: View status, renewal date, history, manual override.
FR-2.5 Salon Directory Screen (`/admin/salons`):
- Paginated listing of all registered salons across KSA with customizable page size (5, 10, 20, 50) and boundary navigation.
- Comprehensive multi-attribute search matching salon name, city, district, region, commercial registration number (`CR-1010XXXX` / ID), phone, or status (Active, Pending, Suspended).
- Dynamic filtering by Region and Operational Status, with active filter counter badges and one-click filter resets.
- Quick-action group on each salon row:
  * View Profile: Slide-over drawer with owner contact, national address, Google Maps link, and dual QR code preview & download (PNG, SVG, ZIP).
  * Change Status (Suspend / Activate / Approve): Triggers explicit confirmation modal.
  * Impersonate / Inspect Salon Dashboard: Launches owner live schedule in Super Admin inspection mode (`/dashboard/index.html?slug={slug}&impersonate=true`).
  * Public Booking flow direct link (`/book.html?slug={slug}`).
- Explicit Confirmation Modal & Audit Trail Enforcement:
  * Status modifications require explicit modal confirmation detailing operational consequences.
  * Mandatory audit reason category selection and detailed compliance rationale notes.
  * Explicit authorization confirmation checkbox required before submit button unlocks.
  * Generates permanent, immutable audit log record in `audit_logs` under actor `admin@barberapp.sa` via `PATCH /api/shops/{id}/status`.
FR-2.6: System Configuration Screen (`/admin/settings`):
- Accessible via `/admin/settings`, `/admin/settings.html`, or embedded `/dashboard/admin.html?view=settings#settings`.
- Tabbed configuration interface organizing platform runtime parameters into 4 functional domains:
  * General App Config: Platform name, contact email, Saudi emergency support phone (+966), default timezone (Asia/Riyadh), currency (SAR), Redis booking hold lease TTL (minutes), and platform-wide maintenance mode with customizable broadcast banner.
  * Billing & Tax Settings: ZATCA VAT rate percentage (15%), 15-digit ZATCA Tax Identification Number (TIN starting and ending with 3), sequential invoice prefix, default monthly and annual subscription fees, Moyasar payment gateway mode (Sandbox/Live), API keys with toggleable visibility, and auto-approval switch for paid subscriptions.
  * Notification & SMS Gateway Settings: Master SMS toggle, Saudi CITC-licensed SMS gateway provider (Taqnyat, Unifonic, Twilio, Mock), CITC Sender ID, API credentials, instant booking confirmation SMS, appointment reminder lead time, and master email SMTP configuration.
  * Feature Flags: Global toggle switches controlling runtime capabilities (Multi-Barber selection, slot hold countdown timer, walk-in quick booking queue, public salon directory browsing, Saudi Mada & Apple Pay fast checkout, luxury dark theme enforcement, Google Maps routing, and automated daily audit archiving).
- Strict Client-Side Validation Per Field Type:
  * Validates RFC-compliant email formats, Saudi mobile numbers (`+966 5XXXXXXXX` or `05XXXXXXXX`), 15-digit ZATCA TIN compliance (`300123456700003`), port bounds (1-65535), and positive monetary amounts with real-time inline alerts.
- Unsaved Changes Warning & Interception:
  * Tracks dirty state (`STATE.settingsDirty`) against stored configuration.
  * Prompts an explicit unsaved changes warning modal (`#unsaved-changes-modal`) on tab switching, sidebar navigation, browser history changes (`popstate`), and window unload (`beforeunload`).
  * Modal provides 3 distinct paths: "Stay on Tab", "Discard Changes", or "Save & Proceed".
- Safe Cache & Application State Synchronization:
  * Persists validated configuration directly into `Store` and `localStorage` (`barber_saas_system_settings`).
  * Dispatches `SETTINGS_UPDATED` storage events across open tabs without requiring full page reloads.
  * Displays affirmative luxury toast notification with timestamp upon successful save.
FR-2.7: Internal Access Control & RBAC Management Screen (`/admin/access-control`):
- Accessible via `/admin/access-control`, `/admin/access-control.html`, or embedded `/dashboard/admin.html?view=access-control#access-control`.
- Functional Two-Tab Administration Console:
  * Tab A: "Admin Users" (Internal Platform Staff):
    - Dedicated management data table displaying Name, Email, Phone, Assigned Platform Role, Last Login timestamp, Status (Active/Suspended), and Contextual Actions.
    - Real-time search across staff names, emails, and phone numbers with dynamic role and status filters.
    - Action: "Invite Internal Admin" modal capturing Full Name, RFC-compliant Email, Saudi Phone, and Platform Role. Auto-provisions credential and triggers immutable audit logging.
    - Action: "Edit Role" modal to adjust platform privileges.
    - Action: "Toggle Active/Suspended" to activate or suspend internal staff.
  * Tab B: "System Roles & Permissions":
    - Interactive capability checklist matrix displaying internal platform roles (`SUPER_ADMIN`, `SUPPORT_AGENT`, `AUDIT_INSPECTOR`).
    - Granular permissions mapped to Super Admin console screens:
      * User Audit (`audit.view`, `audit.export`)
      * Salon Directory (`salon.view`, `salon.status_change`, `salon.impersonate`)
      * System Configuration (`config.view`, `config.edit`)
      * Access Control (`rbac.view`, `rbac.manage`)
    - Capability to toggle permissions per role and persist dynamically via `PUT /api/admin/roles/{role}/permissions`.
- Safety & Security Guard Rules:
  * Self-Lockout Prevention: A logged-in Super Admin cannot deactivate (`active=false`) or demote their own active session account.
  * Last Super Admin Protection: The system blocks deactivating or revoking `SUPER_ADMIN` privileges from the sole remaining active Super Administrator on the platform.
  * Clear UI feedback with disabled controls and informative tooltip warnings (`Cannot deactivate your own account`, `Last active Super Admin protected`).
- Domain Cleanliness & Strict Tenant Segregation:
  * Internal platform roles (`SUPER_ADMIN`, `SUPPORT_AGENT`, `AUDIT_INSPECTOR`) are strictly segregated from tenant/customer domain roles (`SALON_OWNER`, `SALON_STAFF`, `CUSTOMER`).
  * Tenant users and barbers cannot appear in or be managed from the internal platform access control console.
- Backend API Specifications & Audit Trail:
  * `GET /api/admin/users`: Lists all internal platform staff.
  * `POST /api/admin/users`: Provisions/invites a new internal platform staff member.
  * `PUT /api/admin/users/{id}/role`: Updates a staff member's platform role.
  * `PATCH /api/admin/users/{id}/status` & `PUT /api/admin/users/{id}/status`: Suspends or reactivates staff account.
  * `GET /api/admin/roles`: Returns platform roles and their associated permissions map.
  * `PUT /api/admin/roles/{role}/permissions`: Updates role permission mappings.
  * All administrative mutations generate permanent entries in `audit_logs` table.
FR-3: Salon Portal & Multi-Tenant Dashboard (`/portal`, `/salon-dashboard`)
FR-3.1 Architecture & Tenant Isolation Provider:
- Accessible via `/portal`, `/portal/index.html`, and backwards-compatible `/salon-dashboard`.
- Strict Tenant Isolation: Every query, request, and storage lookup executed in the portal automatically injects and verifies the authenticated user's `salonId`.
- Cross-Tenant Boundary Guard: Users attempting to access other tenant shops via URL parameters (`?salonId=...`, `?slug=...`) are blocked with HTTP 403 Forbidden and redirected to their assigned salon.
- Session Resolution: On session initialization, `TenantContext` resolves `salonId`, tenant business profile, user role (`SALON_OWNER` vs `SALON_STAFF`), and linked `staffId`.

FR-3.2 Role-Based Access Control (RBAC) & Navigation Shell:
- Common Shell Header:
  * Salon Name (e.g., "Golden Scissors Salon") + verified Saudi business badge.
  * Active Branch Badge (e.g., "📍 Olaya, Riyadh").
  * Role Indicator Badge (👑 `SALON_OWNER` in gold vs ✂️ `SALON_STAFF` in cyan).
  * Staff Shift Status Toggle: Interactive Online (emerald pulse) / Offline (slate) toggle persisted via `PATCH /api/portal/shift`.
  * User profile credentials and one-click Sign Out action.
- Dynamic Role-Based Sidebar Navigation:
  * Salon Owner Navigation Modules:
    - Calendar / Bookings (`/portal#bookings`): View and manage all appointments across all salon barbers.
    - Staff Management (`/portal#staff`): Manage team members, chair assignments, and working hours.
    - Services & Pricing (`/portal#services`): Configure service catalogue, pricing (SAR), and durations.
    - Salon Profile & Settings (`/portal#settings`): National address, Plus Code, and QR code downloads.
  * Salon Staff Navigation Modules:
    - My Schedule / Bookings (`/portal#schedule`): Strictly scoped personal appointment calendar.
    - Profile & Working Hours (`/portal#profile`): Personal shift schedule and credentials.

FR-3.3 Staff Scope Restriction & Route Authorization Policies:
- Staff Scope Restriction: When `SALON_STAFF` views bookings, queries are strictly scoped by `salonId` AND `staffId = currentUser.id`. Staff cannot view, edit, or cancel appointments assigned to other barbers.
- Route Authorization Interception: If a staff user attempts to access owner-only modules (`#staff`, `#services`, `#settings`), the router intercepts the navigation, issues an HTTP 403 Forbidden alert, and confines them to `#schedule`.
- Backend Enforcement: `SalonPortalController` enforces tenant and staff scopes server-side, returning 403 Forbidden if a staff member requests other barbers' appointments or accesses staff management endpoints.

FR-3.4 Time-slot View & Multi-Format Calendar Engine:
- Multi-format functional views: Day View (hourly slot columns per barber), Week View (7-day timeline overview), and Gantt Timeline View (horizontal time track across staff chairs).
- Navigation & Date Picker: Previous/Next date controls, Today shortcut, and arbitrary date selector with Riyadh timezone alignment.
- Multi-barber column filtering for Salon Owner; strictly locked single chair view for Salon Staff.

FR-3.5 Slot Status State-Machine Transitions & Concurrency Rules:
- Slot Status Types:
  * `HOLD`: Temporary customer checkout lease backed by Redis distributed lock (TTL 5 mins).
  * `CONFIRMED`: Verified customer booking.
  * `ARRIVED`: Customer physically checked in at the salon reception.
  * `IN_SERVICE`: Customer seated in barber chair; haircut/service in progress.
  * `COMPLETED`: Service finished; terminal billing state.
  * `CANCELLED`: Appointment revoked with mandatory reason; terminal state.
  * `NO_SHOW`: Customer did not show up within grace period; terminal state.
  * `WALK_IN_RESERVED`: Direct on-site walk-in reservation booked by staff or owner.
  * `BLOCKED`: Chair reserved for staff break, deep sanitization, or facility maintenance.
- Allowed State Machine Transitions:
  * `HOLD` → `CONFIRMED`, `CANCELLED`
  * `CONFIRMED` → `ARRIVED`, `IN_SERVICE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
  * `WALK_IN_RESERVED` → `ARRIVED`, `IN_SERVICE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
  * `ARRIVED` → `IN_SERVICE`, `CANCELLED`, `NO_SHOW`
  * `IN_SERVICE` → `COMPLETED`, `CANCELLED`
  * `BLOCKED` → `CANCELLED` (unblocked by owner)
- Role-Based Operational Guards:
  * `SALON_OWNER`: Permitted all transitions, booking reassignment between barbers, cancellation with default reason options, slot blocking, and walk-in creation.
  * `SALON_STAFF`: Strictly confined to own chair. Permitted operational transitions: `ARRIVED`, `IN_SERVICE`, `COMPLETED`, `NO_SHOW`. Forbidden from cancelling bookings or blocking slots.
- Concurrency Conflict Engine & Optimistic UI:
  * Evaluates interval overlap `[slotStart, slotEnd)` against active conflicting statuses (`HOLD`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `WALK_IN_RESERVED`, `BLOCKED`).
  * Rejects conflicting reservations with HTTP 409 Conflict.
  * Frontend employs optimistic UI mutation with automatic rollback and error alerts upon server rejection.

FR-3.6 Staff & Roster Management (`/portal/staff`):
- Dedicated, decoupled route `/portal/staff` (and `/portal/staff/index.html`) ensuring modular rendering separate from services.
- Staff Directory Presentation:
  * Dual View Modes: Responsive toggle between Dense Table view and Luxury Cards Grid view with real-time KPI metrics (Total Staff, Active, On Break, Offline).
  * Fields: Name, Avatar with dynamic initials fallback, Role / Specialty (e.g. Master Barber, Senior Stylist), Skills & Specialties tags (`#Haircut`, `#BeardTrim`, `#HotTowel`), Contact phone and email, Active Weekly Schedule summary, Current Shift Status badge (`Active`, `Break`, `Offline`), and Active Toggle switch.
- Administrative Roster & Lifecycle Actions:
  * Invite / Provision new staff member: Name, Role/Specialty, Skills tag inputs (comma-separated), Phone, Email, Temporary Password, Integrated Profile Avatar Uploader (strictly validated <= 2MB, stored as public URL reference `/uploads/salons/{salonId}/avatars/...`, zero Base64 in DB), and initial active toggle.
  * Weekly Working Hours & Break Shift Modal: Configure Day of Week (Sunday–Saturday), Start Time, End Time, Break Start, Break End, and Day-Off toggle. Persisted to `working_hours` table.
  * Availability Boundary Validations: Shift end time must be strictly after shift start time (`endTime > startTime`), and break intervals must fall completely within the working shift (`breakStart >= startTime && breakEnd <= endTime`).
  * Active / Deactivated Status Toggle & Safe Soft-Deletion:
    - Active Toggle: Deactivating a staff member sets `is_active = false`. The booking engine (`SlotBookingService`) immediately prohibits public customer slots and online bookings from being assigned to deactivated barbers.
    - Safety & Conflict Guard (HTTP 409 Conflict): If a staff member has future active appointments (`CONFIRMED`, `HOLD`, `WALK_IN_RESERVED`, `IN_SERVICE` where `slot_end >= NOW()`), both deactivation and deletion attempts are blocked with HTTP 409 Conflict.
    - Conflict Modal: The owner is prompted via a dedicated warning modal (`#conflict-modal`) displaying the conflicting appointments count, appointment details, and a direct link to reassign or cancel those bookings in the booking calendar.
    - Soft-Deletion Architecture: When deletion is executed without conflicting appointments, the system records `deleted_at = NOW()`, deactivates the barber (`is_active = false`, `status = OFFLINE`), and deactivates the linked login account to preserve historical booking auditability and financial reporting integrity.

FR-3.7 Services & Catalog Management (`/portal/services`):
- Dedicated, decoupled route `/portal/services` (and `/portal/services/index.html`).
- Category & Service Management:
  * Categorization: Haircut, Beard & Shave, Facial & Spa, Hair Treatments, Grooming Packages.
  * Detailed Service Attributes: Service Name, Category, Duration (minutes: 15–180), Price (SAR), Cleanup Buffer Time (0–60 minutes cleanup interval between bookings), Assigned Staff qualified to execute this service.
- Public Visibility Toggle:
  * Instant switch toggling `is_visible` flag.
  * Hidden services (`is_visible = false`) are immediately excluded from the customer-facing booking engine and public storefront while remaining visible in owner reports.

FR-3.8 Salon Profile & Operations Settings (`/portal/settings`):
- Dedicated, decoupled route `/portal/settings` (and `/portal/settings/index.html`).
- Commercial Salon Identity:
  * Salon Legal / Trading Name, Commercial Phone number.
  * Logo URL (1:1 square brand icon) and Cover Banner Image URL (16:9 hero background) with live UI previews.
- National Address & Geolocation:
  * Region, City, District, Full Street Address, Map / Landmark description.
  * High-precision GPS Coordinates (Latitude, Longitude) with quick-fill presets for Riyadh, Jeddah, and Dammam. Powers radius/distance calculations for customer discovery.
- Global Salon Operating Schedule:
  * 7-day weekly schedule (Sunday through Saturday).
  * Per-day Open Time, Close Time, and Closed-all-day toggle. Serialized into `operating_hours_json`.
- Booking Rules & Policy Engine:
  * Minimum Cancellation Notice (Hours): e.g. 2 hours. Cancellations within this threshold are penalized or locked.
  * Maximum Advance Booking Window (Days): e.g. 14 days ahead. Prevents customers from reserving slots indefinitely in advance.
  * Auto-Confirm Walk-In Policy: Automatically confirms and locks chair appointments created on-site by staff without requiring customer SMS OTP verification.
- Direct Public Booking URL & QR Code:
  * Direct URL preview (`/booking.html?slug=...`) with one-click clipboard copy.

FR-4: Customer Booking Funnel (Mobile-Optimized & Calendar Integration)
FR-4.1 Architecture & Routes:
- Public endpoints: `/book/:salonSlug`, `/book/:salonId`, `/book.html?slug={slug}`, and `/book/?slug={slug}`.
- Payload budget: Ultra-slim bundle without heavy admin/portal runtime dependencies.
- Zero render-blocking heavy icon/UI libraries; responsive vanilla JavaScript with Tailwind CSS utilities.

FR-4.2 Mobile Performance & Core Web Vitals Constraints:
- Speed & CWV: First Contentful Paint (FCP) < 1.0s, Largest Contentful Paint (LCP) < 1.5s on cellular 4G/5G connections.
- Cumulative Layout Shift (CLS) < 0.1: All hero and gallery images specify explicit `width` and `height`, with `loading="lazy"` below the fold.
- Touch Targets: Strict minimum 48x48px hit target bounds on all slot chips, date strip buttons, and navigation CTAs.
- Sticky Mobile CTA Bar: Fixed bottom navigation bar (`min-h-[48px]`) showing dynamic service count, SAR total price, and one-thumb "Continue" action.

FR-4.3 Contextual Default Placeholders (Zero Broken Images):
- Brand Logo Fallback: Dynamic luxury monogram SVG badge (`#0F172A` radial background with `#F59E0B` 24K gold border) featuring salon initials.
- Hero Cover Banner Fallback: 16:9 ultra-wide dark luxury SVG vector (`#0B0F17` gradient, barbershop shears/pinstripe watermark, dynamic salon name overlay).
- Pre-Curated 3-Photo Aesthetic Gallery: Clean barbershop studio set (Leather Chairs, Hot Towel & Steam, Precision Grooming) with horizontal touch scroll snap (`scroll-snap-type: x mandatory`).
- Staff Avatars: Circular dual-tone gradient SVG badge with staff initials and gold accent; never displays generic blank squares or broken links.

FR-4.4 Step-by-Step Customer Journey (Steps 0 through 5):
- Step 0 (Salon Landing / Hero View): Salon branding, status badge, contact phone, directions, photo gallery carousel, and primary "Book Appointment" CTA.
- Step 1 (Service Selection): Categorized multi-service cards, duration, cleanup buffer, SAR pricing, and live total calculator.
- Step 2 (Barber Selection): Staff cards with rating and title, "Any Available Barber" fast track, and strict privacy protection (staff phone numbers omitted).
- Step 3 (Date & Time Slot Selection): 14-day horizontal scrollable date strip; dynamic time slots retrieved directly from salon store operating hours (`shop.operatingHoursJson` / `shop.operatingHours`); Morning, Afternoon, and Evening buckets; disabled past/booked slots; 5-minute temporary reservation hold (`05:00` countdown).
- Step 4 (Customer Details & Review): Full Name, Saudi Mobile (`05XXXXXXXX` with auto-clearing and regex validation), optional notes, instant review summary card, and prominent cancellation advisory (call salon or support).
- Step 5 (Success Receipt & Calendar Export): Unique Booking Reference (`BBR-XXXXX`), receipt summary, dual Apple/iPhone Calendar (.ics with `-PT1H` alarm) and Google/Android Calendar export, and free zero-cost Google Maps routing (zero paid Maps API dependency).

FR-4.5 Customer Audit Logging:
- Every slot hold emits `CUSTOMER_SLOT_HOLD` audit event with barber, date, slot time, and salon context.
- Every confirmed booking emits `CUSTOMER_BOOKING_CONFIRMED` audit event recording reference code, customer contact, service package, total SAR amount, and cancellation notes.

FR-4.6 Calendar & Navigation Payload Specifications:
- Native `.ics` (RFC-5545): Timezone `TZID:Asia/Riyadh`, Pre-configured 1-hour alarm notification (`BEGIN:VALARM`, `TRIGGER:-PT1H`, `ACTION:DISPLAY`), cancellation advisory note with salon phone.
- Google / Android Calendar: Direct web intent URL with formatted title, start/end timestamps, localized description, and `ctz=Asia/Riyadh`.
- Navigation: Direct free map query link without paid API keys.
FR-5: Real-Time & Concurrency
FR-5.1 WebSocket connection between shop dashboard and backend.
FR-5.2 Broadcast to connected clients within 2 seconds on any booking.
FR-5.3 Double-Booking Prevention: DB-level unique constraint on (barber_id, slot_datetime, status='CONFIRMED'), optimistic locking via @Version, pessimistic lock during transaction, Redis distributed lock.
FR-6: Auto-Approval on Payment
FR-6.1 On successful payment webhook: verify signature, idempotency check, update shop status to 'ACTIVE', generate slug, public booking URL, QR code, welcome email, audit event SHOP_AUTO_APPROVED.
FR-6.2 Guard Conditions handled for success/failure/slug conflict/duplicate webhooks.
FR-6.3 Admin retains override capabilities.
7. Non-Functional Requirements
Page load time: < 1.5s on 4G
Concurrent users: 10,000+ simultaneous
Booking API response: < 300ms (p95)
Uptime: 99.9%
Mobile responsiveness: 100% (mobile-first)
Security: HTTPS, JWT, bcrypt, OWASP Top 10
Data residency: KSA-hosted (compliance)
Backup: Daily automated, 30-day retention
Accessibility: WCAG 2.1 AA
Localization: Arabic + English (RTL support)
8. Technology Stack
8.1 Backend: Java 21 & Spring Boot 3.3 for REST APIs and WebSocket communication, with Moyasar/Stripe integration for payments.
8.2 Database & Caching: MySQL 8.0 for primary relational data storage and Redis 7 for distributed slot locking and fast caching.
8.3 Frontend: Pure Vanilla Modern JavaScript (ES Modules, Fetch API, native WebSocket/SockJS), HTML5, and Tailwind CSS (standalone CLI or CDN integration with Tailwind Typography and Forms).
8.4 Hosting & Infrastructure: Docker containers managed via Render or Vercel, with GitHub Actions for automated testing and deployment.
9. Data Model & Detailed Schemas
Core Entities: User, Shop, Barber, Service, WorkingHours, Slot, Booking, Customer, Subscription, AuditLog, Payment.

### 9.1 Staff Rosters & Working Hours Schema
```sql
-- Table: barbers (Staff Members)
CREATE TABLE barbers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(100) DEFAULT 'Master Barber',
    phone VARCHAR(50),
    email VARCHAR(100),
    rating DECIMAL(2,1) DEFAULT 5.0,
    status VARCHAR(20) DEFAULT 'Active', -- 'Active', 'Break', 'Offline'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    user_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_barber_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
    CONSTRAINT fk_barber_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: working_hours (Barber Weekly Shift Rosters & Breaks)
CREATE TABLE working_hours (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    barber_id BIGINT NOT NULL,
    day_of_week INT NOT NULL, -- 1=Sunday, 2=Monday, ..., 7=Saturday
    start_time TIME NOT NULL, -- Shift start (e.g. '09:00:00')
    end_time TIME NOT NULL,   -- Shift end (e.g. '22:00:00')
    break_start TIME,         -- Mid-shift break start (e.g. '14:00:00')
    break_end TIME,           -- Mid-shift break end (e.g. '15:00:00')
    is_day_off BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_wh_barber FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
    CONSTRAINT uk_barber_day UNIQUE (barber_id, day_of_week)
);
```

### 9.2 Services Catalog Schema
```sql
-- Table: services (Salon Catalog & Packages)
CREATE TABLE services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'General', -- 'Haircut', 'Beard & Shave', 'Facial & Spa', 'Treatments', 'Packages'
    duration_minutes INT NOT NULL DEFAULT 30,
    price DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    buffer_minutes INT NOT NULL DEFAULT 5, -- Cleanup buffer interval after service
    is_visible BOOLEAN NOT NULL DEFAULT TRUE, -- Public booking visibility
    assigned_staff_ids VARCHAR(255), -- Comma-separated list of qualified barber IDs (e.g. "26,27")
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_service_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);
```

### 9.3 Salon Operating Rules & Settings Schema
```sql
-- Extended fields on table: shops
ALTER TABLE shops ADD COLUMN (
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    latitude DECIMAL(10,7) DEFAULT 24.7136000,
    longitude DECIMAL(10,7) DEFAULT 46.6753000,
    min_cancel_notice_hours INT DEFAULT 2,       -- Minimum notice required to cancel (hours)
    max_advance_booking_days INT DEFAULT 14,     -- Maximum advance booking horizon (days)
    auto_confirm_walkins BOOLEAN DEFAULT TRUE,   -- Immediate confirmation of on-site walk-ins
    operating_hours_json JSON                    -- 7-day global salon schedule JSON
);

-- Format of operating_hours_json:
-- {
--   "sunday":    {"open": "09:00", "close": "22:00", "closed": false},
--   "monday":    {"open": "09:00", "close": "22:00", "closed": false},
--   "tuesday":   {"open": "09:00", "close": "22:00", "closed": false},
--   "wednesday": {"open": "09:00", "close": "22:00", "closed": false},
--   "thursday":  {"open": "09:00", "close": "23:00", "closed": false},
--   "friday":    {"open": "13:00", "close": "23:00", "closed": false},
--   "saturday":  {"open": "09:00", "close": "22:00", "closed": false}
-- }
```

### 9.4 Double-Booking Concurrency & Distributed Lock Architecture
To guarantee zero double-booking under high concurrent traffic (e.g., an online customer booking a slot while staff simultaneously registers a walk-in at the desk):
1. **Distributed Lock Lease (`SlotLockService`)**:
   - `acquireSlotHold(barberId, slotStart)` acquires an atomic lock in Redis (`lock:barber:{id}:{timestamp}`) with a strict 10-second acquisition timeout and 5-minute lease TTL.
   - If another client holds the lock, incoming requests block or fail fast with HTTP 409 Conflict.
2. **Transactional Database Conflict Verification (`@Transactional`)**:
   - Inside the transaction, query `bookingRepository.findConflictingBookings(shopId, barberId, slotStart, slotEnd, activeStatuses, excludeId)`.
   - Conflicting statuses checked: `HOLD`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `WALK_IN_RESERVED`, `BLOCKED`.
   - Barber active check: Rejects booking if `barber.getIsActive() == false`.
3. **Guaranteed Release (`finally`)**:
   - Distributed lock is safely released in a `finally` block once the booking entity is committed to MySQL, or upon transaction rollback.

### 9.5 Revenue & Earnings Analytics Engine (`/portal/dashboard` / `/portal/earnings`)
To deliver accurate financial transparency to salon owners while complying with Saudi accounting and ZATCA audit rules:
1. **Strict Status Filter (Audit Requirement)**:
   - Revenue calculations strictly filter and aggregate appointments with `status == BookingStatus.COMPLETED`.
   - Records with status `PENDING`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `CANCELLED`, or `NO_SHOW` are strictly excluded from gross and net financials.
2. **Temporal Aggregations & Metrics**:
   - **Daily Earnings**: Today's gross revenue vs. Yesterday's gross revenue with percentage delta (`+X%` or `-X%`) and completed bookings count.
   - **Weekly Earnings & Velocity**: Current week gross revenue vs. Prior week gross revenue. Includes a 7-day Sunday through Saturday day-by-day revenue breakdown.
   - **Monthly Earnings & Trend**: Current month gross revenue vs. Prior month gross revenue with percentage change and monthly completed bookings count.
   - **Average Ticket Size**: Calculated as `Total Completed Revenue / Total Completed Bookings` in SAR.
   - **Top Revenue Performer**: Identifies the highest gross revenue generating staff member, total revenue, and completed appointment count.
3. **Currency & Localization**:
   - Figures are denominated in Saudi Riyal (`SAR` / `ر.س`).
   - Groupings and date boundaries are locked to `Asia/Riyadh` (`AST` UTC+3) timezone.

### 9.6 Media Management & Static Asset Storage
To maintain high performance and prevent database bloat:
1. **Salon Photo Gallery Constraints (`/portal/settings`)**:
   - Capped at a **strict maximum of 5 photos** per salon.
   - Upload attempts beyond 5 photos reject with HTTP 400 (`Gallery Limit Reached`).
   - Reordering support with persistent `display_order` index.
   - Cover photo assignment: First uploaded photo defaults as cover; explicit cover toggle marks single cover in `salon_images` and synchronizes `shops.cover_image_url`.
2. **Staff Profile Photos (`/portal/staff`)**:
   - Dedicated portrait avatar per barber chair.
   - Displays avatar image in directory and scheduling matrix with fallback to initials badge.
3. **Storage & Security Architecture**:
   - **No Base64 in Database**: Raw Base64 string storage in database columns is strictly prohibited. Database rows store only clean static URL references (e.g. `/uploads/salons/{salonId}/...`).
   - **MIME & Magic-Byte Validation**: Enforces `image/jpeg`, `image/png`, and `image/webp`. Validates both MIME types and binary magic bytes (`FF D8 FF`, `89 50 4E 47`, `RIFF...WEBP`).
   - **File Size Constraint**: Maximum file size strictly enforced at <= 5MB.
   - **Static Asset Delivery**: Hosted via Spring MVC static resource handler mapping `/uploads/**` to `file:uploads/` directory on disk, permitted through the Spring Security chain.

10. API Endpoints (Sample)
POST /api/v1/auth/register
POST /api/v1/auth/login
GET /api/portal/context
GET /api/portal/analytics/revenue
GET /api/portal/gallery
POST /api/portal/gallery/upload
PUT /api/portal/gallery/order
DELETE /api/portal/gallery/{id}
GET /api/portal/staff
POST /api/portal/staff
POST /api/portal/staff/{id}/avatar
GET /api/portal/staff/{id}/schedule
PUT /api/portal/staff/{id}/schedule
PATCH /api/portal/staff/{id}/status
GET /api/portal/services
POST /api/portal/services
PUT /api/portal/services/{id}
PATCH /api/portal/services/{id}/visibility
GET /api/portal/settings
PUT /api/portal/settings
POST /api/shops
POST /api/payments/webhook
GET /api/admin/shops
PATCH /api/admin/shops/{id}/suspend
GET /api/shops/{slug}/barbers
GET /api/shops/{slug}/slots
POST /api/bookings
DELETE /api/bookings/{id}
WS /ws/shop/{id}
11. UI/UX Guidelines
Ultra-modern luxury salon aesthetic. Colors: Deep Slate/Charcoal background (#0B0F17, #111827), Card background (#1F2937 / glassmorphism backdrop-blur-md bg-white/5 border border-white/10), Accent Amber/Gold (#F59E0B / #D97706), Success Emerald (#10B981). Typography: Inter / IBM Plex Sans Arabic. Micro-interactions: floating action modals, live pill badges, smooth step transitions, custom animated countdown bars, skeleton loaders, optimistic UI, toast notifications.
12. Test Cases
Covers Authentication & Registration, Payment & Auto-Approval, Admin, Slot Management, Booking, Concurrency, QR & Maps, and Non-Functional requirements.
13. Project Cost Estimate
Development Cost: 175,000 SAR (outsourced) / 30,000–50,000 SAR (AI review/QA).
Monthly Infrastructure: ~10 SAR (Free tier MVP), ~290 SAR (Paid tier upgrade for 500+ shops). Break-even at 1 shop on free tier, ~15 shops on paid tier.
14. Deployment Plan
Environments: Dev, Staging, Production.
CI/CD Pipeline: GitHub Push -> GitHub Actions -> Tests -> Docker -> Deploy.
Go-Live Checklist included.
15. Risks & Mitigations
Double-booking under load: Mitigation: DB unique + Redis lock + tests
Payment gateway approval delay: Mitigation: Apply early, fallback provider
Low shop adoption: Mitigation: Free trial, QR marketing
Data residency KSA: Mitigation: Host on KSA-compliant cloud
Slot race in WebSocket: Mitigation: Server-authoritative state
16. Success Metrics (KPI)
100+ shops onboarded in first 3 months
< 1% booking conflicts
90% booking completion rate
< 2s real-time slot update latency
99.9% uptime
MRR target: 10,000 SAR by month 6
17. Deliverables Checklist for Build Tool
Deliverable 1: Shop Registration Portal with validated SA phone and address inputs.
Deliverable 2: Payment Gateway Integration with automated subscription webhook processing.
Deliverable 3: Auto-Approval Workflow for approved payment status handling.
Deliverable 4: Super Admin Dashboard for overall monitoring, manual shop approvals, and suspensions (Pure Vanilla JS + Tailwind SPA/MPA modules, no React or Next.js dependencies).
Deliverable 5: Shop Owner Dashboard for barber management and time-slot configuration (Pure Vanilla JS + Tailwind SPA/MPA modules, no React or Next.js dependencies).
Deliverable 6: Public Customer Booking Interface for browsing slots and completing bookings (Pure Vanilla JS + Tailwind SPA/MPA modules, no React or Next.js dependencies).
Deliverable 7: QR Code Generator for auto-generating shop entry and direct booking URLs.
Deliverable 8: Google Maps Integration to display shop location and link directly to booking.
Deliverable 9: Real-Time Slot Synchronization over WebSockets for live schedule updates.
Deliverable 10: Double-Booking Prevention Engine using database locks and Redis key locking.
Deliverable 11: Calendar Integration (.ics export) with automated confirmation emails.
Deliverable 12: User Activity Audit Logging for tracking admin and shop actions.
Deliverable 13: Automated Test Suite (Unit, Integration, and Concurrency Load Tests).
Deliverable 14: CI/CD Pipeline Configurations using GitHub Actions for build and deployment.
Deliverable 15: Deployment Runbook and Production Environment Provisioning.
