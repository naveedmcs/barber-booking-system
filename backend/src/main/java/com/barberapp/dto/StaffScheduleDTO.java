package com.barberapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffScheduleDTO {
    private Long barberId;
    private List<DayScheduleItem> days;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DayScheduleItem {
        private Integer dayOfWeek; // 1 = Sunday, 7 = Saturday or ISO 1=Monday
        private String dayName;
        private LocalTime startTime;
        private LocalTime endTime;
        private Boolean isOff;
        private LocalTime breakStart;
        private LocalTime breakEnd;
    }
}
