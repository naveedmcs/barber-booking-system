# Salon & Barber Booking & Appointment Management System
## End-to-End User Guide & Operational Runbook

Welcome to the **Salon & Barber Booking System** manual. This document provides step-by-step instructions for Customers, Shop Owners, and Super Administrators.

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Customer Booking Journey (`/book/[slug]`)](#2-customer-booking-journey-bookslug)
3. [Shop Owner Live Schedule Journey (`/shop/schedule`)](#3-shop-owner-live-schedule-journey-shopschedule)
4. [Super Admin Management Journey (`/admin`)](#4-super-admin-management-journey-admin)
5. [API Endpoint Reference](#5-api-endpoint-reference)
6. [Automated E2E Testing Runbook](#6-automated-e2e-testing-runbook)

---

## 1. System Architecture Overview

The platform is a multi-tenant SaaS application designed for Saudi Arabia and the GCC region:
- **Frontend**: Next.js 14 (TypeScript, Tailwind CSS, SockJS / STOMP WebSockets).
- **Backend**: Spring Boot 3.3 (Java 21, Redisson Distributed Locking, Flyway, WebSocket Broker).
- **Database & Cache**: MySQL 8.0 (`barber_saas`), Redis 7.0 (distributed slot locks).

---

## 2. Customer Booking Journey (`/book/[slug]`)

### URL Format
`http://localhost:3000/book/golden-scissors`

### Workflow Steps
1. **Select Barber**:
   - Browse shop barbers with ratings and avatars.
   - Click **Choose Barber** to proceed.
2. **Select Service**:
   - View services, durations (e.g. 30 mins), and prices in SAR (e.g. 60 SAR).
   - Click **Select** on the desired service.
3. **Select Date & Time Slot**:
   - Choose appointment date.
   - Click an available time slot.
   - **5-Minute Slot Hold**: Selecting a slot triggers a Redis distributed lock and starts a 5-minute countdown timer.
4. **Enter Customer Information**:
   - Provide Full Name, Saudi Phone (`+966 5XXXXXXXX` or `05XXXXXXXX`), and Email Address.
   - Click **Confirm Appointment**.
5. **Confirmation & Actions**:
   - View booking summary.
   - **📅 Add to Calendar (.ics)**: Downloads standard RFC-5545 `.ics` file for Google/Apple/Outlook calendars.
   - **📱 Download Entry QR Code**: Downloads shop entry QR code SVG/PNG.

---

## 3. Shop Owner Live Schedule Journey (`/shop/schedule`)

### URL Format
`http://localhost:3000/shop/schedule`

### Key Features
- **Real-Time Live Sync**: Connects to WebSockets at `/ws` and subscribes to `/topic/shop/{id}/slots`. Live notifications appear when a customer reserves or holds a slot.
- **Slot Status Indicators**:
  - `AVAILABLE` (Green): Open for booking.
  - `HOLD` (Amber/Pulsing): Held for 5 minutes during customer checkout.
  - `CONFIRMED` (Blue): Paid / booked appointment.
  - `BLOCKED` (Gray): Barber break or holiday.
- **Walk-in Reservation Modal**:
  - Click **+ Add Walk-in Customer**.
  - Fill in Customer Name, Phone, Barber, Time Slot, and Service.
  - Instantly reserves the slot on behalf of walk-in customers.

---

## 4. Super Admin Management Journey (`/admin`)

### URL Format
`http://localhost:3000/admin`

### Key Features
- **Platform Overview Cards**: Monitor Total Shops, Active Subscriptions, Monthly Revenue (SAR), and Auto-Approved Shops count.
- **Shop Overrides**:
  - **Manual Approve / Reactivate**: Instantly activates pending or suspended shops.
  - **Suspend**: Suspends shop operations in case of compliance or payment issues.
- **System Audit Log Viewer**:
  - Views all administrative and automated actions (e.g. `SHOP_AUTO_APPROVED`, `SHOP_SUSPENDED`).
  - Includes timestamp, user email, shop name, action type, IP address, and details.
  - **📥 Export CSV**: Downloads full audit trail in CSV format.

---

## 5. API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/shops/register` | Register a new shop & owner |
| `POST` | `/api/payments/webhook` | Moyasar webhook for payment auto-approval |
| `POST` | `/api/slots/hold` | Acquire 5-minute slot lock |
| `POST` | `/api/bookings/{id}/confirm` | Confirm booking after payment |
| `GET` | `/api/bookings/{id}/calendar` | Download RFC-5545 `.ics` calendar file |
| `WS` | `/ws` | STOMP WebSocket broker endpoint |

---

## 6. Automated E2E Testing Runbook

To execute the automated end-to-end verification suite against a running backend:

```bash
# Make script executable
chmod +x scripts/verify-e2e.sh

# Run E2E test suite
./scripts/verify-e2e.sh
```

### What `verify-e2e.sh` Validates:
1. Registers a new shop via `POST /api/shops/register`.
2. Sends an HMAC-signed mock Moyasar webhook to `POST /api/payments/webhook` to verify auto-approval.
3. Acquires a 5-minute slot hold via `POST /api/slots/hold`.
4. Attempts a duplicate hold on the same slot to verify **HTTP 409 Conflict** rejection.
5. Confirms the booking via `POST /api/bookings/{id}/confirm`.
6. Downloads and parses the `.ics` calendar file stream.
