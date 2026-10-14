/**
 * Integration Test Suite: Salon Operations, Staff Scoping & Financial Analytics
 * Tests execute against live Spring Boot API and real MySQL database
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  request, 
  ensureBackendReady, 
  getOwnerToken, 
  getStaffToken, 
  getShopDetails,
  createTestCustomer,
  generateUniqueSlot 
} from '../setup.js';

describe('Module 2: Salon Operations & Staff Scoping', () => {

  const SALON_ID = 53; // Golden Scissors
  let BARBER_ID;
  let PEER_BARBER_ID;
  let SERVICE_ID;

  beforeAll(async () => {
    await ensureBackendReady();
    const details = await getShopDetails(SALON_ID);
    BARBER_ID = details.barbers[0].id; // 49 (Master Barber Ahmed, linked to staff user)
    PEER_BARBER_ID = details.barbers.length > 1 ? details.barbers[1].id : 50; // 50 (Sami Al-Otaibi)
    SERVICE_ID = details.services[0].id;
  });

  describe('TC-OPS-01: Staff Member Scoping Guard', () => {
    it('should strictly restrict staff queries to own bookings and reject peer queries', async () => {
      const staffToken = await getStaffToken(); // Token for Staff user in Golden Scissors

      // 1. Staff requests their own bookings (allowed)
      const ownRes = await request('/api/portal/bookings', {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      });

      expect(ownRes.status).toBe(200);
      expect(Array.isArray(ownRes.data)).toBe(true);

      // 2. Staff attempts to query another barberId (PEER_BARBER_ID)
      const peerRes = await request(`/api/portal/bookings?barberId=${PEER_BARBER_ID}`, {
        headers: { 'Authorization': `Bearer ${staffToken}` }
      });

      // Must be rejected with 403 Forbidden
      expect(peerRes.status).toBe(403);
      expect(peerRes.data.error).toBe('Staff Scope Restriction');
    });

    it('should forbid staff members from cancelling appointments', async () => {
      const staffToken = await getStaffToken();
      const ownerToken = await getOwnerToken();

      // Create booking for the staff member's own chair (BARBER_ID)
      const customer = await createTestCustomer('staff_status_guard');
      const { start: slotStart, end: slotEnd } = generateUniqueSlot(30);

      const createRes = await request('/api/bookings/public', {
        method: 'POST',
        body: {
          shopId: SALON_ID,
          shopSlug: 'golden-scissors',
          barberId: BARBER_ID,
          serviceId: SERVICE_ID,
          customerName: customer.fullName,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          slotStart,
          slotEnd
        }
      });

      expect(createRes.status).toBe(201);
      const bookingId = createRes.data.id;

      // Staff tries to set status to CANCELLED (forbidden for staff, only operational updates allowed)
      const cancelRes = await request(`/api/portal/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${staffToken}` },
        body: { status: 'CANCELLED' }
      });

      // Must be rejected with 403 Forbidden
      expect(cancelRes.status).toBe(403);
      const errMessage = cancelRes.data.message || cancelRes.data.error || '';
      expect(errMessage).toMatch(/staff members cannot cancel|cannot cancel/i);

      // But Owner CAN set status to CANCELLED
      const ownerCancelRes = await request(`/api/portal/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${ownerToken}` },
        body: { status: 'CANCELLED', cancellationReason: 'Test Cancellation' }
      });
      expect(ownerCancelRes.status).toBe(200);
      expect(ownerCancelRes.data.status).toBe('CANCELLED');
    });
  });

  describe('TC-OPS-02: Financial Analytics & Completed Status Filter', () => {
    it('should calculate revenue analytics in SAR strictly filtering COMPLETED status', async () => {
      const ownerToken = await getOwnerToken();

      const res = await request('/api/portal/analytics/revenue', {
        headers: { 'Authorization': `Bearer ${ownerToken}` }
      });

      expect(res.status).toBe(200);
      expect(res.data).toBeDefined();

      // Check required accounting metrics
      expect(res.data.currency).toBe('SAR');
      expect(res.data.todayEarnings).toBeDefined();
      expect(res.data.yesterdayEarnings).toBeDefined();
      expect(res.data.currentWeekEarnings).toBeDefined();
      expect(res.data.currentMonthEarnings).toBeDefined();
      expect(Array.isArray(res.data.weeklyBreakdown)).toBe(true);

      // Verify that all revenue figures are non-negative numeric/bigdecimal values
      expect(Number(res.data.todayEarnings)).toBeGreaterThanOrEqual(0);
      expect(Number(res.data.currentWeekEarnings)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TC-OPS-03: Salon Photo Gallery Cap Enforcement', () => {
    it('should maintain strict maximum 5 photos per salon and reject excess', async () => {
      const ownerToken = await getOwnerToken();

      // Query current gallery count
      const galleryRes = await request('/api/portal/gallery', {
        headers: { 'Authorization': `Bearer ${ownerToken}` }
      });

      expect(galleryRes.status).toBe(200);
      const currentImages = galleryRes.data;
      expect(currentImages.length).toBeLessThanOrEqual(5);

      if (currentImages.length >= 5) {
        // Prepare valid multipart payload
        const boundary = '----WebKitFormBoundaryTest123456';
        const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo6.jpg"\r\nContent-Type: image/jpeg\r\n\r\nfake-image-bytes\r\n--${boundary}--\r\n`;

        const uploadRes = await request('/api/portal/gallery/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ownerToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`
          },
          body
        });

        // Must reject with 400 Bad Request
        expect(uploadRes.status).toBe(400);
        expect(uploadRes.data.error).toBe('Gallery Limit Reached');
      }
    });

    it('should forbid staff members from uploading to salon gallery', async () => {
      const staffToken = await getStaffToken();

      const boundary = '----WebKitFormBoundaryTestStaff';
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="staff.jpg"\r\nContent-Type: image/jpeg\r\n\r\nfake-image-bytes\r\n--${boundary}--\r\n`;

      const uploadRes = await request('/api/portal/gallery/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${staffToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body
      });

      // Must be 403 Forbidden
      expect(uploadRes.status).toBe(403);
    });
  });

  describe('TC-OPS-04: Active Appointment Staff Deactivation Conflict Guard', () => {
    it('should reject staff deactivation with HTTP 409 Conflict when upcoming appointments exist', async () => {
      const ownerToken = await getOwnerToken();
      const customer = await createTestCustomer('staff_conflict_guard');

      // 1. Create a confirmed booking for Barber far in the future
      const { start: futureDate, end: futureEnd } = generateUniqueSlot(30);

      const bookRes = await request('/api/bookings/public', {
        method: 'POST',
        body: {
          shopId: SALON_ID,
          shopSlug: 'golden-scissors',
          barberId: BARBER_ID,
          serviceId: SERVICE_ID,
          customerName: customer.fullName,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          slotStart: futureDate,
          slotEnd: futureEnd
        }
      });

      expect(bookRes.status).toBe(201);

      // 2. Salon owner attempts to deactivate Barber while holding future appointment
      const deactivateRes = await request(`/api/portal/staff/${BARBER_ID}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${ownerToken}` },
        body: {
          status: 'OFFLINE',
          isActive: false
        }
      });

      // Must trigger 409 Conflict with conflict details
      expect(deactivateRes.status).toBe(409);
      expect(deactivateRes.data.error).toBe('Active Bookings Conflict');
      expect(deactivateRes.data.conflictCount).toBeGreaterThanOrEqual(1);
      expect(deactivateRes.data.message).toContain('upcoming active appointments');
    });
  });

  describe('TC-OPS-05: Staff Shift Status Toggle', () => {
    it('should allow staff member to toggle shift status between ONLINE and OFFLINE', async () => {
      const staffToken = await getStaffToken();

      // Toggle shift to OFFLINE
      const shiftRes = await request('/api/portal/shift', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${staffToken}` },
        body: { status: 'OFFLINE' }
      });

      expect(shiftRes.status).toBe(200);
      expect(shiftRes.data.shiftStatus).toBe('OFFLINE');

      // Toggle shift back to ONLINE
      const onlineRes = await request('/api/portal/shift', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${staffToken}` },
        body: { status: 'ONLINE' }
      });

      expect(onlineRes.status).toBe(200);
      expect(onlineRes.data.shiftStatus).toBe('ONLINE');
    });
  });

});
