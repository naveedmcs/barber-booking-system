package com.barberapp.service;

import com.barberapp.dto.*;
import com.barberapp.entity.User;
import com.barberapp.entity.enums.PlatformRole;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminUserService {

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final PasswordEncoder passwordEncoder;

    // In-memory permission matrix mapping (customizable per platform role)
    private static final Map<String, List<String>> CUSTOM_ROLE_PERMISSIONS = new ConcurrentHashMap<>();

    static {
        CUSTOM_ROLE_PERMISSIONS.put(PlatformRole.SUPER_ADMIN.name(), new ArrayList<>(List.of(
                "audit.view", "audit.export",
                "salon.view", "salon.status_change", "salon.impersonate",
                "config.view", "config.edit",
                "rbac.view", "rbac.manage"
        )));

        CUSTOM_ROLE_PERMISSIONS.put(PlatformRole.SUPPORT_AGENT.name(), new ArrayList<>(List.of(
                "audit.view",
                "salon.view", "salon.status_change",
                "config.view",
                "rbac.view"
        )));

        CUSTOM_ROLE_PERMISSIONS.put(PlatformRole.AUDIT_INSPECTOR.name(), new ArrayList<>(List.of(
                "audit.view", "audit.export",
                "salon.view",
                "config.view",
                "rbac.view"
        )));
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponseDTO> getInternalAdminUsers() {
        List<UserRole> platformRoles = List.of(
                UserRole.SUPER_ADMIN,
                UserRole.SUPPORT_AGENT,
                UserRole.AUDIT_INSPECTOR
        );

        return userRepository.findByRoleIn(platformRoles).stream()
                .map(this::mapToDTO)
                .sorted(Comparator.comparing(AdminUserResponseDTO::getId))
                .toList();
    }

    @Transactional
    public AdminUserResponseDTO inviteAdminUser(InviteAdminUserRequestDTO req, Long actorUserId, String actorEmail, String ipAddress) {
        String cleanEmail = req.getEmail().trim().toLowerCase();

        if (userRepository.findByEmail(cleanEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with email " + cleanEmail + " already exists.");
        }

        if (req.getPhone() != null && !req.getPhone().isBlank()) {
            String cleanPhone = req.getPhone().trim();
            if (userRepository.findByPhone(cleanPhone).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with phone " + cleanPhone + " already exists.");
            }
        }

        if (!req.getRole().isPlatformRole()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned role must be an internal platform role.");
        }

        String rawPassword = req.getInitialPassword() != null && !req.getInitialPassword().isBlank()
                ? req.getInitialPassword().trim()
                : "AdminTemp123!";

        User newUser = User.builder()
                .fullName(req.getFullName().trim())
                .email(cleanEmail)
                .phone(req.getPhone() != null && !req.getPhone().isBlank() ? req.getPhone().trim() : null)
                .role(req.getRole())
                .password(passwordEncoder.encode(rawPassword))
                .active(true)
                .salonId(null)
                .lastLogin(null)
                .build();

        User saved = userRepository.save(newUser);

        User actor = actorUserId != null ? userRepository.findById(actorUserId).orElse(null) : null;
        auditLogService.logEvent(
                actor,
                null,
                "RBAC_INVITE_ADMIN",
                String.format("{\"invitedEmail\":\"%s\",\"role\":\"%s\",\"fullName\":\"%s\"}", saved.getEmail(), saved.getRole(), saved.getFullName()),
                ipAddress != null ? ipAddress : "127.0.0.1"
        );

        log.info("Internal Admin user invited: email={}, role={}, actor={}", saved.getEmail(), saved.getRole(), actorEmail);
        return mapToDTO(saved);
    }

    @Transactional
    public AdminUserResponseDTO updateAdminRole(Long targetUserId, UpdateAdminRoleRequestDTO req, Long actorUserId, String actorEmail, String ipAddress) {
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target admin user not found."));

        if (!targetUser.getRole().isPlatformRole()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is not an internal platform staff member.");
        }

        if (!req.getRole().isPlatformRole()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New role must be an internal platform role.");
        }

        // Safety Rule 1: Self-demotion lockout prevention
        boolean isSelf = (actorUserId != null && actorUserId.equals(targetUserId))
                || (actorEmail != null && actorEmail.equalsIgnoreCase(targetUser.getEmail()));

        if (isSelf && targetUser.getRole() == UserRole.SUPER_ADMIN && req.getRole() != UserRole.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Safety Violation: Super Admin cannot revoke SUPER_ADMIN authority from their own active session account.");
        }

        // Safety Rule 2: Prevent removing the last active SUPER_ADMIN
        if (targetUser.getRole() == UserRole.SUPER_ADMIN && req.getRole() != UserRole.SUPER_ADMIN) {
            long activeSuperAdmins = userRepository.countByRoleAndActiveTrue(UserRole.SUPER_ADMIN);
            if (activeSuperAdmins <= 1 && (targetUser.getActive() == null || targetUser.getActive())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Safety Violation: Cannot reassign the last remaining active SUPER_ADMIN in the system.");
            }
        }

        UserRole oldRole = targetUser.getRole();
        targetUser.setRole(req.getRole());
        User saved = userRepository.save(targetUser);

        User actor = actorUserId != null ? userRepository.findById(actorUserId).orElse(null) : null;
        auditLogService.logEvent(
                actor,
                null,
                "RBAC_ROLE_CHANGE",
                String.format("{\"targetEmail\":\"%s\",\"previousRole\":\"%s\",\"newRole\":\"%s\"}", saved.getEmail(), oldRole, saved.getRole()),
                ipAddress != null ? ipAddress : "127.0.0.1"
        );

        log.info("Internal Admin role updated: user={}, oldRole={}, newRole={}, actor={}", saved.getEmail(), oldRole, saved.getRole(), actorEmail);
        return mapToDTO(saved);
    }

    @Transactional
    public AdminUserResponseDTO updateAdminStatus(Long targetUserId, UpdateAdminStatusRequestDTO req, Long actorUserId, String actorEmail, String ipAddress) {
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target admin user not found."));

        if (!targetUser.getRole().isPlatformRole()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is not an internal platform staff member.");
        }

        boolean requestedActive = req.getActive();

        // Safety Rule 1: Self-deactivation lockout prevention
        boolean isSelf = (actorUserId != null && actorUserId.equals(targetUserId))
                || (actorEmail != null && actorEmail.equalsIgnoreCase(targetUser.getEmail()));

        if (isSelf && !requestedActive) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Safety Violation: Super Admin cannot deactivate or suspend their own current session account.");
        }

        // Safety Rule 2: Prevent deactivating the last active SUPER_ADMIN
        if (targetUser.getRole() == UserRole.SUPER_ADMIN && !requestedActive) {
            long activeSuperAdmins = userRepository.countByRoleAndActiveTrue(UserRole.SUPER_ADMIN);
            if (activeSuperAdmins <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Safety Violation: Cannot deactivate or suspend the last active SUPER_ADMIN.");
            }
        }

        targetUser.setActive(requestedActive);
        User saved = userRepository.save(targetUser);

        User actor = actorUserId != null ? userRepository.findById(actorUserId).orElse(null) : null;
        auditLogService.logEvent(
                actor,
                null,
                "RBAC_STATUS_CHANGE",
                String.format("{\"targetEmail\":\"%s\",\"active\":%b}", saved.getEmail(), requestedActive),
                ipAddress != null ? ipAddress : "127.0.0.1"
        );

        log.info("Internal Admin status updated: user={}, active={}, actor={}", saved.getEmail(), requestedActive, actorEmail);
        return mapToDTO(saved);
    }

    @Transactional(readOnly = true)
    public List<RolePermissionsDTO> getRolePermissions() {
        List<RolePermissionsDTO> list = new ArrayList<>();

        for (PlatformRole role : PlatformRole.values()) {
            long count = userRepository.findAll().stream()
                    .filter(u -> u.getRole() != null && u.getRole().name().equals(role.name()))
                    .count();

            List<String> perms = CUSTOM_ROLE_PERMISSIONS.getOrDefault(role.name(), List.of());

            list.add(RolePermissionsDTO.builder()
                    .role(role.name())
                    .name(role.getDisplayName())
                    .description(role.getDescription())
                    .userCount(count)
                    .permissions(new ArrayList<>(perms))
                    .systemProtected(role == PlatformRole.SUPER_ADMIN)
                    .build());
        }

        return list;
    }

    @Transactional
    public RolePermissionsDTO updateRolePermissions(String roleName, List<String> permissions, Long actorUserId, String actorEmail, String ipAddress) {
        PlatformRole platformRole;
        try {
            platformRole = PlatformRole.valueOf(roleName.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Platform role " + roleName + " not found.");
        }

        List<String> updated = new ArrayList<>(permissions != null ? permissions : List.of());

        // SUPER_ADMIN must always retain critical system authority
        if (platformRole == PlatformRole.SUPER_ADMIN) {
            for (String requiredPerm : List.of("audit.view", "rbac.view", "rbac.manage")) {
                if (!updated.contains(requiredPerm)) {
                    updated.add(requiredPerm);
                }
            }
        }

        CUSTOM_ROLE_PERMISSIONS.put(platformRole.name(), updated);

        User actor = actorUserId != null ? userRepository.findById(actorUserId).orElse(null) : null;
        auditLogService.logEvent(
                actor,
                null,
                "RBAC_PERMISSIONS_UPDATE",
                String.format("{\"role\":\"%s\",\"permissionsCount\":%d}", platformRole.name(), updated.size()),
                ipAddress != null ? ipAddress : "127.0.0.1"
        );

        long count = userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().name().equals(platformRole.name()))
                .count();

        return RolePermissionsDTO.builder()
                .role(platformRole.name())
                .name(platformRole.getDisplayName())
                .description(platformRole.getDescription())
                .userCount(count)
                .permissions(updated)
                .systemProtected(platformRole == PlatformRole.SUPER_ADMIN)
                .build();
    }

    private AdminUserResponseDTO mapToDTO(User user) {
        return AdminUserResponseDTO.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .active(user.getActive() != null ? user.getActive() : true)
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
