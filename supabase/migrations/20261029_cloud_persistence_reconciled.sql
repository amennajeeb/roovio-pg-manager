-- ==============================================================================
-- Migration: Reconciled Cloud Persistence, Multi-Building, Flexible Rooms & Pricing
-- File: supabase/migrations/20261029_cloud_persistence_reconciled.sql
-- Description:
--   Consolidates missing columns from 20261029_multi_building_rooms.sql and
--   20261029_owner_controlled_pricing.sql into a single, idempotent, safe script.
--   Fully preserves existing database records and sets appropriate defaults and constraints.
-- ==============================================================================

-- 1. Extend properties (Multi-Building Support)
ALTER TABLE public.properties 
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS tagline TEXT;

-- 2. Extend floors
ALTER TABLE public.floors 
    ADD COLUMN IF NOT EXISTS total_rooms INTEGER DEFAULT 0;

-- 3. Extend rooms with capacity, whole-room rent, facilities, amenities, and meal pricing
ALTER TABLE public.rooms 
    ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS bathroom_type TEXT NOT NULL DEFAULT 'attached',
    ADD COLUMN IF NOT EXISTS room_rent NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '{"wifi":true,"geyser":true,"cupboard":true,"studyTable":false,"tv":false}'::jsonb,
    ADD COLUMN IF NOT EXISTS food_plan_type TEXT NOT NULL DEFAULT 'no_food',
    ADD COLUMN IF NOT EXISTS meals_provided JSONB DEFAULT '{"breakfast": false, "lunch": false, "dinner": false}'::jsonb,
    ADD COLUMN IF NOT EXISTS food_monthly_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'per_person',
    ADD COLUMN IF NOT EXISTS standard_rent NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS meal_prices JSONB DEFAULT '{"breakfast": 1000, "lunch": 1500, "dinner": 1500}'::jsonb;

-- Room Constraints (Safely added only if absent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_bathroom_type') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_bathroom_type 
            CHECK (bathroom_type IN ('attached', 'shared', 'none'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_status') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_status 
            CHECK (status IN ('available', 'partially_occupied', 'full', 'maintenance', 'inactive', 'closed', 'storage', 'retired'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_food_plan') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_food_plan 
            CHECK (food_plan_type IN ('no_food', 'food_included', 'food_separate', 'custom'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_pricing_basis') THEN
        ALTER TABLE public.rooms ADD CONSTRAINT chk_rooms_pricing_basis 
            CHECK (pricing_basis IN ('per_person', 'per_room'));
    END IF;
END $$;

-- 4. Extend tenants with structured address, agreed pricing, discounts, and audit trail
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS permanent_address JSONB,
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
    ADD COLUMN IF NOT EXISTS rent_history JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS whatsapp_logs JSONB DEFAULT '[]'::jsonb;

-- Tenant Constraints (Safely added only if absent)
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

-- 5. Safe Backfill for any existing rows in the live database
-- Backfill standard_rent to existing monthly_rent if currently null
UPDATE public.tenants 
SET standard_rent = monthly_rent 
WHERE standard_rent IS NULL;

-- Backfill total_monthly_amount to monthly_rent + agreed_food_charge
UPDATE public.tenants 
SET total_monthly_amount = monthly_rent + COALESCE(agreed_food_charge, 0)
WHERE total_monthly_amount IS NULL;

-- Backfill room standard_rent
UPDATE public.rooms 
SET standard_rent = COALESCE(room_rent, 0)
WHERE standard_rent IS NULL OR standard_rent = 0;

-- Backfill permanent_address JSONB from flat address columns if flat columns exist and JSONB is null
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tenants' 
          AND column_name = 'permanent_address_house'
    ) THEN
        UPDATE public.tenants
        SET permanent_address = jsonb_build_object(
            'house', COALESCE(permanent_address_house, ''),
            'locality', COALESCE(permanent_address_locality, ''),
            'district', COALESCE(permanent_address_district, ''),
            'state', COALESCE(permanent_address_state, ''),
            'pincode', COALESCE(permanent_address_pincode, '')
        )
        WHERE permanent_address IS NULL AND permanent_address_house IS NOT NULL;
    END IF;
END $$;

-- 6. Ensure Storage Bucket for private tenant documents exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tenant-documents',
    'tenant-documents',
    false, -- Strictly private
    10485760, -- 10MB limit per document
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE 
    SET public = false, 
        file_size_limit = 10485760,
        allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policy: Only authenticated owners can access objects in their own UUID folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Tenant documents private owner access'
    ) THEN
        CREATE POLICY "Tenant documents private owner access"
            ON storage.objects
            FOR ALL
            TO authenticated
            USING (
                bucket_id = 'tenant-documents'
                AND (storage.foldername(name))[1] = auth.uid()::text
            )
            WITH CHECK (
                bucket_id = 'tenant-documents'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;
END $$;

