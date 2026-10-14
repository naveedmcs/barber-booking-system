package com.barberapp.repository;

import com.barberapp.entity.Barber;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BarberRepository extends JpaRepository<Barber, Long> {
    List<Barber> findByShopId(Long shopId);
    List<Barber> findByShopIdAndDeletedAtIsNull(Long shopId);
    Optional<Barber> findByIdAndShopId(Long id, Long shopId);
    Optional<Barber> findByUserId(Long userId);
    Optional<Barber> findByShopIdAndUserId(Long shopId, Long userId);
    Optional<Barber> findByShopIdAndPhone(Long shopId, String phone);
}
