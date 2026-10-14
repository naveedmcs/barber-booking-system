package com.barberapp.controller;

import com.barberapp.dto.ShopRegistrationDto;
import com.barberapp.dto.ShopStatusUpdateDto;
import com.barberapp.entity.Shop;
import com.barberapp.service.QrCodeService;
import com.barberapp.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shops")
@RequiredArgsConstructor
public class ShopController {

    private final ShopService shopService;
    private final QrCodeService qrCodeService;

    @PostMapping("/register")
    public ResponseEntity<Shop> registerShop(@Valid @RequestBody ShopRegistrationDto dto) {
        Shop shop = shopService.registerShop(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(shop);
    }

    @GetMapping
    public ResponseEntity<List<Shop>> getAllShops() {
        return ResponseEntity.ok(shopService.getAllShops());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Shop> getShopById(@PathVariable Long id) {
        return ResponseEntity.ok(shopService.getShopById(id));
    }

    @GetMapping("/{id}/barbers")
    public ResponseEntity<java.util.List<com.barberapp.entity.Barber>> getBarbers(@PathVariable Long id) {
        return ResponseEntity.ok(shopService.getBarbersByShop(id));
    }

    @GetMapping("/{id}/services")
    public ResponseEntity<java.util.List<com.barberapp.entity.ServiceItem>> getServices(@PathVariable Long id) {
        return ResponseEntity.ok(shopService.getServicesByShop(id));
    }

    @GetMapping("/{id}/qr/login")
    public ResponseEntity<?> downloadLoginQr(
            @PathVariable Long id,
            @RequestParam(defaultValue = "png") String format) throws Exception {
        Shop shop = shopService.getShopById(id);
        String url = shop.getLoginUrl() != null ? shop.getLoginUrl() : "http://localhost:3000/dashboard/index.html?slug=" + shop.getSlug();

        if ("svg".equalsIgnoreCase(format)) {
            String svg = qrCodeService.generateQrCodeSvg(url, 300, 300);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + shop.getSlug() + "-login-qr.svg\"")
                    .contentType(MediaType.parseMediaType("image/svg+xml"))
                    .body(svg);
        } else {
            byte[] png = qrCodeService.generateQrCodePng(url, 300, 300);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + shop.getSlug() + "-login-qr.png\"")
                    .contentType(MediaType.IMAGE_PNG)
                    .body(png);
        }
    }

    @GetMapping("/{id}/qr/booking")
    public ResponseEntity<?> downloadBookingQr(
            @PathVariable Long id,
            @RequestParam(defaultValue = "png") String format) throws Exception {
        Shop shop = shopService.getShopById(id);
        String url = shop.getBookingUrl() != null ? shop.getBookingUrl() : "http://localhost:3000/booking/?slug=" + shop.getSlug();

        if ("svg".equalsIgnoreCase(format)) {
            String svg = qrCodeService.generateQrCodeSvg(url, 300, 300);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + shop.getSlug() + "-booking-qr.svg\"")
                    .contentType(MediaType.parseMediaType("image/svg+xml"))
                    .body(svg);
        } else {
            byte[] png = qrCodeService.generateQrCodePng(url, 300, 300);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + shop.getSlug() + "-booking-qr.png\"")
                    .contentType(MediaType.IMAGE_PNG)
                    .body(png);
        }
    }

    @GetMapping("/{id}/qr/zip")
    public ResponseEntity<byte[]> downloadShopQrZip(@PathVariable Long id) throws Exception {
        Shop shop = shopService.getShopById(id);
        String loginUrl = shop.getLoginUrl() != null ? shop.getLoginUrl() : "http://localhost:3000/dashboard/index.html?slug=" + shop.getSlug();
        String bookingUrl = shop.getBookingUrl() != null ? shop.getBookingUrl() : "http://localhost:3000/booking/?slug=" + shop.getSlug();

        byte[] zipBytes = qrCodeService.generateQrZip(shop.getName(), shop.getSlug(), loginUrl, bookingUrl);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + shop.getSlug() + "-qr-codes.zip\"")
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(zipBytes);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Shop> updateShopStatus(
            @PathVariable Long id,
            @Valid @RequestBody ShopStatusUpdateDto dto,
            HttpServletRequest request) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = request.getRemoteAddr();
        }
        Shop updated = shopService.updateShopStatus(
                id,
                dto.getStatus(),
                dto.getReason(),
                dto.getActorEmail(),
                clientIp
        );
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Shop> updateShopStatusPut(
            @PathVariable Long id,
            @Valid @RequestBody ShopStatusUpdateDto dto,
            HttpServletRequest request) {
        return updateShopStatus(id, dto, request);
    }
}
