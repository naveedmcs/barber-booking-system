package com.barberapp.dto;

import com.barberapp.entity.enums.UserRole;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateAdminRoleRequestDTO {

    @NotNull(message = "Platform role is required")
    private UserRole role;
}
