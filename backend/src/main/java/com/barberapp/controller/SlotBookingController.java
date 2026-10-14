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

    @Data
    public static class PublicBookingRequest {
        private Long shopId;
        private String shopSlug;
        private Long barberId;
        private String barberName;
        private Long serviceId;
        private String serviceName;
        private String customerName;
        private String customerPhone;
        private String customerEmail;
        private String date; // e.g. "2026-10-14"
        private String time; // e.g. "11:00 AM" or "11:00"
        private String slotStart;
        private String slotEnd;
        private String notes;
        private String referenceCode;
    }

    @PostMapping("/bookings/public")
    public ResponseEntity<?> createPublicBooking(@RequestBody PublicBookingRequest request) {
        try {
            LocalDateTime start = parseFlexibleDateTime(request.getSlotStart(), request.getDate(), request.getTime());
            LocalDateTime end = parseFlexibleDateTime(request.getSlotEnd(), null, null);

            Booking booking = slotBookingService.createPublicBooking(
                    request.getShopId(),
                    request.getShopSlug(),
                    request.getBarberId(),
                    request.getBarberName(),
                    request.getServiceId(),
                    request.getServiceName(),
                    request.getCustomerName(),
                    request.getCustomerPhone(),
                    request.getCustomerEmail(),
                    start,
                    end,
                    request.getNotes()
            );

            java.util.Map<String, Object> response = new java.util.HashMap<>();
            response.put("id", booking.getId());
            response.put("shopId", booking.getShop() != null ? booking.getShop().getId() : null);
            response.put("shopName", booking.getShop() != null ? booking.getShop().getName() : "");
            response.put("barberId", booking.getBarber() != null ? booking.getBarber().getId() : null);
            response.put("barberName", booking.getBarber() != null ? booking.getBarber().getName() : "Barber");
            response.put("serviceId", booking.getService() != null ? booking.getService().getId() : null);
            response.put("serviceName", booking.getService() != null ? booking.getService().getName() : "Service");
            response.put("customerName", booking.getCustomer() != null ? booking.getCustomer().getFullName() : "Customer");
            response.put("customerPhone", booking.getCustomer() != null ? booking.getCustomer().getPhone() : "");
            response.put("slotStart", booking.getSlotStart());
            response.put("slotEnd", booking.getSlotEnd());
            response.put("status", booking.getStatus() != null ? booking.getStatus().name() : "CONFIRMED");
            response.put("notes", booking.getNotes());

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(java.util.Map.of("error", e.getMessage()));
        }
    }

    private LocalDateTime parseFlexibleDateTime(String isoStr, String date, String time) {
        if (isoStr != null && !isoStr.isBlank()) {
            String clean = isoStr.trim();
            if (clean.endsWith("Z")) {
                clean = clean.substring(0, clean.length() - 1);
            }
            if (clean.length() == 10) {
                return java.time.LocalDate.parse(clean).atStartOfDay();
            }
            return LocalDateTime.parse(clean);
        }

        if (date != null && !date.isBlank()) {
            java.time.LocalDate ld = java.time.LocalDate.parse(date.trim());
            if (time != null && !time.isBlank()) {
                String t = time.trim();
                try {
                    if (t.contains("AM") || t.contains("PM")) {
                        String[] parts = t.split(" ");
                        String[] hm = parts[0].split(":");
                        int hour = Integer.parseInt(hm[0]);
                        int min = Integer.parseInt(hm[1]);
                        if ("PM".equalsIgnoreCase(parts[1]) && hour < 12) hour += 12;
                        if ("AM".equalsIgnoreCase(parts[1]) && hour == 12) hour = 0;
                        return ld.atTime(hour, min);
                    } else if (t.contains(":")) {
                        String[] hm = t.split(":");
                        return ld.atTime(Integer.parseInt(hm[0]), Integer.parseInt(hm[1]));
                    }
                } catch (Exception ignored) {}
            }
            return ld.atTime(10, 0);
        }

        return null;
    }
}
