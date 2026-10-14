# Database Models, Field Types & Multi-Tenant Data Schemas

## 1. Multi-Tenant Architecture & Isolation Rules

The system implements logical tenant isolation via `shop_id` / `salonId` foreign keys enforced across database tables, JPA repositories, and REST controllers:

- **Tenant Boundary Key**: `shop_id` in tables `barbers`, `services`, `bookings`, `salon_images`, and `audit_logs`. `salon_id` in `users`.
- **Salon Owner Scoping**: Queries and mutations by a `SALON_OWNER` are strictly filtered by `shop_id = :currentUser.salonId`. Cross-tenant mutations (e.g. updating a peer salon's staff or services) return `403 Forbidden` or `404 Not Found`.
- **Staff Scoping**: Queries and mutations by a `SALON_STAFF` are restricted to their assigned chair (`shop_id = :salonId AND barber_id = :staffId`). Staff cannot view peer schedules, delete services, alter salon settings, or cancel appointments.
- **Super Admin Scope**: Global visibility across all tenant shops (`SUPER_ADMIN`).
- **Data Retention & Soft Deletion**: Staff soft-deletion is enforced via `barbers.deleted_at IS NULL` and guarded against active future appointments (`409 Conflict`).

---

## 2. Relational Entity Definitions

### 2.1 Table: `users`
System accounts across all 4 platform roles.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Unique user account ID |
| `email` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | Normalized login email |
| `phone` | `VARCHAR(30)` | `NOT NULL`, `UNIQUE` | Saudi mobile (`05XXXXXXXX`) |
| `password` | `VARCHAR(255)` | `NOT NULL` | BCrypt password hash (Cost: 10) |
| `full_name` | `VARCHAR(100)` | `NOT NULL` | User full display name |
| `role` | `ENUM` | `NOT NULL` | `SUPER_ADMIN`, `SALON_OWNER`, `SALON_STAFF`, `CUSTOMER` |
| `salon_id` | `BIGINT` | `NULL`, `FK -> shops(id)` | Associated salon tenant for Owner/Staff |
| `active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Account activation flag |
| `last_login` | `TIMESTAMP` | `NULL` | Last authentication timestamp |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

---

### 2.2 Table: `shops`
Tenant salon entities registered on the platform.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Unique salon shop ID |
| `name` | `VARCHAR(150)` | `NOT NULL` | Salon trade name |
| `slug` | `VARCHAR(150)` | `NOT NULL`, `UNIQUE` | URL-safe slug (e.g. `golden-scissors`) |
| `owner_id` | `BIGINT` | `NOT NULL`, `FK -> users(id)` | Registered salon owner user |
| `phone` | `VARCHAR(30)` | `NOT NULL` | Primary public salon contact number |
| `region` | `VARCHAR(100)` | `NOT NULL` | Saudi Administrative Region |
| `city` | `VARCHAR(100)` | `NOT NULL` | City (e.g. `Riyadh`, `Jeddah`) |
| `district` | `VARCHAR(100)` | `NOT NULL` | District (e.g. `Olaya`, `Al-Malqa`) |
| `full_address` | `VARCHAR(255)` | `NOT NULL` | Physical storefront address |
| `map_address` | `VARCHAR(255)` | `NULL` | Google Maps navigation reference |
| `latitude` | `DECIMAL(10,8)` | `NULL` | Geographic coordinate |
| `longitude` | `DECIMAL(11,8)` | `NULL` | Geographic coordinate |
| `status` | `ENUM` | `DEFAULT 'PENDING'` | `ACTIVE`, `PENDING`, `SUSPENDED` |
| `subscription_plan` | `ENUM` | `DEFAULT 'MONTHLY'` | `MONTHLY` (20 SAR), `YEARLY` (200 SAR) |
| `operating_hours_json` | `TEXT` | `NULL` | 7-day schedule matrix JSON |
| `max_advance_booking_days`| `INT` | `DEFAULT 14` | Max future booking calendar horizon |
| `min_cancel_notice_hours` | `INT` | `DEFAULT 2` | Minimum cancellation policy window |
| `auto_confirm_walkins` | `BOOLEAN` | `DEFAULT TRUE` | Auto-approval flag for walk-in arrivals |
| `logo_url` | `VARCHAR(512)` | `NULL` | Brand logo static asset path |
| `cover_image_url` | `VARCHAR(512)` | `NULL` | Hero banner static asset path |
| `qr_code_url` | `VARCHAR(512)` | `NULL` | Storefront booking QR asset path |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

---

### 2.3 Table: `barbers`
Staff members and chairs scoped to a specific salon.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Unique barber/staff chair ID |
| `shop_id` | `BIGINT` | `NOT NULL`, `FK -> shops(id)` | Tenant salon binding |
| `user_id` | `BIGINT` | `NULL`, `FK -> users(id)` | Linked authenticated staff user |
| `name` | `VARCHAR(100)` | `NOT NULL` | Staff member full name |
| `specialty` | `VARCHAR(100)` | `NULL` | Job title (e.g. `Master Barber`) |
| `phone` | `VARCHAR(30)` | `NULL` | Private staff contact (hidden from customer) |
| `email` | `VARCHAR(255)` | `NULL` | Private staff email address |
| `photo_url` | `VARCHAR(512)` | `NULL` | Static portrait avatar image path |
| `status` | `VARCHAR(20)` | `DEFAULT 'ACTIVE'` | Shift/roster status (`ACTIVE`, `OFFLINE`) |
| `is_active` | `BOOLEAN` | `DEFAULT TRUE` | Operational availability flag |
| `skills` | `VARCHAR(500)` | `DEFAULT 'Haircut...'` | Comma-delimited skill tags |
| `deleted_at` | `TIMESTAMP` | `NULL` | Soft deletion timestamp (audit preservation) |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

*Index*: `idx_barbers_shop_active (shop_id, is_active, deleted_at)`

---

### 2.4 Table: `services`
Service menu items offered by each tenant salon.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Unique service item ID |
| `shop_id` | `BIGINT` | `NOT NULL`, `FK -> shops(id)` | Tenant salon binding |
| `name` | `VARCHAR(100)` | `NOT NULL` | Service title (e.g. `Haircut & Beard Trim`) |
| `description` | `TEXT` | `NULL` | Detailed service description |
| `price` | `DECIMAL(10,2)` | `NOT NULL` | Retail price in Saudi Riyal (`SAR`) |
| `duration_minutes` | `INT` | `NOT NULL DEFAULT 30` | Treatment duration in minutes |
| `buffer_minutes` | `INT` | `NOT NULL DEFAULT 5` | Turnaround cleaning buffer in minutes |
| `category` | `VARCHAR(50)` | `DEFAULT 'General'` | Category (`Haircut`, `Shave`, `Grooming`) |
| `is_visible` | `BOOLEAN` | `DEFAULT TRUE` | Catalog visibility flag |
| `assigned_staff_ids` | `VARCHAR(255)` | `DEFAULT 'ALL'` | Comma-delimited IDs or `'ALL'` |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

---

### 2.5 Table: `customers`
Customer records linking booking history to user credentials.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Unique customer entity ID |
| `user_id` | `BIGINT` | `NULL`, `FK -> users(id)` | Linked customer user profile |
| `full_name` | `VARCHAR(100)` | `NOT NULL` | Customer full name |
| `email` | `VARCHAR(255)` | `NOT NULL` | Contact email address |
| `phone` | `VARCHAR(30)` | `NOT NULL` | Verified Saudi mobile number |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

---

### 2.6 Table: `bookings`
Appointment reservations, state machine records, and concurrency locks.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Unique appointment ID |
| `shop_id` | `BIGINT` | `NOT NULL`, `FK -> shops(id)` | Salon appointment location |
| `barber_id` | `BIGINT` | `NOT NULL`, `FK -> barbers(id)` | Designated staff member chair |
| `service_id` | `BIGINT` | `NOT NULL`, `FK -> services(id)` | Booked service item |
| `customer_id` | `BIGINT` | `NOT NULL`, `FK -> customers(id)`| Booked customer |
| `slot_start` | `DATETIME` | `NOT NULL` | Appointment start time (`Asia/Riyadh`) |
| `slot_end` | `DATETIME` | `NOT NULL` | Appointment end time (duration + buffer) |
| `status` | `ENUM` | `NOT NULL` | `HOLD`, `CONFIRMED`, `ARRIVED`, `IN_SERVICE`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `WALK_IN_RESERVED`, `BLOCKED` |
| `hold_expires_at` | `DATETIME` | `NULL` | 5-minute concurrency release timer |
| `notes` | `TEXT` | `NULL` | Customer or operational notes |
| `cancellation_reason` | `VARCHAR(255)` | `NULL` | Audit reason if status is `CANCELLED` |
| `version` | `BIGINT` | `DEFAULT 0` | JPA `@Version` optimistic locking |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Booking creation timestamp |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

*Unique Constraint*: `uk_no_double_book (barber_id, slot_start, status)`

---

### 2.7 Table: `salon_images`
Curated photo gallery assets capped at a strict maximum of 5 images per salon.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Image record ID |
| `shop_id` | `BIGINT` | `NOT NULL`, `FK -> shops(id)` | Salon tenant binding |
| `image_url` | `VARCHAR(512)` | `NOT NULL` | Static path (`/uploads/salons/{id}/...`) |
| `display_order` | `INT` | `NOT NULL DEFAULT 0` | Sort position in gallery slider |
| `is_cover` | `BOOLEAN` | `NOT NULL DEFAULT FALSE`| Primary cover photo toggle |
| `caption` | `VARCHAR(255)` | `NULL` | Image caption / alt description |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Upload timestamp |
| `updated_at` | `TIMESTAMP` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

*Index*: `idx_salon_images_shop_order (shop_id, display_order)`

---

### 2.8 Table: `password_resets`
Cryptographically secure single-use password recovery tokens.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Reset record ID |
| `user_id` | `BIGINT` | `NOT NULL`, `FK -> users(id)` | User requesting reset |
| `token_hash` | `VARCHAR(64)` | `NOT NULL` | SHA-256 digest of 32-byte hex token |
| `expires_at` | `TIMESTAMP` | `NOT NULL` | Expiry cutoff (60 minutes from issue) |
| `used` | `BOOLEAN` | `NOT NULL DEFAULT FALSE`| Single-use enforcement flag |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Token generation timestamp |

*Indices*: `idx_password_resets_hash_used (token_hash, used)`, `idx_password_resets_user (user_id)`

---

### 2.9 Table: `audit_logs`
Immutable compliance and security activity journal.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `PK`, `AUTO_INCREMENT` | Audit log entry ID |
| `user_id` | `BIGINT` | `NULL`, `FK -> users(id)` | Performing actor |
| `shop_id` | `BIGINT` | `NULL`, `FK -> shops(id)` | Scoped salon context |
| `action` | `VARCHAR(100)` | `NOT NULL` | Event key (e.g. `LOGIN`, `STATUS_CHANGED`)|
| `details` | `TEXT` | `NULL` | Detailed audit payload description |
| `ip_address` | `VARCHAR(50)` | `NULL` | Originating client IP address |
| `created_at` | `TIMESTAMP` | `DEFAULT CURRENT_TIMESTAMP` | Event timestamp |

---

## 3. Flyway Migration History

1. **`V1__init_schema.sql`**: Core baseline (`users`, `shops`, `barbers`, `services`, `bookings`).
2. **`V2__add_auth_and_tenant_fields.sql`**: Role enums, `salon_id` foreign keys, and audit log tables.
3. **`V3__add_slot_hold_and_payment_fields.sql`**: Slot hold timers and payment gateway tracking columns.
4. **`V4__add_access_control_and_user_management.sql`**: Granular internal RBAC capabilities and permissions table.
5. **`V5__add_cancellation_reason_and_audit_columns.sql`**: Cancellation reason columns and audit fields.
6. **`V6__add_staff_services_and_settings_fields.sql`**: Weekly shift JSON, service buffer minutes, operating hours JSON.
7. **`V7__add_salon_gallery_and_media_support.sql`**: `salon_images` table with 5-photo maximum cap support.
8. **`V8__add_staff_skills_and_lifecycle_support.sql`**: Barber `skills`, avatar path, and `deleted_at` soft-deletion.
9. **`V9__create_password_resets_table.sql`**: `password_resets` table with SHA-256 token hashing and 60m expiry.
