# API Reference & Endpoint Specification
**Project**: Salon & Barber Booking SaaS Platform  
**Base URL**: `http://localhost:8080` (or `https://api.yourdomain.com`)  
**Specification Version**: 1.0-BASELINE  
**Status**: Active Baseline  

---

## 1. Authentication & Security Endpoints

### 1.1 POST `/api/v1/auth/login`
Authenticates a user via email or Saudi mobile phone and password. Issues a stateless JWT bearer token.

- **Access**: Public
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "owner@goldenscissors.sa",
    "password": "Owner123!",
    "rememberMe": true
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": 2,
      "email": "owner@goldenscissors.sa",
      "fullName": "Tariq Al-Mansoor",
      "role": "SALON_OWNER",
      "salonId": 1,
      "salonName": "Golden Scissors Salon",
      "salonSlug": "golden-scissors",
      "active": true
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid email or password.
  - `403 Forbidden`: Account is suspended (`active: false`).

---

### 1.2 GET `/api/v1/auth/me`
Retrieves currently authenticated user profile based on Bearer token.

- **Access**: Authenticated (`Bearer <token>`)
- **Request Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK` (UserDTO)
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid token.

---

## 2. Shop Management & Onboarding Endpoints

### 2.1 POST `/api/shops/register`
Self-onboarding endpoint for new shop owners.

- **Access**: Public
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "ownerFullName": "Tariq Al-Mansoor",
    "ownerEmail": "owner@goldenscissors.sa",
    "ownerPassword": "OwnerPassword123!",
    "shopName": "Golden Scissors Salon",
    "phone": "0501234567",
    "region": "Riyadh Region",
    "district": "Olaya",
    "city": "Riyadh",
    "fullAddress": "King Fahd Road, Building 42, Olaya",
    "mapAddress": "7JQC+RP Riyadh",
    "subscriptionPlan": "MONTHLY"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": 1,
    "name": "Golden Scissors Salon",
    "slug": "golden-scissors-a1b2c3",
    "phone": "0501234567",
    "region": "Riyadh Region",
    "district": "Olaya",
    "city": "Riyadh",
    "fullAddress": "King Fahd Road, Building 42, Olaya",
    "mapAddress": "7JQC+RP Riyadh",
    "subscriptionPlan": "MONTHLY",
    "status": "PENDING",
    "loginUrl": "http://localhost:3000/dashboard/index.html?slug=golden-scissors-a1b2c3",
    "bookingUrl": "http://localhost:3000/book.html?slug=golden-scissors-a1b2c3",
    "loginQrCodeData": "data:image/png;base64,...",
    "bookingQrCodeData": "data:image/png;base64,..."
  }
  ```

---

### 2.2 GET `/api/shops`
Lists all registered shops across the platform.

- **Access**: Public / Super Admin
- **Response**: `200 OK` (Array of Shop entities)

---

### 2.3 GET `/api/shops/{id}`
Retrieves details of a single shop by primary key ID.

- **Access**: Public
- **Response**: `200 OK` (Shop entity)
- **Error Responses**: `404 Not Found`

---

### 2.4 GET `/api/shops/{id}/barbers`
Lists barbers assigned to the specified shop.

- **Access**: Public
- **Response**: `200 OK`
  ```json
  [
    {
      "id": 1,
      "name": "Master Barber Ahmed",
      "photoUrl": "https://..."
    }
  ]
  ```

---

### 2.5 GET `/api/shops/{id}/services`
Lists grooming services offered by the specified shop.

- **Access**: Public
- **Response**: `200 OK`
  ```json
  [
    {
      "id": 1,
      "name": "Haircut & Beard Trim",
      "description": "Standard haircut with beard styling",
      "price": 60.00,
      "durationMinutes": 30
    }
  ]
  ```

---

## 3. QR Code Export Endpoints

### 3.1 GET `/api/shops/{id}/qr/login`
Generates a QR code linking to the salon owner's private dashboard.

- **Parameters**: `format` (optional, `png` [default] or `svg`)
- **Response**: `image/png` or `image/svg+xml` byte stream

### 3.2 GET `/api/shops/{id}/qr/booking`
Generates a QR code linking to the shop's public customer booking page.

- **Parameters**: `format` (optional, `png` [default] or `svg`)
- **Response**: `image/png` or `image/svg+xml` byte stream

### 3.3 GET `/api/shops/{id}/qr/zip`
Packages PNG and SVG variants of both login and booking QR codes along with a plaintext `links.txt` into a `.zip` archive.

- **Response**: `application/zip` stream with filename `{slug}-qr-codes.zip`

---

## 4. Slot Booking & Reservation Endpoints

### 4.1 POST `/api/slots/hold`
Acquires a 5-minute Redis distributed lock and creates a database `HOLD` booking.

- **Access**: Public
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "shopId": 1,
    "barberId": 1,
    "serviceId": 1,
    "customerId": 1,
    "slotStart": "2026-10-15T14:00:00",
    "slotEnd": "2026-10-15T14:30:00"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": 10,
    "status": "HOLD",
    "slotStart": "2026-10-15T14:00:00",
    "slotEnd": "2026-10-15T14:30:00",
    "holdExpiresAt": "2026-10-15T14:05:00",
    "version": 0
  }
  ```
- **Error Responses**:
  - `409 Conflict`: Slot is currently held or already confirmed by another customer.

---

### 4.2 POST `/api/bookings/{id}/confirm`
Confirms an existing booking in `HOLD` status.

- **Access**: Public
- **Response**: `200 OK`
  ```json
  {
    "id": 10,
    "status": "CONFIRMED"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Booking is not in `HOLD` status or hold has expired.

---

### 4.3 GET `/api/bookings/{id}/calendar`
Generates and downloads an RFC-5545 `.ics` iCalendar invitation file for a confirmed booking.

- **Access**: Public
- **Response**: `200 OK`
  - Header: `Content-Type: text/calendar;charset=UTF-8`
  - Header: `Content-Disposition: attachment; filename="appointment-{id}.ics"`

---

## 5. Payment Gateway Webhook Endpoint

### 5.1 POST `/api/payments/webhook`
Callback receiver for payment gateway notifications (Moyasar, Mada, STC Pay).

- **Access**: Public (HMAC Authenticated)
- **Request Headers**:
  - `Content-Type: application/json`
  - `X-Webhook-Signature`: HMAC-SHA256 signature of `transactionId` using `payment.webhook.secret`
- **Request Body**:
  ```json
  {
    "shopId": 1,
    "transactionId": "tx_moyasar_99214",
    "amount": 20.00,
    "currency": "SAR",
    "status": "SUCCESS",
    "provider": "MOYASAR"
  }
  ```
- **Response**: `200 OK` ("Webhook processed successfully" or "Event already processed")
- **Error Responses**:
  - `401 Unauthorized`: Missing or invalid HMAC signature.
  - `404 Not Found`: Shop ID not found.

---

## 6. Real-Time WebSocket Broker

### 6.1 WS `/ws`
STOMP over SockJS endpoint for real-time live schedule synchronization.

- **Protocol**: STOMP 1.1 / 1.2 over WebSocket or SockJS fallback
- **Destination Broker**: `/topic`
- **Application Prefix**: `/app`
- **Subscriptions**:
  - Destination: `/topic/shop/{shopId}/slots`
  - Event Payload:
    ```json
    {
      "shopId": 1,
      "barberId": 1,
      "slotId": 10,
      "slotStart": "2026-10-15T14:00:00",
      "slotEnd": "2026-10-15T14:30:00",
      "eventType": "SLOT_HELD",
      "status": "HOLD"
    }
    ```
