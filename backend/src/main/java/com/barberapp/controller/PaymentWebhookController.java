package com.barberapp.controller;

import com.barberapp.entity.Payment;
import com.barberapp.entity.Shop;
import com.barberapp.entity.Subscription;
import com.barberapp.entity.enums.PaymentProvider;
import com.barberapp.entity.enums.PaymentStatus;
import com.barberapp.entity.enums.ShopStatus;
import com.barberapp.entity.enums.SubscriptionPlan;
import com.barberapp.entity.enums.SubscriptionStatus;
import com.barberapp.repository.PaymentRepository;
import com.barberapp.repository.ShopRepository;
import com.barberapp.repository.SubscriptionRepository;
import com.barberapp.service.AuditLogService;
import com.barberapp.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentWebhookController {

    private final PaymentRepository paymentRepository;
    private final ShopRepository shopRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final ShopService shopService;
    private final AuditLogService auditLogService;

    @Value("${payment.webhook.secret:default_webhook_secret_key}")
    private String webhookSecret;

    @Getter
    @Setter
    @NoArgsConstructor
    public static class WebhookPayload {
        private Long shopId;
        private String transactionId;
        private BigDecimal amount;
        private String currency;
        private String status;
        private String provider;
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handlePaymentWebhook(
            @RequestBody WebhookPayload payload,
            @RequestHeader(value = "X-Webhook-Signature", required = false) String signature,
            HttpServletRequest request) {

        log.info("Received payment webhook for transactionId: {}", payload.getTransactionId());

        if (signature != null && !verifyHmacSignature(payload.getTransactionId(), signature)) {
            log.warn("Invalid HMAC signature for transactionId: {}", payload.getTransactionId());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid signature");
        }

        // Idempotency Check
        if (payload.getTransactionId() != null && paymentRepository.existsByTransactionId(payload.getTransactionId())) {
            log.info("Transaction {} already processed. Idempotent return.", payload.getTransactionId());
            return ResponseEntity.ok("Event already processed");
        }

        Shop shop = shopRepository.findById(payload.getShopId())
                .orElseThrow(() -> new IllegalArgumentException("Shop not found with ID: " + payload.getShopId()));

        if ("SUCCESS".equalsIgnoreCase(payload.getStatus()) || "PAID".equalsIgnoreCase(payload.getStatus())) {
            // Auto-Approve Shop & Generate Final Slug
            String baseSlug = shopService.generateSlug(shop.getName());
            String finalSlug = baseSlug;

            shop.setStatus(ShopStatus.ACTIVE);
            shop.setSlug(finalSlug);
            shop.setQrCodeUrl("https://book.barberapp.sa/" + finalSlug + "/qr");
            shopRepository.save(shop);

            // Subscription Creation
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime endDate = shop.getSubscriptionPlan() == SubscriptionPlan.YEARLY ? now.plusYears(1) : now.plusMonths(1);

            Subscription subscription = Subscription.builder()
                    .shop(shop)
                    .planType(shop.getSubscriptionPlan())
                    .status(SubscriptionStatus.ACTIVE)
                    .amount(payload.getAmount() != null ? payload.getAmount() : BigDecimal.ZERO)
                    .startDate(now)
                    .endDate(endDate)
                    .autoRenew(true)
                    .build();
            subscription = subscriptionRepository.save(subscription);

            // Payment Record
            Payment payment = Payment.builder()
                    .shop(shop)
                    .subscription(subscription)
                    .amount(payload.getAmount() != null ? payload.getAmount() : BigDecimal.ZERO)
                    .currency(payload.getCurrency() != null ? payload.getCurrency() : "SAR")
                    .status(PaymentStatus.SUCCESS)
                    .provider(parseProvider(payload.getProvider()))
                    .transactionId(payload.getTransactionId())
                    .rawResponse("Automated Webhook Approval")
                    .build();
            paymentRepository.save(payment);

            // Audit Logging
            auditLogService.logEvent(
                    shop.getOwner(),
                    shop,
                    "SHOP_AUTO_APPROVED",
                    "Shop auto-approved following payment transaction: " + payload.getTransactionId(),
                    request.getRemoteAddr()
            );

            log.info("Shop ID {} auto-approved with slug: {}", shop.getId(), finalSlug);
        }

        return ResponseEntity.ok("Webhook processed successfully");
    }

    private boolean verifyHmacSignature(String data, String signature) {
        try {
            Mac sha256Hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256Hmac.init(secretKey);
            byte[] hmacBytes = sha256Hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            String calculatedSignature = HexFormat.of().formatHex(hmacBytes);
            return calculatedSignature.equalsIgnoreCase(signature);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            log.error("Error computing HMAC signature", e);
            return false;
        }
    }

    private PaymentProvider parseProvider(String providerStr) {
        if (providerStr == null) return PaymentProvider.MOYASAR;
        try {
            return PaymentProvider.valueOf(providerStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            return PaymentProvider.MOYASAR;
        }
    }
}
