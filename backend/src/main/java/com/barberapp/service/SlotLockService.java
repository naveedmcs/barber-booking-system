package com.barberapp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class SlotLockService {

    private final RedissonClient redissonClient;
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final long HOLD_TTL_MINUTES = 5;

    public String buildLockKey(Long barberId, LocalDateTime slotStart) {
        return "lock:slot:" + barberId + ":" + slotStart.format(FORMATTER);
    }

    public boolean acquireSlotHold(Long barberId, LocalDateTime slotStart) {
        String lockKey = buildLockKey(barberId, slotStart);
        RLock lock = redissonClient.getLock(lockKey);
        try {
            return lock.tryLock(0, HOLD_TTL_MINUTES, TimeUnit.MINUTES);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Interrupted while acquiring lock for key {}", lockKey, e);
            return false;
        }
    }

    public void releaseSlotHold(Long barberId, LocalDateTime slotStart) {
        String lockKey = buildLockKey(barberId, slotStart);
        RLock lock = redissonClient.getLock(lockKey);
        if (lock.isHeldByCurrentThread()) {
            lock.unlock();
        }
    }
}
