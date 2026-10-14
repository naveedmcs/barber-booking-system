package com.barberapp.entity.enums;

public enum UserRole {
    // Internal Platform Roles
    SUPER_ADMIN,
    SUPPORT_AGENT,
    AUDIT_INSPECTOR,

    // Tenant Domain Roles
    SALON_OWNER,
    SALON_STAFF,
    SHOP_OWNER, // legacy alias for SALON_OWNER
    BARBER,     // legacy alias for SALON_STAFF
    CUSTOMER;

    public boolean isPlatformRole() {
        return this == SUPER_ADMIN || this == SUPPORT_AGENT || this == AUDIT_INSPECTOR;
    }

    public boolean isTenantRole() {
        return !isPlatformRole();
    }
}
