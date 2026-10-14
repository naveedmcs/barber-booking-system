package com.barberapp.repository;

import com.barberapp.entity.WorkingHours;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkingHoursRepository extends JpaRepository<WorkingHours, Long> {
    List<WorkingHours> findByBarberIdOrderByDayOfWeekAsc(Long barberId);
    Optional<WorkingHours> findByBarberIdAndDayOfWeek(Long barberId, Integer dayOfWeek);
    void deleteByBarberId(Long barberId);
}
