-- Flyway Migration V9: Create password_resets table and sanitize legacy plain text passwords

CREATE TABLE password_resets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_password_resets_token_hash (token_hash),
    INDEX idx_password_resets_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sanitize legacy unhashed user passwords (e.g. user 135 with plain 'password') to BCrypt hash of "Password123!"
UPDATE users 
SET password = '$2a$10$ehdBzoabfflfMR11zP44c.yP72vQoD019tGjTff0gWn4q00Z6j5sS' 
WHERE password NOT LIKE '$2a$%';

-- Standardize legacy SHOP_OWNER roles to canonical SALON_OWNER
UPDATE users SET role = 'SALON_OWNER' WHERE role = 'SHOP_OWNER';
