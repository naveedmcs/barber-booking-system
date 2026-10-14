# System Routing & REST API Reference

## 1. Frontend Route Registry

### 1.1 Route Table by Role & Journey

| Role | Target Journey | Canonical URL | Physical File | Access Control / Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Platform Admin Console | `/dashboard/admin.html` | `frontend/dashboard/admin.html` | Platform-wide RBAC, Audit logs, Shop moderation, Settings |
| **Super Admin** | Access Control Matrix | `/admin/access-control.html` | *Redirects to `/dashboard/admin.html#access-control`* | Internal staff management & screen permission matrix |
| **Super Admin** | Salons Moderation | `/admin/salons.html` | *Redirects to `/dashboard/admin.html#salons`* | Tenant shop status (`ACTIVE`, `PENDING`, `SUSPENDED`) |
| **Super Admin** | Global System Settings | `/admin/settings.html` | *Redirects to `/dashboard/admin.html#settings`* | Platform configs, tax/billing, SMS, feature flags |
| **Super Admin** | Audit Log Viewer | `/admin/audit.html` | *Redirects to `/dashboard/admin.html#audit`* | Security compliance and audit activity timeline |
| **Salon Owner** | Owner Portal Dashboard | `/portal/index.html` | `frontend/portal/index.html` | Multi-tenant salon dashboard, calendar, revenue analytics |
| **Salon Owner** | Staff Roster Management| `/portal/staff/index.html` | `frontend/portal/staff/index.html` | Staff chairs, avatars, status toggle, invite modal |
| **Salon Owner** | Service Menu Catalog | `/portal/services/index.html` | `frontend/portal/services/index.html` | Service items, pricing, durations, buffer times |
| **Salon Owner** | Salon Settings & Media | `/portal/settings/index.html` | `frontend/portal/settings/index.html` | Operating hours, bank/tax info, 5-photo gallery cap |
| **Salon Staff** | Staff Schedule Timetable| `/portal/index.html#schedule` | `frontend/portal/index.html` | Scoped strictly to assigned chair (`staffId`) |
| **Salon Staff** | Shift Status Toggle | Header status pill | `/api/portal/shift` | Dynamic toggle between `ONLINE` and `OFFLINE` |
| **Customer** | Storefront & Booking | `/booking/?slug={slug}` | `frontend/booking/index.html` | **Single canonical physical booking page** (6-step funnel) |
| **Customer** | Directory & Search | `/salons.html` | `frontend/salons.html` | City/district search, rating, salon cards |
| **Customer** | Customer Self-Registration| `/login.html#register` | `frontend/login.html` | Saudi mobile validation (`05XXXXXXXX`), role = `CUSTOMER` |
| **Customer** | Forgot Password Request | `/forgot-password.html` | `frontend/forgot-password.html` | Dispatches 60-minute recovery token |
| **Customer** | Reset Password Submit | `/reset-password.html?token={t}` | `frontend/reset-password.html` | Sets new password via single-use token |
| **Public** | Platform Landing Page | `/` or `/index.html` | `frontend/index.html` | Marketing hero, salon discovery, business onboarding CTA |
| **Public** | Salon Business Sign-Up | `/register.html` | `frontend/register.html` | Multi-step onboarding for salon owners |
| **Public** | Unified Login Gateway | `/login.html` | `frontend/login.html` | Single authentication form for all roles |

### 1.2 Route Aliases & HTTP Redirects
- `/book`, `/book.html`, `/booking.html` &rarr; `302 Redirect` to `/booking/?slug={slug}` (preserves all query parameters and hash fragments).

---

## 2. REST API Endpoint Signatures

### 2.1 Authentication & Password Recovery (`/api/auth/*`)

| Method | Endpoint | Access | Request Payload Signature | Response Signature |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | `{ email: string, password: string, rememberMe?: boolean }` | `{ accessToken: string, tokenType: "Bearer", expiresIn: number, user: UserDTO }` |
| `POST` | `/api/auth/register` | Public | `{ fullName: string, phone: string, email: string, password: string }` | `{ accessToken: string, tokenType: "Bearer", user: UserDTO (role: CUSTOMER) }` |
| `POST` | `/api/auth/register-salon` | Public | `{ ownerFullName, ownerEmail, ownerPhone, ownerPassword, shopName, city, district }` | `{ accessToken: string, user: UserDTO (role: SALON_OWNER, salonId) }` |
| `POST` | `/api/auth/forgot-password` | Public | `{ email: string }` | `{ message: string, devResetLink?: string }` |
| `POST` | `/api/auth/reset-password` | Public | `{ token: string, newPassword: string }` | `{ message: string }` |
| `GET` | `/api/auth/me` | Bearer | *None* | `UserDTO` |

---

### 2.2 Public Storefronts & Catalogs (`/api/shops/*`)

| Method | Endpoint | Access | Query / Path Params | Response Signature |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/shops` | Public | *None* | `List<ShopDTO>` |
| `GET` | `/api/shops/{id}` | Public | `id: Long` | `ShopDTO` |
| `GET` | `/api/shops/by-slug/{slug}` | Public | `slug: string` | `ShopDTO` |
| `GET` | `/api/shops/{id}/barbers` | Public | `id: Long` | `List<BarberDTO>` |
| `GET` | `/api/shops/{id}/services` | Public | `id: Long` | `List<ServiceItemDTO>` |
| `GET` | `/api/shops/{id}/gallery` | Public | `id: Long` | `List<SalonImageDTO>` |

---

### 2.3 Customer Slot Engine & Booking Funnel (`/api/slots/*`, `/api/bookings/*`)

| Method | Endpoint | Access | Request Payload Signature | Response Signature |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/slots/hold` | Public/Auth | `{ shopId: Long, barberId: Long, serviceId: Long, customerId: Long, slotStart: ISO8601, slotEnd: ISO8601 }` | `Booking` (`status: HOLD`, `holdExpiresAt: NOW+5m`) *(409 if locked/conflict)* |
| `POST` | `/api/bookings/{id}/confirm` | Public/Auth | Path: `id: Long` | `Booking` (`status: CONFIRMED`) |
| `GET` | `/api/bookings/{id}/calendar` | Public | Path: `id: Long` | `text/calendar` (RFC-5545 `.ics` with UTC timestamps & -PT1H alarm) |
| `POST` | `/api/bookings/public` | Public | `{ shopId: Long, barberId: Long, serviceId: Long, customerName: string, customerPhone: string, customerEmail: string, slotStart: ISO8601, slotEnd: ISO8601, notes?: string }` | `Booking` (`status: CONFIRMED`) *(400/409 on overlap)* |

---

### 2.4 Multi-Tenant Salon Portal Operations (`/api/portal/*`)
*All endpoints require Bearer JWT token (`SALON_OWNER` or `SALON_STAFF`).*

| Method | Endpoint | Allowed Roles | Request Signature | Response Signature |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/portal/bookings` | Owner, Staff | Query: `barberId?: Long, date?: YYYY-MM-DD` | `List<Booking>` *(Staff scoped to own `barberId`)* |
| `PATCH` | `/api/portal/bookings/{id}/status` | Owner, Staff | `{ status: "ARRIVED" \| "IN_SERVICE" \| "COMPLETED" \| "NO_SHOW" \| "CANCELLED", reason?: string }` | `Booking` *(Staff forbidden from cancelling: 403)* |
| `POST` | `/api/portal/bookings/walk-in` | Owner, Staff | `{ barberId: Long, serviceId: Long, customerName: string, customerPhone: string, slotStart: ISO8601, slotEnd: ISO8601 }` | `Booking` (`status: CONFIRMED`, `walkIn: true`) |
| `GET` | `/api/portal/analytics/revenue` | Owner only | *None* | `{ todayEarnings: number, weekEarnings: number, monthEarnings: number, totalEarnings: number, totalCompletedBookings: number, currency: "SAR" }` |
| `GET` | `/api/portal/staff` | Owner, Staff | *None* | `List<Barber>` |
| `POST` | `/api/portal/staff` | Owner only | `{ name: string, specialty?: string, phone?: string, email?: string, skills?: string }` | `Barber` |
| `PUT` | `/api/portal/staff/{id}` | Owner only | `{ name: string, specialty?: string, phone?: string, email?: string, skills?: string }` | `Barber` |
| `PATCH` | `/api/portal/staff/{id}/status` | Owner only | `{ status: string, isActive: boolean }` | `Barber` *(409 Conflict if active future appointments exist)* |
| `POST` | `/api/portal/staff/{id}/avatar` | Owner only | `multipart/form-data` (`file`) | `{ avatarUrl: string }` |
| `PATCH` | `/api/portal/shift` | Staff only | `{ status: "ONLINE" \| "OFFLINE" }` | `{ status: string, isActive: boolean }` |
| `GET` | `/api/portal/services` | Owner, Staff | *None* | `List<ServiceItem>` |
| `POST` | `/api/portal/services` | Owner only | `{ name: string, price: number, durationMinutes: number, bufferMinutes: number, category: string, isVisible: boolean }` | `ServiceItem` |
| `PUT` | `/api/portal/services/{id}` | Owner only | Service fields update | `ServiceItem` |
| `GET` | `/api/portal/settings` | Owner only | *None* | `Shop` |
| `PUT` | `/api/portal/settings` | Owner only | `{ name, phone, city, district, fullAddress, operatingHoursJson, autoConfirmWalkins }` | `Shop` |
| `GET` | `/api/portal/gallery` | Owner only | *None* | `List<SalonImage>` |
| `POST` | `/api/portal/gallery/upload` | Owner only | `multipart/form-data` (`image`) | `SalonImage` *(400 Bad Request if >= 5 photos cap reached)* |
| `DELETE` | `/api/portal/gallery/{id}` | Owner only | Path: `id: Long` | `204 No Content` |

---

### 2.5 Super Admin Platform Operations (`/api/admin/*`, `/api/shops/{id}/status`)
*All endpoints require Bearer JWT token with `SUPER_ADMIN` role.*

| Method | Endpoint | Purpose | Request Payload | Response Signature |
| :--- | :--- | :--- | :--- | :--- |
| `PATCH` | `/api/shops/{id}/status` | Moderate salon status | `{ status: "ACTIVE" \| "PENDING" \| "SUSPENDED", reason?: string }` | `ShopDTO` |
| `GET` | `/api/admin/audit-logs` | Query security audit log | Query: `page, limit, shopId, action` | `Page<AuditLog>` |
| `GET` | `/api/admin/users` | List internal platform staff | *None* | `List<UserDTO>` |
| `POST` | `/api/admin/users/invite` | Invite internal admin staff | `{ email, fullName, role: "SUPER_ADMIN" \| "SUPPORT_AGENT" }` | `UserDTO` |
| `GET` | `/api/admin/permissions` | Get RBAC permission matrix | *None* | `Map<Role, List<String>>` |
| `PUT` | `/api/admin/permissions` | Update screen permissions | `{ role, permissions: string[] }` | `200 OK` |

---

### 2.6 Real-Time WebSocket Channel
- **Protocol**: STOMP over WebSocket (`/ws`)
- **Subscription Topic**: `/topic/shop/{shopId}/slots`
- **Broadcast Events**: Slot Holds (`SLOT_HELD`), Booking Confirmations (`BOOKING_CONFIRMED`), Cancellations (`SLOT_RELEASED`), Walk-In Arrivals (`WALKIN_CONFIRMED`).
