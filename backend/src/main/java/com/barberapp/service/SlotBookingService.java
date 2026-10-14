package com.barberapp.service;

import com.barberapp.entity.*;
import com.barberapp.entity.enums.BookingStatus;
import com.barberapp.exception.SlotAlreadyBookedException;
import com.barberapp.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SlotBookingService {

    private final SlotLockService slotLockService;
    private final BookingRepository bookingRepository;
    private final ShopRepository shopRepository;
    private final BarberRepository barberRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final CustomerRepository customerRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @Transactional
    public Booking holdSlot(Long shopId, Long barberId, Long serviceId, Long customerId,
                             LocalDateTime slotStart, LocalDateTime slotEnd) {
        boolean lockAcquired = slotLockService.acquireSlotHold(barberId, slotStart);
        if (!lockAcquired) {
            throw new SlotAlreadyBookedException("Slot is currently held or being booked by another customer");
        }

        try {
            Shop shop = shopRepository.findById(shopId)
                    .orElseThrow(() -> new IllegalArgumentException("Shop not found with ID: " + shopId));
            Barber barber = barberRepository.findById(barberId)
                    .orElseThrow(() -> new IllegalArgumentException("Barber not found with ID: " + barberId));

            if (barber.getIsActive() != null && !barber.getIsActive()) {
                throw new SlotAlreadyBookedException("Barber is currently inactive and cannot receive new bookings");
            }

            List<BookingStatus> conflictStatuses = List.of(
                    BookingStatus.HOLD,
                    BookingStatus.CONFIRMED,
                    BookingStatus.ARRIVED,
                    BookingStatus.IN_SERVICE,
                    BookingStatus.WALK_IN_RESERVED,
                    BookingStatus.BLOCKED
            );

            List<Booking> conflicts = bookingRepository.findConflictingBookings(shopId, barberId, slotStart, slotEnd, conflictStatuses, null);
            for (Booking conflict : conflicts) {
                if (conflict.getStatus() == BookingStatus.HOLD) {
                    if (conflict.getHoldExpiresAt() != null && conflict.getHoldExpiresAt().isAfter(LocalDateTime.now())) {
                        throw new SlotAlreadyBookedException("Slot is currently held by another customer");
                    }
                } else {
                    throw new SlotAlreadyBookedException("Slot is already booked or blocked by staff");
                }
            }

            ServiceItem service = serviceItemRepository.findById(serviceId)
                    .orElseThrow(() -> new IllegalArgumentException("Service not found with ID: " + serviceId));
            Customer customer = customerRepository.findById(customerId)
                    .or(() -> customerRepository.findByUserId(customerId))
                    .orElseGet(() -> {
                        return userRepository.findById(customerId).map(u -> {
                            Customer newCust = Customer.builder()
                                    .user(u)
                                    .fullName(u.getFullName())
                                    .email(u.getEmail())
                                    .phone(u.getPhone())
                                    .build();
                            return customerRepository.save(newCust);
                        }).orElseThrow(() -> new IllegalArgumentException("Customer not found with ID: " + customerId));
                    });

            Booking booking = Booking.builder()
                    .shop(shop)
                    .barber(barber)
                    .service(service)
                    .customer(customer)
                    .slotStart(slotStart)
                    .slotEnd(slotEnd)
                    .status(BookingStatus.HOLD)
                    .holdExpiresAt(LocalDateTime.now().plusMinutes(5))
                    .build();

            return bookingRepository.saveAndFlush(booking);

        } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException e) {
            log.warn("Database constraint or optimistic lock violation for barberId {} at {}", barberId, slotStart);
            slotLockService.releaseSlotHold(barberId, slotStart);
            throw new SlotAlreadyBookedException("Slot was already booked by a concurrent transaction");
        } catch (Exception e) {
            slotLockService.releaseSlotHold(barberId, slotStart);
            throw e;
        }
    }

    @Transactional
    public Booking confirmBooking(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found with ID: " + bookingId));

        if (booking.getStatus() == BookingStatus.CONFIRMED) {
            return booking;
        }

        if (booking.getStatus() != BookingStatus.HOLD) {
            throw new IllegalStateException("Booking is not in HOLD status");
        }

        if (booking.getHoldExpiresAt() != null && booking.getHoldExpiresAt().isBefore(LocalDateTime.now())) {
            booking.setStatus(BookingStatus.CANCELLED);
            bookingRepository.save(booking);
            throw new IllegalStateException("Slot hold has expired");
        }

        booking.setStatus(BookingStatus.CONFIRMED);
        Booking saved = bookingRepository.save(booking);

        try {
            String customerName = saved.getCustomer() != null ? saved.getCustomer().getFullName() : "Customer";
            String customerPhone = saved.getCustomer() != null ? saved.getCustomer().getPhone() : "";
            String barberName = saved.getBarber() != null ? saved.getBarber().getName() : "Barber";
            String serviceName = saved.getService() != null ? saved.getService().getName() : "Service";
            auditLogService.logEvent(
                    null,
                    saved.getShop(),
                    "BOOKING_CONFIRMED",
                    String.format("Appointment booked: Customer %s (%s) with %s for %s on %s at %s",
                            customerName, customerPhone, barberName, serviceName,
                            saved.getSlotStart() != null ? saved.getSlotStart().toLocalDate() : "",
                            saved.getSlotStart() != null ? saved.getSlotStart().toLocalTime() : ""),
                    "127.0.0.1"
            );
        } catch (Exception ex) {
            log.warn("Failed to record audit log for confirmed booking: {}", ex.getMessage());
        }

        return saved;
    }

    @Transactional
    public Booking createPublicBooking(
            Long shopId,
            String shopSlug,
            Long barberId,
            String barberName,
            Long serviceId,
            String serviceName,
            String customerName,
            String customerPhone,
            String customerEmail,
            LocalDateTime slotStart,
            LocalDateTime slotEnd,
            String notes) {

        // 1. Resolve Shop
        Shop shop = null;
        if (shopId != null) {
            shop = shopRepository.findById(shopId).orElse(null);
        }
        if (shop == null && shopSlug != null && !shopSlug.isBlank()) {
            shop = shopRepository.findBySlug(shopSlug.trim()).orElse(null);
        }
        if (shop == null) {
            shop = shopRepository.findAll().stream().findFirst().orElse(null);
        }
        if (shop == null) {
            throw new IllegalArgumentException("No shop found to attach booking.");
        }

        // 2. Resolve Barber
        Barber barber = null;
        if (barberId != null) {
            barber = barberRepository.findById(barberId).orElse(null);
        }
        if (barber == null && barberName != null && !barberName.isBlank()) {
            String bNameLower = barberName.trim().toLowerCase();
            barber = barberRepository.findByShopId(shop.getId()).stream()
                    .filter(b -> b.getName() != null && b.getName().toLowerCase().contains(bNameLower))
                    .findFirst().orElse(null);
        }
        if (barber == null) {
            String createdName = (barberName != null && !barberName.isBlank()) ? barberName.trim() : "Master Barber";
            barber = barberRepository.save(Barber.builder()
                    .shop(shop)
                    .name(createdName)
                    .specialty("Master Barber")
                    .status("ACTIVE")
                    .isActive(true)
                    .skills("Haircut, Beard Trim, Hot Towel")
                    .build());
        }

        // 3. Resolve Service
        ServiceItem service = null;
        if (serviceId != null) {
            service = serviceItemRepository.findById(serviceId).orElse(null);
        }
        if (service == null && serviceName != null && !serviceName.isBlank()) {
            String sNameLower = serviceName.trim().toLowerCase();
            service = serviceItemRepository.findByShopId(shop.getId()).stream()
                    .filter(s -> s.getName() != null && (s.getName().toLowerCase().contains(sNameLower) || sNameLower.contains(s.getName().toLowerCase())))
                    .findFirst().orElse(null);
        }
        if (service == null) {
            service = serviceItemRepository.findByShopId(shop.getId()).stream().findFirst().orElse(null);
        }
        if (service == null) {
            String createdServiceName = (serviceName != null && !serviceName.isBlank()) ? serviceName.trim() : "Classic Haircut";
            service = serviceItemRepository.save(ServiceItem.builder()
                    .shop(shop)
                    .name(createdServiceName)
                    .price(new java.math.BigDecimal("50.00"))
                    .durationMinutes(30)
                    .bufferMinutes(5)
                    .category("General")
                    .isVisible(true)
                    .assignedStaffIds("ALL")
                    .build());
        }

        // 4. Resolve or create Customer
        String phoneClean = (customerPhone != null && !customerPhone.isBlank()) ? customerPhone.trim() : "0500000000";
        Customer customer = customerRepository.findByPhone(phoneClean).orElse(null);
        if (customer == null) {
            String cName = (customerName != null && !customerName.isBlank()) ? customerName.trim() : "Customer Guest";
            String cEmail = (customerEmail != null && !customerEmail.isBlank()) ? customerEmail.trim() : (phoneClean + "@guest.barberapp.sa");
            customer = Customer.builder()
                    .fullName(cName)
                    .phone(phoneClean)
                    .email(cEmail)
                    .build();
            customer = customerRepository.save(customer);
        }

        // 5. Calculate slotEnd if null
        LocalDateTime start = (slotStart != null) ? slotStart : LocalDateTime.now().plusDays(1).withHour(10).withMinute(0).withSecond(0);
        int duration = (service != null && service.getDurationMinutes() != null) ? service.getDurationMinutes() : 30;
        LocalDateTime end = (slotEnd != null) ? slotEnd : start.plusMinutes(duration);

        // 6. Build and save Booking with CONFIRMED status
        Booking booking = Booking.builder()
                .shop(shop)
                .barber(barber)
                .service(service)
                .customer(customer)
                .slotStart(start)
                .slotEnd(end)
                .status(BookingStatus.CONFIRMED)
                .notes(notes)
                .build();

        Booking saved = bookingRepository.save(booking);

        // 7. Audit log
        try {
            auditLogService.logEvent(
                    null,
                    shop,
                    "CUSTOMER_BOOKING_CONFIRMED",
                    String.format("Public booking confirmed: Customer %s (%s) with %s on %s at %s. Services: [%s]. Notes: %s",
                            customer.getFullName(), customer.getPhone(), barber.getName(),
                            saved.getSlotStart().toLocalDate(), saved.getSlotStart().toLocalTime(),
                            service != null ? service.getName() : "Custom",
                            notes != null ? notes : "None"),
                    "127.0.0.1"
            );
        } catch (Exception ex) {
            log.warn("Failed to record audit log for public customer booking: {}", ex.getMessage());
        }

        return saved;
    }
}
