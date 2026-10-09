package com.barberapp.service;

import com.barberapp.entity.*;
import com.barberapp.entity.enums.ShopStatus;
import com.barberapp.entity.enums.SubscriptionPlan;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.exception.SlotAlreadyBookedException;
import com.barberapp.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
public class BookingConcurrencyTest {

    @Autowired
    private SlotBookingService slotBookingService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ShopRepository shopRepository;

    @Autowired
    private BarberRepository barberRepository;

    @Autowired
    private ServiceItemRepository serviceItemRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private BookingRepository bookingRepository;

    private Long shopId;
    private Long barberId;
    private Long serviceId;
    private Long customerId;
    private LocalDateTime slotStart;
    private LocalDateTime slotEnd;

    @BeforeEach
    void setUp() {
        bookingRepository.deleteAll();
        barberRepository.deleteAll();
        serviceItemRepository.deleteAll();
        shopRepository.deleteAll();
        customerRepository.deleteAll();
        userRepository.deleteAll();

        User owner = userRepository.save(User.builder()
                .email("owner@test.com")
                .password("password")
                .fullName("Shop Owner")
                .role(UserRole.SHOP_OWNER)
                .phone("0500000001")
                .build());

        Shop shop = shopRepository.save(Shop.builder()
                .owner(owner)
                .name("Golden Scissors")
                .slug("golden-scissors")
                .phone("0500000002")
                .region("Riyadh Region")
                .district("Olaya")
                .city("Riyadh")
                .fullAddress("King Fahd Road, Olaya")
                .subscriptionPlan(SubscriptionPlan.MONTHLY)
                .status(ShopStatus.ACTIVE)
                .build());
        shopId = shop.getId();

        Barber barber = barberRepository.save(Barber.builder()
                .shop(shop)
                .name("Master Barber Ahmed")
                .build());
        barberId = barber.getId();

        ServiceItem service = serviceItemRepository.save(ServiceItem.builder()
                .shop(shop)
                .name("Haircut & Beard Trim")
                .price(new BigDecimal("50.00"))
                .durationMinutes(30)
                .build());
        serviceId = service.getId();

        Customer customer = customerRepository.save(Customer.builder()
                .fullName("John Doe")
                .email("john@example.com")
                .phone("0500000003")
                .build());
        customerId = customer.getId();

        slotStart = LocalDateTime.of(2026, 10, 1, 14, 0);
        slotEnd = slotStart.plusMinutes(30);
    }

    @Test
    @DisplayName("Verify 20 concurrent booking requests yield exactly 1 success and 19 rejections")
    void testConcurrentBookingRaceCondition() throws InterruptedException {
        int numberOfThreads = 20;
        ExecutorService executorService = Executors.newFixedThreadPool(numberOfThreads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(numberOfThreads);

        AtomicInteger successCount = new AtomicInteger(0);
        AtomicInteger failureCount = new AtomicInteger(0);

        for (int i = 0; i < numberOfThreads; i++) {
            executorService.submit(() -> {
                try {
                    startLatch.await();
                    slotBookingService.holdSlot(shopId, barberId, serviceId, customerId, slotStart, slotEnd);
                    successCount.incrementAndGet();
                } catch (SlotAlreadyBookedException e) {
                    failureCount.incrementAndGet();
                } catch (Exception e) {
                    failureCount.incrementAndGet();
                } finally {
                    finishLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        finishLatch.await();
        executorService.shutdown();

        assertEquals(1, successCount.get(), "Expected exactly 1 successful booking hold");
        assertEquals(19, failureCount.get(), "Expected exactly 19 rejections due to concurrent locking");
    }
}
