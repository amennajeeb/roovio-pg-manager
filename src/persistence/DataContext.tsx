import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  AppState,
  Tenant,
  Room,
  Bed,
  BedType,
  BerthTier,
  RentCharge,
  PaymentRecord,
  Expense,
  MaintenanceTicket,
  BuildingAmenity,
  BedStatus,
  PaymentMethod,
  Property,
  Floor,
  SharingType,
  RoomStatus,
  RoomPurpose,
  OperationalStatus,
  BathroomType,
  FoodPlanType,
  PricingBasis,
  MealOptions,
  MealPrices,
  RentPriceHistory,
  RoomAmenities,
  InventoryItem,
  PermanentAddress,
  TenantDocument,
  DocumentType,
  DocumentVerificationStatus,
} from '../types';
import { loadAppState, saveAppState, resetAppState, exportAppStateJSON, getCachedAppState } from './storage';
import { createStarterStateForOwner } from '../fixtures/seedData';
import { calculateDueDate, getDaysInMonth } from '../utils/date';
import { maskAadhaarNumber } from '../utils/validation';
import { documentStore } from '../services/documentStore';
import {
  isValidUUID,
  loadCloudDataForOwner,
  initializeCloudOwner,
  upsertCloudTenant,
  upsertCloudPayment,
  upsertCloudExpense,
  upsertCloudRoom,
  upsertCloudBed,
  deleteCloudRoom,
  uploadTenantDocumentCloud,
  getSignedDocumentUrlCloud,
  deleteTenantDocumentCloud,
  checkoutCloudTenant,
  transferCloudTenant,
  setNoticeCloudTenant,
  upsertCloudRentCharges,
  upsertCloudMaintenanceTicket,
  upsertCloudProperty,
  upsertCloudFloors,
  archiveCloudProperty,
} from '../services/cloudDataService';
import { useAuth } from './AuthContext';

interface OnboardTenantInput {
  name: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  isPhoneMasked?: boolean;
  emergencyContact?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  permanentAddress?: PermanentAddress;
  employerName?: string;
  jobTitle?: string;
  workplaceAddress?: string;
  employmentPhone?: string;
  joiningDate: string;
  moveInDate?: string;
  roomId: string;
  bedId: string;
  monthlyRent: number;
  // Owner-controlled pricing & negotiations
  pricingBasis?: PricingBasis;
  standardRent?: number;
  foodPlanType?: FoodPlanType;
  selectedMeals?: MealOptions;
  standardFoodCharge?: number;
  agreedFoodCharge?: number;
  discountType?: 'amount' | 'percentage';
  discountValue?: number;
  discountAmount?: number;
  discountReason?: string;
  pricingOverrideReason?: string;
  totalMonthlyAmount?: number;
  monthlyDueDay: number;
  depositRequired: number;
  depositReceived: number;
  notes?: string;
  billingOption: 'full_month' | 'prorated';
  customChargeAmount?: number;
  documents?: TenantDocument[];
}

export interface BuildingMetrics {
  totalFloors: number;
  totalRooms: number;
  accommodationRooms: number;
  storageRooms: number;
  closedRooms: number;
  retiredRooms: number;
  totalBeds: number;
  totalBerths: number;
  occupiedBeds: number;
  occupiedBerths: number;
  availableBeds: number;
  vacantBerths: number;
  maintenanceBeds: number;
  occupancyRate: number;
  roomsInMaintenance: number;
  monthlyAccommodationRentPotential: number;
  potentialAccommodationRent: number;
  monthlyFoodChargesPotential: number;
  potentialFoodRent: number;
  totalMonthlyPotential: number;
}

export interface BulkGenerateInput {
  propertyId: string;
  floorId: string;
  startNumber: number;
  count: number;
  prefix?: string;
  sharingType: SharingType;
  pricingBasis?: PricingBasis;
  bedType: BedType;
  upperRent?: number;
  lowerRent?: number;
  singleRent?: number;
  hasAc: boolean;
  hasAttachedBathroom: boolean;
  bathroomType: BathroomType;
  foodPlan?: FoodPlanType;
  mealsProvided?: MealOptions;
  mealPrices?: MealPrices;
  foodMonthlyCharge?: number;
  amenitiesList?: RoomAmenities;
  notes?: string;
}

interface NewRoomBedInput {
  label: string;
  bedType: BedType;
  bunkGroup?: string;
  tier?: BerthTier;
  monthlyRent: number;
}

interface DataContextType {
  state: AppState;
  properties: Property[];
  activePropertyId: string;
  setSelectedMonth: (month: string) => void;
  updateProperty: (prop: Partial<Property>) => void;

  // Multi-Building Management
  setActiveBuilding: (propertyId: string) => void;
  addBuilding: (data: {
    name: string;
    tagline?: string;
    description?: string;
    address: string;
    city: string;
    pincode: string;
    phone: string;
    upiId: string;
    totalFloors?: number;
  }) => { success: boolean; property?: Property; error?: string };
  updateBuilding: (propertyId: string, updates: Partial<Property>) => { success: boolean; error?: string };
  archiveBuilding: (propertyId: string, isArchived?: boolean) => { success: boolean; error?: string };

  // Floors
  addFloor: (floor: { propertyId: string; number: number; name: string }) => { success: boolean; floor?: Floor; error?: string };
  updateFloor: (floorId: string, updates: Partial<Floor>) => { success: boolean; error?: string };
  deleteFloor: (floorId: string) => { success: boolean; error?: string };

  // Tenants & Berths
  allocateTenant: (input: OnboardTenantInput) => { success: boolean; error?: string; tenant?: Tenant };
  updateTenant: (tenantId: string, updates: Partial<Tenant>) => void;
  updateTenantPricing: (
    tenantId: string,
    newMonthlyRent: number,
    effectiveDate: string,
    options?: {
      agreedFoodCharge?: number;
      reason?: string;
      selectedMeals?: MealOptions;
      foodPlanType?: FoodPlanType;
      standardFoodCharge?: number;
    }
  ) => { success: boolean; error?: string };
  giveNotice: (tenantId: string, noticeDate: string, expectedMoveOutDate: string, notes?: string) => void;
  checkoutTenant: (
    tenantId: string,
    checkoutDate: string,
    inventoryUpdates: Record<string, 'Good' | 'Fair' | 'Damaged' | 'Missing'>,
    refundDepositAmount?: number,
    notes?: string
  ) => void;
  moveTenantBed: (
    tenantId: string,
    targetRoomId: string,
    targetBedId: string,
    moveDate: string,
    notes?: string,
    options?: { newRent?: number; reason?: string }
  ) => { success: boolean; error?: string };
  
  // Identity & Document Management
  addTenantDocument: (
    tenantId: string,
    docData: {
      documentType: DocumentType;
      title: string;
      maskedDocumentNumber?: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      consentObtained: boolean;
      verificationNotes?: string;
    },
    file?: Blob | File
  ) => { success: boolean; document?: TenantDocument; error?: string };
  updateDocumentVerification: (
    tenantId: string,
    documentId: string,
    status: DocumentVerificationStatus,
    notes?: string,
    rejectionReason?: string
  ) => { success: boolean; error?: string };
  replaceTenantDocument: (
    tenantId: string,
    documentId: string,
    newFile: Blob | File,
    newMetadata?: Partial<TenantDocument>
  ) => { success: boolean; error?: string };
  deleteTenantDocument: (
    tenantId: string,
    documentId: string
  ) => { success: boolean; error?: string };
  getSecureDocumentAccess: (
    tenantId: string,
    documentId: string
  ) => { url?: string; fileName?: string; mimeType?: string; error?: string };
  getSecureDocumentAccessAsync: (
    tenantId: string,
    documentId: string
  ) => Promise<{ url?: string; fileName?: string; mimeType?: string; error?: string }>;
  
  // Rent & Payments
  recordPayment: (payment: {
    tenantId: string;
    chargeId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    notes?: string;
  }) => { success: boolean; error?: string; payment?: PaymentRecord };
  generateMonthlyCharges: (month: string) => { generatedCount: number; alreadyExistedCount: number };

  // Building, Rooms & Bunks/Berths
  addRoom: (room: {
    propertyId?: string;
    floorId: string;
    roomNumber: string;
    sharingType?: string;
    capacity?: number;
    hasAc: boolean;
    hasAttachedBathroom: boolean;
    hasBalcony: boolean;
    bathroomType?: BathroomType;
    roomRent?: number;
    status?: RoomStatus;
    roomPurpose?: RoomPurpose;
    operationalStatus?: OperationalStatus;
    statusReason?: string;
    statusEffectiveDate?: string;
    statusNotes?: string;
    notes?: string;
    amenitiesList?: RoomAmenities;
    foodPlan?: FoodPlanType;
    mealsProvided?: MealOptions;
    foodMonthlyCharge?: number;
    pricingBasis?: PricingBasis;
    mealPrices?: MealPrices;
    beds: NewRoomBedInput[];
  }) => { success: boolean; error?: string };
  bulkGenerateRooms: (config: BulkGenerateInput) => { success: boolean; createdCount: number; error?: string };
  updateRoom: (roomId: string, updates: Partial<Room>) => { success: boolean; error?: string };
  deleteRoom: (roomId: string, force?: boolean) => { success: boolean; error?: string; hasHistory?: boolean };
  retireRoom: (roomId: string, reason?: string, effectiveDate?: string, notes?: string) => { success: boolean; error?: string };
  closeRoom: (roomId: string, reason?: string, effectiveDate?: string, notes?: string) => { success: boolean; error?: string };
  convertToStorage: (roomId: string, reason?: string, effectiveDate?: string, notes?: string) => { success: boolean; error?: string };
  reopenRoom: (roomId: string) => { success: boolean; error?: string };
  getBuildingMetrics: (propertyId?: string) => BuildingMetrics;
  
  addBunkBedToRoom: (roomId: string, config: { bunkGroup: string; upperRent: number; lowerRent: number }) => { success: boolean; error?: string };
  removeBunkBedFromRoom: (roomId: string, bunkGroup: string) => { success: boolean; error?: string };
  addSingleBedToRoom: (roomId: string, config: { label: string; monthlyRent: number }) => { success: boolean; error?: string };
  deleteBed: (roomId: string, bedId: string) => { success: boolean; error?: string };
  updateBerthRent: (roomId: string, bedId: string, monthlyRent: number) => { success: boolean; error?: string };
  setBedStatus: (bedId: string, status: BedStatus, maintenanceReason?: string) => { success: boolean; error?: string };

  // Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Facilities & Maintenance
  addMaintenanceTicket: (ticket: Omit<MaintenanceTicket, 'id' | 'ticketNumber'>) => void;
  updateMaintenanceTicket: (id: string, updates: Partial<MaintenanceTicket>) => void;
  convertTicketToExpense: (ticketId: string, amount: number, paymentMode: Expense['paymentMode'], notes?: string) => { success: boolean; error?: string };
  updateAmenity: (id: string, updates: Partial<BuildingAmenity>) => void;

  // WhatsApp
  logWhatsAppActivity: (tenantId: string, action: 'prepared' | 'opened', message: string, phone: string) => void;

  // Backups & Reset
  resetData: () => void;
  exportData: () => void;
  importData: (imported: AppState) => { success: boolean; error?: string };

  // Cloud persistence status & controls
  storageMode: 'cloud' | 'demo';
  cloudSyncStatus: 'synced' | 'syncing' | 'offline_cache' | 'error' | 'demo';
  cloudError: string | null;
  clearCloudError: () => void;
  syncWithCloud: () => Promise<{ success: boolean; error?: string }>;

  // Computations (strictly based on individual sleeping berths)
  metrics: {
    totalBeds: number;
    occupiedBeds: number;
    vacantBeds: number;
    noticeBeds: number;
    maintenanceBeds: number;
    occupancyRate: number;
    
    expectedRent: number;
    collectedRent: number;
    remainingBalance: number;
    
    monthlyExpenses: number;
    netCashFlow: number;

    overdueCount: number;
    overdueAmount: number;
    dueSoonCount: number;
    dueSoonAmount: number;
    paidCount: number;
    
    noticeCount: number;
    openTicketsCount: number;
  };
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const currentOwnerId = user?.id || 'owner-gv-default';

  // Cloud vs Demo mode determination
  const isCloudOwner = user?.id ? isValidUUID(user.id) : false;
  const storageMode: 'cloud' | 'demo' = isCloudOwner ? 'cloud' : 'demo';
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'syncing' | 'offline_cache' | 'error' | 'demo'>(
    isCloudOwner ? 'syncing' : 'demo'
  );
  const [cloudError, setCloudError] = useState<string | null>(null);

  const clearCloudError = () => setCloudError(null);

  const [state, setState] = useState<AppState>(() => {
    return loadAppState(currentOwnerId);
  });

  // When active authenticated owner changes, safely fetch from cloud or load offline cache
  useEffect(() => {
    let isMounted = true;

    async function loadOwnerData() {
      if (!user?.id) {
        setState(loadAppState('owner-gv-default'));
        setCloudSyncStatus('demo');
        setCloudError(null);
        return;
      }

      if (!isValidUUID(user.id)) {
        // Local demo mode
        const localData = loadAppState(user.id);
        if (user.propertyName && localData.property.name === 'Sunrise Executive PG') {
          localData.property.name = user.propertyName;
        }
        setState(localData);
        setCloudSyncStatus('demo');
        setCloudError(null);
        return;
      }

      // Authenticated Cloud Owner Mode
      setCloudSyncStatus('syncing');
      setCloudError(null);

      try {
        const cloudRes = await loadCloudDataForOwner(user.id);
        if (!isMounted) return;

        if (cloudRes.success && cloudRes.hasCloudData && cloudRes.data) {
          setState(cloudRes.data);
          saveAppState(cloudRes.data, user.id);
          setCloudSyncStatus('synced');
        } else if (cloudRes.success && !cloudRes.hasCloudData) {
          // Check if local cache exists for this owner
          const existingCached = getCachedAppState(user.id);
          if (existingCached && existingCached.rooms.length > 0) {
            setState(existingCached);
            setCloudSyncStatus('offline_cache');
          } else {
            // New cloud owner: provision in Supabase
            const initRes = await initializeCloudOwner(user.id, user.propertyName || 'My PG');
            if (initRes.success && initRes.property) {
              const starterState = createStarterStateForOwner(user.id);
              starterState.property = initRes.property;
              starterState.properties = [initRes.property];
              starterState.activePropertyId = initRes.property.id;
              setState(starterState);
              saveAppState(starterState, user.id);
              setCloudSyncStatus('synced');
            } else {
              setCloudSyncStatus('offline_cache');
              setCloudError(initRes.error || 'Failed to initialize cloud property. Displaying local setup.');
            }
          }
        } else {
          // Cloud fetch failed - Fall back to local offline cache without overwriting
          const cached = getCachedAppState(user.id);
          if (cached) {
            setState(cached);
            setCloudSyncStatus('offline_cache');
            setCloudError(cloudRes.error || 'Offline Cache • Supabase connection pending.');
          } else {
            setCloudSyncStatus('error');
            setCloudError(cloudRes.error || 'Failed to load records from Supabase cloud.');
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        const cached = getCachedAppState(user.id);
        if (cached) {
          setState(cached);
          setCloudSyncStatus('offline_cache');
          setCloudError(err?.message || 'Offline Cache active.');
        } else {
          setCloudSyncStatus('error');
          setCloudError(err?.message || 'Database error: unable to load cloud records.');
        }
      }
    }

    loadOwnerData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.propertyName]);

  // Persist state offline strictly partitioned by owner
  useEffect(() => {
    if (state.ownerId === currentOwnerId) {
      saveAppState(state, currentOwnerId);
    }
  }, [state, currentOwnerId]);

  const syncWithCloud = async () => {
    if (!isCloudOwner || !user?.id) {
      return { success: false, error: 'Cannot sync in demo mode.' };
    }
    setCloudSyncStatus('syncing');
    setCloudError(null);
    try {
      const res = await loadCloudDataForOwner(user.id);
      if (res.success && res.hasCloudData && res.data) {
        setState(res.data);
        saveAppState(res.data, user.id);
        setCloudSyncStatus('synced');
        return { success: true };
      } else {
        setCloudSyncStatus('error');
        setCloudError(res.error || 'Failed to sync with cloud.');
        return { success: false, error: res.error };
      }
    } catch (err: any) {
      setCloudSyncStatus('error');
      setCloudError(err?.message || 'Sync failed.');
      return { success: false, error: err?.message };
    }
  };

  const setSelectedMonth = (month: string) => {
    setState((prev) => ({ ...prev, selectedMonth: month }));
  };

  const properties = useMemo(() => {
    if (state.properties && state.properties.length > 0) {
      return state.properties;
    }
    return [state.property];
  }, [state.properties, state.property]);

  const activePropertyId = state.activePropertyId || state.property.id;

  const setActiveBuilding = (propertyId: string) => {
    const target = properties.find((p) => p.id === propertyId);
    if (target) {
      setState((prev) => ({
        ...prev,
        activePropertyId: propertyId,
        property: target,
      }));
    }
  };

  const addBuilding = (data: {
    name: string;
    tagline?: string;
    description?: string;
    address: string;
    city: string;
    pincode: string;
    phone: string;
    upiId: string;
    totalFloors?: number;
  }) => {
    if (!data.name.trim()) {
      return { success: false, error: 'Building name is required.' };
    }

    const newPropId = `prop-${Date.now()}`;
    const totalFloors = Math.max(1, data.totalFloors || 1);
    const newProperty: Property = {
      id: newPropId,
      ownerId: currentOwnerId,
      name: data.name.trim(),
      tagline: data.tagline?.trim(),
      description: data.description?.trim(),
      address: data.address.trim(),
      city: data.city.trim(),
      pincode: data.pincode.trim(),
      phone: data.phone.trim(),
      upiId: data.upiId.trim(),
      totalFloors,
      isArchived: false,
      createdAt: new Date().toISOString(),
    };

    // Generate initial floors for this building
    const newFloors: Floor[] = [];
    for (let i = 1; i <= totalFloors; i++) {
      newFloors.push({
        id: `floor-${i}-${newPropId}`,
        propertyId: newPropId,
        number: i,
        name: i === 1 ? 'Floor 1 (Ground)' : `Floor ${i}`,
        totalRooms: 0,
      });
    }

    setState((prev) => {
      const existing = prev.properties && prev.properties.length > 0 ? prev.properties : [prev.property];
      return {
        ...prev,
        properties: [...existing, newProperty],
        activePropertyId: newPropId,
        property: newProperty,
        floors: [...prev.floors, ...newFloors],
      };
    });

    if (isCloudOwner && user?.id) {
      upsertCloudProperty(newProperty, user.id).then((res) => {
        if (!res.success) console.error('Cloud property save error:', res.error);
      });
      upsertCloudFloors(newFloors, user.id).catch((err) => {
        console.error('Cloud floors save error:', err);
      });
    }

    return { success: true, property: newProperty };
  };

  const updateBuilding = (propertyId: string, updates: Partial<Property>) => {
    setState((prev) => {
      const existing = prev.properties && prev.properties.length > 0 ? prev.properties : [prev.property];
      const updatedProps = existing.map((p) => (p.id === propertyId ? { ...p, ...updates } : p));
      const active = updatedProps.find((p) => p.id === (prev.activePropertyId || prev.property.id)) || updatedProps[0];
      return {
        ...prev,
        properties: updatedProps,
        property: active,
      };
    });

    if (isCloudOwner && user?.id) {
      const target = (state.properties || [state.property]).find((p) => p.id === propertyId);
      if (target) {
        upsertCloudProperty({ ...target, ...updates }, user.id).catch((err) => {
          console.error('Cloud property update error:', err);
        });
      }
    }

    return { success: true };
  };

  const archiveBuilding = (propertyId: string, isArchived: boolean = true) => {
    setState((prev) => {
      const existing = prev.properties && prev.properties.length > 0 ? prev.properties : [prev.property];
      const updatedProps = existing.map((p) => (p.id === propertyId ? { ...p, isArchived } : p));
      const active = updatedProps.find((p) => p.id === (prev.activePropertyId || prev.property.id)) || updatedProps[0];
      return {
        ...prev,
        properties: updatedProps,
        property: active,
      };
    });

    if (isCloudOwner && user?.id) {
      archiveCloudProperty(propertyId, isArchived, user.id).catch((err) => {
        console.error('Cloud property archive error:', err);
      });
    }

    return { success: true };
  };

  const addFloor = (floorData: { propertyId: string; number: number; name: string }) => {
    const newFloor: Floor = {
      id: `floor-${floorData.number}-${floorData.propertyId}-${Date.now().toString(36)}`,
      propertyId: floorData.propertyId,
      number: floorData.number,
      name: floorData.name.trim(),
      totalRooms: 0,
    };
    setState((prev) => ({
      ...prev,
      floors: [...prev.floors, newFloor],
    }));
    return { success: true, floor: newFloor };
  };

  const updateFloor = (floorId: string, updates: Partial<Floor>) => {
    setState((prev) => ({
      ...prev,
      floors: prev.floors.map((f) => (f.id === floorId ? { ...f, ...updates } : f)),
    }));
    return { success: true };
  };

  const deleteFloor = (floorId: string) => {
    const floorRooms = state.rooms.filter((r) => r.floorId === floorId);
    const occupiedBeds = floorRooms.flatMap((r) => r.beds).filter((b) => b.status === 'occupied' || b.status === 'notice');
    if (occupiedBeds.length > 0) {
      return {
        success: false,
        error: `Cannot delete floor: it contains ${occupiedBeds.length} active tenant(s). Please reassign or check out tenants first.`,
      };
    }
    setState((prev) => ({
      ...prev,
      floors: prev.floors.filter((f) => f.id !== floorId),
      rooms: prev.rooms.filter((r) => r.floorId !== floorId),
    }));
    return { success: true };
  };

  const updateProperty = (prop: Partial<Property>) => {
    updateBuilding(state.activePropertyId || state.property.id, prop);
  };

  // Calculations: strictly computed across individual sleeping berths
  const metrics = useMemo(() => {
    const allBeds = state.rooms.flatMap((r) => r.beds);
    const totalBeds = allBeds.length; // Counts individual sleeping berths, never physical bunk frames
    
    const vacantBeds = allBeds.filter((b) => b.status === 'vacant').length;
    const noticeBeds = allBeds.filter((b) => b.status === 'notice').length;
    const occupiedOnly = allBeds.filter((b) => b.status === 'occupied').length;
    const occupiedBeds = occupiedOnly + noticeBeds; // Notice still counts as occupied
    const maintenanceBeds = allBeds.filter((b) => b.status === 'maintenance').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // Rent charges for selected billing month
    const monthCharges = state.rentCharges.filter((c) => c.billingMonth === state.selectedMonth);
    const expectedRent = monthCharges.reduce((sum, c) => sum + c.amount, 0);

    // Payments allocated to this billing month
    const monthPayments = state.payments.filter((p) => p.billingMonth === state.selectedMonth);
    const collectedRent = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = Math.max(0, expectedRent - collectedRent);

    let overdueCount = 0;
    let overdueAmount = 0;
    let dueSoonCount = 0;
    let dueSoonAmount = 0;
    let paidCount = 0;

    monthCharges.forEach((charge) => {
      const chargePayments = monthPayments
        .filter((p) => p.chargeId === charge.id)
        .reduce((sum, p) => sum + p.amount, 0);
      const bal = charge.amount - chargePayments;

      if (bal <= 0) {
        paidCount++;
      } else {
        if (state.demoDate > charge.dueDate) {
          overdueCount++;
          overdueAmount += bal;
        } else {
          dueSoonCount++;
          dueSoonAmount += bal;
        }
      }
    });

    const monthExpenses = state.expenses
      .filter((e) => e.paymentDate.startsWith(state.selectedMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    const netCashFlow = collectedRent - monthExpenses;
    const noticeCount = state.tenants.filter((t) => t.status === 'notice').length;
    const openTicketsCount = state.maintenanceTickets.filter((t) => t.status !== 'resolved').length;

    return {
      totalBeds,
      occupiedBeds,
      vacantBeds,
      noticeBeds,
      maintenanceBeds,
      occupancyRate,
      expectedRent,
      collectedRent,
      remainingBalance,
      monthlyExpenses: monthExpenses,
      netCashFlow,
      overdueCount,
      overdueAmount,
      dueSoonCount,
      dueSoonAmount,
      paidCount,
      noticeCount,
      openTicketsCount,
    };
  }, [state]);

  // Allocate a tenant to an individual berth
  const allocateTenant = (input: OnboardTenantInput) => {
    const room = state.rooms.find((r) => r.id === input.roomId);
    if (!room) return { success: false, error: 'Selected room not found.' };

    if (
      room.operationalStatus === 'storage' ||
      room.operationalStatus === 'closed' ||
      room.operationalStatus === 'retired' ||
      room.status === 'inactive' ||
      (room.roomPurpose && room.roomPurpose !== 'accommodation')
    ) {
      return {
        success: false,
        error: `Cannot allocate resident: Room ${room.roomNumber} is currently ${room.operationalStatus || room.status || 'not available for accommodation'}.`,
      };
    }

    const bed = room.beds.find((b) => b.id === input.bedId);
    if (!bed) return { success: false, error: 'Selected berth not found.' };

    if (bed.status !== 'vacant') {
      return {
        success: false,
        error: `Berth "${bed.label}" in Room ${room.roomNumber} is currently ${bed.status}. Duplicate allocation is blocked.`,
      };
    }

    const tenantId = `tenant-${Date.now()}`;

    const initialInventory: InventoryItem[] = [
      { id: `inv-${Date.now()}-1`, name: 'Mattress', condition: 'Good', checkInDate: input.joiningDate },
      { id: `inv-${Date.now()}-2`, name: 'Pillow', condition: 'Good', checkInDate: input.joiningDate },
      { id: `inv-${Date.now()}-3`, name: 'Bed key', condition: 'New', checkInDate: input.joiningDate },
      { id: `inv-${Date.now()}-4`, name: 'Cupboard key', condition: 'New', checkInDate: input.joiningDate },
      { id: `inv-${Date.now()}-5`, name: 'Study table', condition: 'Good', checkInDate: input.joiningDate },
      { id: `inv-${Date.now()}-6`, name: 'Fan', condition: 'Good', checkInDate: input.joiningDate },
      { id: `inv-${Date.now()}-7`, name: 'Geyser', condition: 'Good', checkInDate: input.joiningDate },
    ];

    const agreedRent = input.monthlyRent;
    const isFoodSeparate = input.foodPlanType === 'food_separate' || input.foodPlanType === 'custom';
    const agreedFood = isFoodSeparate ? (input.agreedFoodCharge || 0) : 0;
    const totalMonthlyAmount = input.totalMonthlyAmount !== undefined
      ? input.totalMonthlyAmount
      : (agreedRent + agreedFood);

    const initialHistory: RentPriceHistory[] = [
      {
        id: `rh-${Date.now()}`,
        effectiveDate: input.joiningDate,
        previousRent: input.standardRent || bed.monthlyRent,
        newRent: agreedRent,
        previousFoodCharge: input.standardFoodCharge || 0,
        newFoodCharge: agreedFood,
        reason: input.discountReason || input.pricingOverrideReason || 'Initial agreed rent',
        changedAt: new Date().toISOString(),
      },
    ];

    const newTenant: Tenant = {
      id: tenantId,
      ownerId: state.ownerId || 'owner-gv-default',
      name: input.name.trim(),
      phone: input.phone.trim(),
      alternatePhone: input.alternatePhone?.trim(),
      email: input.email?.trim(),
      isPhoneMasked: input.isPhoneMasked ?? false,
      emergencyContact: input.emergencyContact?.trim() || input.emergencyContactPhone?.trim(),
      emergencyContactName: input.emergencyContactName?.trim(),
      emergencyContactPhone: input.emergencyContactPhone?.trim(),
      emergencyContactRelation: input.emergencyContactRelation?.trim(),
      permanentAddress: input.permanentAddress,
      employerName: input.employerName?.trim(),
      jobTitle: input.jobTitle?.trim(),
      workplaceAddress: input.workplaceAddress?.trim(),
      employmentPhone: input.employmentPhone?.trim(),
      joiningDate: input.joiningDate,
      moveInDate: input.moveInDate || input.joiningDate,
      propertyId: state.property.id,
      roomId: input.roomId,
      bedId: input.bedId,
      // Pricing & Negotiations
      pricingBasis: input.pricingBasis || room.pricingBasis || 'per_person',
      standardRent: input.standardRent !== undefined ? input.standardRent : bed.monthlyRent,
      monthlyRent: agreedRent,
      foodPlanType: input.foodPlanType || room.foodPlan || 'no_food',
      selectedMeals: input.selectedMeals,
      standardFoodCharge: input.standardFoodCharge ?? 0,
      agreedFoodCharge: agreedFood,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount: input.discountAmount,
      discountReason: input.discountReason,
      pricingOverrideReason: input.pricingOverrideReason,
      totalMonthlyAmount,
      rentHistory: initialHistory,
      monthlyDueDay: input.monthlyDueDay,
      depositRequired: input.depositRequired,
      depositReceived: input.depositReceived,
      status: 'active',
      notes: input.notes?.trim(),
      assignedInventory: initialInventory,
      stayHistory: [
        {
          id: `stay-${Date.now()}`,
          date: input.joiningDate,
          action: 'joined',
          roomNumber: room.roomNumber,
          bedLabel: bed.label,
          notes: `Allocated to ${bed.label} (${bed.bedType === 'bunk' ? `${bed.tier} berth` : 'single bed'})`,
        },
      ],
      whatsappLogs: [],
      documents: input.documents || [],
    };

    const joiningMonth = input.joiningDate.slice(0, 7);
    const dueDate = calculateDueDate(joiningMonth, input.monthlyDueDay);

    let initialChargeAmount = totalMonthlyAmount;
    let isProrated = false;
    let prorationNotes = '';

    if (input.billingOption === 'prorated') {
      isProrated = true;
      if (input.customChargeAmount !== undefined) {
        initialChargeAmount = input.customChargeAmount;
        prorationNotes = `Custom prorated rent for month ${joiningMonth}`;
      } else {
        const [yearStr, monthStr, dayStr] = input.joiningDate.split('-');
        const totalDays = getDaysInMonth(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1);
        const joiningDay = parseInt(dayStr, 10);
        const activeDays = Math.max(1, totalDays - joiningDay + 1);
        initialChargeAmount = Math.round((totalMonthlyAmount / totalDays) * activeDays);
        prorationNotes = `Prorated for ${activeDays} days in ${joiningMonth}`;
      }
    }

    const newCharge: RentCharge = {
      id: `chg-${Date.now()}`,
      tenantId,
      billingMonth: joiningMonth,
      dueDate,
      amount: initialChargeAmount,
      isProrated,
      prorationNotes,
      createdAt: new Date().toISOString(),
    };

    const newDeposits = [...state.securityDeposits];
    if (input.depositReceived > 0) {
      newDeposits.push({
        id: `sec-dep-${Date.now()}`,
        tenantId,
        type: 'collected',
        amount: input.depositReceived,
        date: input.joiningDate,
        method: 'UPI',
        notes: 'Initial security deposit upon onboarding',
      });
    }

    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== input.roomId) return r;
      return {
        ...r,
        beds: r.beds.map((b) => {
          if (b.id !== input.bedId) return b;
          return {
            ...b,
            status: 'occupied' as BedStatus,
            currentTenantId: tenantId,
          };
        }),
      };
    });

    setState((prev) => ({
      ...prev,
      rooms: updatedRooms,
      tenants: [...prev.tenants, newTenant],
      rentCharges: [...prev.rentCharges, newCharge],
      securityDeposits: newDeposits,
    }));

    if (isCloudOwner) {
      upsertCloudTenant(newTenant, currentOwnerId).catch((err) => {
        setCloudSyncStatus('offline_cache');
        setCloudError(err?.message || 'Tenant saved offline. Cloud sync pending.');
      });
      upsertCloudBed({ ...bed, status: 'occupied', currentTenantId: tenantId }, state.property.id, currentOwnerId).catch(() => {});
    }

    return { success: true, tenant: newTenant };
  };

  const updateTenant = (tenantId: string, updates: Partial<Tenant>) => {
    const existing = state.tenants.find((t) => t.id === tenantId);
    if (existing && isCloudOwner && user?.id) {
      upsertCloudTenant({ ...existing, ...updates }, user.id).catch((err) => {
        console.error('Failed to sync updated tenant to Supabase:', err);
      });
    }
    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) => (t.id === tenantId ? { ...t, ...updates } : t)),
    }));
  };

  const updateTenantPricing = (
    tenantId: string,
    newMonthlyRent: number,
    effectiveDate: string,
    options?: {
      agreedFoodCharge?: number;
      reason?: string;
      selectedMeals?: MealOptions;
      foodPlanType?: FoodPlanType;
      standardFoodCharge?: number;
    }
  ) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    if (newMonthlyRent < 0) {
      return { success: false, error: 'Monthly rent cannot be negative.' };
    }
    if (options?.agreedFoodCharge !== undefined && options.agreedFoodCharge < 0) {
      return { success: false, error: 'Food charge cannot be negative.' };
    }

    const previousRent = tenant.monthlyRent;
    const previousFoodCharge = tenant.agreedFoodCharge || 0;
    const newFoodCharge = options?.agreedFoodCharge !== undefined ? options.agreedFoodCharge : previousFoodCharge;
    const totalMonthly = newMonthlyRent + newFoodCharge;

    const historyEntry: RentPriceHistory = {
      id: `rh-${Date.now()}`,
      effectiveDate,
      previousRent,
      newRent: newMonthlyRent,
      previousFoodCharge,
      newFoodCharge,
      reason: options?.reason || 'Price change agreement updated',
      changedAt: new Date().toISOString(),
    };

    const updatedHistory = [...(tenant.rentHistory || []), historyEntry];
    const updatedTenant: Tenant = {
      ...tenant,
      monthlyRent: newMonthlyRent,
      agreedFoodCharge: newFoodCharge,
      totalMonthlyAmount: totalMonthly,
      foodPlanType: options?.foodPlanType !== undefined ? options.foodPlanType : tenant.foodPlanType,
      standardFoodCharge: options?.standardFoodCharge !== undefined ? options.standardFoodCharge : tenant.standardFoodCharge,
      selectedMeals: options?.selectedMeals || tenant.selectedMeals,
      rentHistory: updatedHistory,
    };

    if (isCloudOwner && user?.id) {
      upsertCloudTenant(updatedTenant, user.id).catch((err) => {
        console.error('Failed to sync updated tenant pricing to Supabase:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId ? updatedTenant : t
      ),
    }));

    return { success: true };
  };

  // Add a document to a tenant profile
  const addTenantDocument = (
    tenantId: string,
    docData: {
      documentType: DocumentType;
      title: string;
      maskedDocumentNumber?: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      consentObtained: boolean;
      verificationNotes?: string;
    },
    file?: Blob | File
  ) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    if (docData.documentType === 'aadhaar' && !docData.consentObtained) {
      return { success: false, error: 'Explicit tenant consent is required to process Aadhaar identity proof.' };
    }

    const currentOwner = state.ownerId || 'owner-gv-default';
    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const maskedNum = docData.maskedDocumentNumber
      ? (docData.documentType === 'aadhaar' ? maskAadhaarNumber(docData.maskedDocumentNumber) : docData.maskedDocumentNumber.trim())
      : undefined;

    const extension = docData.fileName.split('.').pop() || 'pdf';
    const storagePath = `${currentOwner}/${tenantId}/${docId}.${extension}`;

    if (file) {
      documentStore.storeFile(docId, file, currentOwner, docData.fileName, docData.mimeType);
    }

    const newDoc: TenantDocument = {
      id: docId,
      tenantId,
      documentType: docData.documentType,
      title: docData.title.trim(),
      maskedDocumentNumber: maskedNum,
      fileName: docData.fileName.trim(),
      fileSize: docData.fileSize,
      mimeType: docData.mimeType,
      uploadedAt: new Date().toISOString(),
      verificationStatus: 'pending',
      verificationNotes: docData.verificationNotes?.trim(),
      storagePath,
      consentObtained: docData.consentObtained,
      ownerId: currentOwner,
    };

    if (isCloudOwner && user?.id && file) {
      uploadTenantDocumentCloud(newDoc, file, user.id).catch((err) => {
        console.error('Failed to sync tenant document to Supabase storage:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId
          ? { ...t, documents: [...(t.documents || []), newDoc] }
          : t
      ),
    }));

    return { success: true, document: newDoc };
  };

  // Update verification status of a document
  const updateDocumentVerification = (
    tenantId: string,
    documentId: string,
    status: DocumentVerificationStatus,
    notes?: string,
    rejectionReason?: string
  ) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { success: false, error: 'Document not found.' };

    const currentOwner = state.ownerId || 'owner-gv-default';
    if (doc.ownerId && doc.ownerId !== currentOwner) {
      return { success: false, error: '403 Forbidden: Cannot modify document belonging to another owner.' };
    }

    if (status === 'rejected' && !rejectionReason?.trim()) {
      return { success: false, error: 'A rejection reason is required when rejecting a document.' };
    }

    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              documents: t.documents?.map((d) =>
                d.id === documentId
                  ? {
                      ...d,
                      verificationStatus: status,
                      verificationNotes: notes?.trim() ?? d.verificationNotes,
                      rejectionReason: status === 'rejected' ? rejectionReason?.trim() : undefined,
                      verifiedAt: status !== 'pending' ? new Date().toISOString() : undefined,
                      verifiedBy: status !== 'pending' ? currentOwner : undefined,
                    }
                  : d
              ),
            }
          : t
      ),
    }));

    return { success: true };
  };

  // Replace a document with a new file
  const replaceTenantDocument = (
    tenantId: string,
    documentId: string,
    newFile: Blob | File,
    newMetadata?: Partial<TenantDocument>
  ) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { success: false, error: 'Document not found.' };

    const currentOwner = state.ownerId || 'owner-gv-default';
    if (doc.ownerId && doc.ownerId !== currentOwner) {
      return { success: false, error: '403 Forbidden: Cannot replace document belonging to another owner.' };
    }

    const fileName = (newFile as File).name || doc.fileName;
    const mimeType = newFile.type || doc.mimeType;
    const fileSize = newFile.size;

    documentStore.storeFile(documentId, newFile, currentOwner, fileName, mimeType);

    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              documents: t.documents?.map((d) =>
                d.id === documentId
                  ? {
                      ...d,
                      ...newMetadata,
                      fileName,
                      mimeType,
                      fileSize,
                      uploadedAt: new Date().toISOString(),
                      verificationStatus: 'pending', // Re-verification required
                    }
                  : d
              ),
            }
          : t
      ),
    }));

    return { success: true };
  };

  // Delete a tenant document
  const deleteTenantDocument = (tenantId: string, documentId: string) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { success: false, error: 'Document not found.' };

    const currentOwner = state.ownerId || 'owner-gv-default';
    if (doc.ownerId && doc.ownerId !== currentOwner) {
      return { success: false, error: '403 Forbidden: Cannot delete document belonging to another owner.' };
    }

    documentStore.deleteFile(documentId, currentOwner);

    if (isCloudOwner && user?.id) {
      deleteTenantDocumentCloud(documentId, user.id, doc.storagePath).catch((err) => {
        console.error('Failed to delete tenant document from Supabase storage:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId
          ? { ...t, documents: t.documents?.filter((d) => d.id !== documentId) }
          : t
      ),
    }));

    return { success: true };
  };

  // Get secure signed URL for viewing/download
  const getSecureDocumentAccess = (tenantId: string, documentId: string) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { error: 'Document not found.' };

    const currentOwner = state.ownerId || 'owner-gv-default';
    return documentStore.getSecureAccessUrl(documentId, currentOwner);
  };

  // Asynchronous secure access supporting Supabase signed URL generation
  const getSecureDocumentAccessAsync = async (
    tenantId: string,
    documentId: string
  ): Promise<{ url?: string; fileName?: string; mimeType?: string; error?: string }> => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { error: 'Document not found.' };

    const currentOwner = state.ownerId || 'owner-gv-default';
    if (doc.ownerId && doc.ownerId !== currentOwner) {
      return { error: '403 Forbidden: Cannot access documents belonging to another owner.' };
    }

    const local = documentStore.getSecureAccessUrl(documentId, currentOwner);
    if (local.url) {
      return local;
    }

    if (doc.storagePath) {
      const signedRes = await getSignedDocumentUrlCloud(doc.storagePath);
      if (signedRes.success && signedRes.signedUrl) {
        return {
          url: signedRes.signedUrl,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
        };
      }
      return { error: signedRes.error || 'Failed to generate cloud signed URL.' };
    }

    return { error: 'Document file not found in storage.' };
  };

  // Give Notice
  const giveNotice = (tenantId: string, noticeDate: string, expectedMoveOutDate: string, notes?: string) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const room = state.rooms.find((r) => r.id === tenant.roomId);
    const bed = room?.beds.find((b) => b.id === tenant.bedId);

    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== tenant.roomId) return r;
      return {
        ...r,
        beds: r.beds.map((b) => {
          if (b.id !== tenant.bedId) return b;
          return { ...b, status: 'notice' as BedStatus };
        }),
      };
    });

    const stayItem = {
      id: `stay-${Date.now()}`,
      date: noticeDate,
      action: 'notice_given' as const,
      roomNumber: room?.roomNumber || 'Unknown',
      bedLabel: bed?.label || 'Unknown',
      notes: notes || `Notice submitted; expected checkout: ${expectedMoveOutDate}`,
    };

    if (isCloudOwner && user?.id) {
      setNoticeCloudTenant(
        tenantId,
        noticeDate,
        expectedMoveOutDate,
        user.id,
        notes,
        { roomNumber: room?.roomNumber || 'Unknown', bedLabel: bed?.label || 'Berth' }
      ).catch((err) => {
        console.error('Failed to sync notice to Supabase:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      rooms: updatedRooms,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              status: 'notice',
              noticeDate,
              expectedMoveOutDate,
              notes: notes ? `${t.notes ? t.notes + '\n' : ''}${notes}` : t.notes,
              stayHistory: [...(t.stayHistory || []), stayItem],
            }
          : t
      ),
    }));

    return { success: true };
  };

  // Checkout tenant
  const checkoutTenant = (
    tenantId: string,
    checkoutDate: string,
    inventoryUpdates: Record<string, 'Good' | 'Fair' | 'Damaged' | 'Missing'> = {},
    refundDepositAmount?: number,
    notes?: string
  ) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const room = state.rooms.find((r) => r.id === tenant.roomId);
    const bed = room?.beds.find((b) => b.id === tenant.bedId);

    // Free the berth back to vacant
    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== tenant.roomId) return r;
      return {
        ...r,
        beds: r.beds.map((b) => {
          if (b.id !== tenant.bedId) return b;
          return {
            ...b,
            status: 'vacant' as BedStatus,
            currentTenantId: undefined,
          };
        }),
      };
    });

    const updatedInventory = (tenant.assignedInventory || []).map((item) => ({
      ...item,
      checkOutDate: checkoutDate,
      checkOutCondition: inventoryUpdates[item.id] || 'Good',
    }));

    const stayItem = {
      id: `stay-${Date.now()}`,
      date: checkoutDate,
      action: 'checked_out' as const,
      roomNumber: room?.roomNumber || '',
      bedLabel: bed?.label || '',
      notes: notes || 'Final checkout completed, berth released',
    };

    const newDeposits = [...state.securityDeposits];
    if (refundDepositAmount && refundDepositAmount > 0) {
      newDeposits.push({
        id: `sec-dep-${Date.now()}`,
        tenantId,
        type: 'refunded',
        amount: refundDepositAmount,
        date: checkoutDate,
        method: 'UPI',
        notes: 'Deposit refund upon checkout clearance',
      });
    }

    if (isCloudOwner && user?.id) {
      checkoutCloudTenant(
        tenantId,
        checkoutDate,
        user.id,
        { roomNumber: room?.roomNumber || '', bedLabel: bed?.label || '', notes },
        refundDepositAmount
      ).catch((err) => {
        console.error('Failed to sync checkout to Supabase:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      rooms: updatedRooms,
      securityDeposits: newDeposits,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              status: 'checked_out',
              actualCheckoutDate: checkoutDate,
              assignedInventory: updatedInventory,
              stayHistory: [...(t.stayHistory || []), stayItem],
            }
          : t
      ),
    }));

    return { success: true };
  };

  // Move tenant to another berth with destination validation & optional rent change agreement
  const moveTenantBed = (
    tenantId: string,
    targetRoomId: string,
    targetBedId: string,
    moveDate: string,
    notes?: string,
    options?: { newRent?: number; reason?: string }
  ) => {
    const tenant = state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const targetRoom = state.rooms.find((r) => r.id === targetRoomId);
    if (!targetRoom) return { success: false, error: 'Target room not found.' };

    // Prevent transferring into closed, storage, retired, or non-accommodation rooms
    if (
      targetRoom.operationalStatus === 'storage' ||
      targetRoom.operationalStatus === 'closed' ||
      targetRoom.operationalStatus === 'retired' ||
      targetRoom.status === 'inactive' ||
      (targetRoom.roomPurpose && targetRoom.roomPurpose !== 'accommodation')
    ) {
      return {
        success: false,
        error: `Cannot transfer resident: Destination Room ${targetRoom.roomNumber} is currently ${targetRoom.operationalStatus || targetRoom.status || 'not available for accommodation'}.`,
      };
    }

    const targetBed = targetRoom.beds.find((b) => b.id === targetBedId);
    if (!targetBed) return { success: false, error: 'Target berth not found.' };

    if (targetBed.status !== 'vacant') {
      return { success: false, error: `Target berth "${targetBed.label}" in Room ${targetRoom.roomNumber} is not vacant.` };
    }

    const newStatus: BedStatus = tenant.status === 'notice' ? 'notice' : 'occupied';

    const updatedRooms = state.rooms.map((r) => {
      let beds = r.beds;
      if (r.id === tenant.roomId) {
        beds = beds.map((b) => (b.id === tenant.bedId ? { ...b, status: 'vacant' as BedStatus, currentTenantId: undefined } : b));
      }
      if (r.id === targetRoomId) {
        beds = beds.map((b) => (b.id === targetBedId ? { ...b, status: newStatus, currentTenantId: tenantId } : b));
      }
      return { ...r, beds };
    });

    const stayItem = {
      id: `stay-${Date.now()}`,
      date: moveDate,
      action: 'moved' as const,
      roomNumber: targetRoom.roomNumber,
      bedLabel: targetBed.label,
      notes: notes || `Moved to Room ${targetRoom.roomNumber}, ${targetBed.label}`,
    };

    // If rent change option is specified (due to berth price difference or agreement revision)
    let updatedHistory = tenant.rentHistory || [];
    let newMonthlyRent = tenant.monthlyRent;
    let newTotal = tenant.totalMonthlyAmount;

    if (options?.newRent !== undefined && options.newRent >= 0 && options.newRent !== tenant.monthlyRent) {
      const historyEntry: RentPriceHistory = {
        id: `rh-move-${Date.now()}`,
        effectiveDate: moveDate,
        previousRent: tenant.monthlyRent,
        newRent: options.newRent,
        previousFoodCharge: tenant.agreedFoodCharge || 0,
        newFoodCharge: tenant.agreedFoodCharge || 0,
        reason: options.reason || `Rent adjusted upon transfer to Room ${targetRoom.roomNumber} (${targetBed.label})`,
        changedAt: new Date().toISOString(),
      };
      updatedHistory = [...updatedHistory, historyEntry];
      newMonthlyRent = options.newRent;
      newTotal = options.newRent + (tenant.agreedFoodCharge || 0);
    }

    const updatedTenant: Tenant = {
      ...tenant,
      roomId: targetRoomId,
      bedId: targetBedId,
      monthlyRent: newMonthlyRent,
      totalMonthlyAmount: newTotal,
      rentHistory: updatedHistory,
      stayHistory: [...tenant.stayHistory, stayItem],
    };

    setState((prev) => ({
      ...prev,
      rooms: updatedRooms,
      tenants: prev.tenants.map((t) => (t.id === tenantId ? updatedTenant : t)),
    }));

    if (isCloudOwner && user?.id) {
      transferCloudTenant(
        tenantId,
        targetRoomId,
        targetBedId,
        moveDate,
        tenant.roomId,
        tenant.bedId,
        user.id,
        options,
        { roomNumber: targetRoom.roomNumber, bedLabel: targetBed.label, notes }
      ).catch((err) => {
        console.error('Failed to sync room transfer to Supabase:', err);
      });
    }

    return { success: true };
  };

  // Record a payment allocated to a rent charge
  const recordPayment = (payment: {
    tenantId: string;
    chargeId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    transactionRef?: string;
    notes?: string;
  }) => {
    const charge = state.rentCharges.find((c) => c.id === payment.chargeId);
    if (!charge) {
      return { success: false, error: 'Target rent charge not found.' };
    }

    const alreadyPaid = state.payments
      .filter((p) => p.chargeId === payment.chargeId)
      .reduce((sum, p) => sum + p.amount, 0);
    const balance = charge.amount - alreadyPaid;

    if (payment.amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than ₹0.' };
    }

    if (payment.amount > balance) {
      return {
        success: false,
        error: `Payment amount of ₹${payment.amount.toLocaleString('en-IN')} exceeds the outstanding balance of ₹${balance.toLocaleString('en-IN')}.`,
      };
    }

    const receiptSeq = (state.payments.length + 1).toString().padStart(3, '0');
    const cleanMonth = (payment.paymentDate.slice(0, 7) || state.selectedMonth).replace('-', '');
    const receiptNumber = `RCP-${cleanMonth}-${receiptSeq}`;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      receiptNumber,
      tenantId: payment.tenantId,
      chargeId: payment.chargeId,
      billingMonth: charge.billingMonth,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      transactionRef: payment.transactionRef?.trim(),
      notes: payment.notes?.trim(),
      createdAt: new Date().toISOString(),
    };

    if (isCloudOwner && user?.id) {
      upsertCloudPayment(newPayment, state.property.id, user.id).catch((err) => {
        console.error('Failed to sync payment to Supabase:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      payments: [...prev.payments, newPayment],
    }));

    return { success: true, payment: newPayment };
  };

  // Generate monthly charges with duplicate prevention
  const generateMonthlyCharges = (month: string) => {
    const activeTenants = state.tenants.filter((t) => t.status === 'active' || t.status === 'notice');
    let generatedCount = 0;
    let alreadyExistedCount = 0;

    const newCharges: RentCharge[] = [];

    activeTenants.forEach((tenant) => {
      const exists = state.rentCharges.some((c) => c.tenantId === tenant.id && c.billingMonth === month);
      if (exists) {
        alreadyExistedCount++;
      } else {
        generatedCount++;
        const dueDate = calculateDueDate(month, tenant.monthlyDueDay);
        newCharges.push({
          id: `chg-${month.replace('-', '')}-${tenant.id}`,
          tenantId: tenant.id,
          billingMonth: month,
          dueDate,
          amount: tenant.monthlyRent,
          isProrated: false,
          createdAt: new Date().toISOString(),
        });
      }
    });

    if (newCharges.length > 0) {
      if (isCloudOwner && user?.id) {
        upsertCloudRentCharges(newCharges, state.property.id, user.id).catch((err) => {
          console.error('Failed to sync rent charges to Supabase:', err);
        });
      }

      setState((prev) => ({
        ...prev,
        rentCharges: [...prev.rentCharges, ...newCharges],
      }));
    }

    return { generatedCount, alreadyExistedCount };
  };

  // Room & Bed / Bunk Management
  const addRoom = (roomInput: {
    propertyId?: string;
    floorId: string;
    roomNumber: string;
    sharingType?: string;
    capacity?: number;
    hasAc: boolean;
    hasAttachedBathroom: boolean;
    hasBalcony: boolean;
    bathroomType?: BathroomType;
    roomRent?: number;
    status?: RoomStatus;
    notes?: string;
    amenitiesList?: RoomAmenities;
    foodPlan?: FoodPlanType;
    mealsProvided?: MealOptions;
    foodMonthlyCharge?: number;
    pricingBasis?: PricingBasis;
    mealPrices?: MealPrices;
    beds: NewRoomBedInput[];
  }) => {
    const targetPropId = roomInput.propertyId || state.activePropertyId || state.property.id;
    const cleanRoomNum = roomInput.roomNumber.trim();

    // Check duplicate room number within the same building
    const isDuplicate = state.rooms.some((r) => {
      const rProp = r.propertyId || state.floors.find((f) => f.id === r.floorId)?.propertyId;
      return (
        rProp === targetPropId &&
        r.roomNumber.toLowerCase() === cleanRoomNum.toLowerCase()
      );
    });

    if (isDuplicate) {
      return { success: false, error: `Room ${cleanRoomNum} already exists in this building.` };
    }

    const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const beds: Bed[] = roomInput.beds.map((b) => {
      let uniqueId = '';
      if (b.bedType === 'bunk') {
        const tierStr = b.tier === 'upper' ? 'Upper' : 'Lower';
        uniqueId = `Room ${cleanRoomNum} - ${b.bunkGroup || 'Bunk 1'} - ${tierStr}`;
      } else {
        uniqueId = `Room ${cleanRoomNum} - ${b.label}`;
      }

      return {
        id: uniqueId,
        roomId,
        label: b.label,
        bedType: b.bedType,
        bunkGroup: b.bunkGroup,
        tier: b.tier,
        monthlyRent: b.monthlyRent,
        status: 'vacant',
      };
    });

    const sharingType = roomInput.sharingType || `${beds.length}-Sharing (${beds.length} Berths)`;

    const newRoom: Room = {
      id: roomId,
      propertyId: targetPropId,
      floorId: roomInput.floorId,
      roomNumber: cleanRoomNum,
      sharingType,
      capacity: roomInput.capacity || beds.length,
      hasAc: roomInput.hasAc,
      hasAttachedBathroom: roomInput.hasAttachedBathroom,
      hasBalcony: roomInput.hasBalcony,
      bathroomType: roomInput.bathroomType || (roomInput.hasAttachedBathroom ? 'attached' : 'shared'),
      roomRent: roomInput.roomRent,
      status: roomInput.status || 'available',
      pricingBasis: roomInput.pricingBasis || 'per_person',
      notes: roomInput.notes?.trim(),
      amenitiesList: roomInput.amenitiesList || {
        cupboard: true,
        table: true,
        chair: true,
        fan: true,
        wifi: true,
        geyser: roomInput.hasAttachedBathroom,
        balcony: roomInput.hasBalcony,
      },
      foodPlan: roomInput.foodPlan || 'no_food',
      mealsProvided: roomInput.mealsProvided || { breakfast: false, lunch: false, dinner: false },
      mealPrices: roomInput.mealPrices || { breakfast: 800, lunch: 1200, dinner: 1500 },
      foodMonthlyCharge: roomInput.foodMonthlyCharge || 0,
      beds,
    };

    if (isCloudOwner && user?.id) {
      upsertCloudRoom(newRoom, user.id).catch((err) => {
        console.error('Failed to sync room to Supabase:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      rooms: [...prev.rooms, newRoom],
    }));

    return { success: true };
  };

  const bulkGenerateRooms = (config: BulkGenerateInput) => {
    const {
      propertyId,
      floorId,
      startNumber,
      count,
      prefix = '',
      sharingType,
      bedType,
      upperRent = 6000,
      lowerRent = 6500,
      singleRent = 7000,
      hasAc,
      hasAttachedBathroom,
      bathroomType,
      foodPlan,
      mealsProvided,
      foodMonthlyCharge,
      amenitiesList,
      notes,
    } = config;

    const newRooms: Room[] = [];

    for (let i = 0; i < count; i++) {
      const roomNum = `${prefix}${startNumber + i}`;
      const isDup = state.rooms.some((r) => {
        const rProp = r.propertyId || state.floors.find((f) => f.id === r.floorId)?.propertyId;
        return rProp === propertyId && r.roomNumber.toLowerCase() === roomNum.toLowerCase();
      });
      if (isDup) continue;

      const roomId = `room-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      let beds: Bed[] = [];

      if (bedType === 'bunk') {
        if (sharingType === 'Four' || sharingType === 'Four Sharing') {
          beds = [
            { id: `Room ${roomNum} - Bunk 1 - Upper`, roomId, label: 'Bunk 1 - Upper', bedType: 'bunk', bunkGroup: 'Bunk 1', tier: 'upper', monthlyRent: upperRent, status: 'vacant' },
            { id: `Room ${roomNum} - Bunk 1 - Lower`, roomId, label: 'Bunk 1 - Lower', bedType: 'bunk', bunkGroup: 'Bunk 1', tier: 'lower', monthlyRent: lowerRent, status: 'vacant' },
            { id: `Room ${roomNum} - Bunk 2 - Upper`, roomId, label: 'Bunk 2 - Upper', bedType: 'bunk', bunkGroup: 'Bunk 2', tier: 'upper', monthlyRent: upperRent, status: 'vacant' },
            { id: `Room ${roomNum} - Bunk 2 - Lower`, roomId, label: 'Bunk 2 - Lower', bedType: 'bunk', bunkGroup: 'Bunk 2', tier: 'lower', monthlyRent: lowerRent, status: 'vacant' },
          ];
        } else if (sharingType === 'Triple' || sharingType === 'Triple Sharing') {
          beds = [
            { id: `Room ${roomNum} - Bunk 1 - Upper`, roomId, label: 'Bunk 1 - Upper', bedType: 'bunk', bunkGroup: 'Bunk 1', tier: 'upper', monthlyRent: upperRent, status: 'vacant' },
            { id: `Room ${roomNum} - Bunk 1 - Lower`, roomId, label: 'Bunk 1 - Lower', bedType: 'bunk', bunkGroup: 'Bunk 1', tier: 'lower', monthlyRent: lowerRent, status: 'vacant' },
            { id: `Room ${roomNum} - Bed 1`, roomId, label: 'Bed 1', bedType: 'single', tier: 'single', monthlyRent: singleRent, status: 'vacant' },
          ];
        } else {
          beds = [
            { id: `Room ${roomNum} - Bunk 1 - Upper`, roomId, label: 'Bunk 1 - Upper', bedType: 'bunk', bunkGroup: 'Bunk 1', tier: 'upper', monthlyRent: upperRent, status: 'vacant' },
            { id: `Room ${roomNum} - Bunk 1 - Lower`, roomId, label: 'Bunk 1 - Lower', bedType: 'bunk', bunkGroup: 'Bunk 1', tier: 'lower', monthlyRent: lowerRent, status: 'vacant' },
          ];
        }
      } else {
        const bedCount = sharingType === 'Single' ? 1 : sharingType === 'Double' ? 2 : sharingType === 'Triple' ? 3 : 2;
        beds = Array.from({ length: bedCount }).map((_, bIdx) => ({
          id: `Room ${roomNum} - Bed ${bIdx + 1}`,
          roomId,
          label: `Bed ${bIdx + 1}`,
          bedType: 'single',
          tier: 'single',
          monthlyRent: singleRent,
          status: 'vacant',
        }));
      }

      newRooms.push({
        id: roomId,
        propertyId,
        floorId,
        roomNumber: roomNum,
        sharingType,
        capacity: beds.length,
        hasAc,
        hasAttachedBathroom,
        hasBalcony: false,
        bathroomType: bathroomType || (hasAttachedBathroom ? 'attached' : 'shared'),
        status: 'available',
        notes: notes?.trim(),
        amenitiesList: amenitiesList || {
          cupboard: true,
          table: true,
          chair: true,
          fan: true,
          wifi: true,
          geyser: hasAttachedBathroom,
        },
        foodPlan: foodPlan || 'no_food',
        pricingBasis: config.pricingBasis || 'per_person',
        mealsProvided: mealsProvided || { breakfast: false, lunch: false, dinner: false },
        mealPrices: config.mealPrices || { breakfast: 800, lunch: 1200, dinner: 1500 },
        foodMonthlyCharge: foodMonthlyCharge || 0,
        beds,
      });
    }

    if (newRooms.length === 0) {
      return { success: false, createdCount: 0, error: 'All requested room numbers already exist in this building.' };
    }

    setState((prev) => ({
      ...prev,
      rooms: [...prev.rooms, ...newRooms],
    }));

    return { success: true, createdCount: newRooms.length };
  };

  const getBuildingMetrics = (propertyId?: string): BuildingMetrics => {
    const targetId = propertyId || state.activePropertyId || state.property.id;
    const buildingFloors = state.floors.filter((f) => f.propertyId === targetId);
    const floorIdSet = new Set(buildingFloors.map((f) => f.id));
    const buildingRooms = state.rooms.filter((r) =>
      r.propertyId ? r.propertyId === targetId : floorIdSet.has(r.floorId)
    );

    const isAccommodationRoom = (r: Room) => {
      const purpose = r.roomPurpose || 'accommodation';
      const opStatus = r.operationalStatus || (r.status === 'inactive' ? 'closed' : r.status === 'maintenance' ? 'maintenance' : 'available');
      return purpose === 'accommodation' && opStatus !== 'storage' && opStatus !== 'closed' && opStatus !== 'retired';
    };

    const accommodationRoomsList = buildingRooms.filter(isAccommodationRoom);
    const storageRoomsList = buildingRooms.filter((r) => r.roomPurpose === 'storage' || r.operationalStatus === 'storage');
    const closedRoomsList = buildingRooms.filter((r) => r.operationalStatus === 'closed' || (r.status === 'inactive' && r.operationalStatus !== 'retired'));
    const retiredRoomsList = buildingRooms.filter((r) => r.operationalStatus === 'retired');

    // Berths belonging strictly to active accommodation rooms
    const accommodationBeds = accommodationRoomsList.flatMap((r) => r.beds);

    const totalFloors = buildingFloors.length;
    const totalRooms = buildingRooms.length;
    const accommodationRooms = accommodationRoomsList.length;
    const storageRooms = storageRoomsList.length;
    const closedRooms = closedRoomsList.length;
    const retiredRooms = retiredRoomsList.length;

    const totalBeds = accommodationBeds.length;
    const occupiedBeds = accommodationBeds.filter((b) => b.status === 'occupied' || b.status === 'notice').length;
    const availableBeds = accommodationBeds.filter((b) => b.status === 'vacant').length;
    const maintenanceBeds = accommodationBeds.filter((b) => b.status === 'maintenance').length;
    const roomsInMaintenance = accommodationRoomsList.filter(
      (r) => r.status === 'maintenance' || r.operationalStatus === 'maintenance' || (r.beds.length > 0 && r.beds.every((b) => b.status === 'maintenance'))
    ).length;

    // Monthly accommodation potential rent strictly from active accommodation rooms
    const monthlyAccommodationRentPotential = accommodationRoomsList.reduce((sum, r) => {
      if (r.roomRent && r.roomRent > 0) {
        return sum + r.roomRent;
      }
      return sum + r.beds.reduce((bSum, b) => bSum + (b.monthlyRent || 0), 0);
    }, 0);

    // Monthly food charges potential (separate food plan)
    const monthlyFoodChargesPotential = accommodationRoomsList.reduce((sum, r) => {
      if (r.foodPlan === 'food_separate' && r.foodMonthlyCharge && r.foodMonthlyCharge > 0) {
        return sum + r.foodMonthlyCharge * r.beds.length;
      }
      return sum;
    }, 0);

    const totalMonthlyPotential = monthlyAccommodationRentPotential + monthlyFoodChargesPotential;
    const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

    return {
      totalFloors,
      totalRooms,
      accommodationRooms,
      storageRooms,
      closedRooms,
      retiredRooms,
      totalBeds,
      totalBerths: totalBeds,
      occupiedBeds,
      occupiedBerths: occupiedBeds,
      availableBeds,
      vacantBerths: availableBeds,
      maintenanceBeds,
      occupancyRate,
      roomsInMaintenance,
      monthlyAccommodationRentPotential,
      potentialAccommodationRent: monthlyAccommodationRentPotential,
      monthlyFoodChargesPotential,
      potentialFoodRent: monthlyFoodChargesPotential,
      totalMonthlyPotential,
    };
  };

  const updateRoom = (roomId: string, updates: Partial<Room>): { success: boolean; error?: string } => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const occupiedBeds = room.beds.filter((b) => b.status === 'occupied' || b.status === 'notice' || b.currentTenantId);

    // If attempting to close, retire, or convert to non-accommodation while active residents are present:
    const targetPurpose = updates.roomPurpose || room.roomPurpose || 'accommodation';
    const targetOpStatus = updates.operationalStatus || room.operationalStatus || 'available';

    if (
      occupiedBeds.length > 0 &&
      (targetPurpose !== 'accommodation' || targetOpStatus === 'storage' || targetOpStatus === 'closed' || targetOpStatus === 'retired')
    ) {
      return {
        success: false,
        error: `Cannot change Room ${room.roomNumber} to ${targetPurpose !== 'accommodation' ? targetPurpose : targetOpStatus} while it currently has ${occupiedBeds.length} active resident(s). Please transfer or check out residents first.`,
      };
    }

    // Check duplicate room number in the same property if room number changed
    if (updates.roomNumber && updates.roomNumber.trim().toLowerCase() !== room.roomNumber.toLowerCase()) {
      const targetPropertyId = updates.propertyId || room.propertyId;
      const duplicate = state.rooms.find(
        (r) => r.id !== roomId && r.propertyId === targetPropertyId && r.roomNumber.toLowerCase() === updates.roomNumber!.trim().toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: `Room number "${updates.roomNumber}" already exists in this property.` };
      }
    }

    // Cannot remove occupied beds if beds were updated
    if (updates.beds) {
      const missingOccupied = occupiedBeds.find((ob) => !updates.beds!.some((nb) => nb.id === ob.id));
      if (missingOccupied) {
        return {
          success: false,
          error: `Cannot remove berth "${missingOccupied.label}" because it is currently occupied. Please transfer the resident before modifying bed configuration.`,
        };
      }
    }

    const updatedRoom: Room = {
      ...room,
      ...updates,
      amenities: {
        ...(room.amenities || {}),
        ...(updates.amenities || {}),
        _roomPurpose: targetPurpose,
        _operationalStatus: targetOpStatus,
        _statusReason: updates.statusReason || room.statusReason,
        _statusEffectiveDate: updates.statusEffectiveDate || room.statusEffectiveDate,
        _statusNotes: updates.statusNotes || room.statusNotes,
      },
    };

    setState((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => (r.id === roomId ? updatedRoom : r)),
    }));

    if (isCloudOwner && user?.id) {
      upsertCloudRoom(updatedRoom, user.id).catch((err) => {
        console.error('Failed to sync updated room to cloud:', err);
      });
    }

    return { success: true };
  };

  const deleteRoom = (roomId: string, force?: boolean): { success: boolean; error?: string; hasHistory?: boolean } => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const occupiedBeds = room.beds.filter((b) => b.status === 'occupied' || b.status === 'notice' || b.currentTenantId);
    if (occupiedBeds.length > 0) {
      return {
        success: false,
        error: `Cannot delete Room ${room.roomNumber} because it currently has ${occupiedBeds.length} active resident(s). Please transfer or check out residents first.`,
      };
    }

    // Check historical records (past stay history, maintenance tickets)
    const pastTenants = state.tenants.filter(
      (t) => t.roomId === roomId || t.stayHistory?.some((s) => s.roomNumber === room.roomNumber)
    );
    const linkedTickets = state.maintenanceTickets.filter((m) => m.roomId === roomId);

    if ((pastTenants.length > 0 || linkedTickets.length > 0) && !force) {
      return {
        success: false,
        hasHistory: true,
        error: `Room ${room.roomNumber} has ${pastTenants.length} past resident record(s) and ${linkedTickets.length} maintenance record(s). Retiring or closing the room is strongly recommended instead to preserve financial and audit history.`,
      };
    }

    setState((prev) => ({
      ...prev,
      rooms: prev.rooms.filter((r) => r.id !== roomId),
    }));

    if (isCloudOwner && user?.id) {
      deleteCloudRoom(roomId, user.id).catch((err) => {
        console.error('Failed to delete room in cloud:', err);
      });
    }

    return { success: true };
  };

  const retireRoom = (roomId: string, reason?: string, effectiveDate?: string, notes?: string) => {
    return updateRoom(roomId, {
      operationalStatus: 'retired',
      status: 'inactive',
      statusReason: reason || 'Permanently retired from operations',
      statusEffectiveDate: effectiveDate || state.demoDate,
      statusNotes: notes,
    });
  };

  const closeRoom = (roomId: string, reason?: string, effectiveDate?: string, notes?: string) => {
    return updateRoom(roomId, {
      operationalStatus: 'closed',
      status: 'inactive',
      statusReason: reason || 'Temporarily closed',
      statusEffectiveDate: effectiveDate || state.demoDate,
      statusNotes: notes,
    });
  };

  const convertToStorage = (roomId: string, reason?: string, effectiveDate?: string, notes?: string) => {
    return updateRoom(roomId, {
      roomPurpose: 'storage',
      operationalStatus: 'storage',
      status: 'inactive',
      statusReason: reason || 'Converted to utility/storage room',
      statusEffectiveDate: effectiveDate || state.demoDate,
      statusNotes: notes,
    });
  };

  const reopenRoom = (roomId: string) => {
    return updateRoom(roomId, {
      roomPurpose: 'accommodation',
      operationalStatus: 'available',
      status: 'available',
      statusReason: 'Reopened for accommodation',
      statusEffectiveDate: state.demoDate,
    });
  };

  // Add a Bunk Bed (2 separate berths: Upper & Lower) to an existing room
  const addBunkBedToRoom = (roomId: string, config: { bunkGroup: string; upperRent: number; lowerRent: number }) => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const bunkGroup = config.bunkGroup.trim();
    if (room.beds.some((b) => b.bunkGroup === bunkGroup)) {
      return { success: false, error: `${bunkGroup} already exists in Room ${room.roomNumber}. Use a different label like "Bunk 2".` };
    }

    const lowerId = `Room ${room.roomNumber} - ${bunkGroup} - Lower`;
    const upperId = `Room ${room.roomNumber} - ${bunkGroup} - Upper`;

    const lowerBerth: Bed = {
      id: lowerId,
      roomId,
      label: `${bunkGroup} - Lower`,
      bedType: 'bunk',
      bunkGroup,
      tier: 'lower',
      monthlyRent: config.lowerRent,
      status: 'vacant',
    };

    const upperBerth: Bed = {
      id: upperId,
      roomId,
      label: `${bunkGroup} - Upper`,
      bedType: 'bunk',
      bunkGroup,
      tier: 'upper',
      monthlyRent: config.upperRent,
      status: 'vacant',
    };

    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== roomId) return r;
      const newBeds = [...r.beds, lowerBerth, upperBerth];
      return {
        ...r,
        beds: newBeds,
        sharingType: `${newBeds.length}-Sharing (${newBeds.length} Berths)`,
      };
    });

    setState((prev) => ({ ...prev, rooms: updatedRooms }));
    return { success: true };
  };

  // Remove a Bunk Bed while preventing removal if any berth is active
  const removeBunkBedFromRoom = (roomId: string, bunkGroup: string) => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const bunkBerths = room.beds.filter((b) => b.bunkGroup === bunkGroup);
    const occupiedBerth = bunkBerths.find((b) => b.status === 'occupied' || b.status === 'notice' || b.currentTenantId);

    if (occupiedBerth) {
      const tenant = state.tenants.find((t) => t.id === occupiedBerth.currentTenantId);
      return {
        success: false,
        error: `Cannot remove ${bunkGroup}: Berth "${occupiedBerth.label}" currently has an active tenant (${tenant?.name || 'Assigned'}). Please check out or reassign the tenant first.`,
      };
    }

    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== roomId) return r;
      const remainingBeds = r.beds.filter((b) => b.bunkGroup !== bunkGroup);
      return {
        ...r,
        beds: remainingBeds,
        sharingType: `${remainingBeds.length}-Sharing (${remainingBeds.length} Berths)`,
      };
    });

    setState((prev) => ({ ...prev, rooms: updatedRooms }));
    return { success: true };
  };

  // Add a Single Bed to an existing room
  const addSingleBedToRoom = (roomId: string, config: { label: string; monthlyRent: number }) => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const label = config.label.trim();
    const bedId = `Room ${room.roomNumber} - ${label}`;

    if (room.beds.some((b) => b.id === bedId || b.label === label)) {
      return { success: false, error: `Bed with label "${label}" already exists in Room ${room.roomNumber}.` };
    }

    const newBed: Bed = {
      id: bedId,
      roomId,
      label,
      bedType: 'single',
      tier: 'single',
      monthlyRent: config.monthlyRent,
      status: 'vacant',
    };

    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== roomId) return r;
      const newBeds = [...r.beds, newBed];
      return {
        ...r,
        beds: newBeds,
        sharingType: `${newBeds.length}-Sharing (${newBeds.length} Berths)`,
      };
    });

    setState((prev) => ({ ...prev, rooms: updatedRooms }));
    return { success: true };
  };

  // Delete an individual single bed or berth (blocking if occupied)
  const deleteBed = (roomId: string, bedId: string) => {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const bed = room.beds.find((b) => b.id === bedId);
    if (!bed) return { success: false, error: 'Berth not found.' };

    if (bed.status === 'occupied' || bed.status === 'notice' || bed.currentTenantId) {
      const tenant = state.tenants.find((t) => t.id === bed.currentTenantId);
      return {
        success: false,
        error: `Cannot delete ${bed.label} because it currently has an assigned tenant (${tenant?.name || 'Active'}). Please check out or reassign the tenant first.`,
      };
    }

    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== roomId) return r;
      const remainingBeds = r.beds.filter((b) => b.id !== bedId);
      return {
        ...r,
        beds: remainingBeds,
        sharingType: `${remainingBeds.length}-Sharing (${remainingBeds.length} Berths)`,
      };
    });

    setState((prev) => ({
      ...prev,
      rooms: updatedRooms,
    }));

    return { success: true };
  };

  // Update a berth's configured monthly rent
  const updateBerthRent = (roomId: string, bedId: string, monthlyRent: number) => {
    if (monthlyRent < 0) return { success: false, error: 'Rent cannot be negative.' };

    const room = state.rooms.find((r) => r.id === roomId);
    const bed = room?.beds.find((b) => b.id === bedId);
    if (bed && isCloudOwner && user?.id) {
      upsertCloudBed({ ...bed, monthlyRent }, state.property.id, user.id).catch((err) => {
        console.error('Failed to sync berth rent to Supabase:', err);
      });
    }

    const updatedRooms = state.rooms.map((r) => {
      if (r.id !== roomId) return r;
      return {
        ...r,
        beds: r.beds.map((b) => (b.id === bedId ? { ...b, monthlyRent } : b)),
      };
    });

    setState((prev) => ({ ...prev, rooms: updatedRooms }));
    return { success: true };
  };

  const setBedStatus = (bedId: string, status: BedStatus, maintenanceReason?: string) => {
    let error: string | undefined;

    const updatedRooms = state.rooms.map((r) => {
      return {
        ...r,
        beds: r.beds.map((b) => {
          if (b.id !== bedId) return b;
          if (b.currentTenantId && (status === 'vacant' || status === 'maintenance')) {
            error = 'Cannot change berth availability directly while a tenant is assigned. Check out or move tenant first.';
            return b;
          }
          return {
            ...b,
            status,
            maintenanceReason: status === 'maintenance' ? maintenanceReason : undefined,
          };
        }),
      };
    });

    if (error) {
      return { success: false, error };
    }

    setState((prev) => ({
      ...prev,
      rooms: updatedRooms,
    }));

    return { success: true };
  };

  // Expenses
  const addExpense = (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExp: Expense = {
      ...expense,
      id: `exp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    if (isCloudOwner && user?.id) {
      upsertCloudExpense(newExp, state.property.id, user.id).catch((err) => {
        console.error('Failed to sync expense to Supabase:', err);
      });
    }
    setState((prev) => ({
      ...prev,
      expenses: [newExp, ...prev.expenses],
    }));
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
  };

  const deleteExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };

  // Maintenance Tickets
  const addMaintenanceTicket = (ticket: Omit<MaintenanceTicket, 'id' | 'ticketNumber'>) => {
    const ticketSeq = (state.maintenanceTickets.length + 101).toString();
    const newTicket: MaintenanceTicket = {
      ...ticket,
      id: `tkt-${Date.now()}`,
      ticketNumber: `TKT-${ticketSeq}`,
    };

    if (isCloudOwner && user?.id) {
      upsertCloudMaintenanceTicket(newTicket, state.property.id, user.id).catch((err) => {
        console.error('Failed to sync maintenance ticket to Supabase:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      maintenanceTickets: [newTicket, ...prev.maintenanceTickets],
    }));
  };

  const updateMaintenanceTicket = (id: string, updates: Partial<MaintenanceTicket>) => {
    const target = state.maintenanceTickets.find((t) => t.id === id);
    if (target && isCloudOwner && user?.id) {
      upsertCloudMaintenanceTicket({ ...target, ...updates }, state.property.id, user.id).catch((err) => {
        console.error('Failed to update maintenance ticket in Supabase:', err);
      });
    }

    setState((prev) => ({
      ...prev,
      maintenanceTickets: prev.maintenanceTickets.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const convertTicketToExpense = (ticketId: string, amount: number, paymentMode: Expense['paymentMode'], notes?: string) => {
    const ticket = state.maintenanceTickets.find((t) => t.id === ticketId);
    if (!ticket) return { success: false, error: 'Maintenance ticket not found.' };

    if (ticket.linkedExpenseId) {
      return { success: false, error: 'An expense has already been recorded for this ticket.' };
    }

    const expenseId = `exp-${Date.now()}`;
    const newExpense: Expense = {
      id: expenseId,
      title: `Maintenance: ${ticket.title} (${ticket.ticketNumber})`,
      category: 'Maintenance',
      amount,
      paymentDate: state.demoDate,
      paymentMode,
      notes: notes || `Resolved ticket: ${ticket.description}`,
      linkedMaintenanceTicketId: ticketId,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      expenses: [newExpense, ...prev.expenses],
      maintenanceTickets: prev.maintenanceTickets.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              status: 'resolved',
              resolvedDate: state.demoDate,
              linkedExpenseId: expenseId,
            }
          : t
      ),
    }));

    return { success: true };
  };

  const updateAmenity = (id: string, updates: Partial<BuildingAmenity>) => {
    setState((prev) => ({
      ...prev,
      amenities: prev.amenities.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  };

  const logWhatsAppActivity = (tenantId: string, action: 'prepared' | 'opened', message: string, phone: string) => {
    const logItem = {
      id: `wa-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action,
      phone,
      message,
    };

    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId
          ? {
              ...t,
              whatsappLogs: [logItem, ...(t.whatsappLogs || [])],
            }
          : t
      ),
    }));
  };

  // Reset & Backup
  const resetData = () => {
    const fresh = resetAppState(currentOwnerId);
    setState(fresh);
  };

  const exportData = () => {
    exportAppStateJSON(state);
  };

  const importData = (imported: AppState) => {
    if (!imported || typeof imported !== 'object' || !Array.isArray(imported.rooms)) {
      return { success: false, error: 'Invalid backup format. Import aborted.' };
    }
    setState(imported);
    return { success: true };
  };

  return (
    <DataContext.Provider
      value={{
        state,
        properties,
        activePropertyId,
        storageMode,
        cloudSyncStatus,
        cloudError,
        clearCloudError,
        syncWithCloud,
        setSelectedMonth,
        updateProperty,
        setActiveBuilding,
        addBuilding,
        updateBuilding,
        archiveBuilding,
        addFloor,
        updateFloor,
        deleteFloor,
        allocateTenant,
        updateTenant,
        updateTenantPricing,
        giveNotice,
        checkoutTenant,
        moveTenantBed,
        addTenantDocument,
        updateDocumentVerification,
        replaceTenantDocument,
        deleteTenantDocument,
        getSecureDocumentAccess,
        getSecureDocumentAccessAsync,
        recordPayment,
        generateMonthlyCharges,
        addRoom,
        bulkGenerateRooms,
        updateRoom,
        deleteRoom,
        retireRoom,
        closeRoom,
        convertToStorage,
        reopenRoom,
        getBuildingMetrics,
        addBunkBedToRoom,
        removeBunkBedFromRoom,
        addSingleBedToRoom,
        deleteBed,
        updateBerthRent,
        setBedStatus,
        addExpense,
        updateExpense,
        deleteExpense,
        addMaintenanceTicket,
        updateMaintenanceTicket,
        convertTicketToExpense,
        updateAmenity,
        logWhatsAppActivity,
        resetData,
        exportData,
        importData,
        metrics,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
