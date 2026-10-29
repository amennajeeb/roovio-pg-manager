-- ==============================================================================
-- Migration: Owner-Controlled Pricing, Differential Berth Rents & Price Audit Trail
-- Extends rooms and tenants for GreenView PG Manager
-- ==============================================================================

-- 1. Extend rooms table with pricing basis and itemized meal pricing
ALTER TABLE public.rooms 
    ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'per_person',
    ADD COLUMN IF NOT EXISTS standard_rent NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS meal_prices JSONB DEFAULT '{"breakfast": 1000, "lunch": 1500, "dinner": 1500}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_pricing_basis') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_pricing_basis 
            CHECK (pricing_basis IN ('per_person', 'per_room'));
    END IF;
END $$;

-- 2. Extend tenants table with standard pricing vs agreed pricing and price history audit trail
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'per_person',
    ADD COLUMN IF NOT EXISTS standard_rent NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS food_plan_type TEXT NOT NULL DEFAULT 'no_food',
    ADD COLUMN IF NOT EXISTS selected_meals JSONB DEFAULT '{"breakfast": false, "lunch": false, "dinner": false}'::jsonb,
    ADD COLUMN IF NOT EXISTS standard_food_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS agreed_food_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_type TEXT,
    ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_reason TEXT,
    ADD COLUMN IF NOT EXISTS pricing_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS total_monthly_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS rent_history JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_pricing_basis') THEN
        ALTER TABLE public.tenants ADD CONSTRAINT chk_tenants_pricing_basis 
            CHECK (pricing_basis IN ('per_person', 'per_room'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_discount_type') THEN
        ALTER TABLE public.tenants ADD CONSTRAINT chk_tenants_discount_type 
            CHECK (discount_type IS NULL OR discount_type IN ('amount', 'percentage'));
    END IF;
END $$;

