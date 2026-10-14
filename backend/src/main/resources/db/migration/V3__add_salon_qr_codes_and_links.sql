-- Flyway Migration V3: Add login link, booking link, and QR code data to shops table
ALTER TABLE shops ADD COLUMN login_url VARCHAR(512) NULL;
ALTER TABLE shops ADD COLUMN booking_url VARCHAR(512) NULL;
ALTER TABLE shops ADD COLUMN login_qr_code_data LONGTEXT NULL;
ALTER TABLE shops ADD COLUMN booking_qr_code_data LONGTEXT NULL;
