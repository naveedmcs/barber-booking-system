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

    @Transactional
    public Booking holdSlot(Long shopId, Long barberId, Long serviceId, Long customerId,
                             LocalDateTime slotStart, LocalDateTime slotEnd) {
        boolean lockAcquired = slotLockService.acquireSlotHold(barberId, slotStart);
        if (!lockAcquired) {
            throw new SlotAlreadyBookedException("Slot is currently held or being booked by another customer");
        }

        try {
            bookingRepository.findExistingBooking(barberId, slotStart, List.of(BookingStatus.HOLD, BookingStatus.CONFIRMED))
                    .ifPresent(existing -> {
                        if (existing.getStatus() == BookingStatus.CONFIRMED ||
                                (existing.getHoldExpiresAt() != null && existing.getHoldExpiresAt().isAfter(LocalDateTime.now()))) {
                            throw new SlotAlreadyBookedException("Slot is already booked or held in database");
                        }
                    });

            Shop shop = shopRepository.findById(shopId)
                    .orElseThrow(() -> new IllegalArgumentException("Shop not found with ID: " + shopId));
            Barber barber = barberRepository.findById(barberId)
                    .orElseThrow(() -> new IllegalArgumentException("Barber not found with ID: " + barberId));
            ServiceItem service = serviceItemRepository.findById(serviceId)
                    .orElseThrow(() -> new IllegalArgumentException("Service not found with ID: " + serviceId));
            Customer customer = customerRepository.findById(customerId)
                    .orElseThrow(() -> new IllegalArgumentException("Customer not found with ID: " + customerId));

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
        return bookingRepository.save(booking);
    }
}
