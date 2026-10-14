-- Flyway Migration V5: Add cancellation_reason and notes, and allow nullable foreign keys for BLOCKED slots
ALTER TABLE bookings MODIFY service_id BIGINT NULL, MODIFY customer_id BIGINT NULL, ADD COLUMN cancellation_reason VARCHAR(255) NULL, ADD COLUMN notes VARCHAR(500) NULL;
