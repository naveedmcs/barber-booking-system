package com.barberapp.service;

import com.barberapp.entity.Booking;
import com.barberapp.entity.enums.BookingStatus;
import com.barberapp.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Background Scheduler: Automatically sweeps expired 5-minute temporary slot holds.
 * - Releases Redis Redisson distributed slot locks.
 * - Transitions expired HOLD entities to CANCELLED in MySQL.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SlotHoldCleanupTask {

    private final BookingRepository bookingRepository;
    private final SlotLockService slotLockService;

    @Scheduled(fixedDelay = 60000) // Sweeps every 60 seconds
    @Transactional
    public void sweepExpiredSlotHolds() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> expiredHolds = bookingRepository.findByStatusAndHoldExpiresAtBefore(BookingStatus.HOLD, now);

        if (expiredHolds.isEmpty()) {
            return;
        }

        log.info("Found {} expired slot holds to clean up", expiredHolds.size());
        for (Booking booking : expiredHolds) {
            try {
                if (booking.getBarber() != null && booking.getSlotStart() != null) {
                    slotLockService.releaseSlotHold(booking.getBarber().getId(), booking.getSlotStart());
                }
                booking.setStatus(BookingStatus.CANCELLED);
                bookingRepository.save(booking);
                log.info("Released expired hold for booking ID {} (Barber ID: {}, Start: {})",
                        booking.getId(),
                        booking.getBarber() != null ? booking.getBarber().getId() : "null",
                        booking.getSlotStart());
            } catch (Exception e) {
                log.warn("Failed to cleanly expire booking ID {}: {}", booking.getId(), e.getMessage());
            }
        }
    }
}
