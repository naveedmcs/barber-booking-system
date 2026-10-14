package com.barberapp.service;

import com.barberapp.dto.AuditLogPageResponseDTO;
import com.barberapp.dto.AuditLogResponseDTO;
import com.barberapp.entity.AuditLog;
import com.barberapp.entity.Shop;
import com.barberapp.entity.User;
import com.barberapp.repository.AuditLogRepository;
import com.barberapp.repository.specification.AuditLogSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public AuditLog logEvent(User user, Shop shop, String action, String details, String ipAddress) {
        try {
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
        } catch (Exception e) {
            log.warn("Could not save audit log with direct FK entity: {}. Saving with unlinked fallback.", e.getMessage());
            try {
                String extendedDetails = details != null ? details : "";
                if (user != null && user.getEmail() != null) {
                    extendedDetails += " (User: " + user.getEmail() + ")";
                }
                AuditLog fallback = AuditLog.builder()
                        .action(action)
                        .details(extendedDetails)
                        .ipAddress(ipAddress)
                        .build();
                return auditLogRepository.save(fallback);
            } catch (Exception ex) {
                log.error("Failed to persist audit log fallback: {}", ex.getMessage());
                return null;
            }
        }
    }

    @Transactional(readOnly = true)
    public AuditLogPageResponseDTO getPaginatedAuditLogs(
            LocalDateTime startDate,
            LocalDateTime endDate,
            String action,
            Long shopId,
            String search,
            Pageable pageable
    ) {
        Specification<AuditLog> spec = AuditLogSpecification.filter(startDate, endDate, action, shopId, search);
        Page<AuditLog> page = auditLogRepository.findAll(spec, pageable);

        List<AuditLogResponseDTO> content = page.getContent().stream()
                .map(this::mapToDTO)
                .toList();

        return AuditLogPageResponseDTO.builder()
                .content(content)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .empty(page.isEmpty())
                .build();
    }

    @Transactional(readOnly = true)
    public AuditLogResponseDTO getAuditLogById(Long id) {
        AuditLog logEntity = auditLogRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Audit log entry not found with ID: " + id));
        return mapToDTO(logEntity);
    }

    private AuditLogResponseDTO mapToDTO(AuditLog log) {
        User user = log.getUser();
        Shop shop = log.getShop();

        return AuditLogResponseDTO.builder()
                .id(log.getId())
                .userId(user != null ? user.getId() : null)
                .userEmail(user != null ? user.getEmail() : "system@barberapp.sa")
                .userFullName(user != null ? user.getFullName() : "System Engine")
                .userRole(user != null && user.getRole() != null ? user.getRole().name() : "SYSTEM")
                .shopId(shop != null ? shop.getId() : null)
                .shopName(shop != null ? shop.getName() : "Global Platform")
                .shopSlug(shop != null ? shop.getSlug() : null)
                .action(log.getAction())
                .details(log.getDetails())
                .ipAddress(log.getIpAddress() != null ? log.getIpAddress() : "127.0.0.1")
                .createdAt(log.getCreatedAt())
                .build();
    }
}
