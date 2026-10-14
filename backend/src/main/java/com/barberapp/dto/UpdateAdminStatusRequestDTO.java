package com.barberapp.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateAdminStatusRequestDTO {

    @NotNull(message = "Active status is required")
    private Boolean active;
}
