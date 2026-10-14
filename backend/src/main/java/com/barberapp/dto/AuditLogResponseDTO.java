package com.barberapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponseDTO {
    private Long id;
    private Long userId;
    private String userEmail;
    private String userFullName;
    private String userRole;
    private Long shopId;
    private String shopName;
    private String shopSlug;
    private String action;
    private String details;
    private String ipAddress;
    private LocalDateTime createdAt;
}
