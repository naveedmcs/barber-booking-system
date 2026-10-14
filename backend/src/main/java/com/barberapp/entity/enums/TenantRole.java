package com.barberapp.entity.enums;

/**
 * Tenant Domain Roles for Salons, Barbers, and Public Customers
 */
public enum TenantRole {
    SALON_OWNER("Salon Owner", "Tenant business owner managing assigned shop, staff, and pricing"),
    SALON_STAFF("Salon Staff", "Barber and front-desk personnel managing walk-in queues and time slots"),
    CUSTOMER("Customer", "Public customer booking appointments and receiving calendar reminders");

    private final String displayName;
    private final String description;

    TenantRole(String displayName, String description) {
        this.displayName = displayName;
        this.description = description;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }
}
