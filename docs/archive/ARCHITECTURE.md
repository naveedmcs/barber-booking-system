# System Architecture & Technical Specifications
## Salon & Barber Appointment SaaS Platform (BarberApp KSA)

---

## 1. Architectural Overview & Technology Stack

The platform is engineered as a multi-tenant SaaS appointment and salon operations system tailored for the Saudi Arabian retail grooming market.

### Core Stack Components:
- **Backend**: Spring Boot 3.3.4 (Java 21) on embedded Tomcat.
- **Database**: MySQL 8.0 with Flyway database migration management.
- **Cache & Concurrency**: Redis 7.0 with Redisson distributed locking.
- **Frontend Architecture**: Pure Vanilla JavaScript (ES Modules) + Tailwind CSS (v3 CDN) + semantic responsive HTML5. No React/Next.js/Node runtime dependencies.
- **Security & RBAC**: Stateless JWT Authentication (`/api/v1/auth/**`), Spring Security 6 filter chain, role-based method security, and tenant isolation decorators.
- **Real-Time Communication**: WebSocket STOMP Broker (`/ws`) for live appointment schedule synchronization.
- **Static Asset Subsystem**: Dedicated local disk storage mapping to `/uploads/**` with magic-byte validation and strict size bounds.

---

## 2. Multi-Tenant Isolation & Role-Based Access Control (RBAC)

The system enforces strict multi-tenant boundary isolation across all data access pathways.

```mermaid
graph TD
    Client["Client Request (Frontend)"] --> Filter["JwtAuthenticationFilter"]
    Filter --> Principal["UserPrincipal (salonId, role, staffId)"]
    Principal --> RBAC{"RBAC Guard"}
    
    RBAC -->|"SALON_OWNER"| OwnerScope["Owner Scope: Full Salon Access (Bookings, Staff, Services, Settings, Analytics, Gallery)"]
    RBAC -->|"SALON_STAFF"| StaffScope["Staff Scope: Locked to Assigned Chair (staffId = currentUser.id). Peer appointments & settings blocked."]
    RBAC -->|"SUPER_ADMIN"| AdminScope["Platform Scope: System Audits, Multi-Shop Directory, RBAC Access Control"]
    
    OwnerScope --> DB[(MySQL 8.0 - Tenant Scoped)]
    StaffScope --> DB
    AdminScope --> DB
```

### RBAC Matrix:
| Role | Portal Calendar | Quick Walk-in | Staff Management | Services Catalog | Salon Settings | Revenue Analytics | Media Gallery | Platform Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `SUPER_ADMIN` | Read/Inspect | N/A | Full | Full | Full | Read All | Full | Full |
| `SALON_OWNER` | Full (All Chairs) | Full | Full | Full | Full | Full (Shop Scoped) | Full (Max 5) | Denied |
| `SALON_STAFF` | Own Chair Only | Own Chair Only | Denied (403) | Denied (403) | Denied (403) | Denied (403) | Denied (403) | Denied |

---

## 3. Database Schema Delta (Flyway Migrations)

### Migration History:
1. `V1__init_schema.sql`: Base tables (`users`, `shops`, `barbers`, `services`, `bookings`).
2. `V2__add_auth_and_tenant_fields.sql`: Role enums, `salon_id` tenant keys, and audit logging support.
3. `V3__add_slot_hold_and_payment_fields.sql`: Slot hold timers and payment gateway tracking.
4. `V4__add_access_control_and_user_management.sql`: Platform internal staff roles and granular RBAC permissions.
5. `V5__add_cancellation_reason_and_audit_columns.sql`: Appointment cancellation reasons and audit columns.
6. `V6__add_staff_services_and_settings_fields.sql`: Weekly roster JSON, service buffer times, and operating hours JSON.
7. `V7__add_salon_gallery_and_media_support.sql`: Table `salon_images` and media upload indices.
8. `V8__add_staff_skills_and_lifecycle_support.sql`: Barber `skills` column, `deleted_at` timestamp for soft-deletion, and tenant active index.
9. `V9__create_password_resets_table.sql`: Table `password_resets` for SHA-256 hashed single-use recovery tokens and user FK.

### Schema Detail: `password_resets` (V9 Migration)
```sql
CREATE TABLE password_resets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_resets_hash_used ON password_resets(token_hash, used);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);
```

### Schema Detail: `salon_images` (V7 Migration)
```sql
CREATE TABLE salon_images (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    caption VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_salon_images_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX idx_salon_images_shop_order ON salon_images(shop_id, display_order);
```

### Schema Detail: `barbers` (Skills, Avatars & Soft-Deletion Lifecycle - V8 Migration)
```sql
ALTER TABLE barbers 
    ADD COLUMN skills VARCHAR(500) NULL DEFAULT 'Haircut, Beard Trim, Hot Towel',
    ADD COLUMN deleted_at TIMESTAMP NULL;

CREATE INDEX idx_barbers_shop_active ON barbers (shop_id, is_active, deleted_at);
```
- **Avatar Storage & Limits**: 
  - Dedicated endpoint `POST /api/portal/staff/upload-avatar` and `POST /api/portal/staff/{id}/avatar`.
  - Strict maximum file size cap: **2MB** (`MAX_AVATAR_SIZE = 2 * 1024 * 1024`).
  - Stored strictly as public URL `/uploads/salons/{salonId}/avatars/...`, zero Base64 in DB columns.
- **Availability Boundary Rules**:
  - `endTime` must be strictly after `startTime` (`endTime > startTime`).
  - Break window must fall strictly inside shift (`breakStart >= startTime && breakEnd <= endTime`).
- **Data Integrity & Conflict Safety Guard (HTTP 409 Conflict)**:
  - Deactivation (`PATCH /status`) and Deletion (`DELETE /{id}`) query `BookingRepository.findUpcomingActiveBookings(shopId, barberId, [CONFIRMED, HOLD, WALK_IN_RESERVED, IN_SERVICE], slotEnd >= NOW())`.
  - If active appointments exist, returns **HTTP 409 Conflict** with payload:
    `{ "error": "CONFLICT", "message": "...", "conflictCount": N, "upcomingBookings": [...] }`.
  - Soft-deletion sets `deleted_at = NOW()`, `is_active = false`, `status = 'OFFLINE'`, and deactivates the linked `User` record to preserve historical booking records and financial audits.

---

## 4. Revenue & Financial Analytics Engine

Located at `SalonAnalyticsService.java` and exposed via `GET /api/portal/analytics/revenue`.

### 4.1 Strict Business Accounting Rule
```
Gross Revenue = SUM(service.price) WHERE booking.status = 'COMPLETED' AND booking.shop_id = :salonId
```
- **Excluded Statuses**: Records with status `PENDING`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `CANCELLED`, `NO_SHOW`, or `BLOCKED` are **strictly excluded** from gross, net, and ticket size computations.

### 4.2 Computed Metric Specifications
1. **Daily Earnings**:
   - `todayEarnings`: Revenue from completed appointments between `00:00:00` and `23:59:59` today (in `Asia/Riyadh`).
   - `yesterdayEarnings`: Revenue from completed appointments during the preceding 24h day.
   - `dailyPercentChange`: Percentage delta calculated as `((today - yesterday) / yesterday) * 100`. Defaults to `+100.0%` if yesterday was 0 and today > 0, or `0.0%` if both 0.
2. **Weekly Earnings & Day Breakdown**:
   - `currentWeekEarnings`: Aggregated revenue from current week (Sunday through Saturday).
   - `weeklyBreakdown`: 7-day array of `{ dayOfWeek, date, revenue, bookingsCount }`.
3. **Monthly Trend**:
   - `currentMonthEarnings`: Revenue for the current calendar month.
   - `previousMonthEarnings`: Revenue for the previous calendar month.
   - `monthlyPercentChange`: Percentage trend vs. previous month.
4. **Average Ticket Size & Performer**:
   - `averageTicketSize = totalCompletedRevenue / totalCompletedBookings`.
   - `topStaff`: Barber with highest completed booking revenue (`staffId`, `name`, `avatarUrl`, `specialty`, `totalRevenue`, `completedBookings`).
5. **Localization**:
   - Currency: `SAR` (`ر.س`).
   - Timezone: `Asia/Riyadh` (`AST UTC+3`).

---

## 5. Media Management & Static Asset Storage Subsystem

Located at `MediaStorageService.java` and `WebMvcConfig.java`.

### 5.1 Storage Architecture Rules
- **No Base64 in Database**: Storing raw base64 data URIs in relational database rows is strictly prohibited to prevent table bloat and high memory footprint.
- **Storage Hierarchy**:
  ```
  uploads/
  └── salons/
      └── {salonId}/
          ├── gallery/
          │   ├── 5d1bc2bd-21f1-4088-90a0-4683e8889aad.png
          │   └── ... (Strict maximum 5 files)
          └── avatars/
              ├── b87faf00-1007-443f-b353-c8365e6aadb3.png
              └── ...
  ```
- **Static Resource Handler**:
  - In `WebMvcConfig.java`:
    ```java
    registry.addResourceHandler("/uploads/**")
            .addResourceLocations(uploadDirectory.toUri().toString() + "/");
    ```
  - Trailing slash is mandatory on `file:.../uploads/` to ensure Spring MVC resolves directory subpaths correctly.
  - Security chain explicitly permits `/uploads/**` in `SecurityConfig.java`.

### 5.2 Upload Validation & Integrity Guard
1. **Maximum File Size**: 5MB (`5 * 1024 * 1024 bytes`).
2. **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`.
3. **Binary Magic-Byte Inspection**:
   - JPEG: `0xFF, 0xD8, 0xFF`
   - PNG: `0x89, 0x50, 0x4E, 0x47`
   - WebP: `RIFF....WEBP`
4. **Gallery Cap Enforcement**: Server and client enforce a strict cap of 5 gallery photos per salon. Requests beyond 5 return HTTP 400 (`Gallery Limit Reached`).

---

## 6. Concurrency Control & Double-Booking Prevention

Engineered in `SlotLockService.java` and `SalonPortalController.java`.

1. **Distributed Lock Lease**:
   - Atomic acquisition via Redis Redisson: `lock:barber:{barberId}:{slotTimestamp}`.
   - Wait timeout: 10 seconds. Lease TTL: 5 minutes.
2. **Transactional Database Conflict Verification**:
   - Queries `findConflictingBookings` inside `@Transactional` boundary checking active overlapping slots.
3. **Guaranteed Release**:
   - Redisson lock safely released in `finally` block upon commit or rollback.

---

## 7. Mobile-Optimized Customer Booking Funnel Subsystem

Engineered in the single canonical file `frontend/booking/index.html` and `frontend/src/js/booking-stepper.js` (with HTTP 302 redirect middleware mapping legacy `/book`, `/book.html`, and `/booking.html` directly to `/booking/`).

### 7.1 Contextual Default Asset Fallbacks (`FallbackAssets`)
- **Brand Logo (`FallbackAssets.getBrandLogo`)**: Zero-latency data URI SVG monogram badge with radial background (`#1E293B` to `#0B0F17`), 24K gold border (`#F59E0B`), and dynamic salon initials.
- **Hero Cover Banner (`FallbackAssets.getHeroBanner`)**: 16:9 ultra-wide dark luxury SVG vector with barbershop watermark shears and pinstripes, glowing ambient orbs, and dynamic salon title.
- **Pre-Curated Aesthetic Gallery (`FallbackAssets.getDefaultGallery`)**: 3 high-contrast barbershop cards (Vintage Leather Stations, Hot Towel & Steam, Precision Grooming) rendered with `loading="lazy"` and explicit dimensions (`width=288`, `height=180`) preventing Cumulative Layout Shifts (CLS < 0.1).
- **Staff Avatars (`FallbackAssets.getStaffAvatar`)**: Circular dual-tone gradient SVG initials badge with 48x48px hit target bounds.

### 7.2 Dynamic Salon Store Slot Generator
- Time slots are dynamically derived from the salon's schedule (`shop.operatingHoursJson` or `shop.operatingHours`).
- Evaluates the selected date's day of week against salon open/close hours (e.g. Friday 13:00-23:00, Weekdays 09:00-22:00) in 30-minute intervals.
- Bucketed into Morning (< 12:00 PM), Afternoon (12:00 PM - 05:00 PM), and Evening (>= 05:00 PM).
- Automatically marks past slots on the current day as unavailable, and disables conflicting slots registered in `Store.getBookings()`.

### 7.3 Dual Calendar & Navigation Integration
- **Apple / iPhone Calendar (`downloadIcsCalendarFile` & `lib/calendar.js`)**:
  * RFC-5545 compliant `.ics` payload.
  * Timezone: `TZID:Asia/Riyadh` (`AST UTC+3`).
  * Pre-configured alarm: `BEGIN:VALARM`, `TRIGGER:-PT1H`, `ACTION:DISPLAY`.
  * Formatted description embedding booking reference code, barber, services, customer notes, and prominent cancellation advisory.
- **Google / Android Calendar (`getGoogleCalendarWebUrl` & `lib/calendar.js`)**:
  * Direct web intent template URL (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`).
  * Timezone locked to `ctz=Asia/Riyadh` with start/end ISO timestamps.
- **Zero-Cost Map Routing**:
  * Direct standard map navigation link (`https://maps.google.com/?q=...`) requiring zero paid Google Maps API keys or billable API requests.

---

## 8. Slot Hold Timeout Background Worker

Engineered in `com.barberapp.service.SlotHoldCleanupTask`.

1. **Scheduled Execution**:
   - Runs automatically every 60 seconds (`@Scheduled(fixedDelay = 60000)`).
   - Scans MySQL `bookings` table via `findByStatusAndHoldExpiresAtBefore(BookingStatus.HOLD, LocalDateTime.now())`.
2. **Atomic Lock & State Transition**:
   - Safely releases Redisson slot lock: `slotLockService.releaseSlotHold(booking.getBarber().getId(), booking.getSlotStart())`.
   - Transitions booking entity status from `HOLD` to `CANCELLED`.
   - Emits structured info logs documenting freed chair intervals and booking IDs.

---

## 9. Canonical Folder Structure Rules

To maintain high code quality, modularity, and zero dead code, all additions must adhere to the standard directory hierarchy:

```
frontend/src/js/
├── components/                # Reusable presentation primitives
│   └── ui/                    # modal.js, drawer.js, toast.js, badge.js
├── features/                  # Domain-bounded functional modules
│   ├── admin/                 # Super admin tabs: overview, salons, access-control, audit, settings
│   ├── portal/                # Salon tenant modules: dashboard, staff, services, settings, analytics
│   ├── booking/               # Customer booking wizard steps (0 through 5)
│   └── authentication/        # auth-service.js, auth-guard.js, tenant-context.js
├── lib/                       # Pure shared business logic & adapters
│   ├── api-client.js          # Unified fetch client with Bearer auth injection
│   ├── validators.js          # Saudi phone regex, email, HTML escaper
│   ├── formatting.js          # Currency SAR, dates, slots, durations
│   ├── calendar.js            # Dual Apple/Google calendar exporters
│   ├── qr-client.js           # Client-side QR generation & ZIP downloads
│   └── store.js               # LocalStorage persistence adapter & mock seeds
└── types/                     # Shared models and immutable enums
    └── enums.js               # BookingStatus, UserRole, PlatformRole, TenantRole, SubscriptionPlan
```

### Architectural Constraints:
1. **Zero Monoliths**: No single file may exceed 500 lines. Domain logic must be split into feature modules.
2. **Import Hierarchy**: Features may import from `lib/`, `types/`, and `components/`. Primitives in `lib/` must never import from `features/`.
3. **No Direct Hardcoding of Enums**: Always import status and role constants from `types/enums.js`.

---

## 10. Unified Authentication, Registration & Password Reset Engine

Centralized in `AuthController.java` (`/api/auth/*` and `/api/v1/auth/*`) with zero in-memory mocks, zero plaintext passwords, and real MySQL database persistence.

### 10.1 BCrypt Password Encryption Policy
- Passwords are encrypted exclusively via Spring Security's `BCryptPasswordEncoder` (Cost factor 10, format `$2a$10$...`).
- Raw plaintext passwords are never stored, logged, or serialized.
- Legacy plaintext fallback logic has been completely purged from the codebase.
- User authentication matches incoming plaintext credentials against BCrypt hashes using `passwordEncoder.matches(raw, hash)`.

### 10.2 Role Governance & Registration Policy
1. **Customer Self-Registration (`POST /api/auth/register`)**:
   - Fields: Full Name, Saudi Mobile (`05xxxxxxxx`), Email, Password.
   - Normalizes Saudi telephone formats (`+9665...`, `9665...`, `05...`) into standard 10-digit format.
   - Enforces unique email and unique phone constraints (`HTTP 409 Conflict` on duplicates).
   - Atomically provisions a `User` entity (`role = CUSTOMER`) and a linked `Customer` record.
   - Issues a signed 24h JWT token for instant checkout continuation.
2. **Salon Owner Business Onboarding (`POST /api/auth/register-salon`)**:
   - Atomic `@Transactional` creation of `Shop` and `User` (`role = SALON_OWNER`).
   - Tenant isolation binding: `owner.setSalonId(shop.getId())`.
   - Generates initial salon operating hours and services catalog.
3. **Salon Staff Provisioning (Public Registration Blocked)**:
   - Public registration for staff is strictly prohibited (`403 Forbidden`).
   - Staff accounts are provisioned exclusively by authorized salon owners or super administrators via `POST /api/portal/staff`.
4. **Super Administrator Provisioning (Public Registration Blocked)**:
   - Super admin registration forms are strictly prohibited.
   - Seeded exclusively via the idempotent CLI script `npm run seed:admin` (`scripts/seed-admin.js`) which verifies if a `SUPER_ADMIN` exists before creating `admin@barberapp.sa`.

### 10.3 Cryptographic Password Recovery Lifecycle
```mermaid
sequenceDiagram
    autonumber
    actor User as User / Client
    participant Auth as AuthController
    participant DB as MySQL (password_resets)
    participant Hash as SHA-256 Engine

    User->>Auth: POST /api/auth/forgot-password { email }
    Auth->>Auth: SecureRandom 32-byte token (64 hex chars)
    Auth->>Hash: SHA-256(rawToken) -> tokenHash
    Auth->>DB: INSERT INTO password_resets (user_id, token_hash, expires_at, used=false)
    Auth-->>User: 200 OK { message, resetLink, expiresInMinutes: 60 }
    
    Note over User,Auth: User opens reset password screen with token
    
    User->>Auth: POST /api/auth/reset-password { token, newPassword }
    Auth->>Hash: SHA-256(token) -> tokenHash
    Auth->>DB: SELECT WHERE token_hash = ? AND used = false AND expires_at > NOW()
    alt Token Valid & Unused
        Auth->>DB: UPDATE users SET password = BCrypt(newPassword)
        Auth->>DB: UPDATE password_resets SET used = true
        Auth-->>User: 200 OK { message: "Password updated successfully" }
    else Token Expired or Re-used
        Auth-->>User: 400 Bad Request { error: "Invalid or Expired Token" }
    end
```

---

## 11. Environment Variables & Configuration Inventory

| Variable | Scope | Default Setting | Description |
| :--- | :--- | :--- | :--- |
| `SERVER_PORT` | Backend | `8080` | Spring Boot HTTP listening port. |
| `SPRING_DATASOURCE_URL` | Backend | `jdbc:mysql://localhost:3307/barber_saas` | MySQL JDBC connection string (Port 3307 mapped to container). |
| `SPRING_DATASOURCE_USERNAME` | Backend | `barber_user` | Database authentication username. |
| `SPRING_DATASOURCE_PASSWORD` | Backend | `barber_password` | Database password. |
| `SPRING_DATA_REDIS_HOST` | Backend | `localhost` | Redis server hostname for distributed locking. |
| `SPRING_DATA_REDIS_PORT` | Backend | `6379` | Redis server port. |
| `JWT_SECRET` | Backend | `bbr-super-secret-key-256bit-min-security-barberapp-ksa-2026` | 256-bit cryptographic secret for signing JWT access tokens. |
| `JWT_EXPIRATION_MS` | Backend | `86400000` (24 Hours) | JWT token lifespan in milliseconds. |
| `MEDIA_UPLOAD_DIR` | Backend | `uploads` | Base local filesystem directory for salon gallery and avatar storage. |
| `TUNNEL_PORT` | Dev Scripts | `3000` | Target local frontend server port for `scripts/tunnel.sh`. |
| `TUNNEL_USER` | Dev Scripts | `admin` | HTTP Basic Auth username for public mobile tunnel access. |
| `TUNNEL_PASS` | Dev Scripts | `BarberDev2026!` | HTTP Basic Auth password for public mobile tunnel access. |

---

## 12. Relational Database Schema & Relationships

```mermaid
erDiagram
    SHOPS ||--o{ BARBERS : employs
    SHOPS ||--o{ SERVICE_ITEMS : offers
    SHOPS ||--o{ BOOKINGS : hosts
    SHOPS ||--o{ SALON_IMAGES : showcases
    SHOPS ||--o{ WORKING_HOURS : operates
    USERS ||--o| SHOPS : owns
    USERS ||--o{ PASSWORD_RESETS : requests
    BARBERS ||--o{ BOOKINGS : serves
    SERVICE_ITEMS ||--o{ BOOKINGS : includes
    CUSTOMERS ||--o{ BOOKINGS : books
    USERS ||--o{ AUDIT_LOGS : generates

    USERS {
        bigint id PK
        string email UK
        string password
        string full_name
        string phone
        string role
        bigint salon_id FK
        boolean active
        timestamp last_login
    }

    PASSWORD_RESETS {
        bigint id PK
        bigint user_id FK
        string token_hash
        timestamp expires_at
        boolean used
        timestamp created_at
    }

    SHOPS {
        bigint id PK
        string name
        string slug UK
        string phone
        string city
        string subscription_plan
        string booking_url
        string qr_code_url
        boolean is_active
    }

    BARBERS {
        bigint id PK
        bigint shop_id FK
        string name
        string title
        string skills
        string avatar_url
        boolean is_active
        timestamp deleted_at
    }

    BOOKINGS {
        bigint id PK
        bigint shop_id FK
        bigint barber_id FK
        bigint service_id FK
        bigint customer_id FK
        timestamp slot_start
        timestamp slot_end
        string status
        string reference_code UK
        string cancellation_reason
    }

    SALON_IMAGES {
        bigint id PK
        bigint shop_id FK
        string image_url
        int display_order
        boolean is_cover
    }
```
