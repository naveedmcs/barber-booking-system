package com.barberapp.dto;

import com.barberapp.entity.enums.SubscriptionPlan;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShopRegistrationDto {

    @NotBlank(message = "Owner full name is required")
    private String ownerFullName;

    @NotBlank(message = "Owner email is required")
    @Email(message = "Invalid email format")
    private String ownerEmail;

    @NotBlank(message = "Owner password is required")
    private String ownerPassword;

    @NotBlank(message = "Shop name is required")
    private String shopName;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^(\\+9665|05)[0-9]{8}$", message = "Invalid Saudi phone number format")
    private String phone;

    @NotBlank(message = "Region is required")
    private String region;

    @NotBlank(message = "District is required")
    private String district;

    @NotBlank(message = "City is required")
    private String city;

    @NotBlank(message = "Full address is required")
    private String fullAddress;

    private String mapAddress;

    @NotNull(message = "Subscription plan is required")
    private SubscriptionPlan subscriptionPlan;
}
