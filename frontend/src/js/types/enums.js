/**
 * Core Enums and Status Constants for Barber Booking Platform
 */

export const BookingStatus = Object.freeze({
  AVAILABLE: "AVAILABLE",
  HOLD: "HOLD",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
});

export const UserRole = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  SALON_OWNER: "SALON_OWNER",
  SALON_STAFF: "SALON_STAFF",
  CUSTOMER: "CUSTOMER"
});

export const PlatformRole = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  SUPPORT_AGENT: "SUPPORT_AGENT"
});

export const TenantRole = Object.freeze({
  SALON_OWNER: "SALON_OWNER",
  SALON_STAFF: "SALON_STAFF"
});

export const SubscriptionPlan = Object.freeze({
  STARTER: "STARTER",
  PROFESSIONAL: "PROFESSIONAL",
  ENTERPRISE: "ENTERPRISE"
});

export const ShopStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  PENDING: "PENDING"
});
