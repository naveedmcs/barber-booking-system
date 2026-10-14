package com.barberapp.controller;

import com.barberapp.dto.*;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.security.JwtAuthenticationFilter;
import com.barberapp.security.JwtService;
import com.barberapp.service.AdminUserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminUserController.class)
@AutoConfigureMockMvc(addFilters = false)
public class AdminUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminUserService adminUserService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("GET /api/admin/users returns internal platform admin users")
    void testGetInternalAdminUsers() throws Exception {
        AdminUserResponseDTO admin = AdminUserResponseDTO.builder()
                .id(1L)
                .fullName("Super Administrator")
                .email("admin@barberapp.sa")
                .phone("0500000000")
                .role(UserRole.SUPER_ADMIN)
                .active(true)
                .lastLogin(LocalDateTime.now())
                .createdAt(LocalDateTime.now().minusDays(10))
                .build();

        AdminUserResponseDTO support = AdminUserResponseDTO.builder()
                .id(2L)
                .fullName("Tariq Al-Harbi")
                .email("support@barberapp.sa")
                .phone("0551122334")
                .role(UserRole.SUPPORT_AGENT)
                .active(true)
                .lastLogin(null)
                .createdAt(LocalDateTime.now().minusDays(2))
                .build();

        when(adminUserService.getInternalAdminUsers()).thenReturn(List.of(admin, support));

        mockMvc.perform(get("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].email").value("admin@barberapp.sa"))
                .andExpect(jsonPath("$[0].role").value("SUPER_ADMIN"))
                .andExpect(jsonPath("$[1].email").value("support@barberapp.sa"))
                .andExpect(jsonPath("$[1].role").value("SUPPORT_AGENT"));
    }

    @Test
    @DisplayName("POST /api/admin/users invites a new internal admin user")
    void testInviteAdminUser() throws Exception {
        InviteAdminUserRequestDTO request = InviteAdminUserRequestDTO.builder()
                .fullName("Noura Al-Dosari")
                .email("inspector@barberapp.sa")
                .phone("0559988776")
                .role(UserRole.AUDIT_INSPECTOR)
                .build();

        AdminUserResponseDTO created = AdminUserResponseDTO.builder()
                .id(3L)
                .fullName("Noura Al-Dosari")
                .email("inspector@barberapp.sa")
                .phone("0559988776")
                .role(UserRole.AUDIT_INSPECTOR)
                .active(true)
                .createdAt(LocalDateTime.now())
                .build();

        when(adminUserService.inviteAdminUser(any(), any(), any(), any())).thenReturn(created);

        mockMvc.perform(post("/api/admin/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(3))
                .andExpect(jsonPath("$.email").value("inspector@barberapp.sa"))
                .andExpect(jsonPath("$.role").value("AUDIT_INSPECTOR"));
    }

    @Test
    @DisplayName("PUT /api/admin/users/{id}/role updates platform role")
    void testUpdateAdminRole() throws Exception {
        UpdateAdminRoleRequestDTO request = UpdateAdminRoleRequestDTO.builder()
                .role(UserRole.AUDIT_INSPECTOR)
                .build();

        AdminUserResponseDTO updated = AdminUserResponseDTO.builder()
                .id(2L)
                .fullName("Tariq Al-Harbi")
                .email("support@barberapp.sa")
                .role(UserRole.AUDIT_INSPECTOR)
                .active(true)
                .build();

        when(adminUserService.updateAdminRole(eq(2L), any(), any(), any(), any())).thenReturn(updated);

        mockMvc.perform(put("/api/admin/users/2/role")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("AUDIT_INSPECTOR"));
    }

    @Test
    @DisplayName("PATCH /api/admin/users/{id}/status toggles active status")
    void testUpdateAdminStatus() throws Exception {
        UpdateAdminStatusRequestDTO request = UpdateAdminStatusRequestDTO.builder()
                .active(false)
                .build();

        AdminUserResponseDTO suspended = AdminUserResponseDTO.builder()
                .id(2L)
                .fullName("Tariq Al-Harbi")
                .email("support@barberapp.sa")
                .role(UserRole.SUPPORT_AGENT)
                .active(false)
                .build();

        when(adminUserService.updateAdminStatus(eq(2L), any(), any(), any(), any())).thenReturn(suspended);

        mockMvc.perform(patch("/api/admin/users/2/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    @DisplayName("PATCH /api/admin/users/{id}/status throws 400 on self-deactivation")
    void testPreventSelfDeactivation() throws Exception {
        UpdateAdminStatusRequestDTO request = UpdateAdminStatusRequestDTO.builder()
                .active(false)
                .build();

        when(adminUserService.updateAdminStatus(eq(1L), any(), any(), any(), any()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Safety Violation: Super Admin cannot deactivate or suspend their own current session account."));

        mockMvc.perform(patch("/api/admin/users/1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/admin/roles returns platform roles and permission matrix")
    void testGetRolePermissions() throws Exception {
        RolePermissionsDTO r1 = RolePermissionsDTO.builder()
                .role("SUPER_ADMIN")
                .name("Super Administrator")
                .description("Full unrestricted access")
                .userCount(1)
                .permissions(List.of("audit.view", "audit.export", "salon.view", "salon.status_change", "salon.impersonate", "config.view", "config.edit", "rbac.view", "rbac.manage"))
                .systemProtected(true)
                .build();

        when(adminUserService.getRolePermissions()).thenReturn(List.of(r1));

        mockMvc.perform(get("/api/admin/roles")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].role").value("SUPER_ADMIN"))
                .andExpect(jsonPath("$[0].permissions.length()").value(9));
    }
}
