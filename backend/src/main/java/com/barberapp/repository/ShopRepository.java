package com.barberapp.repository;

import com.barberapp.entity.Shop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ShopRepository extends JpaRepository<Shop, Long> {
    boolean existsBySlug(String slug);
}
