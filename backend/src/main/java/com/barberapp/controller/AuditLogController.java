package com.barberapp.controller;

import com.barberapp.dto.AuditLogPageResponseDTO;
import com.barberapp.dto.AuditLogResponseDTO;
import com.barberapp.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@RestController
@RequestMapping("/api/admin/audit-logs")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class AuditLogController {

    private final AuditLogService auditLogService;
    private final com.barberapp.repository.UserRepository userRepository;
    private final com.barberapp.repository.ShopRepository shopRepository;

    @PostMapping
    public ResponseEntity<AuditLogResponseDTO> createAuditLog(
            @RequestBody com.barberapp.dto.CreateAuditLogRequestDTO request,
            jakarta.servlet.http.HttpServletRequest httpRequest
    ) {
        log.info("Client audit log ingested: action={}, details={}, shopId={}",
                request.getAction(), request.getDetails(), request.getShopId());

        String ip = org.springframework.util.StringUtils.hasText(request.getIpAddress())
                ? request.getIpAddress()
                : (httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1");

        com.barberapp.entity.User user = null;
        if (request.getUserId() != null) {
            user = userRepository.findById(request.getUserId()).orElse(null);
        } else if (org.springframework.util.StringUtils.hasText(request.getUserEmail())) {
            user = userRepository.findByEmail(request.getUserEmail()).orElse(null);
        }

        com.barberapp.entity.Shop shop = null;
        if (request.getShopId() != null) {
            shop = shopRepository.findById(request.getShopId()).orElse(null);
        } else if (org.springframework.util.StringUtils.hasText(request.getShopName())) {
            shop = shopRepository.findAll().stream()
                    .filter(s -> s.getName().equalsIgnoreCase(request.getShopName().trim()))
                    .findFirst()
                    .orElse(null);
        }

        String action = org.springframework.util.StringUtils.hasText(request.getAction())
                ? request.getAction().trim()
                : "USER_ACTIVITY";

        String details = request.getDetails() != null ? request.getDetails() : "Activity logged";

        com.barberapp.entity.AuditLog logEntity = auditLogService.logEvent(user, shop, action, details, ip);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(auditLogService.getAuditLogById(logEntity.getId()));
    }

    @GetMapping
    public ResponseEntity<AuditLogPageResponseDTO> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) Long shopId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "DESC") String direction
    ) {
        log.info("Fetching audit logs: page={}, size={}, from={}, to={}, action={}, shopId={}, search={}",
                page, size, from, to, action, shopId, search);

        // Normalize page and size boundaries
        int pageIndex = Math.max(0, page);
        int pageSize = Math.min(100, Math.max(1, size));

        Sort sort = Sort.by(
                "ASC".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC,
                sortBy
        );
        Pageable pageable = PageRequest.of(pageIndex, pageSize, sort);

        LocalDateTime startDateTime = from != null ? from.atStartOfDay() : null;
        LocalDateTime endDateTime = to != null ? to.atTime(LocalTime.MAX) : null;

        AuditLogPageResponseDTO response = auditLogService.getPaginatedAuditLogs(
                startDateTime,
                endDateTime,
                action,
                shopId,
                search,
                pageable
        );

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AuditLogResponseDTO> getAuditLogById(@PathVariable Long id) {
        AuditLogResponseDTO dto = auditLogService.getAuditLogById(id);
        return ResponseEntity.ok(dto);
    }
}
