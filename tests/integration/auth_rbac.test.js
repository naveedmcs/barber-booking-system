/**
 * Integration Test Suite: Authentication, Registration & RBAC Boundaries
 * Tests execute against live Spring Boot API and real MySQL database
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { 
  request, 
  ensureBackendReady, 
  getAdminToken, 
  getOwnerToken, 
  getStaffToken, 
  createTestCustomer,
  generateSaudiPhone 
} from '../setup.js';

describe('Module 1: Authentication & RBAC Boundaries', () => {

  beforeAll(async () => {
    await ensureBackendReady();
  });

  describe('TC-AUTH-01: Role Escalation Tamper Guard', () => {
    it('should ignore role payload tamper and force CUSTOMER role on public registration', async () => {
      const email = `hacker_${Date.now()}@barberapp.sa`;
      const phone = generateSaudiPhone();

      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: 'Security Tester',
          phone,
          email,
          password: 'Password123!',
          role: 'SUPER_ADMIN' // Malicious attempt to escalate role
        }
      });

      expect(res.status).toBe(201);
      expect(res.data).toBeDefined();
      expect(res.data.user).toBeDefined();
      // Role must strictly be CUSTOMER, never SUPER_ADMIN
      expect(res.data.user.role).toBe('CUSTOMER');
      expect(res.data.accessToken).toBeDefined();
    });

    it('should prevent public registration from assigning SALON_STAFF role', async () => {
      const email = `fake_staff_${Date.now()}@barberapp.sa`;
      const phone = generateSaudiPhone();

      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: 'Fake Staff',
          phone,
          email,
          password: 'Password123!',
          role: 'SALON_STAFF'
        }
      });

      expect(res.status).toBe(201);
      expect(res.data.user.role).toBe('CUSTOMER');
    });
  });

  describe('TC-AUTH-02: Multi-Role Credential Issuance & Attributes', () => {
    it('should authenticate SUPER_ADMIN with valid token and platform claims', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'admin@barberapp.sa',
          password: 'Admin123!'
        }
      });

      expect(res.status).toBe(200);
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.user.role).toBe('SUPER_ADMIN');
      expect(res.data.user.email).toBe('admin@barberapp.sa');
    });

    it('should authenticate SALON_OWNER and bind to active salon tenant ID', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'owner@goldenscissors.sa',
          password: 'Owner123!'
        }
      });

      expect(res.status).toBe(200);
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.user.role).toBe('SALON_OWNER');
      expect(res.data.user.salonId).toBe(53);
    });

    it('should authenticate SALON_STAFF and bind to assigned salon', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'staff@goldenscissors.sa',
          password: 'Staff123!'
        }
      });

      expect(res.status).toBe(200);
      expect(res.data.accessToken).toBeDefined();
      expect(res.data.user.role).toBe('SALON_STAFF');
      expect(res.data.user.salonId).toBe(53);
    });

    it('should reject invalid credentials with HTTP 401 Unauthorized', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'admin@barberapp.sa',
          password: 'WrongPassword999!'
        }
      });

      expect(res.status).toBe(401);
      expect(res.data.error).toBe('Invalid credentials');
    });
  });

  describe('TC-AUTH-03: Cryptographic Password Reset Lifecycle', () => {
    it('should issue token, allow reset, and strictly prevent token re-use', async () => {
      // 1. Create a fresh test customer
      const customer = await createTestCustomer('reset_flow');

      // 2. Request forgot-password
      const forgotRes = await request('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: customer.email }
      });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.data.token).toBeDefined();
      expect(forgotRes.data.expiresInMinutes).toBe(60);

      const resetToken = forgotRes.data.token;

      // 3. Reset password using the valid token
      const newPassword = 'BrandNewPassword456!';
      const resetRes = await request('/api/auth/reset-password', {
        method: 'POST',
        body: {
          token: resetToken,
          newPassword
        }
      });

      expect(resetRes.status).toBe(200);
      expect(resetRes.data.message).toContain('Password updated successfully');

      // 4. Verify login with OLD password fails (401)
      const oldLoginRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: customer.email,
          password: customer.password
        }
      });
      expect(oldLoginRes.status).toBe(401);

      // 5. Verify login with NEW password succeeds (200)
      const newLoginRes = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: customer.email,
          password: newPassword
        }
      });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.data.accessToken).toBeDefined();

      // 6. Security Critical: Token Re-use must be rejected with HTTP 400 Bad Request
      const reuseRes = await request('/api/auth/reset-password', {
        method: 'POST',
        body: {
          token: resetToken,
          newPassword: 'YetAnotherPassword789!'
        }
      });
      expect(reuseRes.status).toBe(400);
      expect(reuseRes.data.error).toBe('Invalid or Expired Token');
    });
  });

  describe('TC-AUTH-04: Tenant Boundary Isolation', () => {
    it('should prevent Salon Owner from updating or deleting peer salon staff', async () => {
      const ownerToken = await getOwnerToken(); // Owner of Salon 53

      // Attempt to mutate staff member in another salon (or non-owned ID 99999)
      const tamperedRes = await request('/api/portal/staff/99999', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${ownerToken}` },
        body: {
          name: 'Hacked Barber',
          title: 'Master Hacker',
          phone: '0501112233'
        }
      });

      // Must be 404 (Not Found in tenant scope) or 403 (Forbidden)
      expect([403, 404]).toContain(tamperedRes.status);
    });

    it('should prevent Salon Owner from modifying services of peer salon', async () => {
      const ownerToken = await getOwnerToken();

      const tamperedServiceRes = await request('/api/portal/services/99999', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${ownerToken}` },
        body: {
          name: 'Compromised Service',
          price: 1.00,
          duration: 10
        }
      });

      expect([403, 404]).toContain(tamperedServiceRes.status);
    });
  });

  describe('TC-AUTH-06: Saudi Mobile Phone Normalization & Validation', () => {
    it('should normalize international format +9665xxxxxxxx to 05xxxxxxxx', async () => {
      const email = `saudi_intl_${Date.now()}@barberapp.sa`;
      const suffix = Math.floor(10000000 + Math.random() * 90000000);
      const rawPhone = `+9665${suffix}`;

      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: 'Saudi Citizen',
          phone: rawPhone,
          email,
          password: 'ValidPassword123!'
        }
      });

      expect(res.status).toBe(201);
      expect(res.data.user.phone).toBe(`05${suffix}`);
    });

    it('should reject invalid phone length or non-Saudi prefix', async () => {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          fullName: 'Invalid Phone User',
          phone: '0412345678', // Non-05 prefix
          email: `invalid_phone_${Date.now()}@barberapp.sa`,
          password: 'ValidPassword123!'
        }
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toBe('Bad Request');
    });
  });

});
