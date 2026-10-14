package com.barberapp.repository;

import com.barberapp.entity.PasswordReset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {
    Optional<PasswordReset> findByTokenHashAndUsedFalse(String tokenHash);
    List<PasswordReset> findByUserIdAndUsedFalse(Long userId);
}
