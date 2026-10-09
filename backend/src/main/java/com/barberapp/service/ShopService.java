package com.barberapp.service;

import com.barberapp.dto.ShopRegistrationDto;
import com.barberapp.entity.*;
import com.barberapp.entity.enums.ShopStatus;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopRepository shopRepository;
    private final UserRepository userRepository;
    private final BarberRepository barberRepository;
    private final ServiceItemRepository serviceItemRepository;
    private final CustomerRepository customerRepository;

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

        return savedShop;
    }

    public java.util.List<Barber> getBarbersByShop(Long shopId) {
        return barberRepository.findByShopId(shopId);
    }

    public java.util.List<ServiceItem> getServicesByShop(Long shopId) {
        return serviceItemRepository.findByShopId(shopId);
    }

    public String generateSlug(String shopName) {
        String slugified = shopName.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("[\\s-]+", "-");
        return slugified.isEmpty() ? "shop" : slugified;
    }
}
