package com.barberapp.service;

import com.barberapp.entity.AuditLog;
import com.barberapp.entity.Shop;
import com.barberapp.entity.User;
import com.barberapp.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public AuditLog logEvent(User user, Shop shop, String action, String details, String ipAddress) {
        AuditLog auditLog = AuditLog.builder()
                .user(user)
                .shop(shop)
                .action(action)
                .details(details)
                .ipAddress(ipAddress)
                .build();
        log.info("AUDIT LOG EVENT: action={}, shopId={}, userId={}, details={}", action,
                shop != null ? shop.getId() : null, user != null ? user.getId() : null, details);
        return auditLogRepository.save(auditLog);
    }
}
