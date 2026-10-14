package com.barberapp.service;

import com.barberapp.dto.RevenueAnalyticsDTO;
import com.barberapp.entity.Barber;
import com.barberapp.entity.Booking;
import com.barberapp.entity.enums.BookingStatus;
import com.barberapp.repository.BookingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SalonAnalyticsService {

    public static final ZoneId RIYADH_ZONE = ZoneId.of("Asia/Riyadh");
    public static final String CURRENCY = "SAR";

    private final BookingRepository bookingRepository;

    @Transactional(readOnly = true)
    public RevenueAnalyticsDTO calculateRevenueAnalytics(Long salonId) {
        ZonedDateTime nowRiyadh = ZonedDateTime.now(RIYADH_ZONE);
        LocalDate today = nowRiyadh.toLocalDate();
        LocalDate yesterday = today.minusDays(1);

        // Fetch all completed bookings for salon (strict filter)
        List<Booking> allCompleted = bookingRepository.findAllCompletedBookings(salonId)
                .stream()
                .filter(b -> b.getStatus() == BookingStatus.COMPLETED)
                .collect(Collectors.toList());

        // 1. Daily Metrics (Today vs Yesterday)
        List<Booking> todayBookings = filterBookingsOnDate(allCompleted, today);
        List<Booking> yesterdayBookings = filterBookingsOnDate(allCompleted, yesterday);

        BigDecimal todayEarnings = sumRevenue(todayBookings);
        BigDecimal yesterdayEarnings = sumRevenue(yesterdayBookings);
        Double dailyPercentChange = calculatePercentChange(todayEarnings, yesterdayEarnings);

        // 2. Weekly Metrics (Sunday to Saturday Saudi Workweek)
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        LocalDate weekEnd = weekStart.plusDays(6);

        LocalDate prevWeekStart = weekStart.minusWeeks(1);
        LocalDate prevWeekEnd = weekEnd.minusWeeks(1);

        List<Booking> currentWeekBookings = filterBookingsBetweenDates(allCompleted, weekStart, weekEnd);
        List<Booking> prevWeekBookings = filterBookingsBetweenDates(allCompleted, prevWeekStart, prevWeekEnd);

        BigDecimal currentWeekEarnings = sumRevenue(currentWeekBookings);
        BigDecimal prevWeekEarnings = sumRevenue(prevWeekBookings);
        Double weeklyPercentChange = calculatePercentChange(currentWeekEarnings, prevWeekEarnings);

        // 7-Day Day-by-Day Breakdown
        List<RevenueAnalyticsDTO.DayBreakdownDTO> weeklyBreakdown = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate d = weekStart.plusDays(i);
            List<Booking> dayBookings = filterBookingsOnDate(allCompleted, d);
            weeklyBreakdown.add(RevenueAnalyticsDTO.DayBreakdownDTO.builder()
                    .dayOfWeek(d.getDayOfWeek().toString())
                    .date(d.toString())
                    .revenue(sumRevenue(dayBookings))
                    .bookingsCount(dayBookings.size())
                    .build());
        }

        // 3. Monthly Metrics
        YearMonth currentYearMonth = YearMonth.from(today);
        YearMonth prevYearMonth = currentYearMonth.minusMonths(1);

        List<Booking> currentMonthBookings = filterBookingsInMonth(allCompleted, currentYearMonth);
        List<Booking> prevMonthBookings = filterBookingsInMonth(allCompleted, prevYearMonth);

        BigDecimal currentMonthEarnings = sumRevenue(currentMonthBookings);
        BigDecimal prevMonthEarnings = sumRevenue(prevMonthBookings);
        Double monthlyPercentChange = calculatePercentChange(currentMonthEarnings, prevMonthEarnings);

        // 4. Overall Totals & Average Ticket Size
        BigDecimal totalCompletedRevenue = sumRevenue(allCompleted);
        int totalCompletedCount = allCompleted.size();
        BigDecimal averageTicketSize = BigDecimal.ZERO;
        if (totalCompletedCount > 0) {
            averageTicketSize = totalCompletedRevenue.divide(BigDecimal.valueOf(totalCompletedCount), 2, RoundingMode.HALF_UP);
        }

        // 5. Top Revenue-Generating Staff Member
        RevenueAnalyticsDTO.TopStaffRevenueDTO topStaff = findTopStaff(allCompleted);

        return RevenueAnalyticsDTO.builder()
                .currency(CURRENCY)
                .timezone(RIYADH_ZONE.getId())
                .todayEarnings(todayEarnings)
                .yesterdayEarnings(yesterdayEarnings)
                .dailyPercentChange(dailyPercentChange)
                .todayBookingsCount(todayBookings.size())
                .currentWeekEarnings(currentWeekEarnings)
                .previousWeekEarnings(prevWeekEarnings)
                .weeklyPercentChange(weeklyPercentChange)
                .weeklyBreakdown(weeklyBreakdown)
                .currentMonthEarnings(currentMonthEarnings)
                .previousMonthEarnings(prevMonthEarnings)
                .monthlyPercentChange(monthlyPercentChange)
                .currentMonthBookingsCount(currentMonthBookings.size())
                .totalCompletedRevenue(totalCompletedRevenue)
                .totalCompletedBookings(totalCompletedCount)
                .averageTicketSize(averageTicketSize)
                .topStaff(topStaff)
                .build();
    }

    private List<Booking> filterBookingsOnDate(List<Booking> bookings, LocalDate date) {
        return bookings.stream()
                .filter(b -> b.getSlotStart() != null && b.getSlotStart().toLocalDate().isEqual(date))
                .collect(Collectors.toList());
    }

    private List<Booking> filterBookingsBetweenDates(List<Booking> bookings, LocalDate start, LocalDate end) {
        return bookings.stream()
                .filter(b -> {
                    if (b.getSlotStart() == null) return false;
                    LocalDate d = b.getSlotStart().toLocalDate();
                    return !d.isBefore(start) && !d.isAfter(end);
                })
                .collect(Collectors.toList());
    }

    private List<Booking> filterBookingsInMonth(List<Booking> bookings, YearMonth yearMonth) {
        return bookings.stream()
                .filter(b -> b.getSlotStart() != null && YearMonth.from(b.getSlotStart().toLocalDate()).equals(yearMonth))
                .collect(Collectors.toList());
    }

    private BigDecimal sumRevenue(List<Booking> bookings) {
        return bookings.stream()
                .map(b -> (b.getService() != null && b.getService().getPrice() != null) ? b.getService().getPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private Double calculatePercentChange(BigDecimal current, BigDecimal previous) {
        if (previous == null || previous.compareTo(BigDecimal.ZERO) == 0) {
            if (current != null && current.compareTo(BigDecimal.ZERO) > 0) return 100.0;
            return 0.0;
        }
        BigDecimal diff = current.subtract(previous);
        return diff.divide(previous, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private RevenueAnalyticsDTO.TopStaffRevenueDTO findTopStaff(List<Booking> bookings) {
        Map<Barber, List<Booking>> byBarber = bookings.stream()
                .filter(b -> b.getBarber() != null)
                .collect(Collectors.groupingBy(Booking::getBarber));

        if (byBarber.isEmpty()) {
            return null;
        }

        Barber topBarber = null;
        BigDecimal maxRevenue = BigDecimal.ZERO;
        int maxBookings = 0;

        for (Map.Entry<Barber, List<Booking>> entry : byBarber.entrySet()) {
            BigDecimal staffRevenue = sumRevenue(entry.getValue());
            if (topBarber == null || staffRevenue.compareTo(maxRevenue) > 0) {
                topBarber = entry.getKey();
                maxRevenue = staffRevenue;
                maxBookings = entry.getValue().size();
            }
        }

        if (topBarber == null) return null;

        return RevenueAnalyticsDTO.TopStaffRevenueDTO.builder()
                .staffId(topBarber.getId())
                .name(topBarber.getName())
                .avatarUrl(topBarber.getPhotoUrl())
                .specialty(topBarber.getSpecialty())
                .totalRevenue(maxRevenue)
                .completedBookings(maxBookings)
                .build();
    }
}
