package com.barberapp.controller;

import com.barberapp.dto.*;
import com.barberapp.security.UserPrincipal;
import com.barberapp.service.AdminUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponseDTO>> getInternalAdminUsers() {
        return ResponseEntity.ok(adminUserService.getInternalAdminUsers());
    }

    @PostMapping("/users")
    public ResponseEntity<AdminUserResponseDTO> inviteAdminUser(
            @Valid @RequestBody InviteAdminUserRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest
    ) {
        Long actorId = principal != null ? principal.getUserId() : null;
        String actorEmail = principal != null ? principal.getEmail() : "admin@barberapp.sa";
        String ip = servletRequest.getRemoteAddr();

        AdminUserResponseDTO created = adminUserService.inviteAdminUser(request, actorId, actorEmail, ip);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<AdminUserResponseDTO> updateAdminRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAdminRoleRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest
    ) {
        Long actorId = principal != null ? principal.getUserId() : null;
        String actorEmail = principal != null ? principal.getEmail() : "admin@barberapp.sa";
        String ip = servletRequest.getRemoteAddr();

        AdminUserResponseDTO updated = adminUserService.updateAdminRole(id, request, actorId, actorEmail, ip);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/users/{id}/status")
    public ResponseEntity<AdminUserResponseDTO> updateAdminStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAdminStatusRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest
    ) {
        Long actorId = principal != null ? principal.getUserId() : null;
        String actorEmail = principal != null ? principal.getEmail() : "admin@barberapp.sa";
        String ip = servletRequest.getRemoteAddr();

        AdminUserResponseDTO updated = adminUserService.updateAdminStatus(id, request, actorId, actorEmail, ip);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/users/{id}/status")
    public ResponseEntity<AdminUserResponseDTO> updateAdminStatusPut(
            @PathVariable Long id,
            @Valid @RequestBody UpdateAdminStatusRequestDTO request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest
    ) {
        return updateAdminStatus(id, request, principal, servletRequest);
    }

    @GetMapping("/roles")
    public ResponseEntity<List<RolePermissionsDTO>> getRolePermissions() {
        return ResponseEntity.ok(adminUserService.getRolePermissions());
    }

    @PutMapping("/roles/{role}/permissions")
    public ResponseEntity<RolePermissionsDTO> updateRolePermissions(
            @PathVariable String role,
            @RequestBody Map<String, List<String>> payload,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest servletRequest
    ) {
        Long actorId = principal != null ? principal.getUserId() : null;
        String actorEmail = principal != null ? principal.getEmail() : "admin@barberapp.sa";
        String ip = servletRequest.getRemoteAddr();

        List<String> permissions = payload.getOrDefault("permissions", List.of());
        RolePermissionsDTO updated = adminUserService.updateRolePermissions(role, permissions, actorId, actorEmail, ip);
        return ResponseEntity.ok(updated);
    }
}
