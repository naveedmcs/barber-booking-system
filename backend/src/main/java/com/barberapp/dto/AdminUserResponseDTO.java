package com.barberapp.dto;

import com.barberapp.entity.enums.UserRole;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserResponseDTO {
    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private UserRole role;
    private Boolean active;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
}
