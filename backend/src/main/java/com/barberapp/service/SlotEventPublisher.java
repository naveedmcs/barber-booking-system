package com.barberapp.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class SlotEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SlotUpdateEvent {
        private Long shopId;
        private Long barberId;
        private Long slotId;
        private LocalDateTime slotStart;
        private LocalDateTime slotEnd;
        private String eventType;
        private String status;
    }

    public void publishSlotUpdate(Long shopId, SlotUpdateEvent event) {
        String destination = "/topic/shop/" + shopId + "/slots";
        log.info("Publishing slot update to destination {}: {}", destination, event);
        messagingTemplate.convertAndSend(destination, event);
    }
}
