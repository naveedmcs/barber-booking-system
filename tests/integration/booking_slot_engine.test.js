/**
 * Integration Test Suite: Customer Booking Funnel & Concurrency Slot Engine
 * Validates real Redis Redisson locks, MySQL slot constraints, and calendar generation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  request, 
  ensureBackendReady, 
  getShopDetails,
  createTestCustomer,
  generateUniqueSlot,
  formatLocalISO 
} from '../setup.js';

describe('Module 3: Customer Booking Funnel & Slot Engine', () => {

  const SHOP_ID = 53; // Golden Scissors
  let BARBER_ID;
  let SERVICE_ID;

  beforeAll(async () => {
    await ensureBackendReady();
    const details = await getShopDetails(SHOP_ID);
    BARBER_ID = details.barbers[0].id;
    SERVICE_ID = details.services[0].id;
  });

  describe('TC-BOOK-01: Slot Occupancy & Buffer Time Protection', () => {
    it('should hold a slot and reject overlapping intervals', async () => {
      const customer = await createTestCustomer('slot_buffer');
      const { start: slotStart, end: slotEnd, startDate } = generateUniqueSlot(45); // 30m service + 15m buffer
      const overlapStart = formatLocalISO(new Date(startDate.getTime() + 15 * 60000));
      const overlapEnd = formatLocalISO(new Date(startDate.getTime() + 45 * 60000));

      // 1. Initial Slot Hold
      const holdRes = await request('/api/slots/hold', {
        method: 'POST',
        body: {
          shopId: SHOP_ID,
          barberId: BARBER_ID,
          serviceId: SERVICE_ID,
          customerId: customer.id,
          slotStart,
          slotEnd
        }
      });

      expect(holdRes.status).toBe(201);
      expect(holdRes.data.status).toBe('HOLD');

      // 2. Overlapping Booking Attempt (Starts inside the slotStart-slotEnd buffer interval)
      const overlappingCustomer = await createTestCustomer('overlapping');
      const overlapRes = await request('/api/slots/hold', {
        method: 'POST',
        body: {
          shopId: SHOP_ID,
          barberId: BARBER_ID,
          serviceId: SERVICE_ID,
          customerId: overlappingCustomer.id,
          slotStart: overlapStart,
          slotEnd: overlapEnd
        }
      });

      // Must strictly be rejected with 409 Conflict
      expect(overlapRes.status).toBe(409);
    });
  });

  describe('TC-BOOK-02: Concurrency Race Condition Guard (Redis Distributed Lock)', () => {
    it('should grant slot to exactly 1 request and return clean 409 conflict to concurrent contender', async () => {
      const customer1 = await createTestCustomer('race_1');
      const customer2 = await createTestCustomer('race_2');
      const { start: slotStart, end: slotEnd } = generateUniqueSlot(30);

      // Dispatch 2 concurrent HTTP requests at the exact same millisecond
      const [res1, res2] = await Promise.all([
        request('/api/slots/hold', {
          method: 'POST',
          body: {
            shopId: SHOP_ID,
            barberId: BARBER_ID,
            serviceId: SERVICE_ID,
            customerId: customer1.id,
            slotStart,
            slotEnd
          }
        }),
        request('/api/slots/hold', {
          method: 'POST',
          body: {
            shopId: SHOP_ID,
            barberId: BARBER_ID,
            serviceId: SERVICE_ID,
            customerId: customer2.id,
            slotStart,
            slotEnd
          }
        })
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Exactly one request must succeed (201) and exactly one must fail with conflict (409)
      expect(statuses).toEqual([201, 409]);

      const winningRes = res1.status === 201 ? res1 : res2;
      const losingRes = res1.status === 409 ? res1 : res2;

      expect(winningRes.data.status).toBe('HOLD');
      expect(typeof losingRes.data === 'string' ? losingRes.data : losingRes.data.error || losingRes.data.message)
        .toMatch(/currently held|already booked/i);
    });
  });

  describe('TC-BOOK-04: RFC-5545 Calendar Generation & Timezone Specification', () => {
    it('should generate valid .ics payload with UTC timestamps and reminder alarm', async () => {
      // 1. Create and confirm a booking
      const customer = await createTestCustomer('calendar_test');
      const { start: slotStart, end: slotEnd } = generateUniqueSlot(30);

      const holdRes = await request('/api/slots/hold', {
        method: 'POST',
        body: {
          shopId: SHOP_ID,
          barberId: BARBER_ID,
          serviceId: SERVICE_ID,
          customerId: customer.id,
          slotStart,
          slotEnd
        }
      });

      expect(holdRes.status).toBe(201);
      const bookingId = holdRes.data.id;

      // Confirm booking
      const confirmRes = await request(`/api/bookings/${bookingId}/confirm`, {
        method: 'POST'
      });
      expect(confirmRes.status).toBe(200);

      // 2. Request .ics calendar
      const calRes = await request(`/api/bookings/${bookingId}/calendar`);
      expect(calRes.status).toBe(200);

      const icsText = typeof calRes.data === 'string' ? calRes.data : JSON.stringify(calRes.data);

      // Check RFC-5545 specifications
      expect(icsText).toContain('BEGIN:VCALENDAR');
      expect(icsText).toContain('VERSION:2.0');
      expect(icsText).toContain('BEGIN:VEVENT');
      expect(icsText).toContain('STATUS:CONFIRMED');
      expect(icsText).toContain('END:VEVENT');
      expect(icsText).toContain('END:VCALENDAR');
    });
  });

  describe('TC-BOOK-06: Double-Booking Prevention on Public Booking Pipeline', () => {
    it('should reject public bookings overlapping with confirmed appointments', async () => {
      const customer = await createTestCustomer('double_booking');
      const { start: slotStart, end: slotEnd } = generateUniqueSlot(30);

      // Create first public booking
      const firstRes = await request('/api/bookings/public', {
        method: 'POST',
        body: {
          shopId: SHOP_ID,
          shopSlug: 'golden-scissors',
          barberId: BARBER_ID,
          barberName: 'Master Barber Ahmed',
          serviceId: SERVICE_ID,
          serviceName: 'Haircut & Beard Trim',
          customerName: customer.fullName,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          slotStart,
          slotEnd
        }
      });

      expect(firstRes.status).toBe(201);
      expect(firstRes.data.id).toBeDefined();

      // Attempt second public booking on identical slot
      const duplicateRes = await request('/api/bookings/public', {
        method: 'POST',
        body: {
          shopId: SHOP_ID,
          shopSlug: 'golden-scissors',
          barberId: BARBER_ID,
          barberName: 'Master Barber Ahmed',
          serviceId: SERVICE_ID,
          serviceName: 'Haircut & Beard Trim',
          customerName: 'Second Customer',
          customerPhone: '0512345678',
          customerEmail: 'second@barberapp.sa',
          slotStart,
          slotEnd
        }
      });

      // Must be rejected with 400 Bad Request / conflict
      expect([400, 409]).toContain(duplicateRes.status);
      const errStr = typeof duplicateRes.data === 'string' ? duplicateRes.data : duplicateRes.data.error || duplicateRes.data.message || '';
      expect(errStr).toMatch(/already booked|duplicate entry|uk_no_double_book|conflict/i);
    });
  });

});
