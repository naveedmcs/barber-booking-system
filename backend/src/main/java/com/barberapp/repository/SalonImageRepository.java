package com.barberapp.repository;

import com.barberapp.entity.SalonImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalonImageRepository extends JpaRepository<SalonImage, Long> {

    List<SalonImage> findByShopIdOrderByDisplayOrderAsc(Long shopId);

    long countByShopId(Long shopId);

    void deleteByShopId(Long shopId);
}
