package com.barberapp.dto;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortalBookingResponseDTO {
    private Long id;
    private Long shopId;
    private Long barberId;
    private String barberName;
    private Long serviceId;
    private String serviceName;
    private Integer serviceDuration;
    private Double servicePrice;
    private String customerName;
    private String customerPhone;
    private LocalDateTime slotStart;
    private LocalDateTime slotEnd;
    private String status;
    private String cancellationReason;
    private String notes;
}
