package com.barberapp.entity.enums;

/**
 * Internal Platform Roles for Super Admin & Administrative Staff
 */
public enum PlatformRole {
    SUPER_ADMIN("Super Administrator", "Full unrestricted access across all platform entities and configuration"),
    SUPPORT_AGENT("Support Agent", "Operational support for salon moderation, status adjustments, and inquiries"),
    AUDIT_INSPECTOR("Audit Inspector", "Compliance and security audit inspection with read-only audit exports");

    private final String displayName;
    private final String description;

    PlatformRole(String displayName, String description) {
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
