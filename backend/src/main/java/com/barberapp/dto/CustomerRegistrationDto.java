package com.barberapp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CustomerRegistrationDto {

    @NotBlank(message = "Full Name is required")
    private String fullName;

    @NotBlank(message = "Saudi mobile number is required")
    @Pattern(regexp = "^(05|\\+9665|9665)[0-9]{8}$", message = "Invalid Saudi mobile number. Must start with 05 (10 digits).")
    private String phone;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;
}
