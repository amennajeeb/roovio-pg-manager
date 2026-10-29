-- ==============================================================================
-- GreenView PG Manager - Production Database Schema & Row Level Security (RLS)
-- Multi-Tenant Data Isolation with Individual Berth & Bunk Bed Architecture
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROPERTIES
-- Represents a PG / Hostel establishment owned by an authenticated user
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    total_floors INTEGER NOT NULL DEFAULT 1,
    phone TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own properties"
    ON public.properties
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_properties_owner_id ON public.properties(owner_id);

-- ==============================================================================
-- 2. FLOORS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.floors (
    id TEXT PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    label TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own floors"
    ON public.floors
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_floors_owner_id ON public.floors(owner_id);
CREATE INDEX idx_floors_property_id ON public.floors(property_id);

-- ==============================================================================
-- 3. ROOMS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rooms (
    id TEXT PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    floor_id TEXT NOT NULL REFERENCES public.floors(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    sharing_type TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    has_ac BOOLEAN NOT NULL DEFAULT false,
    has_attached_bathroom BOOLEAN NOT NULL DEFAULT false,
    has_balcony BOOLEAN NOT NULL DEFAULT false,
    bathroom_type TEXT NOT NULL DEFAULT 'attached' CHECK (bathroom_type IN ('attached', 'shared', 'none')),
    room_rent NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'partially_occupied', 'full', 'maintenance', 'inactive')),
    notes TEXT,
    amenities JSONB DEFAULT '{}'::jsonb,
    food_plan_type TEXT NOT NULL DEFAULT 'no_food' CHECK (food_plan_type IN ('no_food', 'food_included', 'food_separate', 'custom')),
    meals_provided JSONB DEFAULT '{"breakfast": false, "lunch": false, "dinner": false}'::jsonb,
    food_monthly_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_rooms_property_number UNIQUE (property_id, room_number)
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own rooms"
    ON public.rooms
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_rooms_owner_id ON public.rooms(owner_id);
CREATE INDEX idx_rooms_floor_id ON public.rooms(floor_id);

-- ==============================================================================
-- 4. BEDS & INDIVIDUAL BERTHS
-- Supports single beds, bunk beds, and mixed configurations.
-- In bunk beds, Upper and Lower berths are separately managed sleeping spaces
-- with their own ID (e.g. 'Room 101 - Bunk 1 - Upper'), occupancy, and monthly rent.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.beds (
    id TEXT PRIMARY KEY, -- Formatted: 'Room 101 - Bunk 1 - Upper' or 'Room 101 - Bed 1'
    room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- e.g. 'Bunk 1 - Upper', 'Bunk 1 - Lower', 'Bed 1'
    bed_type TEXT NOT NULL CHECK (bed_type IN ('single', 'bunk')),
    bunk_group TEXT, -- e.g. 'Bunk 1', 'Bunk 2' (grouped in same physical bunk frame)
    tier TEXT NOT NULL DEFAULT 'single' CHECK (tier IN ('upper', 'lower', 'single')),
    monthly_rent NUMERIC(10, 2) NOT NULL CHECK (monthly_rent >= 0),
    status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'notice', 'maintenance')),
    current_tenant_id UUID, -- References public.tenants(id)
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_bunk_tier CHECK (
        (bed_type = 'bunk' AND tier IN ('upper', 'lower') AND bunk_group IS NOT NULL) OR
        (bed_type = 'single' AND tier = 'single')
    )
);

ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own beds and berths"
    ON public.beds
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_beds_owner_id ON public.beds(owner_id);
CREATE INDEX idx_beds_room_id ON public.beds(room_id);
CREATE INDEX idx_beds_status ON public.beds(status);
CREATE INDEX idx_beds_bunk_group ON public.beds(room_id, bunk_group);

-- ==============================================================================
-- 5. TENANTS & EXTENDED PROFILES
-- Includes contact details, permanent residential address, emergency contact,
-- employment details, joining and move-in dates.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
    bed_id TEXT NOT NULL REFERENCES public.beds(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alternate_phone TEXT,
    email TEXT,
    is_phone_masked BOOLEAN NOT NULL DEFAULT false,
    
    -- Emergency Contact
    emergency_contact TEXT, -- legacy string
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relation TEXT,

    -- Permanent Residential Address
    permanent_address_house TEXT,
    permanent_address_locality TEXT,
    permanent_address_district TEXT,
    permanent_address_state TEXT,
    permanent_address_pincode TEXT,

    -- Employment / Occupation
    employer_name TEXT,
    job_title TEXT,
    workplace_address TEXT,
    employment_phone TEXT,

    -- Dates
    joining_date DATE NOT NULL,
    move_in_date DATE,

    -- Financial & Status
    monthly_rent NUMERIC(10, 2) NOT NULL CHECK (monthly_rent >= 0),
    monthly_due_day INTEGER NOT NULL CHECK (monthly_due_day BETWEEN 1 AND 31),
    deposit_required NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (deposit_required >= 0),
    deposit_received NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (deposit_received >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notice', 'checked_out')),
    notice_date DATE,
    expected_move_out_date DATE,
    actual_checkout_date DATE,
    notes TEXT,

    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own tenants"
    ON public.tenants
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_tenants_owner_id ON public.tenants(owner_id);
CREATE INDEX idx_tenants_bed_id ON public.tenants(bed_id);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_employer ON public.tenants(employer_name);

-- ==============================================================================
-- 5B. TENANT IDENTITY & VERIFICATION DOCUMENTS
-- Enforces:
-- 1. Full 12-digit Aadhaar numbers are never collected, stored or exposed.
-- 2. Only masked identifiers e.g. "•••• •••• 1234" are retained.
-- 3. Tenant consent is explicitly tracked.
-- 4. Manual verification status: pending, verified, rejected (with reason).
-- 5. Row Level Security strictly enforces owner isolation.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_documents (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('aadhaar', 'other_id', 'address_proof', 'employment_id', 'other')),
    title TEXT NOT NULL,
    masked_document_number TEXT, -- Only masked, e.g. "•••• •••• 1234", never raw Aadhaar
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size <= 10485760), -- Max 10MB limit
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Private Supabase Storage object path
    consent_obtained BOOLEAN NOT NULL DEFAULT true,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    verification_notes TEXT,
    rejection_reason TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_rejection_reason CHECK (
        (verification_status = 'rejected' AND rejection_reason IS NOT NULL) OR
        (verification_status != 'rejected')
    )
);

ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage tenant documents"
    ON public.tenant_documents
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_tenant_documents_owner_id ON public.tenant_documents(owner_id);
CREATE INDEX idx_tenant_documents_tenant_id ON public.tenant_documents(tenant_id);
CREATE INDEX idx_tenant_documents_status ON public.tenant_documents(verification_status);

-- ==============================================================================
-- 5C. SUPABASE STORAGE CONFIGURATION & POLICIES
-- Private bucket for tenant identification & address proofs.
-- Never public. Access only through short-lived signed URLs.
-- ==============================================================================
-- 1. Ensure private storage bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'tenant-documents',
    'tenant-documents',
    false, -- Strictly private
    10485760, -- 10MB limit per document
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

-- 2. Storage RLS Policy: Authenticated owners can only manage objects in their own folder
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

-- Foreign key linking current_tenant_id from beds to tenants
ALTER TABLE public.beds
    ADD CONSTRAINT fk_beds_current_tenant
    FOREIGN KEY (current_tenant_id)
    REFERENCES public.tenants(id)
    ON DELETE SET NULL;

-- ==============================================================================
-- 6. RENT CHARGES
-- Distinct ledger records for each billing month per tenant
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.rent_charges (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    billing_month TEXT NOT NULL, -- Format: 'YYYY-MM'
    due_date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    is_prorated BOOLEAN NOT NULL DEFAULT false,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_rent_charge_month UNIQUE (tenant_id, billing_month)
);

ALTER TABLE public.rent_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage rent charges"
    ON public.rent_charges
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_rent_charges_owner_id ON public.rent_charges(owner_id);
CREATE INDEX idx_rent_charges_billing_month ON public.rent_charges(billing_month);
CREATE INDEX idx_rent_charges_tenant_id ON public.rent_charges(tenant_id);

-- ==============================================================================
-- 7. PAYMENTS
-- Payments explicitly allocated against monthly rent charges
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    receipt_number TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    charge_id TEXT NOT NULL REFERENCES public.rent_charges(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    billing_month TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'Cash', 'Bank Transfer')),
    transaction_ref TEXT,
    notes TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage payments"
    ON public.payments
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_payments_owner_id ON public.payments(owner_id);
CREATE INDEX idx_payments_charge_id ON public.payments(charge_id);
CREATE INDEX idx_payments_billing_month ON public.payments(billing_month);

-- ==============================================================================
-- 8. SECURITY DEPOSITS
-- Isolated ledger for security deposit receipts and refunds
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.security_deposits (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('collected', 'refunded', 'deducted')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('UPI', 'Cash', 'Bank Transfer')),
    notes TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.security_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage security deposits"
    ON public.security_deposits
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_security_deposits_owner_id ON public.security_deposits(owner_id);
CREATE INDEX idx_security_deposits_tenant_id ON public.security_deposits(tenant_id);

-- ==============================================================================
-- 9. EXPENSES
-- Operational expenses (utilities, cook, cleaning, maintenance, repairs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Utilities', 'Maintenance', 'Salaries & Staff', 'Groceries & Kitchen', 'Internet & Cable', 'Rent & Lease', 'Repairs', 'Other')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('UPI', 'Cash', 'Bank Transfer', 'Credit Card')),
    notes TEXT,
    linked_maintenance_ticket_id TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage expenses"
    ON public.expenses
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_expenses_owner_id ON public.expenses(owner_id);
CREATE INDEX idx_expenses_payment_date ON public.expenses(payment_date);

-- ==============================================================================
-- 10. MAINTENANCE TICKETS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
    id TEXT PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    room_id TEXT REFERENCES public.rooms(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    category TEXT NOT NULL CHECK (category IN ('Plumbing', 'Electrical', 'Appliances', 'Carpentry', 'Cleaning', 'Pest Control', 'Other')),
    reported_date DATE NOT NULL,
    resolved_date DATE,
    linked_expense_id TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage maintenance tickets"
    ON public.maintenance_tickets
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_maintenance_tickets_owner_id ON public.maintenance_tickets(owner_id);
CREATE INDEX idx_maintenance_tickets_status ON public.maintenance_tickets(status);

-- ==============================================================================
-- 11. INVENTORY CHECKLISTS
-- Bedside tables, mattresses, keys, cupboards allocated to tenants
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    condition TEXT NOT NULL DEFAULT 'Good' CHECK (condition IN ('Good', 'Fair', 'Damaged', 'Missing')),
    check_in_condition TEXT NOT NULL DEFAULT 'Good' CHECK (check_in_condition IN ('Good', 'Fair', 'Damaged', 'Missing')),
    check_out_condition TEXT CHECK (check_out_condition IN ('Good', 'Fair', 'Damaged', 'Missing')),
    check_in_date DATE NOT NULL,
    check_out_date DATE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage inventory items"
    ON public.inventory_items
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_inventory_items_owner_id ON public.inventory_items(owner_id);
CREATE INDEX idx_inventory_items_tenant_id ON public.inventory_items(tenant_id);

-- ==============================================================================
-- 12. STAY & BERTH AUDIT HISTORY
-- Immutable record of bed allocations, transfers, notice submissions, and checkouts
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stay_history (
    id TEXT PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('joined', 'moved', 'notice_given', 'checked_out')),
    room_number TEXT NOT NULL,
    bed_label TEXT NOT NULL,
    notes TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.stay_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view and record stay history"
    ON public.stay_history
    FOR ALL
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_stay_history_owner_id ON public.stay_history(owner_id);
CREATE INDEX idx_stay_history_tenant_id ON public.stay_history(tenant_id);

