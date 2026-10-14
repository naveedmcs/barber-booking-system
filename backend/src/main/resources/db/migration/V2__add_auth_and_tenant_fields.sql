-- Flyway Migration V2: Add tenant salon_id and active boolean to users table
ALTER TABLE users ADD COLUMN salon_id BIGINT NULL;
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
