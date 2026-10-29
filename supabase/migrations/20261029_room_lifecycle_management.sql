-- ==============================================================================
-- GREENVIEW PG MANAGER: ROOM LIFECYCLE, PURPOSE & DECOMMISSIONING MIGRATION
-- Migration Name: 20261029_room_lifecycle_management.sql
-- Description: Adds schema support for room operational statuses, room purposes
-- (storage, maintenance, staff, accommodation), status reasons, effective dates,
-- and status transition history.
-- 
-- IMPORTANT: REVIEW-ONLY MIGRATION. DO NOT EXECUTE DIRECTLY AGAINST PRODUCTION
-- UNTIL EXPLICITLY APPROVED.
--
-- Backward Compatibility: The application data layer also mirrors these fields
-- into rooms.amenities JSONB, ensuring uninterrupted functionality before
-- this migration is formally applied to Supabase.
-- ==============================================================================

-- 1. ADD ROOM PURPOSE & OPERATIONAL STATUS COLUMNS TO rooms TABLE
ALTER TABLE IF EXISTS public.rooms
  ADD COLUMN IF NOT EXISTS room_purpose text NOT NULL DEFAULT 'accommodation',
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_effective_date date,
  ADD COLUMN IF NOT EXISTS status_notes text,
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. ADD CHECK CONSTRAINTS SAFELY
DO $$
BEGIN
  -- Validate room_purpose values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_room_purpose'
  ) THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT chk_rooms_room_purpose
      CHECK (room_purpose IN ('accommodation', 'storage', 'maintenance', 'staff', 'other'));
  END IF;

  -- Validate operational_status values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_rooms_operational_status'
  ) THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT chk_rooms_operational_status
      CHECK (operational_status IN ('available', 'closed', 'maintenance', 'storage', 'retired'));
  END IF;
END $$;

-- 3. CREATE PERFORMANCE INDEXES FOR FILTERING
CREATE INDEX IF NOT EXISTS idx_rooms_purpose ON public.rooms (room_purpose);
CREATE INDEX IF NOT EXISTS idx_rooms_operational_status ON public.rooms (operational_status);
CREATE INDEX IF NOT EXISTS idx_rooms_property_purpose ON public.rooms (property_id, room_purpose);

-- 4. BACKFILL FROM EXISTING AMENITIES JSONB METADATA (IF PRESENT)
UPDATE public.rooms
SET
  room_purpose = COALESCE(amenities->>'_roomPurpose', room_purpose),
  operational_status = COALESCE(amenities->>'_operationalStatus', operational_status),
  status_reason = COALESCE(amenities->>'_statusReason', status_reason),
  status_notes = COALESCE(amenities->>'_statusNotes', status_notes)
WHERE amenities IS NOT NULL
  AND (amenities ? '_roomPurpose' OR amenities ? '_operationalStatus');

-- 5. DOCUMENTATION COMMENTS
COMMENT ON COLUMN public.rooms.room_purpose IS 'Primary operational purpose: accommodation, storage, maintenance, staff, other.';
COMMENT ON COLUMN public.rooms.operational_status IS 'Lifecycle state: available, closed, maintenance, storage, retired.';
COMMENT ON COLUMN public.rooms.status_reason IS 'Human-readable explanation for converting to storage, closing, or retirement.';
COMMENT ON COLUMN public.rooms.status_effective_date IS 'Date when the operational status change took effect.';
COMMENT ON COLUMN public.rooms.status_history IS 'JSON array of chronological status transitions for auditing.';

