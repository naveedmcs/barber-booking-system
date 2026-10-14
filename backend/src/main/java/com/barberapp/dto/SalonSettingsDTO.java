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
public class SalonSettingsDTO {
    private Long id;
    private String name;
    private String slug;
    private String phone;
    private String region;
    private String district;
    private String city;
    private String fullAddress;
    private String mapAddress;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String logoUrl;
    private String coverImageUrl;
    private Integer minCancelNoticeHours;
    private Integer maxAdvanceBookingDays;
    private Boolean autoConfirmWalkins;
    private String operatingHoursJson;
    private String bookingUrl;
    private String qrCodeUrl;
}
