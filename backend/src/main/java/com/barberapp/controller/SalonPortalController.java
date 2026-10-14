package com.barberapp.controller;

import com.barberapp.dto.*;
import com.barberapp.entity.*;
import com.barberapp.entity.enums.BookingStatus;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.*;
import com.barberapp.security.UserPrincipal;
import com.barberapp.service.SlotLockService;
import com.barberapp.service.SalonAnalyticsService;
import com.barberapp.service.MediaStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/portal")
@RequiredArgsConstructor
@Slf4j
public class SalonPortalController {

    private final UserRepository userRepository;
    private final ShopRepository shopRepository;
    private final BarberRepository barberRepository;
    private final BookingRepository bookingRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final CustomerRepository customerRepository;
    private final WorkingHoursRepository workingHoursRepository;
    private final SlotLockService slotLockService;
    private final PasswordEncoder passwordEncoder;
    private final SalonAnalyticsService salonAnalyticsService;
    private final MediaStorageService mediaStorageService;
    private final SalonImageRepository salonImageRepository;
    private final com.barberapp.service.AuditLogService auditLogService;

    private static final List<BookingStatus> ACTIVE_CONFLICT_STATUSES = List.of(
            BookingStatus.HOLD,
            BookingStatus.CONFIRMED,
            BookingStatus.ARRIVED,
            BookingStatus.IN_SERVICE,
            BookingStatus.WALK_IN_RESERVED,
            BookingStatus.BLOCKED
    );

    // In-memory shift status store for real-time shift toggling
    private final Map<Long, String> shiftStatusMap = new ConcurrentHashMap<>();

    private User resolveAuthenticatedUser(UserPrincipal principal, Long requestedUserId) {
        if (principal != null && principal.getUserId() != null) {
            return userRepository.findById(principal.getUserId()).orElse(null);
        }
        if (requestedUserId != null) {
            return userRepository.findById(requestedUserId).orElse(null);
        }
        return null;
    }

    private Long resolveSalonId(User user) {
        if (user == null) return null;
        if (user.getSalonId() != null) return user.getSalonId();
        return shopRepository.findByOwnerId(user.getId()).stream()
                .findFirst().map(Shop::getId).orElse(null);
    }

    private Long parseAndResolveSalonId(String rawSalonId) {
        if (rawSalonId == null || rawSalonId.isBlank()) return null;
        String clean = rawSalonId.trim();
        if (clean.startsWith("shop-")) {
            clean = clean.substring(5);
        }
        try {
            Long parsed = Long.parseLong(clean);
            if (shopRepository.existsById(parsed)) {
                return parsed;
            }
        } catch (NumberFormatException ignored) {}

        // Fallback: look up by slug
        Shop shopBySlug = shopRepository.findBySlug(rawSalonId.trim()).orElse(null);
        if (shopBySlug != null) return shopBySlug.getId();

        // Default to golden-scissors if "shop-1" or "1"
        Shop golden = shopRepository.findBySlug("golden-scissors").orElse(null);
        if (golden != null) return golden.getId();

        return null;
    }

    private PortalBookingResponseDTO toDTO(Booking b) {
        return PortalBookingResponseDTO.builder()
                .id(b.getId())
                .shopId(b.getShop() != null ? b.getShop().getId() : null)
                .barberId(b.getBarber() != null ? b.getBarber().getId() : null)
                .barberName(b.getBarber() != null ? b.getBarber().getName() : "Barber")
                .serviceId(b.getService() != null ? b.getService().getId() : null)
                .serviceName(b.getService() != null ? b.getService().getName() : (b.getStatus() == BookingStatus.BLOCKED ? "Blocked / Maintenance" : "Walk-In Service"))
                .serviceDuration(b.getService() != null ? b.getService().getDurationMinutes() : 30)
                .servicePrice(b.getService() != null ? b.getService().getPrice().doubleValue() : 0.0)
                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : (b.getStatus() == BookingStatus.BLOCKED ? "Salon Internal" : "Walk-in Guest"))
                .customerPhone(b.getCustomer() != null ? b.getCustomer().getPhone() : "")
                .slotStart(b.getSlotStart())
                .slotEnd(b.getSlotEnd())
                .status(b.getStatus() != null ? b.getStatus().name() : "CONFIRMED")
                .cancellationReason(b.getCancellationReason())
                .notes(b.getNotes())
                .build();
    }

    /**
     * Resolves tenant context (Salon details, user identity, staff scope, accessible modules)
     */
    @GetMapping("/context")
    public ResponseEntity<?> getPortalContext(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String salonId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized", "message", "Authentication required to access salon portal."));
        }

        // Resolve Shop
        Long targetSalonId = user.getSalonId();
        if (targetSalonId == null && user.getRole() == UserRole.SUPER_ADMIN && salonId != null) {
            targetSalonId = parseAndResolveSalonId(salonId);
        }

        Shop shop = null;
        if (targetSalonId != null) {
            shop = shopRepository.findById(targetSalonId).orElse(null);
        } else {
            shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) {
                targetSalonId = shop.getId();
                user.setSalonId(targetSalonId);
                userRepository.save(user);
            }
        }

        if (shop == null && user.getRole() != UserRole.SUPER_ADMIN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Tenant Not Found", "message", "User is not assigned to any active salon."));
        }

        // Resolve staffId if user is SALON_STAFF
        Long staffId = null;
        boolean isStaff = user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER;
        boolean isOwner = user.getRole() == UserRole.SALON_OWNER || user.getRole() == UserRole.SHOP_OWNER || user.getRole() == UserRole.SUPER_ADMIN;

        if (isStaff) {
            Barber barber = barberRepository.findByUserId(user.getId()).orElse(null);
            if (barber != null) {
                staffId = barber.getId();
            }
        }

        // Accessible Modules based on RBAC Rules
        List<String> accessibleModules = new ArrayList<>();
        if (isOwner) {
            accessibleModules.addAll(List.of("bookings", "staff", "services", "settings"));
        } else if (isStaff) {
            accessibleModules.addAll(List.of("schedule", "profile"));
        }

        String shift = shiftStatusMap.getOrDefault(user.getId(), "ONLINE");

        UserDTO userDTO = UserDTO.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .salonId(shop != null ? shop.getId() : null)
                .salonName(shop != null ? shop.getName() : null)
                .salonSlug(shop != null ? shop.getSlug() : null)
                .phone(user.getPhone())
                .active(user.getActive())
                .staffId(staffId)
                .build();

        PortalContextResponseDTO response = PortalContextResponseDTO.builder()
                .salonId(shop != null ? shop.getId() : null)
                .salonName(shop != null ? shop.getName() : "Global Administration")
                .salonSlug(shop != null ? shop.getSlug() : null)
                .branch(shop != null ? shop.getDistrict() + ", " + shop.getCity() : "Riyadh Headquarter")
                .fullAddress(shop != null ? shop.getFullAddress() : null)
                .user(userDTO)
                .isOwner(isOwner)
                .isStaff(isStaff)
                .shiftStatus(shift)
                .accessibleModules(accessibleModules)
                .build();

        return ResponseEntity.ok(response);
    }

    /**
     * Tenant-Isolated Bookings Query
     * Enforces:
     * 1. Automatic tenant salonId scoping
     * 2. Staff Scope Restriction: SALON_STAFF queries strictly filtered by staffId = currentUser.id
     */
    @GetMapping("/bookings")
    public ResponseEntity<?> getPortalBookings(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long barberId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Unauthorized", "message", "Authentication required to query bookings."));
        }

        Long salonId = user.getSalonId();
        if (salonId == null && (user.getRole() == UserRole.SALON_OWNER || user.getRole() == UserRole.SHOP_OWNER)) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }

        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Bad Request", "message", "No salon assigned to user session."));
        }

        boolean isStaff = user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER;
        LocalDateTime parsedStart = parseFlexibleDate(startDate, true);
        LocalDateTime parsedEnd = parseFlexibleDate(endDate, false);

        Long effectiveBarberId = barberId;

        if (isStaff) {
            // Staff Scope Restriction: Must only query appointments assigned to this staff member
            Barber staffBarber = barberRepository.findByUserId(user.getId()).orElse(null);
            if (staffBarber == null) {
                staffBarber = barberRepository.findByShopId(salonId).stream()
                        .filter(b -> b.getName().toLowerCase().contains(user.getFullName().toLowerCase()))
                        .findFirst()
                        .orElse(null);
            }

            if (staffBarber == null) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Staff Profile Not Found", "message", "No barber record linked to staff user."));
            }

            Long staffBarberId = staffBarber.getId();

            // Guard: If staff attempts to request another barber's appointments, reject with 403
            if (barberId != null && !barberId.equals(staffBarberId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Staff Scope Restriction",
                                "message", "Staff members must never view or modify appointments assigned to other staff members."));
            }

            effectiveBarberId = staffBarberId;
        }

        List<Booking> bookings;
        if (parsedStart != null || parsedEnd != null) {
            bookings = bookingRepository.findBookingsByDateRange(salonId, effectiveBarberId, parsedStart, parsedEnd);
        } else if (effectiveBarberId != null) {
            bookings = bookingRepository.findByShopIdAndBarberId(salonId, effectiveBarberId);
        } else {
            bookings = bookingRepository.findByShopId(salonId);
        }

        List<PortalBookingResponseDTO> dtoList = bookings.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtoList);
    }

    private LocalDateTime parseFlexibleDate(String str, boolean isStart) {
        if (str == null || str.isBlank()) return null;
        try {
            String clean = str.trim();
            if (clean.endsWith("Z")) {
                clean = clean.substring(0, clean.length() - 1);
            }
            if (clean.length() == 10) {
                java.time.LocalDate ld = java.time.LocalDate.parse(clean);
                return isStart ? ld.atStartOfDay() : ld.atTime(23, 59, 59);
            }
            return LocalDateTime.parse(clean);
        } catch (Exception e) {
            log.warn("Could not parse date parameter '{}': {}", str, e.getMessage());
            return null;
        }
    }

    /**
     * Create Walk-In Booking
     * Concurrency conflict check prevents double-booking
     */
    @PostMapping("/bookings/walk-in")
    @Transactional
    public ResponseEntity<?> createWalkInBooking(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody Map<String, Object> payload) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned to session."));
        }

        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Shop not found."));
        }

        boolean isStaff = user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER;

        Long barberId = payload.get("barberId") != null ? Long.valueOf(payload.get("barberId").toString()) : null;
        if (isStaff) {
            Barber staffBarber = barberRepository.findByUserId(user.getId()).orElse(null);
            if (staffBarber == null) {
                staffBarber = barberRepository.findByShopId(salonId).stream()
                        .filter(b -> b.getName().toLowerCase().contains(user.getFullName().toLowerCase()))
                        .findFirst().orElse(null);
            }
            if (staffBarber == null || (barberId != null && !barberId.equals(staffBarber.getId()))) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Staff Scope Restriction", "message", "Staff members may only reserve walk-ins for their own chair."));
            }
            barberId = staffBarber.getId();
        }

        if (barberId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "barberId is required."));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Barber does not belong to this salon."));
        }

        if (barber.getIsActive() != null && !barber.getIsActive()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "Barber Inactive",
                    "message", "This staff barber is currently deactivated and cannot accept bookings."
            ));
        }

        // Parse slot start and calculate end
        String slotStartStr = (String) payload.get("slotStart");
        LocalDateTime slotStart;
        try {
            slotStart = LocalDateTime.parse(slotStartStr, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            slotStart = LocalDateTime.now().withSecond(0).withNano(0);
        }

        Long serviceId = payload.get("serviceId") != null ? Long.valueOf(payload.get("serviceId").toString()) : null;
        ServiceItem service = null;
        int durationMinutes = 30;
        if (serviceId != null) {
            service = serviceItemRepository.findById(serviceId).orElse(null);
            if (service != null && service.getDurationMinutes() != null) {
                durationMinutes = service.getDurationMinutes();
            }
        }
        LocalDateTime slotEnd = slotStart.plusMinutes(durationMinutes);

        boolean lockAcquired = true;
        if (slotLockService != null) {
            lockAcquired = slotLockService.acquireSlotHold(barberId, slotStart);
        }
        if (!lockAcquired) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Slot Lock Conflict",
                    "message", "This slot is currently being locked or held by another customer."
            ));
        }

        try {
            // Concurrency / Slot Conflict Check
            List<Booking> conflicts = bookingRepository.findConflictingBookings(
                    salonId, barberId, slotStart, slotEnd, ACTIVE_CONFLICT_STATUSES, null);
            if (!conflicts.isEmpty()) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Slot Conflict",
                        "message", "This slot conflicts with an existing booking or blocked schedule for " + barber.getName() + "."
                ));
            }

            // Find or create walk-in customer
            String customerName = (String) payload.getOrDefault("customerName", "Walk-in Guest");
            String customerPhone = (String) payload.getOrDefault("customerPhone", "0500000000");
            Customer customer = customerRepository.findByPhone(customerPhone).orElseGet(() ->
                    customerRepository.save(Customer.builder()
                            .fullName(customerName)
                            .phone(customerPhone)
                            .email(customerPhone.replaceAll("[^0-9]", "") + "@walkin.guest")
                            .build())
            );

            Booking booking = Booking.builder()
                    .shop(shop)
                    .barber(barber)
                    .service(service)
                    .customer(customer)
                    .slotStart(slotStart)
                    .slotEnd(slotEnd)
                    .status(BookingStatus.WALK_IN_RESERVED)
                    .notes((String) payload.getOrDefault("notes", "Quick Walk-In Customer"))
                    .build();

            booking = bookingRepository.save(booking);
            log.info("Created Walk-in booking #{} for shop {} barber {}", booking.getId(), salonId, barber.getId());

            auditLogService.logEvent(
                    user,
                    shop,
                    "BOOKING_CONFIRMED",
                    String.format("Walk-in appointment created: Guest '%s' (%s) with %s for %s",
                            customerName, customerPhone, barber.getName(), service != null ? service.getName() : "General Service"),
                    "127.0.0.1"
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(toDTO(booking));
        } finally {
            if (slotLockService != null && lockAcquired) {
                slotLockService.releaseSlotHold(barberId, slotStart);
            }
        }
    }

    /**
     * Block Slot for Salon Maintenance / Staff Breaks (Owner only)
     */
    @PostMapping("/bookings/block")
    @Transactional
    public ResponseEntity<?> blockSlot(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody Map<String, Object> payload) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        boolean isStaff = user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER;
        if (isStaff) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Access Denied", "message", "Only salon owners can block slots for maintenance or breaks."));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned to session."));
        }

        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Shop not found."));
        }

        Long barberId = payload.get("barberId") != null ? Long.valueOf(payload.get("barberId").toString()) : null;
        if (barberId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "barberId is required."));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Barber does not belong to this salon."));
        }

        LocalDateTime slotStart = LocalDateTime.parse((String) payload.get("slotStart"), DateTimeFormatter.ISO_DATE_TIME);
        LocalDateTime slotEnd = LocalDateTime.parse((String) payload.get("slotEnd"), DateTimeFormatter.ISO_DATE_TIME);
        String reason = (String) payload.getOrDefault("reason", "Salon Maintenance / Break");

        // Conflict check
        List<Booking> conflicts = bookingRepository.findConflictingBookings(
                salonId, barberId, slotStart, slotEnd, ACTIVE_CONFLICT_STATUSES, null);
        if (!conflicts.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Slot Conflict",
                    "message", "Cannot block slot: an active appointment already exists in this time window."
            ));
        }

        Booking booking = Booking.builder()
                .shop(shop)
                .barber(barber)
                .service(null)
                .customer(null)
                .slotStart(slotStart)
                .slotEnd(slotEnd)
                .status(BookingStatus.BLOCKED)
                .notes(reason)
                .build();

        booking = bookingRepository.save(booking);
        log.info("Blocked slot #{} for shop {} barber {}: {}", booking.getId(), salonId, barberId, reason);

        return ResponseEntity.status(HttpStatus.CREATED).body(toDTO(booking));
    }

    /**
     * Update Booking Status (e.g. ARRIVED, IN_SERVICE, COMPLETED, NO_SHOW, CANCELLED)
     */
    @PatchMapping("/bookings/{id}/status")
    @Transactional
    public ResponseEntity<?> updateBookingStatus(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam(required = false) Long userId,
            @RequestBody Map<String, String> payload) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Booking not found."));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }

        if (salonId == null || !booking.getShop().getId().equals(salonId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied: Tenant mismatch."));
        }

        boolean isStaff = user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER;
        boolean isOwner = user.getRole() == UserRole.SALON_OWNER || user.getRole() == UserRole.SHOP_OWNER || user.getRole() == UserRole.SUPER_ADMIN;

        String targetStatusStr = payload.get("status");
        if (targetStatusStr == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Status is required."));
        }

        BookingStatus newStatus;
        try {
            newStatus = BookingStatus.valueOf(targetStatusStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid status: " + targetStatusStr));
        }

        if (isStaff) {
            Barber staffBarber = barberRepository.findByUserId(user.getId()).orElse(null);
            if (staffBarber == null) {
                staffBarber = barberRepository.findByShopId(salonId).stream()
                        .filter(b -> b.getName().toLowerCase().contains(user.getFullName().toLowerCase()))
                        .findFirst().orElse(null);
            }

            if (staffBarber == null || !booking.getBarber().getId().equals(staffBarber.getId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Staff Scope Restriction", "message", "You cannot modify appointments of other staff members."));
            }

            // Staff can mark Arrived, In-Service, Completed, or No-Show
            List<BookingStatus> allowedStaffStatuses = List.of(
                    BookingStatus.ARRIVED,
                    BookingStatus.IN_SERVICE,
                    BookingStatus.COMPLETED,
                    BookingStatus.NO_SHOW
            );

            if (!allowedStaffStatuses.contains(newStatus)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Forbidden", "message", "Staff members cannot cancel or block appointments. Only operational status updates (Arrived, In-Service, Completed, No-Show) are permitted."));
            }
        }

        if (newStatus == BookingStatus.CANCELLED) {
            String reason = payload.getOrDefault("cancellationReason", "Customer requested cancellation");
            booking.setCancellationReason(reason);
        }

        booking.setStatus(newStatus);
        booking = bookingRepository.save(booking);
        log.info("Booking #{} status updated to {}", booking.getId(), newStatus);

        auditLogService.logEvent(
                user,
                booking.getShop(),
                "BOOKING_STATUS_CHANGED",
                String.format("Booking #%d status changed to %s for salon '%s'",
                        booking.getId(), newStatus, booking.getShop() != null ? booking.getShop().getName() : "Global Platform"),
                "127.0.0.1"
        );

        return ResponseEntity.ok(toDTO(booking));
    }

    /**
     * Reassign Booking to Another Staff Member (Owner only)
     * Concurrency conflict check on target staff member
     */
    @PatchMapping("/bookings/{id}/reassign")
    @Transactional
    public ResponseEntity<?> reassignBooking(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam(required = false) Long userId,
            @RequestBody Map<String, Object> payload) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        boolean isOwner = user.getRole() == UserRole.SALON_OWNER || user.getRole() == UserRole.SHOP_OWNER || user.getRole() == UserRole.SUPER_ADMIN;
        if (!isOwner) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Access Denied", "message", "Only salon owners can reassign bookings to other staff members."));
        }

        Booking booking = bookingRepository.findById(id).orElse(null);
        if (booking == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Booking not found."));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }

        if (salonId == null || !booking.getShop().getId().equals(salonId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied: Tenant mismatch."));
        }

        Long newBarberId = payload.get("newBarberId") != null ? Long.valueOf(payload.get("newBarberId").toString()) : null;
        if (newBarberId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "newBarberId is required."));
        }

        Barber newBarber = barberRepository.findById(newBarberId).orElse(null);
        if (newBarber == null || !newBarber.getShop().getId().equals(salonId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Target barber does not belong to this salon."));
        }

        // Concurrency Conflict Check on target barber
        List<Booking> conflicts = bookingRepository.findConflictingBookings(
                salonId, newBarberId, booking.getSlotStart(), booking.getSlotEnd(), ACTIVE_CONFLICT_STATUSES, booking.getId());
        if (!conflicts.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Slot Conflict",
                    "message", "Target barber " + newBarber.getName() + " already has a conflicting appointment in this time window."
            ));
        }

        booking.setBarber(newBarber);
        booking = bookingRepository.save(booking);
        log.info("Booking #{} reassigned to barber #{} ({})", booking.getId(), newBarber.getId(), newBarber.getName());

        return ResponseEntity.ok(toDTO(booking));
    }

    private StaffMemberDTO toStaffDTO(Barber b) {
        List<WorkingHours> hours = workingHoursRepository.findByBarberIdOrderByDayOfWeekAsc(b.getId());
        String scheduleSummary = formatScheduleSummary(hours);

        String skills = (b.getSkills() != null && !b.getSkills().trim().isEmpty())
                ? b.getSkills()
                : "Haircut, Beard Trim, Hot Towel";
        List<String> skillsTags = Arrays.stream(skills.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());

        List<BookingStatus> activeStatuses = List.of(BookingStatus.CONFIRMED, BookingStatus.HOLD, BookingStatus.WALK_IN_RESERVED, BookingStatus.IN_SERVICE);
        int upcomingCount = 0;
        try {
            Long sId = b.getShop() != null ? b.getShop().getId() : null;
            if (sId != null) {
                upcomingCount = bookingRepository.findUpcomingActiveBookings(sId, b.getId(), activeStatuses, LocalDateTime.now()).size();
            }
        } catch (Exception e) {
            log.warn("Could not calculate upcoming bookings for barber #{}: {}", b.getId(), e.getMessage());
        }

        return StaffMemberDTO.builder()
                .id(b.getId())
                .userId(b.getUser() != null ? b.getUser().getId() : null)
                .name(b.getName())
                .specialty(b.getSpecialty() != null ? b.getSpecialty() : "Master Barber")
                .phone(b.getPhone() != null ? b.getPhone() : (b.getUser() != null ? b.getUser().getPhone() : ""))
                .email(b.getEmail() != null ? b.getEmail() : (b.getUser() != null && b.getUser().getEmail() != null && !b.getUser().getEmail().endsWith(".internal") ? b.getUser().getEmail() : null))
                .status(b.getStatus() != null ? b.getStatus() : "ACTIVE")
                .isActive(b.getIsActive() != null ? b.getIsActive() : true)
                .photoUrl(b.getPhotoUrl())
                .avatarUrl(b.getPhotoUrl())
                .skills(skills)
                .skillsTags(skillsTags)
                .upcomingBookingsCount(upcomingCount)
                .scheduleSummary(scheduleSummary)
                .build();
    }

    private String formatScheduleSummary(List<WorkingHours> hours) {
        if (hours == null || hours.isEmpty()) {
            return "Sun-Thu: 09:00 - 21:00 (Break: 13:00-14:00), Fri Off";
        }
        long workingDays = hours.stream().filter(h -> Boolean.FALSE.equals(h.getIsOff())).count();
        Optional<WorkingHours> sampleWork = hours.stream().filter(h -> Boolean.FALSE.equals(h.getIsOff())).findFirst();
        if (sampleWork.isPresent()) {
            WorkingHours sw = sampleWork.get();
            String breakInfo = (sw.getBreakStart() != null && sw.getBreakEnd() != null)
                    ? String.format(" (Break: %s-%s)", sw.getBreakStart(), sw.getBreakEnd())
                    : "";
            return String.format("%d Days/Wk: %s - %s%s", workingDays, sw.getStartTime(), sw.getEndTime(), breakInfo);
        }
        return "Custom Roster";
    }

    private void seedDefaultWorkingHours(Barber barber) {
        for (int day = 1; day <= 7; day++) {
            boolean isOff = (day == 6); // Friday off by default
            LocalTime start = LocalTime.of(9, 0);
            LocalTime end = LocalTime.of(21, 0);
            LocalTime bStart = isOff ? null : LocalTime.of(13, 0);
            LocalTime bEnd = isOff ? null : LocalTime.of(14, 0);

            WorkingHours wh = WorkingHours.builder()
                    .barber(barber)
                    .dayOfWeek(day)
                    .startTime(start)
                    .endTime(end)
                    .isOff(isOff)
                    .breakStart(bStart)
                    .breakEnd(bEnd)
                    .build();
            workingHoursRepository.save(wh);
        }
    }

    /**
     * 1. Salon Staff Management (Owner only)
     */
    @GetMapping("/staff")
    public ResponseEntity<?> getPortalStaff(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String salonId,
            @RequestHeader(value = "X-Salon-Id", required = false) String xSalonId) {

        User user = resolveAuthenticatedUser(principal, userId);

        Long targetSalonId = parseAndResolveSalonId(salonId != null && !salonId.isBlank() ? salonId : xSalonId);

        if (user != null) {
            // RBAC Rule: SALON_STAFF is strictly forbidden from staff management
            if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Access Denied", "message", "Staff members are restricted from staff management module."));
            }
            if (targetSalonId == null) {
                targetSalonId = resolveSalonId(user);
            }
        }

        if (targetSalonId == null) {
            Shop defaultShop = shopRepository.findBySlug("golden-scissors")
                    .orElseGet(() -> shopRepository.findAll().stream().findFirst().orElse(null));
            if (defaultShop != null) {
                targetSalonId = defaultShop.getId();
            }
        }

        if (targetSalonId == null) {
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        List<Barber> barbers = barberRepository.findByShopIdAndDeletedAtIsNull(targetSalonId);
        List<StaffMemberDTO> dtos = barbers.stream().map(this::toStaffDTO).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/staff")
    @Transactional
    public ResponseEntity<?> addStaffMember(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String salonId,
            @RequestHeader(value = "X-Salon-Id", required = false) String xSalonId,
            @RequestBody InviteStaffRequestDTO request) {

        User user = resolveAuthenticatedUser(principal, userId);
        Long targetSalonId = parseAndResolveSalonId(salonId != null && !salonId.isBlank() ? salonId : xSalonId);

        if (user != null) {
            if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
            }
            if (targetSalonId == null) {
                targetSalonId = resolveSalonId(user);
            }
        }

        if (targetSalonId == null) {
            Shop defaultShop = shopRepository.findBySlug("golden-scissors")
                    .orElseGet(() -> shopRepository.findAll().stream().findFirst().orElse(null));
            if (defaultShop != null) targetSalonId = defaultShop.getId();
        }

        Shop shop = targetSalonId != null ? shopRepository.findById(targetSalonId).orElse(null) : null;
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Salon not found"));
        }

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Name is required"));
        }

        String cleanPhone = (request.getPhone() != null && !request.getPhone().trim().isEmpty())
                ? request.getPhone().trim()
                : null;

        if (cleanPhone != null) {
            Optional<Barber> existingBarberInShop = barberRepository.findByShopIdAndPhone(shop.getId(), cleanPhone);
            if (existingBarberInShop.isPresent() && existingBarberInShop.get().getDeletedAt() == null) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Phone Already Registered",
                        "message", "A staff member with this phone number already exists in your salon roster."
                ));
            }
        }

        String rawEmail = (request.getEmail() != null && !request.getEmail().trim().isEmpty())
                ? request.getEmail().trim().toLowerCase()
                : null;

        // If email is provided, verify uniqueness
        if (rawEmail != null) {
            if (userRepository.findByEmail(rawEmail).isPresent()) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Email Already Exists",
                        "message", "A user account with this email address already exists."
                ));
            }
        }

        // Email for login account: use provided email, or generate safe internal login email
        String safeLoginEmail = rawEmail;
        if (safeLoginEmail == null) {
            String shopSlug = shop.getSlug() != null ? shop.getSlug() : "salon";
            String phoneDigits = cleanPhone != null ? cleanPhone.replaceAll("[^0-9]", "") : "";
            safeLoginEmail = "staff." + (phoneDigits.isEmpty() ? System.currentTimeMillis() : phoneDigits) + "@" + shopSlug + ".internal";
            int counter = 1;
            while (userRepository.findByEmail(safeLoginEmail).isPresent()) {
                safeLoginEmail = "staff." + System.currentTimeMillis() + "." + counter + "@" + shopSlug + ".internal";
                counter++;
            }
        }

        String rawPassword = (request.getPassword() != null && !request.getPassword().trim().isEmpty())
                ? request.getPassword().trim()
                : "Staff123!";

        boolean isActive = request.getIsActive() != null ? request.getIsActive() : true;
        String status = (request.getStatus() != null && !request.getStatus().trim().isEmpty())
                ? request.getStatus().trim().toUpperCase()
                : (isActive ? "ACTIVE" : "OFFLINE");
        String skills = (request.getSkills() != null && !request.getSkills().trim().isEmpty())
                ? request.getSkills().trim()
                : "Haircut, Beard Trim, Hot Towel";

        User staffUser = null;
        if (cleanPhone != null) {
            Optional<User> existingUserByPhone = userRepository.findByPhone(cleanPhone);
            if (existingUserByPhone.isPresent()) {
                User eu = existingUserByPhone.get();
                Optional<Barber> tiedBarber = barberRepository.findAll().stream()
                        .filter(b -> b.getUser() != null && b.getUser().getId().equals(eu.getId()) && b.getDeletedAt() == null)
                        .findFirst();
                if (tiedBarber.isPresent()) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                            "error", "Phone Already In Use",
                            "message", "Phone number is already associated with staff member: " + tiedBarber.get().getName()
                    ));
                }
                eu.setRole(UserRole.SALON_STAFF);
                eu.setSalonId(shop.getId());
                eu.setFullName(request.getName().trim());
                eu.setActive(isActive);
                if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
                    eu.setPassword(passwordEncoder.encode(request.getPassword().trim()));
                }
                if (rawEmail != null) {
                    eu.setEmail(rawEmail);
                }
                staffUser = userRepository.save(eu);
            }
        }

        if (staffUser == null) {
            staffUser = User.builder()
                    .email(safeLoginEmail)
                    .password(passwordEncoder.encode(rawPassword))
                    .fullName(request.getName().trim())
                    .phone(cleanPhone)
                    .role(UserRole.SALON_STAFF)
                    .salonId(shop.getId())
                    .active(isActive)
                    .build();
            staffUser = userRepository.save(staffUser);
        }

        Barber barber = Barber.builder()
                .shop(shop)
                .user(staffUser)
                .name(request.getName().trim())
                .specialty(request.getSpecialty() != null && !request.getSpecialty().isBlank() ? request.getSpecialty().trim() : "Master Barber")
                .phone(cleanPhone)
                .email(rawEmail)
                .skills(skills)
                .status(status)
                .isActive(isActive)
                .photoUrl(request.resolveAvatarUrl())
                .build();
        barber = barberRepository.save(barber);

        seedDefaultWorkingHours(barber);

        auditLogService.logEvent(
                user != null ? user : staffUser,
                shop,
                "STAFF_CREATED",
                String.format("Staff member '%s' added to salon '%s' (Specialty: %s, Phone: %s)",
                        barber.getName(), shop.getName(), barber.getSpecialty(), barber.getPhone()),
                "127.0.0.1"
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(toStaffDTO(barber));
    }

    @PutMapping("/staff/{id}")
    @Transactional
    public ResponseEntity<?> updateStaffMember(
            @PathVariable("id") Long barberId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String salonId,
            @RequestHeader(value = "X-Salon-Id", required = false) String xSalonId,
            @RequestBody InviteStaffRequestDTO request) {

        User user = resolveAuthenticatedUser(principal, userId);
        Long targetSalonId = parseAndResolveSalonId(salonId != null && !salonId.isBlank() ? salonId : xSalonId);

        if (user != null) {
            if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
            }
            if (targetSalonId == null) {
                targetSalonId = resolveSalonId(user);
            }
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || barber.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Barber not found"));
        }

        if (targetSalonId != null && barber.getShop() != null && !barber.getShop().getId().equals(targetSalonId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Barber does not belong to your salon"));
        }

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Name is required"));
        }

        // Active status conflict check if deactivating
        Boolean nextActive = request.getIsActive();
        if (nextActive != null && !nextActive && Boolean.TRUE.equals(barber.getIsActive())) {
            List<Booking> upcoming = bookingRepository.findUpcomingActiveBookings(
                    barber.getShop().getId(),
                    barber.getId(),
                    ACTIVE_CONFLICT_STATUSES,
                    LocalDateTime.now()
            );
            if (!upcoming.isEmpty()) {
                List<Map<String, Object>> bookingDetails = upcoming.stream().map(b -> Map.<String, Object>of(
                        "id", b.getId(),
                        "customerName", b.getCustomer() != null ? b.getCustomer().getFullName() : "Customer",
                        "serviceName", b.getService() != null ? b.getService().getName() : "Service",
                        "slotStart", b.getSlotStart() != null ? b.getSlotStart().toString() : "",
                        "status", b.getStatus() != null ? b.getStatus().name() : ""
                )).collect(Collectors.toList());

                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "CONFLICT",
                        "message", "Cannot deactivate " + barber.getName() + " because they have " + upcoming.size() + " future active appointments.",
                        "conflictCount", upcoming.size(),
                        "upcomingBookings", bookingDetails
                ));
            }
        }

        // Handle Email (Optional)
        String rawEmail = (request.getEmail() != null && !request.getEmail().trim().isEmpty())
                ? request.getEmail().trim().toLowerCase()
                : null;

        User linkedUser = barber.getUser();
        if (rawEmail != null) {
            Optional<User> existingUser = userRepository.findByEmail(rawEmail);
            if (existingUser.isPresent() && (linkedUser == null || !existingUser.get().getId().equals(linkedUser.getId()))) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Email Already Exists",
                        "message", "A user account with this email address already belongs to another user."
                ));
            }
            barber.setEmail(rawEmail);
            if (linkedUser != null) {
                linkedUser.setEmail(rawEmail);
            }
        } else {
            barber.setEmail(null);
        }

        // Update Barber properties
        barber.setName(request.getName().trim());
        if (request.getSpecialty() != null && !request.getSpecialty().isBlank()) {
            barber.setSpecialty(request.getSpecialty().trim());
        }
        if (request.getSkills() != null && !request.getSkills().isBlank()) {
            barber.setSkills(request.getSkills().trim());
        }
        if (request.getPhone() != null && !request.getPhone().trim().isEmpty()) {
            String cleanPhone = request.getPhone().trim();
            Optional<User> existingPhoneUser = userRepository.findByPhone(cleanPhone);
            if (existingPhoneUser.isPresent() && (linkedUser == null || !existingPhoneUser.get().getId().equals(linkedUser.getId()))) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Phone Already In Use",
                        "message", "A user account with this phone number already belongs to another user."
                ));
            }
            barber.setPhone(cleanPhone);
            if (linkedUser != null) {
                linkedUser.setPhone(cleanPhone);
            }
        }
        if (request.resolveAvatarUrl() != null) {
            barber.setPhotoUrl(request.resolveAvatarUrl());
        }
        if (request.getIsActive() != null) {
            barber.setIsActive(request.getIsActive());
        }
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            barber.setStatus(request.getStatus().trim().toUpperCase());
        }

        // Update linked User if present
        if (linkedUser != null) {
            linkedUser.setFullName(request.getName().trim());
            if (request.getIsActive() != null) {
                linkedUser.setActive(request.getIsActive());
            }
            if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
                linkedUser.setPassword(passwordEncoder.encode(request.getPassword().trim()));
            }
            userRepository.save(linkedUser);
        }

        barber = barberRepository.save(barber);

        Shop shop = barber.getShop();
        auditLogService.logEvent(
                user != null ? user : linkedUser,
                shop,
                "STAFF_UPDATED",
                String.format("Staff profile updated for '%s' (Barber ID: %d in '%s')",
                        barber.getName(), barber.getId(), shop != null ? shop.getName() : "Unknown"),
                "127.0.0.1"
        );

        return ResponseEntity.ok(toStaffDTO(barber));
    }

    @GetMapping("/staff/{id}/schedule")
    public ResponseEntity<?> getStaffSchedule(
            @PathVariable("id") Long barberId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId) || barber.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Barber not found"));
        }

        List<WorkingHours> hours = workingHoursRepository.findByBarberIdOrderByDayOfWeekAsc(barberId);
        if (hours.isEmpty()) {
            seedDefaultWorkingHours(barber);
            hours = workingHoursRepository.findByBarberIdOrderByDayOfWeekAsc(barberId);
        }

        String[] dayNames = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
        List<StaffScheduleDTO.DayScheduleItem> dayItems = new ArrayList<>();
        for (WorkingHours wh : hours) {
            int d = wh.getDayOfWeek();
            String name = (d >= 1 && d <= 7) ? dayNames[d - 1] : "Day " + d;
            dayItems.add(StaffScheduleDTO.DayScheduleItem.builder()
                    .dayOfWeek(d)
                    .dayName(name)
                    .startTime(wh.getStartTime())
                    .endTime(wh.getEndTime())
                    .isOff(wh.getIsOff())
                    .breakStart(wh.getBreakStart())
                    .breakEnd(wh.getBreakEnd())
                    .build());
        }

        return ResponseEntity.ok(StaffScheduleDTO.builder()
                .barberId(barberId)
                .days(dayItems)
                .build());
    }

    @PutMapping("/staff/{id}/schedule")
    @Transactional
    public ResponseEntity<?> updateStaffSchedule(
            @PathVariable("id") Long barberId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody StaffScheduleDTO request) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied", "message", "Staff cannot modify working hours."));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId) || barber.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Barber not found"));
        }

        if (request.getDays() != null) {
            for (StaffScheduleDTO.DayScheduleItem item : request.getDays()) {
                if (!Boolean.TRUE.equals(item.getIsOff())) {
                    if (item.getStartTime() == null || item.getEndTime() == null) {
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(Map.of("error", "Invalid Shift Time",
                                        "message", "Start time and end time are required for working days."));
                    }
                    if (!item.getEndTime().isAfter(item.getStartTime())) {
                        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(Map.of("error", "Invalid Shift Time",
                                        "message", "Shift end time must be strictly after shift start time for " + (item.getDayName() != null ? item.getDayName() : "Day " + item.getDayOfWeek()) + "."));
                    }
                    if (item.getBreakStart() != null || item.getBreakEnd() != null) {
                        if (item.getBreakStart() == null || item.getBreakEnd() == null) {
                            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                    .body(Map.of("error", "Invalid Break Time",
                                            "message", "Both break start and break end must be specified for " + (item.getDayName() != null ? item.getDayName() : "Day " + item.getDayOfWeek()) + "."));
                        }
                        if (!item.getBreakEnd().isAfter(item.getBreakStart())) {
                            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                    .body(Map.of("error", "Invalid Break Time",
                                            "message", "Break end time must be strictly after break start time for " + (item.getDayName() != null ? item.getDayName() : "Day " + item.getDayOfWeek()) + "."));
                        }
                        if (item.getBreakStart().isBefore(item.getStartTime()) || item.getBreakEnd().isAfter(item.getEndTime())) {
                            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                    .body(Map.of("error", "Invalid Break Time",
                                            "message", "Break intervals must fall within shift hours (" + item.getStartTime() + " - " + item.getEndTime() + ") for " + (item.getDayName() != null ? item.getDayName() : "Day " + item.getDayOfWeek()) + "."));
                        }
                    }
                }
            }
        }

        workingHoursRepository.deleteByBarberId(barberId);

        if (request.getDays() != null) {
            for (StaffScheduleDTO.DayScheduleItem item : request.getDays()) {
                WorkingHours wh = WorkingHours.builder()
                        .barber(barber)
                        .dayOfWeek(item.getDayOfWeek())
                        .startTime(item.getStartTime() != null ? item.getStartTime() : LocalTime.of(9, 0))
                        .endTime(item.getEndTime() != null ? item.getEndTime() : LocalTime.of(21, 0))
                        .isOff(Boolean.TRUE.equals(item.getIsOff()))
                        .breakStart(item.getBreakStart())
                        .breakEnd(item.getBreakEnd())
                        .build();
                workingHoursRepository.save(wh);
            }
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "Working hours and break schedule updated successfully."));
    }

    @PatchMapping("/staff/{id}/status")
    public ResponseEntity<?> updateStaffStatus(
            @PathVariable("id") Long barberId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody Map<String, Object> payload) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId) || barber.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Barber not found"));
        }

        boolean willDeactivate = false;
        if (payload.containsKey("isActive") && payload.get("isActive") != null) {
            boolean active = Boolean.parseBoolean(payload.get("isActive").toString());
            if (!active && Boolean.TRUE.equals(barber.getIsActive())) {
                willDeactivate = true;
            }
        }
        if (payload.containsKey("status") && payload.get("status") != null) {
            String newStatus = payload.get("status").toString().toUpperCase();
            if ("OFFLINE".equals(newStatus) && !"OFFLINE".equals(barber.getStatus())) {
                willDeactivate = true;
            }
        }

        if (willDeactivate) {
            List<BookingStatus> activeStatuses = List.of(BookingStatus.CONFIRMED, BookingStatus.HOLD, BookingStatus.WALK_IN_RESERVED, BookingStatus.IN_SERVICE);
            List<Booking> upcoming = bookingRepository.findUpcomingActiveBookings(salonId, barberId, activeStatuses, LocalDateTime.now());
            if (!upcoming.isEmpty()) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Active Bookings Conflict",
                        "message", "Cannot deactivate staff member with upcoming active appointments. Please reassign or cancel remaining appointments first.",
                        "conflictCount", upcoming.size(),
                        "upcomingBookings", upcoming.stream().map(this::toDTO).collect(Collectors.toList())
                ));
            }
        }

        if (payload.containsKey("status") && payload.get("status") != null) {
            barber.setStatus(payload.get("status").toString().toUpperCase());
        }
        if (payload.containsKey("isActive") && payload.get("isActive") != null) {
            boolean active = Boolean.parseBoolean(payload.get("isActive").toString());
            barber.setIsActive(active);
            if (!active) {
                barber.setStatus("OFFLINE");
            }
        }

        barber = barberRepository.save(barber);

        auditLogService.logEvent(
                user,
                barber.getShop(),
                "STAFF_STATUS_CHANGE",
                String.format("Staff '%s' (ID: %d) status changed to %s (Active: %b) in salon '%s'",
                        barber.getName(), barber.getId(), barber.getStatus(), barber.getIsActive(),
                        barber.getShop() != null ? barber.getShop().getName() : "Assigned Salon"),
                "127.0.0.1"
        );

        return ResponseEntity.ok(toStaffDTO(barber));
    }

    @DeleteMapping("/staff/{id}")
    @Transactional
    public ResponseEntity<?> deleteStaffMember(
            @PathVariable("id") Long barberId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId) || barber.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Barber not found"));
        }

        List<BookingStatus> activeStatuses = List.of(BookingStatus.CONFIRMED, BookingStatus.HOLD, BookingStatus.WALK_IN_RESERVED, BookingStatus.IN_SERVICE);
        List<Booking> upcoming = bookingRepository.findUpcomingActiveBookings(salonId, barberId, activeStatuses, LocalDateTime.now());
        if (!upcoming.isEmpty()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "error", "Active Bookings Conflict",
                    "message", "Cannot delete staff member with upcoming active appointments. Please reassign or cancel remaining appointments first.",
                    "conflictCount", upcoming.size(),
                    "upcomingBookings", upcoming.stream().map(this::toDTO).collect(Collectors.toList())
            ));
        }

        barber.setIsActive(false);
        barber.setStatus("OFFLINE");
        barber.setDeletedAt(LocalDateTime.now());
        if (barber.getUser() != null) {
            barber.getUser().setActive(false);
            userRepository.save(barber.getUser());
        }
        barberRepository.save(barber);

        auditLogService.logEvent(
                user,
                barber.getShop(),
                "DELETE_STAFF",
                String.format("Staff member '%s' (ID: %d) deleted from salon '%s'",
                        barber.getName(), barber.getId(), barber.getShop() != null ? barber.getShop().getName() : "Assigned Salon"),
                "127.0.0.1"
        );

        return ResponseEntity.ok(Map.of("success", true, "message", "Staff member removed successfully."));
    }

    @GetMapping("/staff/{id}/upcoming-bookings")
    public ResponseEntity<?> getUpcomingStaffBookings(
            @PathVariable("id") Long barberId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId) || barber.getDeletedAt() != null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Barber not found"));
        }

        List<BookingStatus> activeStatuses = List.of(BookingStatus.CONFIRMED, BookingStatus.HOLD, BookingStatus.WALK_IN_RESERVED, BookingStatus.IN_SERVICE);
        List<Booking> upcoming = bookingRepository.findUpcomingActiveBookings(salonId, barberId, activeStatuses, LocalDateTime.now());
        List<PortalBookingResponseDTO> dtos = upcoming.stream().map(this::toDTO).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * 2. Services & Catalog for Salon (Owner only)
     */
    @GetMapping("/services")
    public ResponseEntity<?> getPortalServices(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }

        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        return ResponseEntity.ok(serviceItemRepository.findByShopId(salonId));
    }

    @PostMapping("/services")
    public ResponseEntity<?> createService(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody ServiceRequestDTO request) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }
        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Salon not found"));
        }

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Service name is required"));
        }

        ServiceItem service = ServiceItem.builder()
                .shop(shop)
                .name(request.getName().trim())
                .category(request.getCategory() != null ? request.getCategory() : "General")
                .description(request.getDescription())
                .price(request.getPrice() != null ? request.getPrice() : BigDecimal.valueOf(50.0))
                .durationMinutes(request.getDurationMinutes() != null ? request.getDurationMinutes() : 30)
                .bufferMinutes(request.getBufferMinutes() != null ? request.getBufferMinutes() : 5)
                .isVisible(request.getIsVisible() != null ? request.getIsVisible() : true)
                .assignedStaffIds(request.getAssignedStaffIds() != null ? request.getAssignedStaffIds() : "ALL")
                .build();

        service = serviceItemRepository.save(service);

        auditLogService.logEvent(
                user,
                shop,
                "SERVICE_CREATED",
                String.format("New service created: '%s' (%s SAR, %d mins) in salon '%s'",
                        service.getName(), service.getPrice(), service.getDurationMinutes(), shop.getName()),
                "127.0.0.1"
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(service);
    }

    @PutMapping("/services/{id}")
    public ResponseEntity<?> updateService(
            @PathVariable("id") Long serviceId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody ServiceRequestDTO request) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        ServiceItem service = serviceItemRepository.findById(serviceId).orElse(null);
        if (service == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Service not found"));
        }

        if (request.getName() != null) service.setName(request.getName().trim());
        if (request.getCategory() != null) service.setCategory(request.getCategory());
        if (request.getDescription() != null) service.setDescription(request.getDescription());
        if (request.getPrice() != null) service.setPrice(request.getPrice());
        if (request.getDurationMinutes() != null) service.setDurationMinutes(request.getDurationMinutes());
        if (request.getBufferMinutes() != null) service.setBufferMinutes(request.getBufferMinutes());
        if (request.getIsVisible() != null) service.setIsVisible(request.getIsVisible());
        if (request.getAssignedStaffIds() != null) service.setAssignedStaffIds(request.getAssignedStaffIds());

        service = serviceItemRepository.save(service);

        auditLogService.logEvent(
                user,
                service.getShop(),
                "SERVICE_UPDATED",
                String.format("Service '%s' (ID: %d) updated (%s SAR, %d mins)",
                        service.getName(), service.getId(), service.getPrice(), service.getDurationMinutes()),
                "127.0.0.1"
        );

        return ResponseEntity.ok(service);
    }

    @PatchMapping("/services/{id}/visibility")
    public ResponseEntity<?> toggleServiceVisibility(
            @PathVariable("id") Long serviceId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody(required = false) Map<String, Object> payload) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        ServiceItem service = serviceItemRepository.findById(serviceId).orElse(null);
        if (service == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Service not found"));
        }

        if (payload != null && payload.containsKey("isVisible")) {
            service.setIsVisible(Boolean.parseBoolean(payload.get("isVisible").toString()));
        } else {
            service.setIsVisible(!Boolean.TRUE.equals(service.getIsVisible()));
        }

        service = serviceItemRepository.save(service);
        return ResponseEntity.ok(service);
    }

    @DeleteMapping("/services/{id}")
    public ResponseEntity<?> deleteService(
            @PathVariable("id") Long serviceId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        ServiceItem service = serviceItemRepository.findById(serviceId).orElse(null);
        if (service == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Service not found"));
        }

        serviceItemRepository.delete(service);

        auditLogService.logEvent(
                user,
                service.getShop(),
                "SERVICE_DELETED",
                String.format("Service '%s' (ID: %d) deleted", service.getName(), service.getId()),
                "127.0.0.1"
        );

        return ResponseEntity.ok(Map.of("success", true, "message", "Service deleted successfully."));
    }

    /**
     * 3. Salon Operations & Profile Settings (Owner only)
     */
    @GetMapping("/settings")
    public ResponseEntity<?> getSalonSettings(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }
        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Salon not found"));
        }

        String defaultHours = "{\"sunday\":{\"open\":\"09:00\",\"close\":\"22:00\",\"closed\":false},\"monday\":{\"open\":\"09:00\",\"close\":\"22:00\",\"closed\":false},\"tuesday\":{\"open\":\"09:00\",\"close\":\"22:00\",\"closed\":false},\"wednesday\":{\"open\":\"09:00\",\"close\":\"22:00\",\"closed\":false},\"thursday\":{\"open\":\"09:00\",\"close\":\"23:00\",\"closed\":false},\"friday\":{\"open\":\"13:00\",\"close\":\"23:00\",\"closed\":false},\"saturday\":{\"open\":\"09:00\",\"close\":\"22:00\",\"closed\":false}}";

        return ResponseEntity.ok(SalonSettingsDTO.builder()
                .id(shop.getId())
                .name(shop.getName())
                .slug(shop.getSlug())
                .phone(shop.getPhone())
                .region(shop.getRegion())
                .district(shop.getDistrict())
                .city(shop.getCity())
                .fullAddress(shop.getFullAddress())
                .mapAddress(shop.getMapAddress())
                .latitude(shop.getLatitude() != null ? shop.getLatitude() : new BigDecimal("24.7136"))
                .longitude(shop.getLongitude() != null ? shop.getLongitude() : new BigDecimal("46.6753"))
                .logoUrl(shop.getLogoUrl())
                .coverImageUrl(shop.getCoverImageUrl())
                .minCancelNoticeHours(shop.getMinCancelNoticeHours() != null ? shop.getMinCancelNoticeHours() : 2)
                .maxAdvanceBookingDays(shop.getMaxAdvanceBookingDays() != null ? shop.getMaxAdvanceBookingDays() : 14)
                .autoConfirmWalkins(shop.getAutoConfirmWalkins() != null ? shop.getAutoConfirmWalkins() : true)
                .operatingHoursJson(shop.getOperatingHoursJson() != null ? shop.getOperatingHoursJson() : defaultHours)
                .bookingUrl(shop.getBookingUrl() != null && !shop.getBookingUrl().isBlank()
                        ? shop.getBookingUrl()
                        : "http://localhost:3000/booking/?slug=" + shop.getSlug())
                .qrCodeUrl(shop.getQrCodeUrl())
                .build());
    }

    @PutMapping("/settings")
    public ResponseEntity<?> updateSalonSettings(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody SalonSettingsDTO request) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = user.getSalonId();
        if (salonId == null) {
            Shop shop = shopRepository.findByOwnerId(user.getId()).stream().findFirst().orElse(null);
            if (shop != null) salonId = shop.getId();
        }
        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Salon not found"));
        }

        if (request.getName() != null && !request.getName().trim().isEmpty()) shop.setName(request.getName().trim());
        if (request.getPhone() != null && !request.getPhone().trim().isEmpty()) shop.setPhone(request.getPhone().trim());
        if (request.getFullAddress() != null) shop.setFullAddress(request.getFullAddress());
        if (request.getDistrict() != null) shop.setDistrict(request.getDistrict());
        if (request.getCity() != null) shop.setCity(request.getCity());
        if (request.getRegion() != null) shop.setRegion(request.getRegion());
        if (request.getMapAddress() != null) shop.setMapAddress(request.getMapAddress());
        if (request.getLatitude() != null) shop.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) shop.setLongitude(request.getLongitude());
        if (request.getLogoUrl() != null) shop.setLogoUrl(request.getLogoUrl());
        if (request.getCoverImageUrl() != null) shop.setCoverImageUrl(request.getCoverImageUrl());
        if (request.getMinCancelNoticeHours() != null) shop.setMinCancelNoticeHours(request.getMinCancelNoticeHours());
        if (request.getMaxAdvanceBookingDays() != null) shop.setMaxAdvanceBookingDays(request.getMaxAdvanceBookingDays());
        if (request.getAutoConfirmWalkins() != null) shop.setAutoConfirmWalkins(request.getAutoConfirmWalkins());
        if (request.getOperatingHoursJson() != null) shop.setOperatingHoursJson(request.getOperatingHoursJson());

        shop = shopRepository.save(shop);

        auditLogService.logEvent(
                user,
                shop,
                "UPDATE_SALON",
                String.format("Salon settings & profile updated for '%s' (Phone: %s, City: %s)",
                        shop.getName(), shop.getPhone(), shop.getCity()),
                "127.0.0.1"
        );

        return ResponseEntity.ok(Map.of("success", true, "message", "Salon settings updated successfully."));
    }

    /**
     * 4. Current Staff Shift Toggle (Online / Offline)
     */
    @PatchMapping("/shift")
    public ResponseEntity<?> toggleStaffShift(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody Map<String, String> payload) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        String status = payload.getOrDefault("status", "ONLINE").toUpperCase();
        if (!status.equals("ONLINE") && !status.equals("OFFLINE")) {
            status = "ONLINE";
        }

        shiftStatusMap.put(user.getId(), status);
        log.info("Updated shift status for user {} to {}", user.getEmail(), status);

        return ResponseEntity.ok(Map.of("success", true, "shiftStatus", status, "userEmail", user.getEmail()));
    }

    /**
     * 5. Revenue & Financial Analytics (Owner only)
     * Strictly filters for COMPLETED bookings
     */
    @GetMapping("/analytics/revenue")
    public ResponseEntity<?> getRevenueAnalytics(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Access Denied", "message", "Staff members are restricted from viewing financial analytics."));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        RevenueAnalyticsDTO analytics = salonAnalyticsService.calculateRevenueAnalytics(salonId);
        return ResponseEntity.ok(analytics);
    }

    /**
     * 6. Salon Photo Gallery Management (Owner only, max 5 photos)
     */
    @GetMapping("/gallery")
    public ResponseEntity<?> getSalonGallery(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        List<SalonImage> images = salonImageRepository.findByShopIdOrderByDisplayOrderAsc(salonId);
        List<SalonImageDTO> dtos = images.stream().map(img -> SalonImageDTO.builder()
                .id(img.getId())
                .imageUrl(img.getImageUrl())
                .displayOrder(img.getDisplayOrder())
                .isCover(img.getIsCover())
                .caption(img.getCaption())
                .createdAt(img.getCreatedAt())
                .build()).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/gallery/upload")
    @Transactional
    public ResponseEntity<?> uploadGalleryImage(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "isCover", required = false) Boolean isCover,
            @RequestParam(value = "caption", required = false) String caption) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }
        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Salon not found"));
        }

        // STRICT MAXIMUM OF 5 PHOTOS
        long currentCount = salonImageRepository.countByShopId(salonId);
        if (currentCount >= 5) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "Gallery Limit Reached",
                    "message", "A salon gallery is capped at a strict maximum of 5 photos. Please remove an existing photo first."
            ));
        }

        try {
            String imageUrl = mediaStorageService.storeSalonGalleryImage(salonId, file);
            boolean makeCover = Boolean.TRUE.equals(isCover) || currentCount == 0;

            if (makeCover) {
                List<SalonImage> existing = salonImageRepository.findByShopIdOrderByDisplayOrderAsc(salonId);
                for (SalonImage img : existing) {
                    if (Boolean.TRUE.equals(img.getIsCover())) {
                        img.setIsCover(false);
                        salonImageRepository.save(img);
                    }
                }
                shop.setCoverImageUrl(imageUrl);
                shopRepository.save(shop);
            }

            SalonImage image = SalonImage.builder()
                    .shop(shop)
                    .imageUrl(imageUrl)
                    .displayOrder((int) currentCount)
                    .isCover(makeCover)
                    .caption(caption)
                    .build();
            image = salonImageRepository.save(image);

            auditLogService.logEvent(
                    user,
                    shop,
                    "MEDIA_UPLOADED",
                    String.format("Uploaded gallery photo for salon '%s' (Cover: %s)", shop.getName(), makeCover),
                    "127.0.0.1"
            );

            return ResponseEntity.status(HttpStatus.CREATED).body(SalonImageDTO.builder()
                    .id(image.getId())
                    .imageUrl(image.getImageUrl())
                    .displayOrder(image.getDisplayOrder())
                    .isCover(image.getIsCover())
                    .caption(image.getCaption())
                    .createdAt(image.getCreatedAt())
                    .build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid File", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to store gallery image: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Storage Error", "message", "Failed to store image: " + e.getMessage()));
        }
    }

    @PutMapping("/gallery/order")
    @Transactional
    public ResponseEntity<?> updateGalleryOrder(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestBody List<Map<String, Object>> imageOrders) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }
        Shop shop = shopRepository.findById(salonId).orElse(null);

        for (Map<String, Object> item : imageOrders) {
            if (item.get("id") == null) continue;
            Long imgId = Long.valueOf(item.get("id").toString());
            SalonImage img = salonImageRepository.findById(imgId).orElse(null);
            if (img != null && img.getShop().getId().equals(salonId)) {
                if (item.get("displayOrder") != null) {
                    img.setDisplayOrder(Integer.valueOf(item.get("displayOrder").toString()));
                }
                if (item.get("isCover") != null) {
                    boolean isCover = Boolean.parseBoolean(item.get("isCover").toString());
                    img.setIsCover(isCover);
                    if (isCover && shop != null) {
                        shop.setCoverImageUrl(img.getImageUrl());
                        shopRepository.save(shop);
                    }
                }
                salonImageRepository.save(img);
            }
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "Gallery order updated successfully."));
    }

    @DeleteMapping("/gallery/{id}")
    @Transactional
    public ResponseEntity<?> deleteGalleryImage(
            @PathVariable("id") Long imageId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        SalonImage img = salonImageRepository.findById(imageId).orElse(null);
        if (img == null || !img.getShop().getId().equals(salonId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Image not found"));
        }

        boolean wasCover = Boolean.TRUE.equals(img.getIsCover());
        mediaStorageService.deleteFile(img.getImageUrl());
        salonImageRepository.delete(img);

        // If cover was deleted, assign cover to first remaining image
        if (wasCover) {
            List<SalonImage> remaining = salonImageRepository.findByShopIdOrderByDisplayOrderAsc(salonId);
            if (!remaining.isEmpty()) {
                SalonImage newCover = remaining.get(0);
                newCover.setIsCover(true);
                salonImageRepository.save(newCover);
                Shop shop = shopRepository.findById(salonId).orElse(null);
                if (shop != null) {
                    shop.setCoverImageUrl(newCover.getImageUrl());
                    shopRepository.save(shop);
                }
            } else {
                Shop shop = shopRepository.findById(salonId).orElse(null);
                if (shop != null) {
                    shop.setCoverImageUrl(null);
                    shopRepository.save(shop);
                }
            }
        }

        Shop salonShop = shopRepository.findById(salonId).orElse(null);
        auditLogService.logEvent(
                user,
                salonShop,
                "MEDIA_DELETED",
                String.format("Deleted gallery photo for salon '%s'", salonShop != null ? salonShop.getName() : salonId),
                "127.0.0.1"
        );

        return ResponseEntity.ok(Map.of("success", true, "message", "Gallery image deleted successfully."));
    }

    /**
     * 7. Staff Avatar Photo Upload (Owner only)
     */
    @PostMapping("/staff/{id}/avatar")
    @Transactional
    public ResponseEntity<?> uploadStaffAvatar(
            @PathVariable("id") Long barberId,
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam("file") MultipartFile file) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        Barber barber = barberRepository.findById(barberId).orElse(null);
        if (barber == null || !barber.getShop().getId().equals(salonId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Barber not found"));
        }

        try {
            // Cleanup previous local avatar if exists
            if (barber.getPhotoUrl() != null && barber.getPhotoUrl().startsWith("/uploads/")) {
                mediaStorageService.deleteFile(barber.getPhotoUrl());
            }

            String avatarUrl = mediaStorageService.storeStaffAvatar(salonId, barberId, file);
            barber.setPhotoUrl(avatarUrl);
            barber = barberRepository.save(barber);

            auditLogService.logEvent(
                    user,
                    barber.getShop(),
                    "MEDIA_UPLOADED",
                    String.format("Uploaded staff avatar photo for '%s'", barber.getName()),
                    "127.0.0.1"
            );

            return ResponseEntity.ok(toStaffDTO(barber));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid File", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to store staff avatar: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Storage Error", "message", e.getMessage()));
        }
    }

    /**
     * Direct Staff Avatar Upload (Owner only, used during onboarding / Add Staff modal)
     */
    @PostMapping("/staff/upload-avatar")
    public ResponseEntity<?> uploadStaffAvatarDirect(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam("file") MultipartFile file) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }

        try {
            String avatarUrl = mediaStorageService.storeStaffAvatar(salonId, file);
            return ResponseEntity.ok(Map.of("success", true, "avatarUrl", avatarUrl));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid File", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload staff avatar: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Storage Error", "message", e.getMessage()));
        }
    }

    /**
     * Upload Salon Brand Logo (Owner only)
     */
    @PostMapping("/settings/upload-logo")
    @Transactional
    public ResponseEntity<?> uploadSalonLogo(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam("file") MultipartFile file) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }
        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Salon not found"));
        }

        try {
            String logoUrl = mediaStorageService.storeSalonBrandingImage(salonId, "logo", file);
            shop.setLogoUrl(logoUrl);
            shopRepository.save(shop);

            auditLogService.logEvent(
                    user,
                    shop,
                    "MEDIA_UPLOADED",
                    String.format("Uploaded brand logo for salon '%s'", shop.getName()),
                    "127.0.0.1"
            );

            return ResponseEntity.ok(Map.of("success", true, "logoUrl", logoUrl));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid File", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload salon logo: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Storage Error", "message", e.getMessage()));
        }
    }

    /**
     * Upload Salon Cover Banner (Owner only)
     */
    @PostMapping("/settings/upload-cover")
    @Transactional
    public ResponseEntity<?> uploadSalonCover(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long userId,
            @RequestParam("file") MultipartFile file) {

        User user = resolveAuthenticatedUser(principal, userId);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }
        if (user.getRole() == UserRole.SALON_STAFF || user.getRole() == UserRole.BARBER) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Access Denied"));
        }

        Long salonId = resolveSalonId(user);
        if (salonId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "No salon assigned"));
        }
        Shop shop = shopRepository.findById(salonId).orElse(null);
        if (shop == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Salon not found"));
        }

        try {
            String coverUrl = mediaStorageService.storeSalonBrandingImage(salonId, "cover", file);
            shop.setCoverImageUrl(coverUrl);
            shopRepository.save(shop);

            auditLogService.logEvent(
                    user,
                    shop,
                    "MEDIA_UPLOADED",
                    String.format("Uploaded cover banner for salon '%s'", shop.getName()),
                    "127.0.0.1"
            );

            return ResponseEntity.ok(Map.of("success", true, "coverImageUrl", coverUrl));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid File", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to upload salon cover: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Storage Error", "message", e.getMessage()));
        }
    }
}

