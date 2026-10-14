/**
 * Dual Calendar Generator (Apple iCalendar .ics & Google Calendar Web URL)
 */

import { convertSlotToIso } from "./formatting.js";

/**
 * Generates and triggers download of an Apple iCalendar (.ics) file with -PT1H alarm
 */
export function generateAppleIcsCalendar(booking = {}) {
  const formatIcsTime = (iso) => {
    if (!iso) return "20261014T100000Z";
    const d = new Date(iso);
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const startIso = booking.startIso || convertSlotToIso(booking.date, booking.time);
  const endIso = booking.endIso || new Date(new Date(startIso).getTime() + (booking.durationMinutes || 45) * 60000).toISOString();

  const dtStart = formatIcsTime(startIso);
  const dtEnd = formatIcsTime(endIso);
  const now = formatIcsTime(new Date().toISOString());

  const summary = `Appointment: ${booking.serviceNames || booking.service || "Salon Service"} @ ${booking.shopName || "Barbershop"}`;
  const location = booking.address || booking.shopAddress || "Riyadh, Saudi Arabia";
  const description = `Booking Reference: ${booking.bookingRef || booking.referenceCode || "N/A"}\\nBarber: ${booking.barberName || booking.barber || "Specialist"}\\nSalon Contact: ${booking.salonPhone || "0501234567"}\\nNotes: ${booking.notes || "None"}`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BarberApp SaaS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${(booking.bookingRef || "booking") + "-" + Date.now()}@barberapp.sa`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder: Barber Appointment in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  const icsContent = icsLines.join("\r\n");
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointment-${booking.bookingRef || "barber"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Constructs direct Google Calendar URL with dates, location, and description
 */
export function getGoogleCalendarWebUrl(booking = {}) {
  const formatUtcCompact = (iso) => {
    if (!iso) return "20261014T100000Z";
    const d = new Date(iso);
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const startIso = booking.startIso || convertSlotToIso(booking.date, booking.time);
  const endIso = booking.endIso || new Date(new Date(startIso).getTime() + (booking.durationMinutes || 45) * 60000).toISOString();

  const title = encodeURIComponent(`💈 Appointment: ${booking.shopName || "Barbershop"}`);
  const dates = `${formatUtcCompact(startIso)}/${formatUtcCompact(endIso)}`;
  const location = encodeURIComponent(booking.address || "Riyadh, Saudi Arabia");
  const details = encodeURIComponent(
    `Ref: ${booking.bookingRef || booking.referenceCode || "N/A"}\n` +
    `Barber: ${booking.barberName || booking.barber || "Assigned Barber"}\n` +
    `Services: ${booking.serviceNames || booking.service || "Haircut"}\n` +
    `Salon Tel: ${booking.salonPhone || "0501234567"}\n` +
    (booking.notes ? `Notes: ${booking.notes}` : "")
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}
