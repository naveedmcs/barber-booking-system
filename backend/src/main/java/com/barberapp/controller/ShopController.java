package com.barberapp.controller;

import com.barberapp.dto.ShopRegistrationDto;
import com.barberapp.entity.Shop;
import com.barberapp.service.ShopService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopController {

    private final ShopService shopService;

    @PostMapping("/register")
    public ResponseEntity<Shop> registerShop(@Valid @RequestBody ShopRegistrationDto dto) {
        Shop shop = shopService.registerShop(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(shop);
    }
}
