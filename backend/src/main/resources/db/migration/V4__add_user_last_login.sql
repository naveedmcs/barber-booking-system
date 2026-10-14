-- Flyway Migration V4: Add last_login timestamp column to users table
ALTER TABLE users ADD COLUMN last_login DATETIME NULL;
