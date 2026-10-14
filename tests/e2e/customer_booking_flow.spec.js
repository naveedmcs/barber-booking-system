/**
 * End-to-End Test Suite: Customer Booking Funnel Journey
 * Validates the complete customer lifecycle from catalog selection to .ics calendar receipt
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  request, 
  ensureBackendReady, 
  createTestCustomer 
} from '../setup.js';

describe('Module 4: End-to-End Customer Booking Flow (TC-E2E-01)', () => {

  const SHOP_ID = 53; // Golden Scissors canonical salon ID

  beforeAll(async () => {
    await ensureBackendReady();
  });

  it('should complete the entire 6-step customer booking funnel from storefront to .ics calendar', async () => {
    // -------------------------------------------------------------
    // Step 1: Customer visits canonical storefront and inspects shop
    // -------------------------------------------------------------
    const shopRes = await request(`/api/shops/${SHOP_ID}`);
    expect(shopRes.status).toBe(200);
    expect(shopRes.data.id).toBe(SHOP_ID);
    expect(shopRes.data.slug).toBe('golden-scissors');

    // -------------------------------------------------------------
    // Step 2: Customer views and selects from services catalog
    // -------------------------------------------------------------
    const servicesRes = await request(`/api/shops/${SHOP_ID}/services`);
    expect(servicesRes.status).toBe(200);
    expect(Array.isArray(servicesRes.data)).toBe(true);
    expect(servicesRes.data.length).toBeGreaterThanOrEqual(1);

    const selectedService = servicesRes.data[0];
    expect(selectedService.id).toBeDefined();
    expect(selectedService.price).toBeGreaterThan(0);

    // -------------------------------------------------------------
    // Step 3: Customer views active staff roster and picks barber
    // -------------------------------------------------------------
    const barbersRes = await request(`/api/shops/${SHOP_ID}/barbers`);
    expect(barbersRes.status).toBe(200);
    expect(Array.isArray(barbersRes.data)).toBe(true);
    expect(barbersRes.data.length).toBeGreaterThanOrEqual(1);

    const selectedBarber = barbersRes.data.find(b => b.isActive !== false) || barbersRes.data[0];
    expect(selectedBarber.id).toBeDefined();

    // -------------------------------------------------------------
    // Step 4: Customer inputs verified contact credentials
    // -------------------------------------------------------------
    const customer = await createTestCustomer('e2e_journey');
    expect(customer.id).toBeDefined();
    expect(customer.phone).toMatch(/^05[0-9]{8}$/);

    // -------------------------------------------------------------
    // Step 5: Customer acquires a 5-minute temporary slot hold
    // -------------------------------------------------------------
    const uniqueDay = 20 + Math.floor(Math.random() * 5);
    const uniqueHour = 10 + Math.floor(Math.random() * 8);
    const slotStart = `2026-11-${uniqueDay}T${uniqueHour}:00:00`;
    const slotEnd = `2026-11-${uniqueDay}T${uniqueHour}:45:00`;

    const holdRes = await request('/api/slots/hold', {
      method: 'POST',
      body: {
        shopId: SHOP_ID,
        barberId: selectedBarber.id,
        serviceId: selectedService.id,
        customerId: customer.id,
        slotStart,
        slotEnd
      }
    });

    expect(holdRes.status).toBe(201);
    expect(holdRes.data.status).toBe('HOLD');
    expect(holdRes.data.id).toBeDefined();

    const bookingId = holdRes.data.id;

    // -------------------------------------------------------------
    // Step 6: Customer confirms checkout & finalizes booking
    // -------------------------------------------------------------
    const confirmRes = await request(`/api/bookings/${bookingId}/confirm`, {
      method: 'POST'
    });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.data.status).toBe('CONFIRMED');
    expect(confirmRes.data.id).toBe(bookingId);

    // -------------------------------------------------------------
    // Step 7: System issues downloadable RFC-5545 .ics Calendar File
    // -------------------------------------------------------------
    const calendarRes = await request(`/api/bookings/${bookingId}/calendar`);
    expect(calendarRes.status).toBe(200);

    const icsPayload = typeof calendarRes.data === 'string' ? calendarRes.data : JSON.stringify(calendarRes.data);

    expect(icsPayload).toContain('BEGIN:VCALENDAR');
    expect(icsPayload).toContain('VERSION:2.0');
    expect(icsPayload).toContain('BEGIN:VEVENT');
    expect(icsPayload).toContain('STATUS:CONFIRMED');
    expect(icsPayload).toContain(`UID:booking-${bookingId}@barberapp.sa`);
    expect(icsPayload).toContain('END:VEVENT');
    expect(icsPayload).toContain('END:VCALENDAR');
  });

});
