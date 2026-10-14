package com.barberapp.service;

import com.barberapp.dto.ShopRegistrationDto;
import com.barberapp.entity.*;
import com.barberapp.entity.enums.ShopStatus;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShopService {

    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final BarberRepository barberRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final CustomerRepository customerRepository;
    private final QrCodeService qrCodeService;
    private final AuditLogService auditLogService;

    @Transactional
    public Shop registerShop(ShopRegistrationDto dto) {
        User owner = User.builder()
                .fullName(dto.getOwnerFullName())
                .email(dto.getOwnerEmail())
                .password(dto.getOwnerPassword())
                .phone(dto.getPhone())
                .role(UserRole.SHOP_OWNER)
                .build();
        owner = userRepository.save(owner);

        String tempSlug = generateSlug(dto.getShopName()) + "-" + UUID.randomUUID().toString().substring(0, 6);
        String loginUrl = "http://localhost:3000/dashboard/index.html?slug=" + tempSlug;
        String bookingUrl = "http://localhost:3000/booking.html?slug=" + tempSlug;

        String loginQrCode = null;
        String bookingQrCode = null;
        try {
            loginQrCode = qrCodeService.generateQrCodeBase64Png(loginUrl, 300, 300);
            bookingQrCode = qrCodeService.generateQrCodeBase64Png(bookingUrl, 300, 300);
        } catch (Exception e) {
            log.warn("Failed to generate QR codes during registration: {}", e.getMessage());
        }

        Shop shop = Shop.builder()
                .owner(owner)
                .name(dto.getShopName())
                .slug(tempSlug)
                .phone(dto.getPhone())
                .region(dto.getRegion())
                .district(dto.getDistrict())
                .city(dto.getCity())
                .fullAddress(dto.getFullAddress())
                .mapAddress(dto.getMapAddress())
                .subscriptionPlan(dto.getSubscriptionPlan())
                .status(ShopStatus.PENDING)
                .loginUrl(loginUrl)
                .bookingUrl(bookingUrl)
                .loginQrCodeData(loginQrCode)
                .bookingQrCodeData(bookingQrCode)
                .qrCodeUrl(bookingUrl)
                .build();

        Shop savedShop = shopRepository.save(shop);

        // Seed default Barber for the shop
        Barber barber = Barber.builder()
                .shop(savedShop)
                .name("Master Barber")
                .photoUrl("https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=150")
                .build();
        barberRepository.save(barber);

        // Seed default Service for the shop
        ServiceItem service = ServiceItem.builder()
                .shop(savedShop)
                .name("Haircut & Beard Trim")
                .description("Standard haircut with beard styling and hot towel treatment")
                .price(new BigDecimal("60.00"))
                .durationMinutes(30)
                .build();
        serviceItemRepository.save(service);

        // Seed default Customers if none exist
        if (customerRepository.count() == 0) {
            Customer customer1 = Customer.builder()
                    .fullName("Customer One")
                    .email("customer1@example.com")
                    .phone("0501111111")
                    .build();
            customerRepository.save(customer1);

            Customer customer2 = Customer.builder()
                    .fullName("Customer Two")
                    .email("customer2@example.com")
                    .phone("0502222222")
                    .build();
            customerRepository.save(customer2);
        }

        auditLogService.logEvent(
                owner,
                savedShop,
                "SHOP_REGISTERED",
                String.format("New salon registered: '%s' in %s, Plan: %s, Owner: %s",
                        savedShop.getName(), savedShop.getCity(), savedShop.getSubscriptionPlan(), owner.getEmail()),
                "127.0.0.1"
        );

        return savedShop;
    }

    public List<Shop> getAllShops() {
        return shopRepository.findAll();
    }

    public Shop getShopById(Long id) {
        return shopRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Shop not found with id: " + id));
    }

    public Shop getShopBySlug(String slug) {
        return shopRepository.findBySlug(slug)
                .orElseThrow(() -> new RuntimeException("Shop not found with slug: " + slug));
    }

    public List<Barber> getBarbersByShop(Long shopId) {
        return barberRepository.findByShopId(shopId).stream()
                .filter(b -> b.getIsActive() == null || Boolean.TRUE.equals(b.getIsActive()))
                .collect(java.util.stream.Collectors.toList());
    }

    public List<ServiceItem> getServicesByShop(Long shopId) {
        List<ServiceItem> visible = serviceItemRepository.findByShopIdAndIsVisibleTrue(shopId);
        return visible.isEmpty() ? serviceItemRepository.findByShopId(shopId) : visible;
    }

    public String generateSlug(String shopName) {
        String slugified = shopName.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("[\\s-]+", "-");
        return slugified.isEmpty() ? "shop" : slugified;
    }

    @Transactional
    public Shop updateShopStatus(Long id, ShopStatus newStatus, String reason, String actorEmail, String ipAddress) {
        Shop shop = getShopById(id);
        ShopStatus previousStatus = shop.getStatus();
        shop.setStatus(newStatus);
        Shop updated = shopRepository.save(shop);

        // Retrieve admin user for audit logging
        User actor = null;
        if (actorEmail != null && !actorEmail.isBlank()) {
            actor = userRepository.findByEmail(actorEmail).orElse(null);
        }
        if (actor == null) {
            actor = userRepository.findByEmail("admin@barberapp.sa").orElse(null);
        }

        String action = "SHOP_STATUS_" + newStatus.name();
        String details = String.format("Status changed from %s to %s. Reason: %s",
                previousStatus, newStatus, (reason != null && !reason.isBlank()) ? reason : "Administrative override");

        auditLogService.logEvent(actor, updated, action, details, ipAddress);
        log.info("Audit log recorded for shop id {}: action={}, reason={}", id, action, details);

        return updated;
    }
}
