package com.barberapp.security;

import com.barberapp.entity.User;
import com.barberapp.entity.enums.UserRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    public JwtService(
            @Value("${app.jwt.secret:SuperSecretKeyForBarberAppBookingSystemJWT2026SecureKeyWith32PlusBytes!}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(User user) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(user.getEmail())
                .claim("userId", user.getId())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .claim("salonId", user.getSalonId())
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();
    }

    public Claims validateAndExtractClaims(String token) throws JwtException {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractEmail(String token) {
        return validateAndExtractClaims(token).getSubject();
    }

    public Long extractUserId(String token) {
        Object val = validateAndExtractClaims(token).get("userId");
        if (val instanceof Number) {
            return ((Number) val).longValue();
        }
        return null;
    }

    public UserRole extractRole(String token) {
        String roleStr = (String) validateAndExtractClaims(token).get("role");
        if (roleStr != null) {
            return UserRole.valueOf(roleStr);
        }
        return null;
    }

    public Long extractSalonId(String token) {
        Object val = validateAndExtractClaims(token).get("salonId");
        if (val instanceof Number) {
            return ((Number) val).longValue();
        }
        return null;
    }

    public long getExpirationMs() {
        return expirationMs / 1000;
    }
}
