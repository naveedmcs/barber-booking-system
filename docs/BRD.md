BUSINESS REQUIREMENTS DOCUMENT (BRD)
Salon & Barber Booking & Appointment Management System
Document Version: 1.0
Date: 2026
Prepared For: Development Team / Google Antigravity AI Build Tool
Prepared By: Product Owner
Status: Approved for Build
Classification: Internal
Table of Contents
1. Document Control
Document Title: Salon & Barber Booking & Appointment Management System – BRD
Version: 1.0
Date: 2026
Prepared For: Development Team / Google Antigravity AI Build Tool
Prepared By: Product Owner
Status: Draft – Ready for Build
Related Documents: Technical Design Doc (TDD), Test Plan, Deployment Runbook
2. Executive Summary
The Salon & Barber Booking System is a multi-tenant SaaS web platform that allows barber shops and salons to register, manage their barbers, publish available time slots, and accept customer bookings online. The core problem being solved is that walk-in customers face long wait times because all barbers are busy with no visibility into availability.
This system enables:
Shop owners to self-register and get auto-approved upon successful payment.
Customers to book appointments by time slot for a specific barber.
Real-time slot updates, calendar sync, QR code store entry, and Google Maps integration.
A subscription-based revenue model (20 SAR/month or 200 SAR/year).
Target Market: Saudi Arabia (initial), GCC region (expansion).
3. Business Objectives
Eliminate walk-in waiting time by enabling advance slot booking.
Give salon owners a real-time dashboard of barber availability.
Create a recurring revenue stream through monthly/yearly subscriptions.
Provide auto-approval on successful payment with admin override capability.
Ensure zero double-booking under concurrent traffic.
Deliver a mobile-first, fast-loading, responsive experience.
4. Scope
4.1 In-Scope
Shop self-registration portal
Auto-approval upon successful payment
Admin override + full user activity audit
Barber dashboard with time-slot management
Public customer booking page (per shop) + QR code
Payment integration (Mada, Card, STC Pay)
Live slot sync + customer calendar (.ics) export
Responsive, modern UI
Automated test coverage
4.2 Out-of-Scope (Phase 2)
Native mobile apps (iOS/Android)
Loyalty programs / coupons
Multi-language RTL toggle (Phase 2 – Arabic UI)
SMS gateway (only calendar + email in Phase 1)
5. Stakeholders
Super Admin: Override approvals, monitor audit logs, manage subscriptions
Shop Owner: Register, manage barbers, view bookings, override slots
Barber: View own schedule, mark availability
Customer: Browse shop, book slot, receive calendar invite
Payment Gateway: Process subscriptions
System: Enforce slot locking, send notifications
6. Functional Requirements
FR-1: Shop Registration Webpage
FR-1.1: Public registration page accessible without login.
FR-1.2 Mandatory fields: Shop Name, Phone Number (unique, validated SA format), Region, District, City, Full Address, Google Map short address / Plus Code, Subscription Plan (Monthly / Yearly).
FR-1.3 Optional but recommended fields: Shop photos (up to 10, max 5MB each), Multiple barbers: each with Name + Photo or Avatar.
FR-1.4 Subscription selection: Monthly (20 SAR / month), Yearly (200 SAR / year – save 40 SAR).
FR-1.5 Payment Integration: Accept Mada, Visa/Mastercard, STC Pay; on success -> auto-approve shop; on failure -> retain form data, show retry.
FR-1.6 Validation: Phone (Saudi format +966 5XXXXXXXX), Email (RFC-compliant), Duplicate phone -> block registration.
FR-2: Admin Panel
FR-2.1 Dashboard: Total shops, active subscriptions, revenue chart, auto-approval log.
FR-2.2 Shop Override: List of active/pending/suspended shops, actions (Suspend / Reactivate / Manually Approve), auto-generate public booking URL + QR on approve.
FR-2.3 User Audit Page: Full activity log, filters (user, action type, date range, IP), export CSV.
FR-2.4 Subscription Management: View status, renewal date, history, manual override.
FR-3: Shop Owner Dashboard (Post-Approval)
FR-3.1 Time-slot View: Filter by Barber, Date, Status; tabs (Today | Tomorrow | This Week | Custom); live-updating (WebSocket).
FR-3.2 Manual Booking (Walk-in): Reserve slot on behalf of walk-in customer with validation rules.
FR-3.3 Slot Management: Mark barber available/unavailable, set break times, holidays, working hours per barber.
FR-3.4 Booking Notifications: Real-time toast + bell icon when customer books.
FR-3.5 Customer Calendar Sync: Generate .ics file, send via email with "Add to Calendar" button (Google, Apple, Outlook).
FR-4: Customer Booking Page
FR-4.1 Unique Public URL per Shop: Format https://book.barberapp.sa/{shop-slug}
FR-4.2 QR Code: Auto-generated, downloadable (PNG/SVG).
FR-4.3 Google Maps Integration: Store location + short address, booking link attached.
FR-4.4 Booking Flow: Select barber -> select service -> select date -> select slot -> confirm -> receive .ics + confirmation page.
FR-4.5 Slot Locking: Hold for 5 minutes; auto-release if not confirmed.
FR-5: Real-Time & Concurrency
FR-5.1 WebSocket connection between shop dashboard and backend.
FR-5.2 Broadcast to connected clients within 2 seconds on any booking.
FR-5.3 Double-Booking Prevention: DB-level unique constraint on (barber_id, slot_datetime, status='CONFIRMED'), optimistic locking via @Version, pessimistic lock during transaction, Redis distributed lock.
FR-6: Auto-Approval on Payment
FR-6.1 On successful payment webhook: verify signature, idempotency check, update shop status to 'ACTIVE', generate slug, public booking URL, QR code, welcome email, audit event SHOP_AUTO_APPROVED.
FR-6.2 Guard Conditions handled for success/failure/slug conflict/duplicate webhooks.
FR-6.3 Admin retains override capabilities.
7. Non-Functional Requirements
Page load time: < 1.5s on 4G
Concurrent users: 10,000+ simultaneous
Booking API response: < 300ms (p95)
Uptime: 99.9%
Mobile responsiveness: 100% (mobile-first)
Security: HTTPS, JWT, bcrypt, OWASP Top 10
Data residency: KSA-hosted (compliance)
Backup: Daily automated, 30-day retention
Accessibility: WCAG 2.1 AA
Localization: Arabic + English (RTL support)
8. Technology Stack
8.1 Backend: Java 21 & Spring Boot 3.3 for REST APIs and WebSocket communication, with Moyasar/Stripe integration for payments.
8.2 Database & Caching: MySQL 8.0 for primary relational data storage and Redis 7 for distributed slot locking and fast caching.
8.3 Frontend: Pure Vanilla Modern JavaScript (ES Modules, Fetch API, native WebSocket/SockJS), HTML5, and Tailwind CSS (standalone CLI or CDN integration with Tailwind Typography and Forms).
8.4 Hosting & Infrastructure: Docker containers managed via Render or Vercel, with GitHub Actions for automated testing and deployment.
9. Data Model (Core Entities)
User, Shop, Barber, Service, WorkingHours, Slot, Booking, Customer, Subscription, AuditLog, Payment.
Unique constraint: UNIQUE KEY uk_no_double_book (barber_id, slot_start, status)
10. API Endpoints (Sample)
POST /api/auth/register
POST /api/auth/login
POST /api/shops
POST /api/payments/webhook
GET /api/admin/shops
PATCH /api/admin/shops/{id}/suspend
GET /api/shops/{slug}/barbers
GET /api/shops/{slug}/slots
POST /api/bookings
DELETE /api/bookings/{id}
WS /ws/shop/{id}
11. UI/UX Guidelines
Ultra-modern luxury salon aesthetic. Colors: Deep Slate/Charcoal background (#0B0F17, #111827), Card background (#1F2937 / glassmorphism backdrop-blur-md bg-white/5 border border-white/10), Accent Amber/Gold (#F59E0B / #D97706), Success Emerald (#10B981). Typography: Inter / IBM Plex Sans Arabic. Micro-interactions: floating action modals, live pill badges, smooth step transitions, custom animated countdown bars, skeleton loaders, optimistic UI, toast notifications.
12. Test Cases
Covers Authentication & Registration, Payment & Auto-Approval, Admin, Slot Management, Booking, Concurrency, QR & Maps, and Non-Functional requirements.
13. Project Cost Estimate
Development Cost: 175,000 SAR (outsourced) / 30,000–50,000 SAR (AI review/QA).
Monthly Infrastructure: ~10 SAR (Free tier MVP), ~290 SAR (Paid tier upgrade for 500+ shops). Break-even at 1 shop on free tier, ~15 shops on paid tier.
14. Deployment Plan
Environments: Dev, Staging, Production.
CI/CD Pipeline: GitHub Push -> GitHub Actions -> Tests -> Docker -> Deploy.
Go-Live Checklist included.
15. Risks & Mitigations
Double-booking under load: Mitigation: DB unique + Redis lock + tests
Payment gateway approval delay: Mitigation: Apply early, fallback provider
Low shop adoption: Mitigation: Free trial, QR marketing
Data residency KSA: Mitigation: Host on KSA-compliant cloud
Slot race in WebSocket: Mitigation: Server-authoritative state
16. Success Metrics (KPI)
100+ shops onboarded in first 3 months
< 1% booking conflicts
90% booking completion rate
< 2s real-time slot update latency
99.9% uptime
MRR target: 10,000 SAR by month 6
17. Deliverables Checklist for Build Tool
Deliverable 1: Shop Registration Portal with validated SA phone and address inputs.
Deliverable 2: Payment Gateway Integration with automated subscription webhook processing.
Deliverable 3: Auto-Approval Workflow for approved payment status handling.
Deliverable 4: Super Admin Dashboard for overall monitoring, manual shop approvals, and suspensions (Pure Vanilla JS + Tailwind SPA/MPA modules, no React or Next.js dependencies).
Deliverable 5: Shop Owner Dashboard for barber management and time-slot configuration (Pure Vanilla JS + Tailwind SPA/MPA modules, no React or Next.js dependencies).
Deliverable 6: Public Customer Booking Interface for browsing slots and completing bookings (Pure Vanilla JS + Tailwind SPA/MPA modules, no React or Next.js dependencies).
Deliverable 7: QR Code Generator for auto-generating shop entry and direct booking URLs.
Deliverable 8: Google Maps Integration to display shop location and link directly to booking.
Deliverable 9: Real-Time Slot Synchronization over WebSockets for live schedule updates.
Deliverable 10: Double-Booking Prevention Engine using database locks and Redis key locking.
Deliverable 11: Calendar Integration (.ics export) with automated confirmation emails.
Deliverable 12: User Activity Audit Logging for tracking admin and shop actions.
Deliverable 13: Automated Test Suite (Unit, Integration, and Concurrency Load Tests).
Deliverable 14: CI/CD Pipeline Configurations using GitHub Actions for build and deployment.
Deliverable 15: Deployment Runbook and Production Environment Provisioning.
