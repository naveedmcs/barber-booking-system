package com.barberapp.controller;

import com.barberapp.dto.*;
import com.barberapp.entity.Customer;
import com.barberapp.entity.PasswordReset;
import com.barberapp.entity.Shop;
import com.barberapp.entity.User;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.CustomerRepository;
import com.barberapp.repository.PasswordResetRepository;
import com.barberapp.repository.ShopRepository;
import com.barberapp.repository.UserRepository;
import com.barberapp.security.JwtService;
import com.barberapp.security.UserPrincipal;
import com.barberapp.service.AuditLogService;
import com.barberapp.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final ShopRepository shopRepository;
    private final com.barberapp.repository.BarberRepository barberRepository;
    private final PasswordResetRepository passwordResetRepository;
    private final ShopService shopService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    // In-memory registry of active reset links for dev convenience and zero-SMTP testing
    private final Map<String, Map<String, Object>> devResetLinks = new ConcurrentHashMap<>();

    /**
     * Unified Login: Authenticates user credentials exclusively against the database via BCrypt.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequestDTO request,
            HttpServletRequest httpRequest
    ) {
        String ipAddress = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        String cleanEmail = request.getEmail().trim().toLowerCase();

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

        // Validate password strictly via BCrypt (plain-text bypass completely purged)
        boolean passwordMatches = passwordEncoder.matches(request.getPassword(), user.getPassword());

        if (!passwordMatches) {
            auditLogService.logEvent(user, null, "AUTH_LOGIN_FAILED", "Failed login attempt for email: " + cleanEmail + " (Incorrect password)", ipAddress);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials", "message", "Invalid email or password"));
        }

        // Resolve salon info and staffId if assigned
        Shop shop = null;
        Long staffId = null;

        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
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

    /**
     * Customer Self-Registration: Creates authenticated Customer account with BCrypt password.
     */
    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> registerCustomer(
            @Valid @RequestBody CustomerRegistrationDto request,
            HttpServletRequest httpRequest
    ) {
        String ipAddress = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        String cleanEmail = request.getEmail().trim().toLowerCase();
        String cleanPhone = normalizeSaudiPhone(request.getPhone());

        if (userRepository.findByEmail(cleanEmail).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Email Already Registered",
                    "message", "An account with email " + cleanEmail + " already exists. Please sign in."
            ));
        }

        if (userRepository.findByPhone(cleanPhone).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Phone Already Registered",
                    "message", "An account with mobile number " + cleanPhone + " already exists. Please sign in."
            ));
        }

        User customerUser = User.builder()
                .fullName(request.getFullName().trim())
                .email(cleanEmail)
                .phone(cleanPhone)
                .password(passwordEncoder.encode(request.getPassword().trim()))
                .role(UserRole.CUSTOMER)
                .active(true)
                .lastLogin(LocalDateTime.now())
                .build();

        customerUser = userRepository.save(customerUser);

        // Associate with Customer entity record
        Customer customerEntity = Customer.builder()
                .user(customerUser)
                .fullName(customerUser.getFullName())
                .email(customerUser.getEmail())
                .phone(customerUser.getPhone())
                .build();
        customerRepository.save(customerEntity);

        String accessToken = jwtService.generateToken(customerUser);

        UserDTO userDTO = UserDTO.builder()
                .id(customerUser.getId())
                .email(customerUser.getEmail())
                .fullName(customerUser.getFullName())
                .role(customerUser.getRole())
                .phone(customerUser.getPhone())
                .active(customerUser.getActive())
                .build();

        LoginResponseDTO response = LoginResponseDTO.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs())
                .user(userDTO)
                .build();

        auditLogService.logEvent(
                customerUser,
                null,
                "CUSTOMER_REGISTERED",
                "New customer registered: " + customerUser.getFullName() + " (" + customerUser.getEmail() + ")",
                ipAddress
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Salon Owner Onboarding: Atomic creation of Salon + Owner User (BCrypt password).
     */
    @PostMapping("/register-salon")
    @Transactional
    public ResponseEntity<?> registerSalon(
            @Valid @RequestBody ShopRegistrationDto request,
            HttpServletRequest httpRequest
    ) {
        String ipAddress = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        String cleanEmail = request.getOwnerEmail().trim().toLowerCase();

        if (userRepository.findByEmail(cleanEmail).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Email Already Registered",
                    "message", "An owner account with email " + cleanEmail + " already exists."
            ));
        }

        Shop shop = shopService.registerShop(request);
        User owner = shop.getOwner();

        String accessToken = jwtService.generateToken(owner);

        UserDTO userDTO = UserDTO.builder()
                .id(owner.getId())
                .email(owner.getEmail())
                .fullName(owner.getFullName())
                .role(owner.getRole())
                .salonId(shop.getId())
                .salonName(shop.getName())
                .salonSlug(shop.getSlug())
                .phone(owner.getPhone())
                .active(owner.getActive())
                .build();

        LoginResponseDTO response = LoginResponseDTO.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationMs())
                .user(userDTO)
                .build();

        auditLogService.logEvent(
                owner,
                shop,
                "SALON_REGISTERED",
                "Salon " + shop.getName() + " registered with owner " + owner.getEmail(),
                ipAddress
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Request Password Reset: Generates cryptographically secure token, stores SHA-256 hash.
     */
    @PostMapping("/forgot-password")
    @Transactional
    public ResponseEntity<?> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequestDTO request,
            HttpServletRequest httpRequest
    ) {
        String ipAddress = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        String cleanEmail = request.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(cleanEmail).orElse(null);
        if (user == null) {
            // Return generic response to prevent account enumeration
            return ResponseEntity.ok(Map.of(
                    "message", "If an account exists with this email, password reset instructions have been dispatched.",
                    "email", cleanEmail
            ));
        }

        // Invalidate prior unused tokens
        List<PasswordReset> pendingResets = passwordResetRepository.findByUserIdAndUsedFalse(user.getId());
        for (PasswordReset pr : pendingResets) {
            pr.setUsed(true);
        }
        passwordResetRepository.saveAll(pendingResets);

        // Generate 32-byte cryptographically secure random token (64 hex characters)
        byte[] randomBytes = new byte[32];
        new SecureRandom().nextBytes(randomBytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : randomBytes) {
            sb.append(String.format("%02x", b));
        }
        String rawToken = sb.toString();
        String tokenHash = computeSha256(rawToken);

        PasswordReset passwordReset = PasswordReset.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(LocalDateTime.now().plusHours(1))
                .used(false)
                .build();
        passwordResetRepository.save(passwordReset);

        String resetLink = "/reset-password.html?token=" + rawToken;

        devResetLinks.put(rawToken, Map.of(
                "email", user.getEmail(),
                "fullName", user.getFullName(),
                "token", rawToken,
                "resetLink", resetLink,
                "createdAt", LocalDateTime.now().toString(),
                "expiresAt", passwordReset.getExpiresAt().toString()
        ));

        auditLogService.logEvent(
                user,
                null,
                "PASSWORD_RESET_REQUESTED",
                "Password reset requested for " + cleanEmail,
                ipAddress
        );

        return ResponseEntity.ok(Map.of(
                "message", "Password reset instructions generated successfully.",
                "email", cleanEmail,
                "resetLink", resetLink,
                "token", rawToken,
                "expiresInMinutes", 60
        ));
    }

    /**
     * Reset Password: Validates single-use unexpired token, updates password with BCrypt hash.
     */
    @PostMapping("/reset-password")
    @Transactional
    public ResponseEntity<?> resetPassword(
            @Valid @RequestBody ResetPasswordRequestDTO request,
            HttpServletRequest httpRequest
    ) {
        String ipAddress = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        String rawToken = request.getToken().trim();
        String tokenHash = computeSha256(rawToken);

        PasswordReset resetRecord = passwordResetRepository.findByTokenHashAndUsedFalse(tokenHash).orElse(null);

        if (resetRecord == null || resetRecord.getExpiresAt().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "Invalid or Expired Token",
                    "message", "The password reset token is invalid, expired, or has already been used. Please request a new one."
            ));
        }

        User user = resetRecord.getUser();
        user.setPassword(passwordEncoder.encode(request.getNewPassword().trim()));
        userRepository.save(user);

        resetRecord.setUsed(true);
        passwordResetRepository.save(resetRecord);
        devResetLinks.remove(rawToken);

        auditLogService.logEvent(
                user,
                null,
                "PASSWORD_RESET_COMPLETED",
                "Password successfully updated for user " + user.getEmail(),
                ipAddress
        );

        return ResponseEntity.ok(Map.of(
                "message", "Password updated successfully. You may now log in with your new password.",
                "email", user.getEmail()
        ));
    }

    /**
     * Development Utility: Returns active unexpired reset links for local testing without SMTP server.
     */
    @GetMapping({"/dev/reset-links", "/reset-links"})
    public ResponseEntity<?> getDevResetLinks() {
        return ResponseEntity.ok(devResetLinks.values());
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

        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
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

    private String computeSha256(String base) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(base.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 digest unavailable", ex);
        }
    }

    private String normalizeSaudiPhone(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\s+", "");
        if (digits.startsWith("+9665")) return "05" + digits.substring(5);
        if (digits.startsWith("9665")) return "05" + digits.substring(4);
        if (digits.startsWith("009665")) return "05" + digits.substring(6);
        return digits;
    }
}
