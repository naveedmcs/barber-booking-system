#!/usr/bin/env bash
set -e

BASE_URL="${API_URL:-http://localhost:8080/api}"

echo "=================================================="
echo " E2E Validation Suite: Barber Booking SaaS Platform "
echo " Target API Base: ${BASE_URL}                      "
echo "=================================================="

command -v curl >/dev/null 2>&1 || { echo "[ERROR] curl is required."; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "[ERROR] jq is required."; exit 1; }

echo "[1/6] Registering new shop via POST /api/shops/register..."
REG_RESPONSE=$(curl -s -X POST "${BASE_URL}/shops/register" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerFullName": "Tariq Al-Mansoor",
    "ownerEmail": "owner-'$(date +%s)'@testbarber.sa",
    "ownerPassword": "SecurePassword123!",
    "shopName": "Golden Scissors E2E Test",
    "phone": "+9665'$(shuf -i 10000001-99999999 -n 1 2>/dev/null || echo "01234567")'",
    "region": "Riyadh Region",
    "district": "Olaya",
    "city": "Riyadh",
    "fullAddress": "King Fahd Road, Olaya",
    "subscriptionPlan": "MONTHLY"
  }')

SHOP_ID=$(echo "$REG_RESPONSE" | jq -r '.id // empty')
if [ -z "$SHOP_ID" ]; then
  echo "[FAIL] Shop registration failed. Output: $REG_RESPONSE"
  exit 1
fi
echo "[SUCCESS] Shop registered with ID: ${SHOP_ID}"

echo "[2/6] Triggering Moyasar Payment Webhook for Auto-Approval..."
TX_ID="tx_e2e_test_$(date +%s)"
SECRET="default_webhook_secret_key"
SIGNATURE=$(echo -n "$TX_ID" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.*= //')

WEBHOOK_RESP=$(curl -s -w "%{http_code}" -X POST "${BASE_URL}/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: ${SIGNATURE}" \
  -d '{
    "shopId": '"$SHOP_ID"',
    "transactionId": "'"$TX_ID"'",
    "amount": 20.00,
    "currency": "SAR",
    "status": "SUCCESS",
    "provider": "MOYASAR"
  }')

if [[ "$WEBHOOK_RESP" != *"200"* ]]; then
  echo "[FAIL] Webhook auto-approval failed. HTTP Code: $WEBHOOK_RESP"
  exit 1
fi
echo "[SUCCESS] Shop ID ${SHOP_ID} auto-approved via HMAC signed webhook."

echo "[3/6] Acquiring 5-minute slot hold via POST /api/slots/hold..."
SLOT_START="2026-10-15T14:00:00"
SLOT_END="2026-10-15T14:30:00"

HOLD_RESP=$(curl -s -X POST "${BASE_URL}/slots/hold" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": '"$SHOP_ID"',
    "barberId": 1,
    "serviceId": 1,
    "customerId": 1,
    "slotStart": "'"$SLOT_START"'",
    "slotEnd": "'"$SLOT_END"'"
  }')

BOOKING_ID=$(echo "$HOLD_RESP" | jq -r '.id // empty')
if [ -z "$BOOKING_ID" ]; then
  echo "[FAIL] Could not acquire slot hold. Output: $HOLD_RESP"
  exit 1
fi
echo "[SUCCESS] Slot locked with Booking ID: ${BOOKING_ID}"

echo "[4/6] Attempting duplicate hold on locked slot (Verifying 409 Conflict)..."
DUP_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/slots/hold" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": '"$SHOP_ID"',
    "barberId": 1,
    "serviceId": 1,
    "customerId": 2,
    "slotStart": "'"$SLOT_START"'",
    "slotEnd": "'"$SLOT_END"'"
  }')

if [ "$DUP_HTTP_CODE" -eq 409 ]; then
  echo "[SUCCESS] Duplicate slot hold correctly rejected with HTTP 409 Conflict."
else
  echo "[FAIL] Expected HTTP 409 Conflict, but received HTTP ${DUP_HTTP_CODE}"
  exit 1
fi

echo "[5/6] Confirming booking via POST /api/bookings/${BOOKING_ID}/confirm..."
CONFIRM_RESP=$(curl -s -X POST "${BASE_URL}/bookings/${BOOKING_ID}/confirm")
CONFIRMED_STATUS=$(echo "$CONFIRM_RESP" | jq -r '.status // empty')

if [ "$CONFIRMED_STATUS" != "CONFIRMED" ]; then
  echo "[FAIL] Booking confirmation failed. Output: $CONFIRM_RESP"
  exit 1
fi
echo "[SUCCESS] Booking ID ${BOOKING_ID} status updated to CONFIRMED."

echo "[6/6] Downloading .ics calendar file via GET /api/bookings/${BOOKING_ID}/calendar..."
ICS_CONTENT=$(curl -s "${BASE_URL}/bookings/${BOOKING_ID}/calendar")

if [[ "$ICS_CONTENT" == *"BEGIN:VCALENDAR"* && "$ICS_CONTENT" == *"END:VCALENDAR"* ]]; then
  echo "[SUCCESS] Valid RFC-5545 .ics calendar stream received:"
  echo "--------------------------------------------------"
  echo "$ICS_CONTENT" | head -n 12
  echo "--------------------------------------------------"
else
  echo "[FAIL] Invalid .ics content received. Content: $ICS_CONTENT"
  exit 1
fi

echo "=================================================="
echo " ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY! "
echo "=================================================="
