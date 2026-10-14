package com.barberapp.dto;

import com.barberapp.entity.enums.ShopStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopStatusUpdateDto {

    @NotNull
    private ShopStatus status;

    private String reason;

    private String actorEmail;
}
