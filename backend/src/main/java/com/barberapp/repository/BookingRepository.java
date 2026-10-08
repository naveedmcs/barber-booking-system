package com.barberapp.repository;

import com.barberapp.entity.Booking;
import com.barberapp.entity.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Query("SELECT b FROM Booking b WHERE b.barber.id = :barberId AND b.slotStart = :slotStart AND b.status IN (:statuses)")
    Optional<Booking> findExistingBooking(
            @Param("barberId") Long barberId,
            @Param("slotStart") LocalDateTime slotStart,
            @Param("statuses") java.util.List<BookingStatus> statuses
    );
}
