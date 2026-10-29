-- ==============================================================================
-- Migration: Multi-Building and Flexible Room Configuration
-- Extends properties, floors, rooms, and beds for GreenView PG Manager
-- ==============================================================================

-- 1. Extend properties (Buildings)
ALTER TABLE public.properties 
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS tagline TEXT;

-- 2. Extend floors
ALTER TABLE public.floors 
    ADD COLUMN IF NOT EXISTS total_rooms INTEGER DEFAULT 0;

-- 3. Extend rooms with capacity, whole-room rent, facilities, amenities, and food plans
ALTER TABLE public.rooms 
    ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS bathroom_type TEXT NOT NULL DEFAULT 'attached',
    ADD COLUMN IF NOT EXISTS room_rent NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS food_plan_type TEXT NOT NULL DEFAULT 'no_food',
    ADD COLUMN IF NOT EXISTS meals_provided JSONB DEFAULT '{"breakfast": false, "lunch": false, "dinner": false}'::jsonb,
    ADD COLUMN IF NOT EXISTS food_monthly_charge NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Add check constraints if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_bathroom_type') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_bathroom_type 
            CHECK (bathroom_type IN ('attached', 'shared', 'none'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_status') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_status 
            CHECK (status IN ('available', 'partially_occupied', 'full', 'maintenance', 'inactive'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_food_plan') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_food_plan 
            CHECK (food_plan_type IN ('no_food', 'food_included', 'food_separate', 'custom'));
    END IF;
END $$;

