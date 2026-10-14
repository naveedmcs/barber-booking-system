package com.barberapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceRequestDTO {
    private String name;
    private String category;
    private String description;
    private BigDecimal price;
    private Integer durationMinutes;
    private Integer bufferMinutes;
    private Boolean isVisible;
    private String assignedStaffIds;
}
