package com.barberapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAuditLogRequestDTO {
    private String action;
    private String details;
    private Long shopId;
    private String shopName;
    private Long userId;
    private String userEmail;
    private String ipAddress;
}
