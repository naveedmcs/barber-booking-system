package com.barberapp.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RolePermissionsDTO {
    private String role;
    private String name;
    private String description;
    private long userCount;
    private List<String> permissions;
    private boolean systemProtected;
}
