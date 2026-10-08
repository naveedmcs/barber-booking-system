package com.barberapp.controller;

import com.barberapp.entity.Booking;
import com.barberapp.exception.SlotAlreadyBookedException;
import com.barberapp.repository.BookingRepository;
import com.barberapp.service.CalendarService;
import com.barberapp.service.SlotBookingService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SlotBookingController {

    private final SlotBookingService slotBookingService;
    private final CalendarService calendarService;
    private final BookingRepository bookingRepository;

    @Data
    public static class HoldSlotRequest {
        private Long shopId;
        private Long barberId;
        private Long serviceId;
        private Long customerId;
        private LocalDateTime slotStart;
        private LocalDateTime slotEnd;
    }

    @PostMapping("/slots/hold")
    public ResponseEntity<?> holdSlot(@RequestBody HoldSlotRequest request) {
        try {
            Booking booking = slotBookingService.holdSlot(
                    request.getShopId(),
                    request.getBarberId(),
                    request.getServiceId(),
                    request.getCustomerId(),
                    request.getSlotStart(),
                    request.getSlotEnd()
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(booking);
        } catch (SlotAlreadyBookedException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    @PostMapping("/bookings/{id}/confirm")
    public ResponseEntity<?> confirmBooking(@PathVariable("id") Long bookingId) {
        try {
            Booking booking = slotBookingService.confirmBooking(bookingId);
            return ResponseEntity.ok(booking);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @GetMapping("/bookings/{id}/calendar")
    public ResponseEntity<byte[]> downloadCalendar(@PathVariable("id") Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));
        byte[] icsBytes = calendarService.generateIcsCalendar(booking);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/calendar;charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "appointment-" + bookingId + ".ics");

        return new ResponseEntity<>(icsBytes, headers, HttpStatus.OK);
    }
}
