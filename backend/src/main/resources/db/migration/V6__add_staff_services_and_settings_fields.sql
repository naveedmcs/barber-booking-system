-- Migration V6: Add staff, services, and settings fields

ALTER TABLE barbers
    ADD COLUMN specialty VARCHAR(100) DEFAULT 'Master Barber',
    ADD COLUMN phone VARCHAR(30) NULL,
    ADD COLUMN email VARCHAR(255) NULL,
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE working_hours
    ADD COLUMN break_start TIME NULL,
    ADD COLUMN break_end TIME NULL;

ALTER TABLE services
    ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'General',
    ADD COLUMN buffer_minutes INT NOT NULL DEFAULT 5,
    ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN assigned_staff_ids VARCHAR(255) NOT NULL DEFAULT 'ALL';

ALTER TABLE shops
    ADD COLUMN logo_url VARCHAR(512) NULL,
    ADD COLUMN cover_image_url VARCHAR(512) NULL,
    ADD COLUMN latitude DECIMAL(10, 8) NULL,
    ADD COLUMN longitude DECIMAL(11, 8) NULL,
    ADD COLUMN min_cancel_notice_hours INT NOT NULL DEFAULT 2,
    ADD COLUMN max_advance_booking_days INT NOT NULL DEFAULT 14,
    ADD COLUMN auto_confirm_walkins BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN operating_hours_json TEXT NULL;
