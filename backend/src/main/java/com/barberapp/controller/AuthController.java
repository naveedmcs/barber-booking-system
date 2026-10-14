package com.barberapp.controller;

import com.barberapp.dto.LoginRequestDTO;
import com.barberapp.dto.LoginResponseDTO;
import com.barberapp.dto.UserDTO;
import com.barberapp.entity.Shop;
import com.barberapp.entity.User;
import com.barberapp.repository.ShopRepository;
import com.barberapp.repository.UserRepository;
import com.barberapp.security.JwtService;
import com.barberapp.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final ShopRepository shopRepository;
    private final com.barberapp.repository.BarberRepository barberRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final com.barberapp.service.AuditLogService auditLogService;

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequestDTO request,
            jakarta.servlet.http.HttpServletRequest httpRequest
    ) {
        String ipAddress = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        String cleanEmail = request.getEmail().trim();
        User user = userRepository.findByEmail(cleanEmail)
                .or(() -> userRepository.findAll().stream()
                        .filter(u -> u.getPhone() != null && u.getPhone().equals(cleanEmail))
                        .findFirst())
                .orElse(null);

        if (user == null) {
            auditLogService.logEvent(null, null, "AUTH_LOGIN_FAILED", "Failed login attempt for: " + cleanEmail + " (User not found)", ipAddress);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials", "message", "User not found with provided email/phone"));
        }

        if (user.getActive() != null && !user.getActive()) {
            auditLogService.logEvent(user, null, "AUTH_LOGIN_FAILED", "Login blocked: Account suspended for email: " + cleanEmail, ipAddress);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Account suspended", "message", "Your account has been deactivated. Contact super admin."));
        }

        // Validate password (BCrypt or plain fallback for dev compatibility)
        boolean passwordMatches = passwordEncoder.matches(request.getPassword(), user.getPassword())
                || request.getPassword().equals(user.getPassword());

        if (!passwordMatches) {
            auditLogService.logEvent(user, null, "AUTH_LOGIN_FAILED", "Failed login attempt for email: " + cleanEmail + " (Incorrect password)", ipAddress);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials", "message", "Invalid email or password"));
        }

        // Resolve salon info and staffId if assigned
        Shop shop = null;
        Long staffId = null;

        if (user.getRole() == com.barberapp.entity.enums.UserRole.SALON_STAFF || user.getRole() == com.barberapp.entity.enums.UserRole.BARBER) {
            com.barberapp.entity.Barber barber = barberRepository.findByUserId(user.getId()).orElse(null);
            if (barber != null) {
                staffId = barber.getId();
                if (barber.getShop() != null) {
                    shop = barber.getShop();
                    if (user.getSalonId() == null) {
                        user.setSalonId(shop.getId());
                        userRepository.save(user);
                    }
                }
            }
        }

        if (shop == null) {
            if (user.getSalonId() != null) {
                shop = shopRepository.findById(user.getSalonId()).orElse(null);
            } else {
                shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
                if (shop != null && user.getSalonId() == null) {
                    user.setSalonId(shop.getId());
                    userRepository.save(user);
                }
            }
        }

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        String accessToken = jwtService.generateToken(user);

        UserDTO userDTO = UserDTO.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .salonId(shop != null ? shop.getId() : user.getSalonId())
                .salonName(shop != null ? shop.getName() : null)
                .salonSlug(shop != null ? shop.getSlug() : null)
                .phone(user.getPhone())
                .active(user.getActive())
                .staffId(staffId)
                .build();

        LoginResponseDTO response = LoginResponseDTO.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs())
                .user(userDTO)
                .build();

        auditLogService.logEvent(
                user,
                shop,
                "LOGIN",
                String.format("User authenticated successfully. Role: %s, Email: %s, Salon: %s",
                        user.getRole(), user.getEmail(), shop != null ? shop.getName() : "Global Platform"),
                ipAddress
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthenticated", "message", "No valid token present"));
        }

        User user = userRepository.findById(principal.getUserId()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found"));
        }

        Shop shop = null;
        Long staffId = null;

        if (user.getRole() == com.barberapp.entity.enums.UserRole.SALON_STAFF || user.getRole() == com.barberapp.entity.enums.UserRole.BARBER) {
            com.barberapp.entity.Barber barber = barberRepository.findByUserId(user.getId()).orElse(null);
            if (barber != null) {
                staffId = barber.getId();
                shop = barber.getShop();
            }
        }

        if (shop == null) {
            if (user.getSalonId() != null) {
                shop = shopRepository.findById(user.getSalonId()).orElse(null);
            } else {
                shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            }
        }

        UserDTO userDTO = UserDTO.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .salonId(shop != null ? shop.getId() : user.getSalonId())
                .salonName(shop != null ? shop.getName() : null)
                .salonSlug(shop != null ? shop.getSlug() : null)
                .phone(user.getPhone())
                .active(user.getActive())
                .staffId(staffId)
                .build();

        return ResponseEntity.ok(userDTO);
    }
}
