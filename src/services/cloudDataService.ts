import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  AppState,
  Property,
  Floor,
  Room,
  Bed,
  Tenant,
  RentCharge,
  PaymentRecord,
  Expense,
  MaintenanceTicket,
  InventoryItem,
  StayHistoryItem,
  TenantDocument,
  PermanentAddress,
} from '../types';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Verify that the current Supabase session is authenticated and returns the user UUID.
 * Rejects if unauthenticated or if demo credentials are used.
 */
export async function getAuthenticatedCloudOwnerId(): Promise<string> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase client is not configured in environment.');
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('Unauthenticated: An active Supabase session is required for cloud persistence.');
  }

  const ownerId = data.user.id;
  if (!isValidUUID(ownerId)) {
    throw new Error(`Invalid owner UUID from auth provider: "${ownerId}". Demo IDs are prohibited in cloud mode.`);
  }

  return ownerId;
}

// ==============================================================================
// 1. DATA MAPPERS (Database snake_case <-> TypeScript camelCase)
// ==============================================================================

export function mapPropertyRowToEntity(row: any): Property {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tagline: row.tagline || undefined,
    description: row.description || undefined,
    address: row.address,
    city: row.city,
    pincode: row.pincode,
    phone: row.phone,
    upiId: row.upi_id,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at,
  };
}

export function mapPropertyEntityToRow(prop: Property, ownerId: string): any {
  return {
    id: isValidUUID(prop.id) ? prop.id : undefined,
    owner_id: ownerId,
    name: prop.name,
    tagline: prop.tagline || null,
    description: prop.description || null,
    address: prop.address,
    city: prop.city,
    state: 'Karnataka',
    pincode: prop.pincode,
    phone: prop.phone,
    upi_id: prop.upiId,
    is_archived: Boolean(prop.isArchived),
  };
}

export function mapFloorRowToEntity(row: any): Floor {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.label,
    number: row.floor_number,
    totalRooms: row.total_rooms || 0,
  };
}

export function mapRoomRowToEntity(row: any, beds: Bed[]): Room {
  return {
    id: row.id,
    propertyId: row.property_id,
    floorId: row.floor_id,
    roomNumber: row.room_number,
    sharingType: row.sharing_type,
    capacity: row.capacity || beds.length || 1,
    hasAc: Boolean(row.has_ac),
    hasAttachedBathroom: Boolean(row.has_attached_bathroom),
    hasBalcony: Boolean(row.has_balcony),
    bathroomType: row.bathroom_type || 'attached',
    roomRent: row.room_rent != null ? Number(row.room_rent) : undefined,
    status: row.status || 'available',
    roomPurpose: row.room_purpose || row.amenities?._roomPurpose || 'accommodation',
    operationalStatus: row.operational_status || row.amenities?._operationalStatus || (row.status === 'inactive' ? 'closed' : row.status === 'maintenance' ? 'maintenance' : 'available'),
    statusReason: row.status_reason || row.amenities?._statusReason || undefined,
    statusEffectiveDate: row.status_effective_date || row.amenities?._statusEffectiveDate || undefined,
    statusNotes: row.status_notes || row.amenities?._statusNotes || undefined,
    statusHistory: row.status_history || row.amenities?._statusHistory || [],
    notes: row.notes || undefined,
    amenities: row.amenities || { wifi: true, geyser: true, cupboard: true, studyTable: false, tv: false },
    foodPlanType: row.food_plan_type || 'no_food',
    mealsProvided: row.meals_provided || { breakfast: false, lunch: false, dinner: false },
    foodMonthlyCharge: Number(row.food_monthly_charge || 0),
    pricingBasis: row.pricing_basis || 'per_person',
    standardRent: row.standard_rent != null ? Number(row.standard_rent) : 0,
    mealPrices: row.meal_prices || { breakfast: 1000, lunch: 1500, dinner: 1500 },
    beds: beds.filter((b) => b.roomId === row.id),
  };
}

export function mapBedRowToEntity(row: any): Bed {
  return {
    id: row.id,
    roomId: row.room_id,
    label: row.label,
    bedType: row.bed_type,
    bunkGroup: row.bunk_group || undefined,
    tier: row.tier || 'single',
    monthlyRent: Number(row.monthly_rent),
    status: row.status,
    currentTenantId: row.current_tenant_id || undefined,
  };
}

export function mapTenantRowToEntity(row: any, docs: TenantDocument[] = []): Tenant {
  let permanentAddress: PermanentAddress | undefined;
  if (row.permanent_address && typeof row.permanent_address === 'object') {
    permanentAddress = row.permanent_address;
  } else if (row.permanent_address_house) {
    permanentAddress = {
      house: row.permanent_address_house,
      locality: row.permanent_address_locality || '',
      district: row.permanent_address_district || '',
      state: row.permanent_address_state || '',
      pincode: row.permanent_address_pincode || '',
    };
  }

  return {
    id: row.id,
    ownerId: row.owner_id,
    propertyId: row.property_id,
    roomId: row.room_id,
    bedId: row.bed_id,
    name: row.name,
    phone: row.phone,
    alternatePhone: row.alternate_phone || undefined,
    email: row.email || undefined,
    isPhoneMasked: Boolean(row.is_phone_masked),
    emergencyContact: row.emergency_contact || undefined,
    emergencyContactName: row.emergency_contact_name || undefined,
    emergencyContactPhone: row.emergency_contact_phone || undefined,
    emergencyContactRelation: row.emergency_contact_relation || undefined,
    permanentAddress,
    employerName: row.employer_name || undefined,
    jobTitle: row.job_title || undefined,
    workplaceAddress: row.workplace_address || undefined,
    employmentPhone: row.employment_phone || undefined,
    joiningDate: row.joining_date,
    moveInDate: row.move_in_date || row.joining_date,
    monthlyRent: Number(row.monthly_rent),
    monthlyDueDay: Number(row.monthly_due_day),
    depositRequired: Number(row.deposit_required || 0),
    depositReceived: Number(row.deposit_received || 0),
    status: row.status,
    pricingBasis: row.pricing_basis || 'per_person',
    standardRent: row.standard_rent != null ? Number(row.standard_rent) : Number(row.monthly_rent),
    foodPlanType: row.food_plan_type || 'no_food',
    selectedMeals: row.selected_meals,
    standardFoodCharge: Number(row.standard_food_charge || 0),
    agreedFoodCharge: Number(row.agreed_food_charge || 0),
    discountType: row.discount_type || undefined,
    discountValue: row.discount_value != null ? Number(row.discount_value) : undefined,
    discountAmount: Number(row.discount_amount || 0),
    discountReason: row.discount_reason || undefined,
    pricingOverrideReason: row.pricing_override_reason || undefined,
    totalMonthlyAmount: Number(row.total_monthly_amount || row.monthly_rent),
    rentHistory: Array.isArray(row.rent_history) ? row.rent_history : [],
    assignedInventory: [],
    stayHistory: [],
    whatsappLogs: Array.isArray(row.whatsapp_logs) ? row.whatsapp_logs : [],
    documents: docs.filter((d) => d.tenantId === row.id),
  };
}

export function mapTenantEntityToRow(tenant: Tenant, ownerId: string): any {
  return {
    id: isValidUUID(tenant.id) ? tenant.id : undefined,
    property_id: tenant.propertyId,
    room_id: tenant.roomId,
    bed_id: tenant.bedId,
    name: tenant.name,
    phone: tenant.phone,
    alternate_phone: tenant.alternatePhone || null,
    email: tenant.email || null,
    is_phone_masked: Boolean(tenant.isPhoneMasked),
    emergency_contact: tenant.emergencyContact || null,
    emergency_contact_name: tenant.emergencyContactName || null,
    emergency_contact_phone: tenant.emergencyContactPhone || null,
    emergency_contact_relation: tenant.emergencyContactRelation || null,
    permanent_address: tenant.permanentAddress || null,
    permanent_address_house: tenant.permanentAddress?.house || null,
    permanent_address_locality: tenant.permanentAddress?.locality || null,
    permanent_address_district: tenant.permanentAddress?.district || null,
    permanent_address_state: tenant.permanentAddress?.state || null,
    permanent_address_pincode: tenant.permanentAddress?.pincode || null,
    employer_name: tenant.employerName || null,
    job_title: tenant.jobTitle || null,
    workplace_address: tenant.workplaceAddress || null,
    employment_phone: tenant.employmentPhone || null,
    joining_date: tenant.joiningDate,
    move_in_date: tenant.moveInDate || tenant.joiningDate,
    monthly_rent: tenant.monthlyRent,
    monthly_due_day: tenant.monthlyDueDay,
    deposit_required: tenant.depositRequired,
    deposit_received: tenant.depositReceived,
    status: tenant.status,
    pricing_basis: tenant.pricingBasis || 'per_person',
    standard_rent: tenant.standardRent ?? tenant.monthlyRent,
    food_plan_type: tenant.foodPlanType || 'no_food',
    selected_meals: tenant.selectedMeals || { breakfast: false, lunch: false, dinner: false },
    standard_food_charge: tenant.standardFoodCharge || 0,
    agreed_food_charge: tenant.agreedFoodCharge || 0,
    discount_type: tenant.discountType || null,
    discount_value: tenant.discountValue ?? null,
    discount_amount: tenant.discountAmount || 0,
    discount_reason: tenant.discountReason || null,
    pricing_override_reason: tenant.pricingOverrideReason || null,
    total_monthly_amount: tenant.totalMonthlyAmount || (tenant.monthlyRent + (tenant.agreedFoodCharge || 0)),
    rent_history: tenant.rentHistory || [],
    whatsapp_logs: tenant.whatsappLogs || [],
    owner_id: ownerId,
  };
}

export function mapPaymentRowToEntity(row: any): PaymentRecord {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    tenantId: row.tenant_id,
    chargeId: row.charge_id,
    billingMonth: row.billing_month,
    amount: Number(row.amount),
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    transactionRef: row.transaction_ref || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export function mapPaymentEntityToRow(pay: PaymentRecord, propertyId: string, ownerId: string): any {
  return {
    id: pay.id,
    receipt_number: pay.receiptNumber,
    tenant_id: pay.tenantId,
    charge_id: pay.chargeId,
    property_id: propertyId,
    billing_month: pay.billingMonth,
    amount: pay.amount,
    payment_date: pay.paymentDate,
    payment_method: pay.paymentMethod,
    transaction_ref: pay.transactionRef || null,
    notes: pay.notes || null,
    owner_id: ownerId,
  };
}

export function mapRentChargeRowToEntity(row: any): RentCharge {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    billingMonth: row.billing_month,
    dueDate: row.due_date,
    amount: Number(row.amount),
    isProrated: Boolean(row.is_prorated),
    createdAt: row.created_at,
  };
}

export function mapExpenseRowToEntity(row: any): Expense {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    paymentDate: row.payment_date,
    paymentMode: row.payment_mode,
    notes: row.notes || undefined,
    linkedMaintenanceTicketId: row.linked_maintenance_ticket_id || undefined,
    createdAt: row.created_at,
  };
}

export function mapTicketRowToEntity(row: any): MaintenanceTicket {
  return {
    id: row.id,
    ticketNumber: row.ticket_number || `TKT-${row.id.slice(0, 6)}`,
    title: row.title,
    description: row.description || '',
    floorId: row.floor_id || '',
    roomId: row.room_id || undefined,
    category: row.category || 'General',
    priority: row.priority || 'medium',
    status: row.status || 'open',
    createdDate: row.created_date || row.created_at || new Date().toISOString(),
    estimatedCost: Number(row.estimated_cost || 0),
    resolutionNotes: row.resolution_notes || undefined,
    resolvedDate: row.resolved_date || undefined,
    linkedExpenseId: row.linked_expense_id || undefined,
  };
}

export function mapDocumentRowToEntity(row: any): TenantDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    documentType: row.document_type,
    title: row.title,
    maskedDocumentNumber: row.masked_document_number || undefined,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    uploadedAt: row.created_at,
    verificationStatus: row.verification_status,
    verificationNotes: row.verification_notes || undefined,
    rejectionReason: row.rejection_reason || undefined,
    verifiedAt: row.verified_at || undefined,
    verifiedBy: row.verified_by || undefined,
    storagePath: row.storage_path,
    consentObtained: Boolean(row.consent_obtained),
    ownerId: row.owner_id,
  };
}

// ==============================================================================
// 2. CLOUD FETCH & DATA LOAD
// ==============================================================================

export interface CloudLoadResult {
  success: boolean;
  data?: AppState;
  hasCloudData: boolean;
  error?: string;
}

/**
 * Fetch all records owned by the authenticated owner from Supabase.
 * Respects RLS and queries strictly with verified ownerId.
 */
export async function loadCloudDataForOwner(ownerId: string): Promise<CloudLoadResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, hasCloudData: false, error: 'Supabase client is not configured.' };
  }

  if (!isValidUUID(ownerId)) {
    return { success: false, hasCloudData: false, error: `Invalid owner UUID: "${ownerId}". Demo accounts cannot use cloud storage.` };
  }

  try {
    // 1. Fetch Properties
    const { data: props, error: propsErr } = await supabase
      .from('properties')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true });

    if (propsErr) throw propsErr;

    // If owner has 0 properties in cloud, return hasCloudData = false (triggers first-time setup)
    if (!props || props.length === 0) {
      return { success: true, hasCloudData: false };
    }

    const properties: Property[] = props.map(mapPropertyRowToEntity);
    const activeProp = properties.find((p) => !p.isArchived) || properties[0];

    // 2. Fetch Floors, Rooms, Beds in parallel
    const [
      { data: floorsData, error: floorsErr },
      { data: roomsData, error: roomsErr },
      { data: bedsData, error: bedsErr },
      { data: tenantsData, error: tenantsErr },
      { data: docsData, error: docsErr },
      { data: chargesData, error: chargesErr },
      { data: paymentsData, error: paymentsErr },
      { data: expensesData, error: expensesErr },
      { data: ticketsData, error: ticketsErr },
      { data: inventoryData, error: inventoryErr },
      { data: stayHistoryData, error: stayErr },
    ] = await Promise.all([
      supabase.from('floors').select('*').eq('owner_id', ownerId),
      supabase.from('rooms').select('*').eq('owner_id', ownerId),
      supabase.from('beds').select('*').eq('owner_id', ownerId),
      supabase.from('tenants').select('*').eq('owner_id', ownerId),
      supabase.from('tenant_documents').select('*').eq('owner_id', ownerId),
      supabase.from('rent_charges').select('*').eq('owner_id', ownerId),
      supabase.from('payments').select('*').eq('owner_id', ownerId),
      supabase.from('expenses').select('*').eq('owner_id', ownerId),
      supabase.from('maintenance_tickets').select('*').eq('owner_id', ownerId),
      supabase.from('inventory_items').select('*').eq('owner_id', ownerId),
      supabase.from('stay_history').select('*').eq('owner_id', ownerId),
    ]);

    if (floorsErr) throw floorsErr;
    if (roomsErr) throw roomsErr;
    if (bedsErr) throw bedsErr;
    if (tenantsErr) throw tenantsErr;

    const floors: Floor[] = (floorsData || []).map(mapFloorRowToEntity);
    const beds: Bed[] = (bedsData || []).map(mapBedRowToEntity);
    const rooms: Room[] = (roomsData || []).map((r) => mapRoomRowToEntity(r, beds));
    const docs: TenantDocument[] = (docsData || []).map(mapDocumentRowToEntity);
    const tenants: Tenant[] = (tenantsData || []).map((t) => mapTenantRowToEntity(t, docs));
    const rentCharges: RentCharge[] = (chargesData || []).map(mapRentChargeRowToEntity);
    const payments: PaymentRecord[] = (paymentsData || []).map(mapPaymentRowToEntity);
    const expenses: Expense[] = (expensesData || []).map(mapExpenseRowToEntity);
    const maintenanceTickets: MaintenanceTicket[] = (ticketsData || []).map(mapTicketRowToEntity);

    const appState: AppState = {
      version: 1,
      property: activeProp,
      properties,
      activePropertyId: activeProp.id,
      floors,
      rooms,
      tenants,
      rentCharges,
      payments,
      expenses,
      maintenanceTickets,
      securityDeposits: [],
      amenities: [],
      demoDate: '2026-10-29',
      selectedMonth: '2026-10',
      ownerId,
    };

    return {
      success: true,
      hasCloudData: true,
      data: appState,
    };
  } catch (err: any) {
    return {
      success: false,
      hasCloudData: false,
      error: err?.message || 'Failed to fetch cloud records from Supabase.',
    };
  }
}

// ==============================================================================
// 3. CLOUD INITIAL PROVISIONING FOR NEW OWNERS
// ==============================================================================

/**
 * Initializes a new owner in Supabase with their primary Property and 3 Floors.
 */
export async function initializeCloudOwner(
  ownerId: string,
  propertyName: string,
  propertyDetails?: { address?: string; city?: string; phone?: string; upiId?: string }
): Promise<{ success: boolean; property?: Property; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Valid Supabase client and owner UUID required.' };
  }

  try {
    const propId = crypto.randomUUID();
    const newPropRow = {
      id: propId,
      owner_id: ownerId,
      name: propertyName.trim() || 'ROOVIO Malabar Residency PG',
      address: propertyDetails?.address?.trim() || 'Mavoor Road, Kozhikode',
      city: propertyDetails?.city?.trim() || 'Kozhikode, Kerala',
      state: 'Kerala',
      pincode: '673004',
      phone: propertyDetails?.phone?.trim() || '+91 94470 12345',
      upi_id: propertyDetails?.upiId?.trim() || 'malabarpg@upi',
      is_archived: false,
    };

    const { data: insertedProp, error: propErr } = await supabase
      .from('properties')
      .insert(newPropRow)
      .select()
      .single();

    if (propErr) throw propErr;

    // Create 3 standard floors
    const defaultFloors = [
      { id: `floor-g-${propId.slice(0, 8)}`, property_id: propId, floor_number: 0, label: 'Ground Floor', owner_id: ownerId, total_rooms: 0 },
      { id: `floor-1-${propId.slice(0, 8)}`, property_id: propId, floor_number: 1, label: 'First Floor', owner_id: ownerId, total_rooms: 0 },
      { id: `floor-2-${propId.slice(0, 8)}`, property_id: propId, floor_number: 2, label: 'Second Floor', owner_id: ownerId, total_rooms: 0 },
    ];

    const { error: floorErr } = await supabase.from('floors').insert(defaultFloors);
    if (floorErr) throw floorErr;

    return {
      success: true,
      property: mapPropertyRowToEntity(insertedProp),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to initialize owner property in Supabase.' };
  }
}

// ==============================================================================
// 4. CLOUD MUTATIONS (Tenants, Rooms, Payments, Expenses, Buildings, Lifecycle)
// ==============================================================================

/**
 * Safely upsert row(s) into a Supabase table.
 * If a column does not exist in the database (error 42703), it dynamically strips the missing column
 * and retries, ensuring backward compatibility with unmigrated database instances.
 */
export async function safeCloudUpsert(
  tableName: string,
  payload: any | any[],
  onConflict?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not initialized.' };

  let currentPayload = JSON.parse(JSON.stringify(payload));

  for (let attempt = 0; attempt < 8; attempt++) {
    const query = supabase.from(tableName).upsert(currentPayload, onConflict ? { onConflict } : undefined);
    const { data, error } = await query;
    if (!error) {
      return { success: true, data };
    }

    // Check if error is due to an unmigrated missing column (Postgres 42703)
    if (error.code === '42703') {
      const match =
        error.message.match(/column ["]?([a-zA-Z0-9_]+)["]?.*does not exist/i) ||
        error.message.match(/column [a-zA-Z0-9_]+\.([a-zA-Z0-9_]+) does not exist/i);
      const missingCol = match ? match[1] : null;

      if (missingCol) {
        console.warn(`[CloudPersistence] Column "${missingCol}" does not exist in live table "${tableName}". Retrying without it.`);
        if (Array.isArray(currentPayload)) {
          currentPayload = currentPayload.map((r: any) => {
            const copy = { ...r };
            delete copy[missingCol];
            return copy;
          });
        } else {
          delete currentPayload[missingCol];
        }
        continue;
      }
    }

    return { success: false, error: error.message };
  }

  return { success: false, error: `Failed to persist to ${tableName} after column-stripping retries.` };
}

export async function upsertCloudTenant(tenant: Tenant, ownerId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) return { success: false, error: 'Unauthenticated cloud session.' };

  try {
    const row = mapTenantEntityToRow(tenant, ownerId);
    return await safeCloudUpsert('tenants', row, 'id');
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save tenant to cloud.' };
  }
}

export async function upsertCloudPayment(payment: PaymentRecord, propertyId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) return { success: false, error: 'Unauthenticated cloud session.' };

  try {
    const row = mapPaymentEntityToRow(payment, propertyId, ownerId);
    return await safeCloudUpsert('payments', row, 'id');
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to record payment in cloud.' };
  }
}

export async function upsertCloudExpense(expense: Expense, propertyId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) return { success: false, error: 'Unauthenticated cloud session.' };

  try {
    const row = {
      id: expense.id,
      property_id: propertyId,
      title: expense.title,
      category: expense.category,
      amount: expense.amount,
      payment_date: expense.paymentDate,
      payment_mode: expense.paymentMode,
      notes: expense.notes || null,
      linked_maintenance_ticket_id: expense.linkedMaintenanceTicketId || null,
      owner_id: ownerId,
    };
    return await safeCloudUpsert('expenses', row, 'id');
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to log expense in cloud.' };
  }
}

export async function upsertCloudRoom(room: Room, ownerId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) return { success: false, error: 'Unauthenticated cloud session.' };

  try {
    const amenitiesObj = {
      ...(room.amenities || {}),
      _roomPurpose: room.roomPurpose || 'accommodation',
      _operationalStatus: room.operationalStatus || 'available',
      _statusReason: room.statusReason || null,
      _statusEffectiveDate: room.statusEffectiveDate || null,
      _statusNotes: room.statusNotes || null,
      _statusHistory: room.statusHistory || [],
    };

    const roomRow = {
      id: room.id,
      property_id: room.propertyId,
      floor_id: room.floorId,
      room_number: room.roomNumber,
      sharing_type: room.sharingType,
      capacity: room.capacity || room.beds.length,
      has_ac: room.hasAc,
      has_attached_bathroom: room.hasAttachedBathroom,
      has_balcony: room.hasBalcony,
      bathroom_type: room.bathroomType || 'attached',
      room_rent: room.roomRent || null,
      status: room.status || 'available',
      notes: room.notes || null,
      amenities: amenitiesObj,
      food_plan_type: room.foodPlanType || 'no_food',
      meals_provided: room.mealsProvided || { breakfast: false, lunch: false, dinner: false },
      food_monthly_charge: room.foodMonthlyCharge || 0,
      pricing_basis: room.pricingBasis || 'per_person',
      standard_rent: room.standardRent || 0,
      meal_prices: room.mealPrices || { breakfast: 1000, lunch: 1500, dinner: 1500 },
      room_purpose: room.roomPurpose || 'accommodation',
      operational_status: room.operationalStatus || 'available',
      status_reason: room.statusReason || null,
      status_effective_date: room.statusEffectiveDate || null,
      status_notes: room.statusNotes || null,
      owner_id: ownerId,
    };

    const roomRes = await safeCloudUpsert('rooms', roomRow, 'id');
    if (!roomRes.success) throw new Error(roomRes.error);

    // Upsert beds
    if (room.beds && room.beds.length > 0) {
      const bedRows = room.beds.map((b) => ({
        id: b.id,
        room_id: room.id,
        property_id: room.propertyId,
        label: b.label,
        bed_type: b.bedType,
        bunk_group: b.bunkGroup || null,
        tier: b.tier || 'single',
        monthly_rent: b.monthlyRent,
        status: b.status,
        current_tenant_id: b.currentTenantId && isValidUUID(b.currentTenantId) ? b.currentTenantId : null,
        owner_id: ownerId,
      }));

      const bedRes = await safeCloudUpsert('beds', bedRows, 'id');
      if (!bedRes.success) throw new Error(bedRes.error);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save room in cloud.' };
  }
}

export async function deleteCloudRoom(roomId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) return { success: false, error: 'Unauthenticated cloud session.' };

  try {
    // Delete beds belonging to this room first
    const { error: bedErr } = await supabase.from('beds').delete().eq('room_id', roomId).eq('owner_id', ownerId);
    if (bedErr) throw bedErr;

    // Delete the room
    const { error: roomErr } = await supabase.from('rooms').delete().eq('id', roomId).eq('owner_id', ownerId);
    if (roomErr) throw roomErr;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete room in cloud.' };
  }
}

export async function upsertCloudBed(bed: Bed, propertyId: string, ownerId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) return { success: false, error: 'Unauthenticated cloud session.' };

  try {
    const row = {
      id: bed.id,
      room_id: bed.roomId,
      property_id: propertyId,
      label: bed.label,
      bed_type: bed.bedType,
      bunk_group: bed.bunkGroup || null,
      tier: bed.tier || 'single',
      monthly_rent: bed.monthlyRent,
      status: bed.status,
      current_tenant_id: bed.currentTenantId && isValidUUID(bed.currentTenantId) ? bed.currentTenantId : null,
      owner_id: ownerId,
    };
    return await safeCloudUpsert('beds', row, 'id');
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update bed in cloud.' };
  }
}

/**
 * Persist tenant checkout in Supabase cloud:
 * 1. Updates tenant status to 'checked_out' with actual checkout date.
 * 2. Releases assigned bed back to 'vacant'.
 * 3. Appends an entry to stay_history.
 * 4. Optionally records refund in security_deposits.
 */
export async function checkoutCloudTenant(
  tenantId: string,
  checkoutDate: string,
  ownerId: string,
  stayItem?: { roomNumber: string; bedLabel: string; notes?: string },
  refundDepositAmount?: number
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    // 1. Get current tenant details
    const { data: tenantRow, error: fetchErr } = await supabase
      .from('tenants')
      .select('id, property_id, room_id, bed_id, name')
      .eq('id', tenantId)
      .eq('owner_id', ownerId)
      .single();

    if (fetchErr || !tenantRow) {
      return { success: false, error: fetchErr?.message || 'Tenant record not found in cloud.' };
    }

    // 2. Free the bed back to vacant
    if (tenantRow.bed_id) {
      const { error: bedErr } = await supabase
        .from('beds')
        .update({ status: 'vacant', current_tenant_id: null })
        .eq('id', tenantRow.bed_id)
        .eq('owner_id', ownerId);

      if (bedErr) throw bedErr;
    }

    // 3. Update tenant status to checked_out
    const tenantUpdatePayload = {
      id: tenantId,
      status: 'checked_out',
      actual_checkout_date: checkoutDate,
      owner_id: ownerId,
    };
    const tenantRes = await safeCloudUpsert('tenants', tenantUpdatePayload, 'id');
    if (!tenantRes.success) throw new Error(tenantRes.error);

    // 4. Record in stay_history table
    if (tenantRow.property_id) {
      const stayRow = {
        id: `stay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenant_id: tenantId,
        property_id: tenantRow.property_id,
        date: checkoutDate,
        action: 'checked_out',
        room_number: stayItem?.roomNumber || 'Unknown',
        bed_label: stayItem?.bedLabel || 'Berth',
        notes: stayItem?.notes || 'Tenant checkout completed',
        owner_id: ownerId,
      };
      await safeCloudUpsert('stay_history', stayRow, 'id').catch(() => {});
    }

    // 5. If refund deposit amount, record in security_deposits
    if (refundDepositAmount && refundDepositAmount > 0 && tenantRow.property_id) {
      const depositRow = {
        id: `sec-dep-${Date.now()}`,
        tenant_id: tenantId,
        property_id: tenantRow.property_id,
        type: 'refunded',
        amount: refundDepositAmount,
        date: checkoutDate,
        payment_method: 'UPI',
        notes: 'Deposit refund upon checkout clearance',
        owner_id: ownerId,
      };
      await safeCloudUpsert('security_deposits', depositRow, 'id').catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to complete cloud tenant checkout.' };
  }
}

/**
 * Persist room/berth transfer in Supabase cloud:
 * 1. Frees old bed to 'vacant'.
 * 2. Assigns target bed to 'occupied' with tenant ID.
 * 3. Updates tenant's room_id, bed_id, and optionally monthly_rent with rent history log.
 * 4. Appends a transfer record to stay_history.
 */
export async function transferCloudTenant(
  tenantId: string,
  targetRoomId: string,
  targetBedId: string,
  moveDate: string,
  oldRoomId: string,
  oldBedId: string,
  ownerId: string,
  options?: { newRent?: number; reason?: string },
  stayDetails?: { roomNumber: string; bedLabel: string; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    // 1. Free old bed
    if (oldBedId) {
      const { error: oldBedErr } = await supabase
        .from('beds')
        .update({ status: 'vacant', current_tenant_id: null })
        .eq('id', oldBedId)
        .eq('owner_id', ownerId);
      if (oldBedErr) throw oldBedErr;
    }

    // 2. Occupy target bed
    const { error: targetBedErr } = await supabase
      .from('beds')
      .update({ status: 'occupied', current_tenant_id: tenantId })
      .eq('id', targetBedId)
      .eq('owner_id', ownerId);
    if (targetBedErr) throw targetBedErr;

    // 3. Fetch tenant to update rentHistory
    const { data: tenantRow, error: tErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('owner_id', ownerId)
      .single();
    if (tErr || !tenantRow) throw tErr || new Error('Tenant not found.');

    const rentHistory = Array.isArray(tenantRow.rent_history) ? [...tenantRow.rent_history] : [];
    let updatedMonthlyRent = tenantRow.monthly_rent;
    let updatedTotal = tenantRow.total_monthly_amount;

    if (options?.newRent !== undefined && options.newRent >= 0 && options.newRent !== tenantRow.monthly_rent) {
      const historyEntry = {
        id: `rh-move-${Date.now()}`,
        effectiveDate: moveDate,
        previousRent: tenantRow.monthly_rent,
        newRent: options.newRent,
        previousFoodCharge: tenantRow.agreed_food_charge || 0,
        newFoodCharge: tenantRow.agreed_food_charge || 0,
        reason: options.reason || `Transfer to ${stayDetails?.roomNumber || 'room'} (${stayDetails?.bedLabel || 'berth'})`,
        changedAt: new Date().toISOString(),
      };
      rentHistory.push(historyEntry);
      updatedMonthlyRent = options.newRent;
      updatedTotal = options.newRent + (tenantRow.agreed_food_charge || 0);
    }

    const tenantUpdatePayload: any = {
      id: tenantId,
      room_id: targetRoomId,
      bed_id: targetBedId,
      monthly_rent: updatedMonthlyRent,
      total_monthly_amount: updatedTotal,
      rent_history: rentHistory,
      owner_id: ownerId,
    };

    const tUpdateRes = await safeCloudUpsert('tenants', tenantUpdatePayload, 'id');
    if (!tUpdateRes.success) throw new Error(tUpdateRes.error);

    // 4. Record in stay_history table
    if (tenantRow.property_id) {
      const stayRow = {
        id: `stay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenant_id: tenantId,
        property_id: tenantRow.property_id,
        date: moveDate,
        action: 'moved',
        room_number: stayDetails?.roomNumber || 'Room',
        bed_label: stayDetails?.bedLabel || 'Berth',
        notes: stayDetails?.notes || `Transferred to Room ${stayDetails?.roomNumber || ''}, ${stayDetails?.bedLabel || ''}`,
        owner_id: ownerId,
      };
      await safeCloudUpsert('stay_history', stayRow, 'id').catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to persist room transfer in Supabase.' };
  }
}

/**
 * Persist tenant notice in Supabase cloud:
 * 1. Updates tenant status to 'notice' with notice and expected checkout dates.
 * 2. Updates assigned bed status to 'notice'.
 * 3. Appends an event to stay_history.
 */
export async function setNoticeCloudTenant(
  tenantId: string,
  noticeDate: string,
  expectedMoveOutDate: string,
  ownerId: string,
  notes?: string,
  stayDetails?: { roomNumber: string; bedLabel: string }
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    const { data: tenantRow, error: tErr } = await supabase
      .from('tenants')
      .select('id, property_id, room_id, bed_id')
      .eq('id', tenantId)
      .eq('owner_id', ownerId)
      .single();
    if (tErr || !tenantRow) throw tErr || new Error('Tenant not found.');

    // 1. Update tenant status to notice
    const tenantPayload: any = {
      id: tenantId,
      status: 'notice',
      notice_date: noticeDate,
      expected_move_out_date: expectedMoveOutDate,
      owner_id: ownerId,
    };
    const tRes = await safeCloudUpsert('tenants', tenantPayload, 'id');
    if (!tRes.success) throw new Error(tRes.error);

    // 2. Update bed status to notice
    if (tenantRow.bed_id) {
      const { error: bedErr } = await supabase
        .from('beds')
        .update({ status: 'notice' })
        .eq('id', tenantRow.bed_id)
        .eq('owner_id', ownerId);
      if (bedErr) throw bedErr;
    }

    // 3. Record in stay_history table
    if (tenantRow.property_id) {
      const stayRow = {
        id: `stay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tenant_id: tenantId,
        property_id: tenantRow.property_id,
        date: noticeDate,
        action: 'notice_given',
        room_number: stayDetails?.roomNumber || 'Room',
        bed_label: stayDetails?.bedLabel || 'Berth',
        notes: notes || `Notice submitted; expected checkout: ${expectedMoveOutDate}`,
        owner_id: ownerId,
      };
      await safeCloudUpsert('stay_history', stayRow, 'id').catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to persist tenant notice in Supabase.' };
  }
}

/**
 * Persist generated monthly rent charges to Supabase
 */
export async function upsertCloudRentCharges(
  charges: RentCharge[],
  propertyId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    const rows = charges.map((c) => ({
      id: c.id,
      tenant_id: c.tenantId,
      property_id: propertyId,
      billing_month: c.billingMonth,
      due_date: c.dueDate,
      amount: c.amount,
      is_prorated: Boolean(c.isProrated),
      owner_id: ownerId,
    }));

    const res = await safeCloudUpsert('rent_charges', rows, 'id');
    if (!res.success) throw new Error(res.error);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save rent charges to Supabase.' };
  }
}

/**
 * Persist maintenance ticket creation or updates to Supabase
 */
export async function upsertCloudMaintenanceTicket(
  ticket: MaintenanceTicket,
  propertyId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    const row = {
      id: ticket.id,
      property_id: propertyId,
      room_id: ticket.roomId || null,
      tenant_id: null,
      title: ticket.title,
      description: ticket.description || null,
      priority: ticket.priority === 'urgent' ? 'emergency' : ticket.priority || 'medium',
      status: ticket.status || 'open',
      category: ['Plumbing', 'Electrical', 'Appliances', 'Carpentry', 'Cleaning', 'Pest Control'].includes(ticket.category)
        ? ticket.category
        : 'Other',
      reported_date: ticket.createdDate ? ticket.createdDate.split('T')[0] : new Date().toISOString().split('T')[0],
      resolved_date: ticket.resolvedDate || null,
      linked_expense_id: ticket.linkedExpenseId || null,
      owner_id: ownerId,
    };

    const res = await safeCloudUpsert('maintenance_tickets', row, 'id');
    if (!res.success) throw new Error(res.error);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save maintenance ticket in Supabase.' };
  }
}

/**
 * Persist a new or edited building / property to Supabase
 */
export async function upsertCloudProperty(
  property: Property,
  ownerId: string
): Promise<{ success: boolean; property?: Property; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    const row = mapPropertyEntityToRow(property, ownerId);
    if (!row.id) row.id = property.id;

    const res = await safeCloudUpsert('properties', row, 'id');
    if (!res.success) throw new Error(res.error);

    return { success: true, property };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save property in Supabase.' };
  }
}

/**
 * Persist floors to Supabase
 */
export async function upsertCloudFloors(
  floors: Floor[],
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    const rows = floors.map((f) => ({
      id: f.id,
      property_id: f.propertyId,
      floor_number: f.number,
      label: f.name,
      total_rooms: f.totalRooms || 0,
      owner_id: ownerId,
    }));

    const res = await safeCloudUpsert('floors', rows, 'id');
    if (!res.success) throw new Error(res.error);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save floors in Supabase.' };
  }
}

/**
 * Archive or unarchive a property in Supabase
 */
export async function archiveCloudProperty(
  propertyId: string,
  isArchived: boolean,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Unauthenticated cloud session.' };
  }

  try {
    const res = await safeCloudUpsert('properties', { id: propertyId, is_archived: isArchived, owner_id: ownerId }, 'id');
    if (!res.success) throw new Error(res.error);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update property archive state in Supabase.' };
  }
}

// ==============================================================================
// 5. PRIVATE CLOUD DOCUMENT STORAGE
// ==============================================================================

const BUCKET_NAME = 'tenant-documents';

export async function uploadTenantDocumentCloud(
  docOrOwnerId: TenantDocument | string,
  fileOrTenantId: Blob | File | string,
  ownerIdOrPropertyId?: string,
  maybeFile?: Blob | File,
  maybeMeta?: {
    documentType: string;
    title: string;
    maskedDocumentNumber?: string;
    fileName: string;
    mimeType: string;
  }
): Promise<{ success: boolean; document?: TenantDocument; error?: string }> {
  let ownerId: string = '';
  let tenantId: string = '';
  let propertyId: string = '';
  let file: Blob | File;
  let docMeta: {
    documentType: string;
    title: string;
    maskedDocumentNumber?: string;
    fileName: string;
    mimeType: string;
  };
  let docId: string;
  let storagePath: string;

  if (typeof docOrOwnerId === 'object') {
    // Style A: (doc: TenantDocument, file: Blob | File, ownerId: string)
    const doc = docOrOwnerId;
    file = fileOrTenantId as Blob | File;
    ownerId = (ownerIdOrPropertyId as string) || doc.ownerId || '';
    tenantId = doc.tenantId;
    propertyId = '';
    docId = doc.id;
    const rawPath = doc.storagePath || `${ownerId}/${tenantId}/${docId}_${doc.fileName}`;
    storagePath = rawPath.replace(/^tenant-documents\//, '');
    docMeta = {
      documentType: doc.documentType,
      title: doc.title,
      maskedDocumentNumber: doc.maskedDocumentNumber,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    };
  } else {
    // Style B: (ownerId, tenantId, propertyId, file, docMeta)
    ownerId = docOrOwnerId;
    tenantId = fileOrTenantId as string;
    propertyId = ownerIdOrPropertyId || '';
    file = maybeFile as Blob | File;
    docMeta = maybeMeta!;
    const cleanFileName = docMeta.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    storagePath = `${ownerId}/${tenantId}/${docId}_${cleanFileName}`;
  }

  if (!supabase || !isValidUUID(ownerId)) {
    return { success: false, error: 'Supabase client must be authenticated to upload documents.' };
  }

  try {
    // 1. Upload binary file into private Supabase bucket
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    // 2. Insert metadata record into tenant_documents table
    const docRow = {
      id: docId,
      tenant_id: tenantId,
      property_id: propertyId || null,
      document_type: docMeta.documentType,
      title: docMeta.title,
      masked_document_number: docMeta.maskedDocumentNumber || null,
      file_name: docMeta.fileName,
      file_size: file.size,
      mime_type: docMeta.mimeType,
      storage_path: storagePath,
      consent_obtained: true,
      verification_status: 'pending',
      owner_id: ownerId,
    };

    const { data: inserted, error: dbErr } = await supabase
      .from('tenant_documents')
      .insert(docRow)
      .select()
      .single();

    if (dbErr) {
      // Rollback uploaded file if DB insert failed
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      throw dbErr;
    }

    return {
      success: true,
      document: mapDocumentRowToEntity(inserted || docRow),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to upload document to cloud storage.' };
  }
}

export async function getSignedDocumentUrlCloud(
  storagePath: string,
  expiresInSeconds: number = 300
): Promise<{ success: boolean; signedUrl?: string; url?: string; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase client is not configured.' };

  const cleanPath = storagePath.replace(/^tenant-documents\//, '');
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(cleanPath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return { success: false, error: error?.message || 'Failed to generate signed document URL.' };
    }

    return { success: true, signedUrl: data.signedUrl, url: data.signedUrl };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error generating secure document URL.' };
  }
}

export async function deleteTenantDocumentCloud(
  documentId: string,
  storagePathOrOwnerId: string,
  ownerIdOrStoragePath?: string
): Promise<{ success: boolean; error?: string }> {
  let ownerId = '';
  let storagePath = '';

  if (isValidUUID(storagePathOrOwnerId)) {
    ownerId = storagePathOrOwnerId;
    storagePath = ownerIdOrStoragePath || '';
  } else if (ownerIdOrStoragePath && isValidUUID(ownerIdOrStoragePath)) {
    ownerId = ownerIdOrStoragePath;
    storagePath = storagePathOrOwnerId || '';
  } else {
    ownerId = storagePathOrOwnerId;
    storagePath = ownerIdOrStoragePath || '';
  }

  if (!supabase || !isValidUUID(ownerId)) return { success: false, error: 'Unauthenticated cloud session.' };

  try {
    // 1. Delete file from storage
    if (storagePath) {
      const cleanPath = storagePath.replace(/^tenant-documents\//, '');
      await supabase.storage.from(BUCKET_NAME).remove([cleanPath]);
    }

    // 2. Delete DB record
    const { error } = await supabase
      .from('tenant_documents')
      .delete()
      .eq('id', documentId)
      .eq('owner_id', ownerId);

    if (error) throw error;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete document from cloud.' };
  }
}
