package com.barberapp.controller;

import com.barberapp.dto.AuditLogPageResponseDTO;
import com.barberapp.dto.AuditLogResponseDTO;
import com.barberapp.security.JwtAuthenticationFilter;
import com.barberapp.security.JwtService;
import com.barberapp.service.AuditLogService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuditLogController.class)
@AutoConfigureMockMvc(addFilters = false)
public class AuditLogControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuditLogService auditLogService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private com.barberapp.repository.UserRepository userRepository;

    @MockBean
    private com.barberapp.repository.ShopRepository shopRepository;

    @Test
    @DisplayName("GET /api/admin/audit-logs returns paginated response")
    void testGetPaginatedAuditLogs() throws Exception {
        AuditLogResponseDTO item = AuditLogResponseDTO.builder()
                .id(1L)
                .userEmail("admin@barberapp.sa")
                .userFullName("Super Administrator")
                .userRole("SUPER_ADMIN")
                .shopName("Golden Scissors Salon")
                .shopSlug("golden-scissors")
                .action("LOGIN")
                .details("{\"status\": \"SUCCESS\"}")
                .ipAddress("127.0.0.1")
                .createdAt(LocalDateTime.now())
                .build();

        AuditLogPageResponseDTO pageResponse = AuditLogPageResponseDTO.builder()
                .content(List.of(item))
                .page(0)
                .size(10)
                .totalElements(1)
                .totalPages(1)
                .first(true)
                .last(true)
                .empty(false)
                .build();

        when(auditLogService.getPaginatedAuditLogs(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(pageResponse);

        mockMvc.perform(get("/api/admin/audit-logs")
                        .param("page", "0")
                        .param("size", "10")
                        .param("action", "LOGIN")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].action").value("LOGIN"))
                .andExpect(jsonPath("$.content[0].userEmail").value("admin@barberapp.sa"));
    }

    @Test
    @DisplayName("GET /api/admin/audit-logs/{id} returns single entry")
    void testGetAuditLogById() throws Exception {
        AuditLogResponseDTO item = AuditLogResponseDTO.builder()
                .id(5L)
                .userEmail("owner@goldenscissors.sa")
                .action("UPDATE_SALON")
                .details("{\"field\": \"phone\"}")
                .ipAddress("192.168.1.45")
                .createdAt(LocalDateTime.now())
                .build();

        when(auditLogService.getAuditLogById(5L)).thenReturn(item);

        mockMvc.perform(get("/api/admin/audit-logs/5")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.action").value("UPDATE_SALON"))
                .andExpect(jsonPath("$.userEmail").value("owner@goldenscissors.sa"));
    }
}
