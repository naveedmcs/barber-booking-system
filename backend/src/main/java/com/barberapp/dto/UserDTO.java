package com.barberapp.dto;

import com.barberapp.entity.enums.UserRole;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {
    private Long id;
    private String email;
    private String fullName;
    private UserRole role;
    private Long salonId;
    private String salonName;
    private String salonSlug;
    private String phone;
    private Boolean active;
    private Long staffId;
}
