package com.barberapp.service;

import com.barberapp.entity.Booking;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

@Service
@Slf4j
public class CalendarService {

    private static final DateTimeFormatter ICS_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'");

    public byte[] generateIcsCalendar(Booking booking) {
        String uid = "booking-" + booking.getId() + "@barberapp.sa";
        String dtStamp = LocalDateTime.now(ZoneOffset.UTC).format(ICS_DATE_FORMATTER);
        String dtStart = booking.getSlotStart().atZone(ZoneOffset.UTC).format(ICS_DATE_FORMATTER);
        String dtEnd = booking.getSlotEnd().atZone(ZoneOffset.UTC).format(ICS_DATE_FORMATTER);

        String shopName = booking.getShop() != null ? booking.getShop().getName() : "Barber Shop";
        String barberName = booking.getBarber() != null ? booking.getBarber().getName() : "Barber";
        String serviceName = booking.getService() != null ? booking.getService().getName() : "Service";
        String location = booking.getShop() != null ? booking.getShop().getFullAddress() : "";

        String summary = serviceName + " with " + barberName + " at " + shopName;
        String description = "Appointment booking at " + shopName + ". Barber: " + barberName + ". Service: " + serviceName;

        StringBuilder ics = new StringBuilder();
        ics.append("BEGIN:VCALENDAR\r\n");
        ics.append("VERSION:2.0\r\n");
        ics.append("PRODID:-//BarberApp//Appointment Booking System//EN\r\n");
        ics.append("CALSCALE:GREGORIAN\r\n");
        ics.append("METHOD:REQUEST\r\n");
        ics.append("BEGIN:VEVENT\r\n");
        ics.append("UID:").append(uid).append("\r\n");
        ics.append("DTSTAMP:").append(dtStamp).append("\r\n");
        ics.append("DTSTART:").append(dtStart).append("\r\n");
        ics.append("DTEND:").append(dtEnd).append("\r\n");
        ics.append("SUMMARY:").append(escapeIcsText(summary)).append("\r\n");
        ics.append("DESCRIPTION:").append(escapeIcsText(description)).append("\r\n");
        if (!location.isBlank()) {
            ics.append("LOCATION:").append(escapeIcsText(location)).append("\r\n");
        }
        ics.append("STATUS:CONFIRMED\r\n");
        ics.append("END:VEVENT\r\n");
        ics.append("END:VCALENDAR\r\n");

        return ics.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String escapeIcsText(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                   .replace(";", "\\;")
                   .replace(",", "\\,")
                   .replace("\n", "\\n");
    }
}
