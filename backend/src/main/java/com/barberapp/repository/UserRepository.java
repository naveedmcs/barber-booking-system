package com.barberapp.repository;

import com.barberapp.entity.User;
import com.barberapp.entity.enums.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    List<User> findByRoleIn(List<UserRole> roles);
    long countByRoleAndActiveTrue(UserRole role);
}
