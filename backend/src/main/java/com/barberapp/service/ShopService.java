package com.barberapp.service;

import com.barberapp.dto.ShopRegistrationDto;
import com.barberapp.entity.Shop;
import com.barberapp.entity.User;
import com.barberapp.entity.enums.ShopStatus;
import com.barberapp.entity.enums.UserRole;
import com.barberapp.repository.ShopRepository;
import com.barberapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShopService {

    private final ShopRepository shopRepository;
    private final UserRepository userRepository;

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

        return shopRepository.save(shop);
    }

    public String generateSlug(String shopName) {
        String slugified = shopName.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("[\\s-]+", "-");
        return slugified.isEmpty() ? "shop" : slugified;
    }
}
