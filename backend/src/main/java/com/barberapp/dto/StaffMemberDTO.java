package com.barberapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffMemberDTO {
    private Long id;
    private Long userId;
    private String name;
    private String specialty;
    private String phone;
    private String email;
    private String status;
    private Boolean isActive;
    private String photoUrl;
    private String avatarUrl;
    private String scheduleSummary;
    private String skills;
    private java.util.List<String> skillsTags;
    private Integer upcomingBookingsCount;

    public String getAvatarUrl() {
        return avatarUrl != null ? avatarUrl : photoUrl;
    }

    public String getPhotoUrl() {
        return photoUrl != null ? photoUrl : avatarUrl;
    }
}
