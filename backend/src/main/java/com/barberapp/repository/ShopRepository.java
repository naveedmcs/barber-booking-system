package com.barberapp.repository;

import com.barberapp.entity.Shop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopRepository extends JpaRepository<Shop, Long> {
    boolean existsBySlug(String slug);
    Optional<Shop> findBySlug(String slug);
    List<Shop> findByOwnerId(Long ownerId);
}
