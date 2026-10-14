package com.barberapp.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortalContextResponseDTO {
    private Long salonId;
    private String salonName;
    private String salonSlug;
    private String branch;
    private String fullAddress;
    private UserDTO user;
    private boolean isOwner;
    private boolean isStaff;
    private String shiftStatus;
    private List<String> accessibleModules;
}
