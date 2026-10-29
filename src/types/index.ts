// Type definitions for ROOVIO PG Manager

export type BedStatus = 'vacant' | 'occupied' | 'notice' | 'maintenance';

export type RentPaymentStatus = 'paid' | 'due_soon' | 'overdue' | 'partially_paid';

export type SharingType = 'Single' | 'Double' | 'Triple' | 'Four' | string;

export type PaymentMethod = 'UPI' | 'Cash' | 'Bank Transfer';

export type BedType = 'single' | 'bunk';

export type BerthTier = 'upper' | 'lower' | 'single';

export type ExpenseCategory =
  | 'Electricity'
  | 'Water'
  | 'Mess / groceries'
  | 'Staff salary'
  | 'Internet'
  | 'Maintenance'
  | 'Property rent / EMI'
  | 'Miscellaneous';

export type MaintenanceCategory = 'plumbing' | 'electrical' | 'wi-fi' | 'cleaning' | 'appliance';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

export type MaintenanceStatus = 'pending' | 'in_progress' | 'resolved';

export interface Bed {
  id: string; // e.g. "Room 101 - Bed 1", "Room 102 - Bunk 1 - Upper", "Room 102 - Bunk 1 - Lower"
  roomId: string;
  label: string; // e.g. "Bunk 1 - Upper", "Bunk 1 - Lower", "Single Bed 1"
  bedType: BedType; // 'single' | 'bunk'
  bunkGroup?: string; // e.g. "Bunk 1", "Bunk 2"
  tier?: BerthTier; // 'upper' | 'lower' | 'single'
  monthlyRent: number; // Configured monthly rent for this specific berth
  status: BedStatus;
  currentTenantId?: string;
  maintenanceReason?: string;
}

export type RoomStatus = 'available' | 'partially_occupied' | 'full' | 'maintenance' | 'inactive' | 'closed' | 'storage' | 'retired';

export type RoomPurpose = 'accommodation' | 'storage' | 'maintenance' | 'staff' | 'other';
export type OperationalStatus = 'available' | 'closed' | 'maintenance' | 'storage' | 'retired';

export interface RoomStatusHistory {
  id: string;
  roomId: string;
  previousStatus?: OperationalStatus;
  newStatus: OperationalStatus;
  previousPurpose?: RoomPurpose;
  newPurpose: RoomPurpose;
  effectiveDate: string;
  reason: string;
  notes?: string;
  changedAt: string;
}

export type BathroomType = 'attached' | 'shared' | 'none';

export type FoodPlanType = 'no_food' | 'food_included' | 'food_separate' | 'custom';

export type PricingBasis = 'per_person' | 'per_room';

export interface MealOptions {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
}

export interface MealPrices {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export interface RentPriceHistory {
  id: string;
  effectiveDate: string; // YYYY-MM-DD
  previousRent: number;
  newRent: number;
  previousFoodCharge?: number;
  newFoodCharge?: number;
  reason?: string;
  changedAt: string;
}

export interface RoomAmenities {
  cupboard?: boolean;
  table?: boolean;
  studyTable?: boolean;
  chair?: boolean;
  fan?: boolean;
  wifi?: boolean;
  geyser?: boolean;
  tv?: boolean;
  balcony?: boolean;
  [key: string]: any;
}

export interface Room {
  id: string;
  propertyId?: string; // Building ID
  floorId: string;
  roomNumber: string; // e.g. "101", "A-01"
  sharingType: SharingType;
  capacity?: number;
  pricingBasis?: PricingBasis; // 'per_person' | 'per_room'
  standardRent?: number; // Standard monthly rent for room / bed
  hasAc: boolean;
  hasAttachedBathroom: boolean;
  hasBalcony: boolean;
  bathroomType?: BathroomType;
  roomRent?: number; // Optional monthly whole-room rent
  status?: RoomStatus;
  roomPurpose?: RoomPurpose; // 'accommodation' | 'storage' | 'maintenance' | 'staff' | 'other' (default: 'accommodation')
  operationalStatus?: OperationalStatus; // 'available' | 'closed' | 'maintenance' | 'storage' | 'retired' (default: 'available')
  statusReason?: string; // Reason for closure, storage conversion, retirement
  statusEffectiveDate?: string; // Date when operational status took effect
  statusNotes?: string;
  statusHistory?: RoomStatusHistory[];
  notes?: string;
  amenities?: RoomAmenities;
  amenitiesList?: RoomAmenities;
  foodPlan?: FoodPlanType;
  foodPlanType?: FoodPlanType;
  mealsProvided?: MealOptions;
  mealPrices?: MealPrices; // Configurable per-meal monthly charges
  foodMonthlyCharge?: number;
  beds: Bed[]; // Array of individual sleeping berths in this room
}

export interface Floor {
  id: string;
  propertyId: string;
  number: number;
  name: string;
  totalRooms?: number;
}

export interface Property {
  id: string;
  ownerId?: string;
  name: string;
  tagline?: string;
  description?: string;
  address: string;
  city: string;
  state?: string;
  pincode: string;
  phone: string;
  upiId: string;
  totalFloors?: number;
  isArchived?: boolean;
  createdAt?: string;
}

export interface InventoryItem {
  id: string;
  name: string; // 'Mattress' | 'Pillow' | 'Bed key' | 'Cupboard key' | 'Study table' | 'Fan' | 'Geyser'
  condition: 'New' | 'Good' | 'Fair' | 'Damaged' | 'Missing';
  notes?: string;
  checkInDate: string;
  checkOutDate?: string;
  checkOutCondition?: 'Good' | 'Fair' | 'Damaged' | 'Missing';
}

export interface StayHistoryItem {
  id: string;
  date: string;
  action: 'joined' | 'moved' | 'notice_given' | 'checked_out';
  roomNumber: string;
  bedLabel: string;
  notes?: string;
}

export interface WhatsAppLog {
  id: string;
  timestamp: string;
  action: 'prepared' | 'opened';
  phone: string;
  message: string;
}

export interface PermanentAddress {
  house: string;
  locality: string;
  district: string;
  state: string;
  pincode: string;
}

export type DocumentType =
  | 'aadhaar'
  | 'other_id'
  | 'address_proof'
  | 'employment_id'
  | 'other';

export type DocumentVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface TenantDocument {
  id: string;
  tenantId: string;
  documentType: DocumentType;
  title: string;
  maskedDocumentNumber?: string; // Only masked e.g. "•••• •••• 1234" (never full 12 digits)
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  uploadedAt: string;
  verificationStatus: DocumentVerificationStatus;
  verificationNotes?: string;
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  storagePath: string; // Supabase private bucket path
  consentObtained: boolean;
  ownerId?: string;
}

export interface Tenant {
  id: string;
  ownerId?: string; // Owner who owns this tenant record
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  isPhoneMasked: boolean;
  emergencyContact?: string; // Legacy string e.g. "+91 98451 00000"
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  permanentAddress?: PermanentAddress;
  employerName?: string;
  jobTitle?: string;
  workplaceAddress?: string;
  employmentPhone?: string;
  joiningDate: string; // YYYY-MM-DD
  moveInDate?: string; // YYYY-MM-DD
  propertyId: string;
  roomId: string;
  bedId: string; // ID of the allocated berth

  // Owner-Controlled Pricing & Negotiations
  pricingBasis?: PricingBasis; // 'per_person' | 'per_room'
  standardRent?: number; // Standard room/berth rent baseline
  monthlyRent: number; // Final agreed monthly rent
  foodPlanType?: FoodPlanType; // Selected food plan
  selectedMeals?: MealOptions; // Selected meals { breakfast, lunch, dinner }
  standardFoodCharge?: number; // Standard calculated food charge
  agreedFoodCharge?: number; // Final agreed food charge
  discountType?: 'amount' | 'percentage';
  discountValue?: number;
  discountAmount?: number;
  discountReason?: string;
  pricingOverrideReason?: string;
  totalMonthlyAmount?: number; // Agreed rent + agreed food charge
  rentHistory?: RentPriceHistory[]; // Price change audit trail

  monthlyDueDay: number; // 1 - 31
  depositRequired: number;
  depositReceived: number;
  status: 'active' | 'notice' | 'checked_out';
  noticeDate?: string;
  expectedMoveOutDate?: string;
  actualCheckoutDate?: string;
  notes?: string;
  assignedInventory: InventoryItem[];
  stayHistory: StayHistoryItem[];
  whatsappLogs: WhatsAppLog[];
  documents?: TenantDocument[];
}

export interface RentCharge {
  id: string;
  tenantId: string;
  billingMonth: string; // YYYY-MM e.g. "2026-10"
  dueDate: string; // YYYY-MM-DD
  amount: number;
  isProrated: boolean;
  prorationNotes?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  receiptNumber: string;
  tenantId: string;
  chargeId: string;
  billingMonth: string; // YYYY-MM
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  transactionRef?: string;
  notes?: string;
  createdAt: string;
}

export interface SecurityDepositRecord {
  id: string;
  tenantId: string;
  type: 'collected' | 'refunded' | 'deducted';
  amount: number;
  date: string;
  method: PaymentMethod;
  notes?: string;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMode: 'UPI' | 'Cash' | 'Bank Transfer' | 'Card' | 'Cheque';
  notes?: string;
  linkedMaintenanceTicketId?: string;
  createdAt: string;
}

export interface MaintenanceTicket {
  id: string;
  ticketNumber: string; // e.g. "TKT-101"
  title: string;
  description: string;
  floorId: string;
  roomId?: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  createdDate: string;
  estimatedCost: number;
  resolutionNotes?: string;
  resolvedDate?: string;
  linkedExpenseId?: string;
}

export interface BuildingAmenity {
  id: string;
  name: string;
  status: 'Operational' | 'Under Maintenance' | 'Scheduled Service';
  lastServiceDate: string;
  nextServiceDate?: string;
  notes?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  propertyName?: string;
  createdAt?: string;
}

export interface AppState {
  version: number;
  ownerId?: string; // Authenticated PG Owner ID
  demoDate: string; // "2026-10-29"
  selectedMonth: string; // "2026-10"
  property: Property; // Active building for seamless backward compatibility
  properties?: Property[]; // All buildings belonging to this owner
  activePropertyId?: string; // Currently active building ID
  floors: Floor[];
  rooms: Room[];
  tenants: Tenant[];
  rentCharges: RentCharge[];
  payments: PaymentRecord[];
  securityDeposits: SecurityDepositRecord[];
  expenses: Expense[];
  maintenanceTickets: MaintenanceTicket[];
  amenities: BuildingAmenity[];
}
