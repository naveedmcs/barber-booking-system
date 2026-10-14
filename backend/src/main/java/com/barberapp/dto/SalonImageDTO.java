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
public class SalonImageDTO {
    private Long id;
    private String imageUrl;
    private Integer displayOrder;
    private Boolean isCover;
    private String caption;
    private LocalDateTime createdAt;
}
