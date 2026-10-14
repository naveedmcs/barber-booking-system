package com.barberapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevenueAnalyticsDTO {

    private String currency;
    private String timezone;

    // Daily
    private BigDecimal todayEarnings;
    private BigDecimal yesterdayEarnings;
    private Double dailyPercentChange;
    private Integer todayBookingsCount;

    // Weekly
    private BigDecimal currentWeekEarnings;
    private BigDecimal previousWeekEarnings;
    private Double weeklyPercentChange;
    private List<DayBreakdownDTO> weeklyBreakdown;

    // Monthly
    private BigDecimal currentMonthEarnings;
    private BigDecimal previousMonthEarnings;
    private Double monthlyPercentChange;
    private Integer currentMonthBookingsCount;

    // Overview KPIs
    private BigDecimal totalCompletedRevenue;
    private Integer totalCompletedBookings;
    private BigDecimal averageTicketSize;

    // Top Revenue-Generating Staff Member
    private TopStaffRevenueDTO topStaff;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DayBreakdownDTO {
        private String dayOfWeek; // e.g. "Sunday"
        private String date;      // e.g. "2026-10-11"
        private BigDecimal revenue;
        private Integer bookingsCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopStaffRevenueDTO {
        private Long staffId;
        private String name;
        private String avatarUrl;
        private String specialty;
        private BigDecimal totalRevenue;
        private Integer completedBookings;
    }
}
