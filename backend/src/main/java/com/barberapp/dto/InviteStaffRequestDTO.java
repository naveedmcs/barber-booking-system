package com.barberapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteStaffRequestDTO {
    private String name;
    private String specialty;
    private String phone;
    private String email;
    private String password;
    private String photoUrl;
    private String avatarUrl;
    private String skills;
    private String status;
    private Boolean isActive;

    public String resolveAvatarUrl() {
        if (avatarUrl != null && !avatarUrl.isBlank()) return avatarUrl;
        if (photoUrl != null && !photoUrl.isBlank()) return photoUrl;
        return null;
    }
}
