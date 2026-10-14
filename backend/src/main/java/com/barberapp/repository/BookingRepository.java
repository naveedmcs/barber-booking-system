package com.barberapp.repository;

import com.barberapp.entity.Booking;
import com.barberapp.entity.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Query("SELECT b FROM Booking b WHERE b.barber.id = :barberId AND b.slotStart = :slotStart AND b.status IN (:statuses)")
    Optional<Booking> findExistingBooking(
            @Param("barberId") Long barberId,
            @Param("slotStart") LocalDateTime slotStart,
            @Param("statuses") List<BookingStatus> statuses
    );

    List<Booking> findByShopId(Long shopId);

    List<Booking> findByShopIdAndBarberId(Long shopId, Long barberId);

    @Query("SELECT b FROM Booking b WHERE b.barber.id = :barberId " +
           "AND b.shop.id = :shopId " +
           "AND b.status IN (:activeStatuses) " +
           "AND b.slotStart < :slotEnd AND b.slotEnd > :slotStart " +
           "AND (:excludeId IS NULL OR b.id != :excludeId)")
    List<Booking> findConflictingBookings(
            @Param("shopId") Long shopId,
            @Param("barberId") Long barberId,
            @Param("slotStart") LocalDateTime slotStart,
            @Param("slotEnd") LocalDateTime slotEnd,
            @Param("activeStatuses") List<BookingStatus> activeStatuses,
            @Param("excludeId") Long excludeId
    );

    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.service LEFT JOIN FETCH b.barber " +
           "WHERE b.shop.id = :shopId " +
           "AND b.status = com.barberapp.entity.enums.BookingStatus.COMPLETED " +
           "AND b.slotStart >= :start AND b.slotStart <= :end")
    List<Booking> findCompletedBookingsBetween(
            @Param("shopId") Long shopId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.service LEFT JOIN FETCH b.barber " +
           "WHERE b.shop.id = :shopId " +
           "AND b.status = com.barberapp.entity.enums.BookingStatus.COMPLETED")
    List<Booking> findAllCompletedBookings(@Param("shopId") Long shopId);

    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.service LEFT JOIN FETCH b.customer LEFT JOIN FETCH b.barber " +
           "WHERE b.barber.id = :barberId " +
           "AND b.shop.id = :shopId " +
           "AND b.status IN (:activeStatuses) " +
           "AND b.slotEnd >= :now " +
           "ORDER BY b.slotStart ASC")
    List<Booking> findUpcomingActiveBookings(
            @Param("shopId") Long shopId,
            @Param("barberId") Long barberId,
            @Param("activeStatuses") List<BookingStatus> activeStatuses,
            @Param("now") LocalDateTime now
    );

    List<Booking> findByStatusAndHoldExpiresAtBefore(BookingStatus status, LocalDateTime now);

    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.service LEFT JOIN FETCH b.customer LEFT JOIN FETCH b.barber " +
           "WHERE b.shop.id = :shopId " +
           "AND (:barberId IS NULL OR b.barber.id = :barberId) " +
           "AND (:startDate IS NULL OR b.slotStart >= :startDate) " +
           "AND (:endDate IS NULL OR b.slotStart <= :endDate) " +
           "ORDER BY b.slotStart ASC")
    List<Booking> findBookingsByDateRange(
            @Param("shopId") Long shopId,
            @Param("barberId") Long barberId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );
}
