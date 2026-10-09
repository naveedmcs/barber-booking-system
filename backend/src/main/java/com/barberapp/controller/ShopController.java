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

    @GetMapping("/{id}/barbers")
    public ResponseEntity<java.util.List<com.barberapp.entity.Barber>> getBarbers(@PathVariable Long id) {
        return ResponseEntity.ok(shopService.getBarbersByShop(id));
    }

    @GetMapping("/{id}/services")
    public ResponseEntity<java.util.List<com.barberapp.entity.ServiceItem>> getServices(@PathVariable Long id) {
        return ResponseEntity.ok(shopService.getServicesByShop(id));
    }
}
