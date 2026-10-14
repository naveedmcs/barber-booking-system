-- Migration V8: Add staff skills tags and soft deletion timestamp
ALTER TABLE barbers
    ADD COLUMN skills VARCHAR(500) NULL DEFAULT 'Haircut, Beard Trim, Hot Towel',
    ADD COLUMN deleted_at TIMESTAMP NULL;

-- Index for tenant active staff lookup ignoring soft-deleted records
CREATE INDEX idx_barbers_shop_active ON barbers (shop_id, is_active, deleted_at);
