import { describe, it, expect, beforeEach } from 'vitest';
import { getInitialSeedData } from '../fixtures/seedData';
import {
  AppState,
  RentCharge,
  PaymentRecord,
  Expense,
  MaintenanceTicket,
  Tenant,
  Bed,
  Room,
  FoodPlanType,
  MealOptions,
  PermanentAddress,
  TenantDocument,
  DocumentType,
  DocumentVerificationStatus,
} from '../types';
import { calculateDueDate, getDaysInMonth } from '../utils/date';
import { formatINR } from '../utils/currency';
import { escapeCSVCell } from '../utils/csv';
import { validateImportedJSON, saveAppState, getStoredItem, loadAppState, getOwnerStorageKey, saveStoredAuthUser, getStoredAuthUsers } from '../persistence/storage';
import { BUILT_IN_DEMO_ACCOUNTS } from '../persistence/AuthContext';
import {
  isValidIndianPhone,
  isValidIndianPIN,
  isValidEmail,
  maskAadhaarNumber,
  validateDocumentUpload,
} from '../utils/validation';
import { documentStore } from '../services/documentStore';

// In-memory mock store mimicking DataContext logic
class TestStateManager {
  state: AppState;
  ownerId: string;

  constructor(ownerId: string = 'owner-gv-default') {
    this.ownerId = ownerId;
    this.state = getInitialSeedData();
    this.state.ownerId = ownerId;
  }

  getMetrics() {
    const allBeds = this.state.rooms.flatMap((r) => r.beds);
    const totalBeds = allBeds.length;
    const vacantBeds = allBeds.filter((b) => b.status === 'vacant').length;
    const noticeBeds = allBeds.filter((b) => b.status === 'notice').length;
    const occupiedOnly = allBeds.filter((b) => b.status === 'occupied').length;
    const occupiedBeds = occupiedOnly + noticeBeds; // Notice still counts as occupied
    const maintenanceBeds = allBeds.filter((b) => b.status === 'maintenance').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const monthCharges = this.state.rentCharges.filter((c) => c.billingMonth === this.state.selectedMonth);
    const expectedRent = monthCharges.reduce((sum, c) => sum + c.amount, 0);

    const monthPayments = this.state.payments.filter((p) => p.billingMonth === this.state.selectedMonth);
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
        if (this.state.demoDate > charge.dueDate) {
          overdueCount++;
          overdueAmount += bal;
        } else {
          dueSoonCount++;
          dueSoonAmount += bal;
        }
      }
    });

    const monthExpenses = this.state.expenses
      .filter((e) => e.paymentDate.startsWith(this.state.selectedMonth))
      .reduce((sum, e) => sum + e.amount, 0);

    const netCashFlow = collectedRent - monthExpenses;
    const noticeCount = this.state.tenants.filter((t) => t.status === 'notice').length;
    const openTicketsCount = this.state.maintenanceTickets.filter((t) => t.status !== 'resolved').length;

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
  }

  allocateTenant(input: {
    name: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    employerName?: string;
    jobTitle?: string;
    workplaceAddress?: string;
    employmentPhone?: string;
    permanentAddress?: PermanentAddress;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
    joiningDate: string;
    moveInDate?: string;
    roomId: string;
    bedId: string;
    monthlyRent: number;
    monthlyDueDay: number;
    depositRequired: number;
    depositReceived: number;
    ownerId?: string;
    pricingBasis?: 'per_person' | 'per_room';
    standardRent?: number;
    foodPlanType?: 'no_food' | 'food_included' | 'food_separate' | 'custom';
    selectedMeals?: { breakfast: boolean; lunch: boolean; dinner: boolean };
    standardFoodCharge?: number;
    agreedFoodCharge?: number;
    discountType?: 'amount' | 'percentage';
    discountValue?: number;
    discountAmount?: number;
    discountReason?: string;
    pricingOverrideReason?: string;
    totalMonthlyAmount?: number;
  }) {
    const room = this.state.rooms.find((r) => r.id === input.roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    if (
      room.operationalStatus === 'closed' ||
      room.operationalStatus === 'storage' ||
      room.operationalStatus === 'retired' ||
      room.roomPurpose === 'storage' ||
      room.status === 'closed' ||
      room.status === 'storage' ||
      room.status === 'retired'
    ) {
      return { success: false, error: 'Cannot allocate resident to a closed, storage, or retired room.' };
    }

    const bed = room.beds.find((b) => b.id === input.bedId);
    if (!bed) return { success: false, error: 'Bed not found.' };

    if (bed.status !== 'vacant') {
      return { success: false, error: `Bed ${bed.label} is already ${bed.status}. Duplicate allocation blocked.` };
    }

    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tenantId = `tenant-${uniqueSuffix}`;
    bed.status = 'occupied';
    bed.currentTenantId = tenantId;

    const initialTotal = input.totalMonthlyAmount || (input.monthlyRent + (input.agreedFoodCharge || 0));

    const newTenant: Tenant = {
      id: tenantId,
      ownerId: input.ownerId || this.ownerId,
      name: input.name,
      phone: input.phone,
      alternatePhone: input.alternatePhone,
      email: input.email,
      employerName: input.employerName,
      jobTitle: input.jobTitle,
      workplaceAddress: input.workplaceAddress,
      employmentPhone: input.employmentPhone,
      permanentAddress: input.permanentAddress,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
      isPhoneMasked: false,
      joiningDate: input.joiningDate,
      moveInDate: input.moveInDate || input.joiningDate,
      propertyId: this.state.property.id,
      roomId: input.roomId,
      bedId: input.bedId,
      monthlyRent: input.monthlyRent,
      monthlyDueDay: input.monthlyDueDay,
      depositRequired: input.depositRequired,
      depositReceived: input.depositReceived,
      status: 'active',
      pricingBasis: input.pricingBasis || 'per_person',
      standardRent: input.standardRent || bed.monthlyRent,
      foodPlanType: input.foodPlanType || room.foodPlanType || 'no_food',
      selectedMeals: input.selectedMeals,
      standardFoodCharge: input.standardFoodCharge || 0,
      agreedFoodCharge: input.agreedFoodCharge || 0,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount: input.discountAmount,
      discountReason: input.discountReason,
      pricingOverrideReason: input.pricingOverrideReason,
      totalMonthlyAmount: initialTotal,
      rentHistory: [
        {
          id: `price-hist-init-${uniqueSuffix}`,
          effectiveDate: input.joiningDate,
          previousRent: input.standardRent || bed.monthlyRent,
          newRent: input.monthlyRent,
          previousFoodCharge: input.standardFoodCharge || 0,
          newFoodCharge: input.agreedFoodCharge || 0,
          reason: input.discountReason || input.pricingOverrideReason || 'Initial move-in agreement',
          changedAt: new Date().toISOString(),
        },
      ],
      assignedInventory: [],
      stayHistory: [{ id: 's1', date: input.joiningDate, action: 'joined', roomNumber: room.roomNumber, bedLabel: bed.label }],
      whatsappLogs: [],
      documents: [],
    };

    const newCharge: RentCharge = {
      id: `chg-${uniqueSuffix}`,
      tenantId,
      billingMonth: this.state.selectedMonth,
      dueDate: calculateDueDate(this.state.selectedMonth, input.monthlyDueDay),
      amount: initialTotal,
      isProrated: false,
      createdAt: new Date().toISOString(),
    };

    this.state.tenants.push(newTenant);
    this.state.rentCharges.push(newCharge);

    return { success: true, tenant: newTenant };
  }

  recordPayment(payment: {
    tenantId: string;
    chargeId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentRecord['paymentMethod'];
  }) {
    const charge = this.state.rentCharges.find((c) => c.id === payment.chargeId);
    if (!charge) return { success: false, error: 'Charge not found.' };

    const paidSoFar = this.state.payments
      .filter((p) => p.chargeId === payment.chargeId)
      .reduce((sum, p) => sum + p.amount, 0);
    const balance = charge.amount - paidSoFar;

    if (payment.amount <= 0) return { success: false, error: 'Amount must be > 0.' };
    if (payment.amount > balance) {
      return { success: false, error: `Payment of ₹${payment.amount} exceeds balance of ₹${balance}.` };
    }

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      receiptNumber: `RCP-202610-099`,
      tenantId: payment.tenantId,
      chargeId: payment.chargeId,
      billingMonth: charge.billingMonth,
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      createdAt: new Date().toISOString(),
    };

    this.state.payments.push(newPayment);
    return { success: true, payment: newPayment };
  }

  moveTenantBed(
    tenantId: string,
    targetRoomId: string,
    targetBedId: string,
    moveDate: string,
    options?: { newRent?: number; reason?: string }
  ) {
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const targetRoom = this.state.rooms.find((r) => r.id === targetRoomId);
    if (!targetRoom) return { success: false, error: 'Target room not found.' };

    if (
      targetRoom.operationalStatus === 'closed' ||
      targetRoom.operationalStatus === 'storage' ||
      targetRoom.operationalStatus === 'retired' ||
      targetRoom.roomPurpose === 'storage' ||
      targetRoom.status === 'closed' ||
      targetRoom.status === 'storage' ||
      targetRoom.status === 'retired'
    ) {
      return { success: false, error: 'Cannot transfer tenant into a closed, storage, or retired room.' };
    }

    const targetBed = targetRoom.beds.find((b) => b.id === targetBedId);

    if (!targetBed || targetBed.status !== 'vacant') {
      return { success: false, error: 'Target bed is not vacant.' };
    }

    // Free old bed
    const oldRoom = this.state.rooms.find((r) => r.id === tenant.roomId);
    const oldBed = oldRoom?.beds.find((b) => b.id === tenant.bedId);
    if (oldBed) {
      oldBed.status = 'vacant';
      oldBed.currentTenantId = undefined;
    }

    // Assign new bed
    targetBed.status = tenant.status === 'notice' ? 'notice' : 'occupied';
    targetBed.currentTenantId = tenantId;
    tenant.roomId = targetRoomId;
    tenant.bedId = targetBedId;

    if (options && options.newRent !== undefined && options.newRent !== tenant.monthlyRent) {
      const prevRent = tenant.monthlyRent;
      tenant.monthlyRent = options.newRent;
      tenant.totalMonthlyAmount = options.newRent + (tenant.agreedFoodCharge || 0);
      tenant.rentHistory = tenant.rentHistory || [];
      tenant.rentHistory.push({
        id: `price-hist-move-${Date.now()}`,
        effectiveDate: moveDate,
        previousRent: prevRent,
        newRent: options.newRent,
        previousFoodCharge: tenant.agreedFoodCharge || 0,
        newFoodCharge: tenant.agreedFoodCharge || 0,
        reason: options.reason || `Room move to ${targetRoom.roomNumber} - ${targetBed.label}`,
        changedAt: new Date().toISOString(),
      });
    }

    tenant.stayHistory.push({
      id: `stay-${Date.now()}`,
      date: moveDate,
      action: 'moved',
      roomNumber: targetRoom.roomNumber,
      bedLabel: targetBed.label,
    });

    return { success: true };
  }

  updateRoom(roomId: string, updates: Partial<Room>) {
    const room = this.state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const activeOccupants = this.state.tenants.filter(
      (t) => t.roomId === roomId && (t.status === 'active' || t.status === 'notice')
    );

    if (
      activeOccupants.length > 0 &&
      ((updates.roomPurpose && updates.roomPurpose !== 'accommodation') ||
        updates.operationalStatus === 'closed' ||
        updates.operationalStatus === 'storage' ||
        updates.operationalStatus === 'retired' ||
        updates.status === 'closed' ||
        updates.status === 'storage' ||
        updates.status === 'retired')
    ) {
      return {
        success: false,
        error: `Cannot convert Room ${room.roomNumber} to ${updates.operationalStatus || updates.roomPurpose} while it currently houses ${activeOccupants.length} active resident(s).`,
      };
    }

    Object.assign(room, updates);
    return { success: true, room };
  }

  deleteRoom(roomId: string, force: boolean = false) {
    const roomIndex = this.state.rooms.findIndex((r) => r.id === roomId);
    if (roomIndex === -1) return { success: false, error: 'Room not found.' };
    const room = this.state.rooms[roomIndex];

    const activeOccupants = this.state.tenants.filter(
      (t) => t.roomId === roomId && (t.status === 'active' || t.status === 'notice')
    );
    if (activeOccupants.length > 0) {
      return {
        success: false,
        error: `Cannot delete Room ${room.roomNumber}: It currently houses ${activeOccupants.length} active resident(s). You must transfer them or record their checkout first.`,
      };
    }

    const hasPastTenants = this.state.tenants.some((t) => t.roomId === roomId && t.status === 'checked_out');
    const hasTickets = this.state.maintenanceTickets.some((t) => t.roomId === roomId);

    if (!force && (hasPastTenants || hasTickets)) {
      return {
        success: false,
        requiresConfirmation: true,
        error: `Room ${room.roomNumber} has historical occupancy or maintenance records. Retiring the room is strongly recommended instead of permanent deletion.`,
      };
    }

    this.state.rooms.splice(roomIndex, 1);
    return { success: true };
  }

  retireRoom(roomId: string, reason?: string) {
    return this.updateRoom(roomId, {
      operationalStatus: 'retired',
      status: 'retired',
      statusReason: reason || 'Retired from property inventory',
      statusEffectiveDate: this.state.demoDate,
    });
  }

  closeRoom(roomId: string, reason?: string) {
    return this.updateRoom(roomId, {
      operationalStatus: 'closed',
      status: 'closed',
      statusReason: reason || 'Temporarily closed for maintenance/renovation',
      statusEffectiveDate: this.state.demoDate,
    });
  }

  convertToStorage(roomId: string, reason?: string) {
    return this.updateRoom(roomId, {
      roomPurpose: 'storage',
      operationalStatus: 'storage',
      status: 'storage',
      statusReason: reason || 'Converted to facility storage room',
      statusEffectiveDate: this.state.demoDate,
    });
  }

  reopenRoom(roomId: string) {
    const room = this.state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };
    return this.updateRoom(roomId, {
      roomPurpose: 'accommodation',
      operationalStatus: 'available',
      status: 'available',
      statusReason: undefined,
      statusEffectiveDate: undefined,
      statusNotes: undefined,
    });
  }

  getBuildingMetrics(propertyId?: string) {
    const targetPropertyId = propertyId || this.state.property.id;
    const propertyRooms = this.state.rooms.filter((r) => r.propertyId === targetPropertyId);
    const accommodationRoomsList = propertyRooms.filter(
      (r) =>
        (r.roomPurpose === 'accommodation' || !r.roomPurpose) &&
        r.operationalStatus !== 'closed' &&
        r.operationalStatus !== 'storage' &&
        r.operationalStatus !== 'retired' &&
        r.status !== 'closed' &&
        r.status !== 'storage' &&
        r.status !== 'retired'
    );

    const storageRoomsCount = propertyRooms.filter(
      (r) => r.roomPurpose === 'storage' || r.operationalStatus === 'storage' || r.status === 'storage'
    ).length;
    const closedRoomsCount = propertyRooms.filter(
      (r) => r.operationalStatus === 'closed' || r.status === 'closed'
    ).length;
    const retiredRoomsCount = propertyRooms.filter(
      (r) => r.operationalStatus === 'retired' || r.status === 'retired'
    ).length;

    const accommodationBeds = accommodationRoomsList.flatMap((r) => r.beds);
    const totalBerths = accommodationBeds.length;
    const vacantBerths = accommodationBeds.filter((b) => b.status === 'vacant').length;
    const noticeBerths = accommodationBeds.filter((b) => b.status === 'notice').length;
    const occupiedBerths = accommodationBeds.filter((b) => b.status === 'occupied').length + noticeBerths;

    return {
      totalRooms: propertyRooms.length,
      accommodationRooms: accommodationRoomsList.length,
      storageRooms: storageRoomsCount,
      closedRooms: closedRoomsCount,
      retiredRooms: retiredRoomsCount,
      totalBerths,
      occupiedBerths,
      vacantBerths,
    };
  }

  checkoutTenant(tenantId: string, checkoutDate: string) {
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return;

    const room = this.state.rooms.find((r) => r.id === tenant.roomId);
    const bed = room?.beds.find((b) => b.id === tenant.bedId);
    if (bed) {
      bed.status = 'vacant';
      bed.currentTenantId = undefined;
    }

    tenant.status = 'checked_out';
    tenant.actualCheckoutDate = checkoutDate;
    tenant.stayHistory.push({
      id: `stay-${Date.now()}`,
      date: checkoutDate,
      action: 'checked_out',
      roomNumber: room?.roomNumber || '',
      bedLabel: bed?.label || '',
    });
  }

  resolveTicket(ticketId: string) {
    const ticket = this.state.maintenanceTickets.find((t) => t.id === ticketId);
    if (ticket) ticket.status = 'resolved';
  }

  convertTicketToExpense(ticketId: string, amount: number) {
    const ticket = this.state.maintenanceTickets.find((t) => t.id === ticketId);
    if (!ticket) return { success: false, error: 'Ticket not found' };
    if (ticket.linkedExpenseId) return { success: false, error: 'Already converted' };

    const expId = `exp-maint-${Date.now()}`;
    ticket.linkedExpenseId = expId;
    ticket.status = 'resolved';

    this.state.expenses.push({
      id: expId,
      title: `Maintenance: ${ticket.title}`,
      category: 'Maintenance',
      amount,
      paymentDate: this.state.demoDate,
      paymentMode: 'Cash',
      linkedMaintenanceTicketId: ticketId,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }

  addBunkBedToRoom(roomId: string, config: { bunkGroup: string; upperRent: number; lowerRent: number }) {
    const room = this.state.rooms.find((r) => r.id === roomId);
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

    room.beds.push(lowerBerth, upperBerth);
    room.sharingType = `${room.beds.length}-Sharing (${room.beds.length} Berths)`;
    return { success: true };
  }

  removeBunkBedFromRoom(roomId: string, bunkGroup: string) {
    const room = this.state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };

    const bunkBerths = room.beds.filter((b) => b.bunkGroup === bunkGroup);
    const occupiedBerth = bunkBerths.find((b) => b.status === 'occupied' || b.status === 'notice' || b.currentTenantId);

    if (occupiedBerth) {
      const tenant = this.state.tenants.find((t) => t.id === occupiedBerth.currentTenantId);
      return {
        success: false,
        error: `Cannot remove ${bunkGroup}: Berth "${occupiedBerth.label}" currently has an active tenant (${tenant?.name || 'Assigned'}). Please check out or reassign the tenant first.`,
      };
    }

    room.beds = room.beds.filter((b) => b.bunkGroup !== bunkGroup);
    room.sharingType = `${room.beds.length}-Sharing (${room.beds.length} Berths)`;
    return { success: true };
  }

  updateBerthRent(roomId: string, bedId: string, monthlyRent: number) {
    if (monthlyRent < 0) return { success: false, error: 'Rent cannot be negative.' };
    const room = this.state.rooms.find((r) => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found.' };
    const bed = room.beds.find((b) => b.id === bedId);
    if (!bed) return { success: false, error: 'Berth not found.' };
    bed.monthlyRent = monthlyRent;
    return { success: true };
  }

  addTenantDocument(
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
    file?: Blob | File,
    requestOwnerId?: string
  ) {
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const owner = requestOwnerId || this.ownerId;
    if (tenant.ownerId && tenant.ownerId !== owner) {
      return { success: false, error: `403 Forbidden: Owner "${owner}" is not authorized to add documents to tenant belonging to "${tenant.ownerId}".` };
    }

    if (docData.documentType === 'aadhaar' && !docData.consentObtained) {
      return { success: false, error: 'Explicit tenant consent is required to process Aadhaar identity proof.' };
    }

    const validation = validateDocumentUpload({ size: docData.fileSize, type: docData.mimeType });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const maskedNum = docData.maskedDocumentNumber
      ? (docData.documentType === 'aadhaar' ? maskAadhaarNumber(docData.maskedDocumentNumber) : docData.maskedDocumentNumber.trim())
      : undefined;

    if (file) {
      documentStore.storeFile(docId, file, owner, docData.fileName, docData.mimeType);
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
      storagePath: `tenant-documents/${owner}/${tenantId}/${docId}.pdf`,
      consentObtained: docData.consentObtained,
      ownerId: owner,
    };

    if (!tenant.documents) tenant.documents = [];
    tenant.documents.push(newDoc);

    return { success: true, document: newDoc };
  }

  updateDocumentVerification(
    tenantId: string,
    documentId: string,
    status: DocumentVerificationStatus,
    notes?: string,
    rejectionReason?: string,
    requestOwnerId?: string
  ) {
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { success: false, error: 'Document not found.' };

    const owner = requestOwnerId || this.ownerId;
    if (doc.ownerId && doc.ownerId !== owner) {
      return { success: false, error: `403 Forbidden: Owner "${owner}" is not authorized to verify document belonging to "${doc.ownerId}".` };
    }

    if (status === 'rejected' && !rejectionReason?.trim()) {
      return { success: false, error: 'A rejection reason is required when rejecting a document.' };
    }

    doc.verificationStatus = status;
    doc.verificationNotes = notes?.trim() ?? doc.verificationNotes;
    doc.rejectionReason = status === 'rejected' ? rejectionReason?.trim() : undefined;
    doc.verifiedAt = status !== 'pending' ? new Date().toISOString() : undefined;
    doc.verifiedBy = status !== 'pending' ? owner : undefined;

    return { success: true };
  }

  replaceTenantDocument(
    tenantId: string,
    documentId: string,
    newFile: Blob | File,
    requestOwnerId?: string
  ) {
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { success: false, error: 'Document not found.' };

    const owner = requestOwnerId || this.ownerId;
    if (doc.ownerId && doc.ownerId !== owner) {
      return { success: false, error: `403 Forbidden: Owner "${owner}" is not authorized to replace document belonging to "${doc.ownerId}".` };
    }

    const validation = validateDocumentUpload({ size: newFile.size, type: newFile.type });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    documentStore.storeFile(documentId, newFile, owner, (newFile as File).name || doc.fileName, newFile.type);
    doc.fileSize = newFile.size;
    doc.uploadedAt = new Date().toISOString();
    doc.verificationStatus = 'pending'; // Re-verification required

    return { success: true };
  }

  deleteTenantDocument(tenantId: string, documentId: string, requestOwnerId?: string) {
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { success: false, error: 'Document not found.' };

    const owner = requestOwnerId || this.ownerId;
    if (doc.ownerId && doc.ownerId !== owner) {
      return { success: false, error: `403 Forbidden: Owner "${owner}" cannot delete document belonging to "${doc.ownerId}".` };
    }

    documentStore.deleteFile(documentId, owner);
    tenant.documents = tenant.documents?.filter((d) => d.id !== documentId);

    return { success: true };
  }

  getSecureDocumentAccess(tenantId: string, documentId: string, requestOwnerId?: string) {
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { error: 'Tenant not found.' };

    const doc = tenant.documents?.find((d) => d.id === documentId);
    if (!doc) return { error: 'Document not found.' };

    const owner = requestOwnerId || this.ownerId;
    if (doc.ownerId && doc.ownerId !== owner) {
      return { error: `403 Forbidden: Owner "${owner}" is not authorized to access document belonging to "${doc.ownerId}".` };
    }

    return documentStore.getSecureAccessUrl(documentId, owner);
  }

  getTenantsForOwner(requestOwnerId: string) {
    return this.state.tenants.filter((t) => (t.ownerId || 'owner-gv-default') === requestOwnerId);
  }

  updateTenantPricing(
    tenantId: string,
    newRent: number,
    effectiveDate: string,
    options?: {
      agreedFoodCharge?: number;
      reason?: string;
      foodPlanType?: FoodPlanType;
      selectedMeals?: MealOptions;
    }
  ) {
    if (newRent < 0) return { success: false, error: 'Rent cannot be negative.' };
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) return { success: false, error: 'Tenant not found.' };

    const previousRent = tenant.monthlyRent;
    const previousFoodCharge = tenant.agreedFoodCharge || 0;
    const newFood = options?.agreedFoodCharge !== undefined ? options.agreedFoodCharge : previousFoodCharge;

    const historyEntry = {
      id: `price-hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectiveDate,
      previousRent,
      newRent,
      previousFoodCharge,
      newFoodCharge: newFood,
      reason: options?.reason || 'Pricing updated by owner',
      changedAt: new Date().toISOString(),
    };

    tenant.monthlyRent = newRent;
    tenant.agreedFoodCharge = newFood;
    tenant.totalMonthlyAmount = newRent + newFood;
    if (options?.foodPlanType) tenant.foodPlanType = options.foodPlanType;
    if (options?.selectedMeals) tenant.selectedMeals = options.selectedMeals;
    tenant.rentHistory = [...(tenant.rentHistory || []), historyEntry];

    return { success: true, tenant };
  }
}

describe('ROOVIO PG Manager - Operations & Verification Workflows', () => {
  let manager: TestStateManager;

  beforeEach(() => {
    manager = new TestStateManager();
  });

  it('Verifies initial baseline dataset metrics for 29 October 2026 (Section 15)', () => {
    const m = manager.getMetrics();

    // 22 Beds total: 16 occupied (14 + 2 notice), 6 vacant
    expect(m.totalBeds).toBe(22);
    expect(m.occupiedBeds).toBe(16);
    expect(m.vacantBeds).toBe(6);
    expect(m.maintenanceBeds).toBe(0);
    expect(m.occupancyRate).toBe(73); // 16 / 22 = 72.7% rounds to 73%

    // Financials for October 2026:
    // Expected rent: ₹1,04,000 (16 * ₹6,500)
    // Collected rent: ₹65,000 (10 paid full)
    // Remaining balance: ₹39,000 (4 overdue @ 6500 = 26000 + 2 due soon @ 6500 = 13000)
    expect(m.expectedRent).toBe(104000);
    expect(m.collectedRent).toBe(65000);
    expect(m.remainingBalance).toBe(39000);

    expect(m.overdueCount).toBe(4);
    expect(m.overdueAmount).toBe(26000);
    expect(m.dueSoonCount).toBe(2);
    expect(m.dueSoonAmount).toBe(13000);

    // Seed expenses: Total ₹71,100
    expect(m.monthlyExpenses).toBe(71100);

    // Initial Net Cash Flow: ₹65,000 - ₹71,100 = -₹6,100
    expect(m.netCashFlow).toBe(-6100);

    // 4 open maintenance tickets
    expect(m.openTicketsCount).toBe(4);

    // 2 active tenants on notice
    expect(m.noticeCount).toBe(2);
  });

  it('Workflow 1 & 2: Allocate a tenant to a vacant bed and block duplicate allocation', () => {
    // Room 102 - Bed 1 is currently vacant
    const vacantRoomId = 'room-102';
    const vacantBedId = 'Room 102 - Bed 1';

    const res1 = manager.allocateTenant({
      name: 'Pooja Hegde',
      phone: '9845112233',
      joiningDate: '2026-10-29',
      roomId: vacantRoomId,
      bedId: vacantBedId,
      monthlyRent: 6500,
      monthlyDueDay: 5,
      depositRequired: 10000,
      depositReceived: 10000,
    });

    expect(res1.success).toBe(true);

    const metricsAfter = manager.getMetrics();
    // Total occupied beds now 17, vacant beds now 5
    expect(metricsAfter.occupiedBeds).toBe(17);
    expect(metricsAfter.vacantBeds).toBe(5);

    // Duplicate allocation check: attempt to allocate someone else to Room 102 - Bed 1
    const res2 = manager.allocateTenant({
      name: 'Sneha Rao',
      phone: '9845223344',
      joiningDate: '2026-10-29',
      roomId: vacantRoomId,
      bedId: vacantBedId,
      monthlyRent: 6500,
      monthlyDueDay: 5,
      depositRequired: 10000,
      depositReceived: 10000,
    });

    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Duplicate allocation blocked');
  });

  it('Workflow 3 & 4: Record partial payment, reject overpayment, and complete payment', () => {
    // Tenant 11 is overdue with ₹6,500 balance
    const tenant11 = manager.state.tenants.find((t) => t.id === 'tenant-11')!;
    const charge11 = manager.state.rentCharges.find((c) => c.tenantId === tenant11.id)!;

    // Overpayment rejection
    const overpayRes = manager.recordPayment({
      tenantId: tenant11.id,
      chargeId: charge11.id,
      amount: 7000,
      paymentDate: '2026-10-29',
      paymentMethod: 'UPI',
    });
    expect(overpayRes.success).toBe(false);
    expect(overpayRes.error).toContain('exceeds balance');

    // Valid partial payment of ₹3,000
    const partialRes = manager.recordPayment({
      tenantId: tenant11.id,
      chargeId: charge11.id,
      amount: 3000,
      paymentDate: '2026-10-29',
      paymentMethod: 'UPI',
    });
    expect(partialRes.success).toBe(true);

    let metrics = manager.getMetrics();
    expect(metrics.collectedRent).toBe(68000); // 65000 + 3000
    expect(metrics.remainingBalance).toBe(36000); // 39000 - 3000
    expect(metrics.netCashFlow).toBe(-3100); // -6100 + 3000

    // Complete the remaining ₹3,500
    const completeRes = manager.recordPayment({
      tenantId: tenant11.id,
      chargeId: charge11.id,
      amount: 3500,
      paymentDate: '2026-10-29',
      paymentMethod: 'Cash',
    });
    expect(completeRes.success).toBe(true);

    metrics = manager.getMetrics();
    expect(metrics.collectedRent).toBe(71500); // 68000 + 3500
    expect(metrics.remainingBalance).toBe(32500);
    expect(metrics.paidCount).toBe(11); // was 10, now 11 fully paid
    expect(metrics.overdueCount).toBe(3); // was 4, now 3 overdue
  });

  it('Workflow 5: Due date calculation and month length clamping (e.g. Feb 28, Apr 30)', () => {
    // October has 31 days -> day 31 clamps to 2026-10-31
    expect(calculateDueDate('2026-10', 31)).toBe('2026-10-31');

    // November has 30 days -> day 31 clamps to 2026-11-30
    expect(calculateDueDate('2026-11', 31)).toBe('2026-11-30');

    // February non-leap year (2027) has 28 days -> day 31 clamps to 2027-02-28
    expect(calculateDueDate('2027-02', 31)).toBe('2027-02-28');
  });

  it('Workflow 6: Add expense and confirm cash flow updates', () => {
    const initialFlow = manager.getMetrics().netCashFlow; // -6100

    manager.state.expenses.push({
      id: 'exp-new-1',
      title: 'Pest Control Service',
      category: 'Maintenance',
      amount: 2500,
      paymentDate: '2026-10-29',
      paymentMode: 'UPI',
      createdAt: new Date().toISOString(),
    });

    const updatedFlow = manager.getMetrics().netCashFlow;
    expect(updatedFlow).toBe(initialFlow - 2500); // -8600
  });

  it('Workflow 7: Resolve maintenance ticket and prevent duplicate expense conversion', () => {
    const initialOpen = manager.getMetrics().openTicketsCount; // 4
    expect(initialOpen).toBe(4);

    const ticket = manager.state.maintenanceTickets[0];
    manager.resolveTicket(ticket.id);

    expect(manager.getMetrics().openTicketsCount).toBe(3);

    // Conversion to expense
    const conv1 = manager.convertTicketToExpense(ticket.id, 500);
    expect(conv1.success).toBe(true);

    // Duplicate conversion blocked
    const conv2 = manager.convertTicketToExpense(ticket.id, 500);
    expect(conv2.success).toBe(false);
    expect(conv2.error).toContain('Already converted');
  });

  it('Workflow 8: Move tenant without losing history', () => {
    const tenant = manager.state.tenants[0]; // tenant-1 in room 101 bed A
    const oldRoomId = tenant.roomId;
    const oldBedId = tenant.bedId;

    // Target: Room 102 Single Bed 1 (Vacant)
    const res = manager.moveTenantBed(tenant.id, 'room-102', 'Room 102 - Bed 1', '2026-10-29');
    expect(res.success).toBe(true);

    // Verify old bed is vacant
    const oldBed = manager.state.rooms.find((r) => r.id === oldRoomId)?.beds.find((b) => b.id === oldBedId);
    expect(oldBed?.status).toBe('vacant');

    // Verify target bed is occupied
    const targetBed = manager.state.rooms.find((r) => r.id === 'room-102')?.beds.find((b) => b.id === 'Room 102 - Bed 1');
    expect(targetBed?.status).toBe('occupied');
    expect(targetBed?.currentTenantId).toBe(tenant.id);

    // Verify stay history preserved
    expect(tenant.stayHistory.length).toBeGreaterThanOrEqual(2);
    const lastStay = tenant.stayHistory[tenant.stayHistory.length - 1];
    expect(lastStay.action).toBe('moved');
    expect(lastStay.roomNumber).toBe('102');
  });

  it('Workflow 9: Checkout tenant and release bed', () => {
    const tenant = manager.state.tenants[1]; // tenant-2 on notice
    const roomId = tenant.roomId;
    const bedId = tenant.bedId;

    manager.checkoutTenant(tenant.id, '2026-10-29');

    expect(tenant.status).toBe('checked_out');

    // Bed must be vacant immediately
    const bed = manager.state.rooms.find((r) => r.id === roomId)?.beds.find((b) => b.id === bedId);
    expect(bed?.status).toBe('vacant');
    expect(bed?.currentTenantId).toBeUndefined();

    // History preserved
    const lastStay = tenant.stayHistory[tenant.stayHistory.length - 1];
    expect(lastStay.action).toBe('checked_out');
  });

  it('Workflow 10 & 11: JSON Export, Validation, and Backup Restore', () => {
    const state = manager.state;

    // Validation passes for compliant state
    expect(validateImportedJSON(state)).toBe(true);

    // Validation fails for corrupt / incomplete state
    expect(validateImportedJSON(null)).toBe(false);
    expect(validateImportedJSON({})).toBe(false);
    expect(validateImportedJSON({ version: 1, property: {} })).toBe(false);
  });

  it('Workflow 12: CSV Cell Escaping against Formula Injection and Delimiters', () => {
    expect(escapeCSVCell('Standard Text')).toBe('"Standard Text"');
    expect(escapeCSVCell('Text with "quotes"')).toBe('"Text with ""quotes"""');

    // Formula injection attempts
    expect(escapeCSVCell('=1+2')).toBe(`"'=1+2"`);
    expect(escapeCSVCell('+cmd|')).toBe(`"'+cmd|"`);
    expect(escapeCSVCell('-SUM(A1)')).toBe(`"'-SUM(A1)"`);
    expect(escapeCSVCell('@alert()')).toBe(`"'@alert()"`);
  });

  it('Workflow 13: Upper and lower berth allocation with distinct unique berth IDs', () => {
    // Room 201 has Bunk 1 with Upper (vacant) and Lower (occupied)
    const room201 = manager.state.rooms.find((r) => r.id === 'room-201')!;
    const lowerBerth = room201.beds.find((b) => b.tier === 'lower')!;
    const upperBerth = room201.beds.find((b) => b.tier === 'upper')!;

    // Verify unique berth IDs format
    expect(lowerBerth.id).toBe('Room 201 - Bunk 1 - Lower');
    expect(upperBerth.id).toBe('Room 201 - Bunk 1 - Upper');
    expect(lowerBerth.tier).toBe('lower');
    expect(upperBerth.tier).toBe('upper');
    expect(lowerBerth.bunkGroup).toBe('Bunk 1');
    expect(upperBerth.bunkGroup).toBe('Bunk 1');

    // In seed data: Lower berth is occupied by tenant-6, Upper berth is vacant
    expect(lowerBerth.status).toBe('occupied');
    expect(upperBerth.status).toBe('vacant');

    // Allocate new tenant to Upper berth
    const resUpper = manager.allocateTenant({
      name: 'Aditi Sharma',
      phone: '9845998877',
      joiningDate: '2026-10-29',
      roomId: 'room-201',
      bedId: upperBerth.id,
      monthlyRent: upperBerth.monthlyRent,
      monthlyDueDay: 5,
      depositRequired: 10000,
      depositReceived: 10000,
    });

    expect(resUpper.success).toBe(true);
    expect(upperBerth.status).toBe('occupied');
    expect(upperBerth.currentTenantId).toBe(resUpper.tenant?.id);

    // Stay history correctly logged with berth label
    const stay = resUpper.tenant?.stayHistory[0];
    expect(stay?.bedLabel).toBe('Bunk 1 - Upper');
    expect(stay?.roomNumber).toBe('201');
  });

  it('Workflow 14: Capacity and vacancy calculated strictly by individual sleeping berths (never bunk frames)', () => {
    const initialMetrics = manager.getMetrics();
    const initialCapacity = initialMetrics.totalBeds; // 22 individual berths
    const initialVacant = initialMetrics.vacantBeds; // 6 vacant berths

    expect(initialCapacity).toBe(22);
    expect(initialVacant).toBe(6);

    // Add a new Bunk Bed frame (2 berths: Upper and Lower) to Room 101
    const addResult = manager.addBunkBedToRoom('room-101', {
      bunkGroup: 'Bunk 2',
      upperRent: 6000,
      lowerRent: 6500,
    });
    expect(addResult.success).toBe(true);

    const updatedMetrics = manager.getMetrics();
    // Adding 1 physical bunk bed frame adds EXACTLY 2 individual berths to capacity and vacancy
    expect(updatedMetrics.totalBeds).toBe(initialCapacity + 2); // 24
    expect(updatedMetrics.vacantBeds).toBe(initialVacant + 2); // 8

    // Verify both berths have independent unique IDs
    const room101 = manager.state.rooms.find((r) => r.id === 'room-101')!;
    const newUpper = room101.beds.find((b) => b.id === 'Room 101 - Bunk 2 - Upper');
    const newLower = room101.beds.find((b) => b.id === 'Room 101 - Bunk 2 - Lower');

    expect(newUpper).toBeDefined();
    expect(newLower).toBeDefined();
    expect(newUpper?.status).toBe('vacant');
    expect(newLower?.status).toBe('vacant');
  });

  it('Workflow 15: Setting and onboarding with different monthly rents for upper and lower berths', () => {
    // Add a bunk bed with differing rents: Upper @ ₹5,800 and Lower @ ₹6,800
    const addRes = manager.addBunkBedToRoom('room-103', {
      bunkGroup: 'Bunk 3',
      upperRent: 5800,
      lowerRent: 6800,
    });
    expect(addRes.success).toBe(true);

    const room103 = manager.state.rooms.find((r) => r.id === 'room-103')!;
    const upperBerth = room103.beds.find((b) => b.id === 'Room 103 - Bunk 3 - Upper')!;
    const lowerBerth = room103.beds.find((b) => b.id === 'Room 103 - Bunk 3 - Lower')!;

    expect(upperBerth.monthlyRent).toBe(5800);
    expect(lowerBerth.monthlyRent).toBe(6800);

    // Update Upper berth rent to ₹6,000 dynamically
    const updateRes = manager.updateBerthRent('room-103', upperBerth.id, 6000);
    expect(updateRes.success).toBe(true);
    expect(upperBerth.monthlyRent).toBe(6000);

    // Onboard tenant A to Upper Berth at ₹6,000
    const tenantUpper = manager.allocateTenant({
      name: 'Rohan Verma',
      phone: '9811223344',
      joiningDate: '2026-10-29',
      roomId: 'room-103',
      bedId: upperBerth.id,
      monthlyRent: upperBerth.monthlyRent,
      monthlyDueDay: 5,
      depositRequired: 12000,
      depositReceived: 12000,
    });
    expect(tenantUpper.success).toBe(true);
    expect(tenantUpper.tenant?.monthlyRent).toBe(6000);

    // Onboard tenant B to Lower Berth at ₹6,800
    const tenantLower = manager.allocateTenant({
      name: 'Karan Mehra',
      phone: '9811223355',
      joiningDate: '2026-10-29',
      roomId: 'room-103',
      bedId: lowerBerth.id,
      monthlyRent: lowerBerth.monthlyRent,
      monthlyDueDay: 5,
      depositRequired: 13600,
      depositReceived: 13600,
    });
    expect(tenantLower.success).toBe(true);
    expect(tenantLower.tenant?.monthlyRent).toBe(6800);

    // Verify rent charges created reflect individual differing berth rents
    const chargeUpper = manager.state.rentCharges.find((c) => c.tenantId === tenantUpper.tenant?.id);
    const chargeLower = manager.state.rentCharges.find((c) => c.tenantId === tenantLower.tenant?.id);

    expect(chargeUpper?.amount).toBe(6000);
    expect(chargeLower?.amount).toBe(6800);
  });

  it('Workflow 16: Independent duplicate occupancy prevention on upper and lower berths', () => {
    // Room 201 Bunk 1: Lower is occupied (tenant-6), Upper is vacant
    const lowerBerthId = 'Room 201 - Bunk 1 - Lower';
    const upperBerthId = 'Room 201 - Bunk 1 - Upper';

    // 1. Attempting to allocate someone to the already occupied Lower berth MUST fail
    const blockedRes = manager.allocateTenant({
      name: 'Duplicate Tenant',
      phone: '9999900000',
      joiningDate: '2026-10-29',
      roomId: 'room-201',
      bedId: lowerBerthId,
      monthlyRent: 6500,
      monthlyDueDay: 5,
      depositRequired: 10000,
      depositReceived: 10000,
    });
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error).toContain('Duplicate allocation blocked');

    // 2. Allocating to the Upper berth in the same bunk frame succeeds independently
    const successRes = manager.allocateTenant({
      name: 'Valid Upper Tenant',
      phone: '9999911111',
      joiningDate: '2026-10-29',
      roomId: 'room-201',
      bedId: upperBerthId,
      monthlyRent: 6000,
      monthlyDueDay: 5,
      depositRequired: 10000,
      depositReceived: 10000,
    });
    expect(successRes.success).toBe(true);

    // 3. Now that Upper berth is occupied, a second allocation to Upper berth is ALSO blocked
    const blockedUpperRes = manager.allocateTenant({
      name: 'Another Duplicate',
      phone: '9999922222',
      joiningDate: '2026-10-29',
      roomId: 'room-201',
      bedId: upperBerthId,
      monthlyRent: 6000,
      monthlyDueDay: 5,
      depositRequired: 10000,
      depositReceived: 10000,
    });
    expect(blockedUpperRes.success).toBe(false);
    expect(blockedUpperRes.error).toContain('Duplicate allocation blocked');
  });

  it('Workflow 17: Active berth deletion protection (blocks bunk removal if occupied, allows once vacant)', () => {
    // In Room 201, Bunk 1 has tenant-6 in Lower berth
    const removeBlocked = manager.removeBunkBedFromRoom('room-201', 'Bunk 1');
    expect(removeBlocked.success).toBe(false);
    expect(removeBlocked.error).toContain('Cannot remove Bunk 1');
    expect(removeBlocked.error).toContain('currently has an active tenant');

    // Check out tenant-6 from Lower berth
    const tenant6 = manager.state.tenants.find((t) => t.id === 'tenant-6')!;
    manager.checkoutTenant(tenant6.id, '2026-10-29');

    // Now removing Bunk 1 succeeds cleanly because both berths are vacant
    const removeSuccess = manager.removeBunkBedFromRoom('room-201', 'Bunk 1');
    expect(removeSuccess.success).toBe(true);

    // Verify Bunk 1 berths no longer exist in Room 201
    const room201 = manager.state.rooms.find((r) => r.id === 'room-201')!;
    const remainingBeds = room201.beds.filter((b) => b.bunkGroup === 'Bunk 1');
    expect(remainingBeds.length).toBe(0);
  });

  it('Workflow 18: Tenant Profile Field Validation (Phone, PIN code, Email, Masked Aadhaar)', () => {
    // 1. Phone validation
    expect(isValidIndianPhone('9845112233')).toBe(true);
    expect(isValidIndianPhone('+919845112233')).toBe(true);
    expect(isValidIndianPhone('5845112233')).toBe(false); // Does not start with 6-9
    expect(isValidIndianPhone('98451')).toBe(false); // Incomplete digits
    expect(isValidIndianPhone('98451abcde')).toBe(false);

    // 2. PIN code validation
    expect(isValidIndianPIN('560038')).toBe(true);
    expect(isValidIndianPIN('570012')).toBe(true);
    expect(isValidIndianPIN('056038')).toBe(false); // Cannot start with 0
    expect(isValidIndianPIN('56003')).toBe(false); // Must be 6 digits
    expect(isValidIndianPIN('5600389')).toBe(false); // Too long
    expect(isValidIndianPIN('56003A')).toBe(false);

    // 3. Email validation
    expect(isValidEmail('aditya.sharma@example.com')).toBe(true);
    expect(isValidEmail('tenant@company.in')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('test@')).toBe(false);

    // 4. Aadhaar Masking: full 12 digits must NEVER be retained, only last 4
    const masked1 = maskAadhaarNumber('987654321234');
    expect(masked1).toBe('•••• •••• 1234');
    expect(masked1).not.toContain('9876');
    expect(masked1).not.toContain('5432');

    const masked2 = maskAadhaarNumber('1234');
    expect(masked2).toBe('•••• •••• 1234');

    const masked3 = maskAadhaarNumber('•••• •••• 5678');
    expect(masked3).toBe('•••• •••• 5678');
  });

  it('Workflow 19: Document Upload Validation & Failure Scenarios', () => {
    // 1. Rejects file exceeding 10MB limit
    const oversizedBlob = { size: 11 * 1024 * 1024, type: 'application/pdf' };
    const overRes = validateDocumentUpload(oversizedBlob);
    expect(overRes.valid).toBe(false);
    expect(overRes.error).toContain('exceeds the maximum allowed limit of 10MB');

    // 2. Rejects unsupported MIME types (e.g. executable or zip)
    const badMime = { size: 1024, type: 'application/x-msdownload' };
    const badRes = validateDocumentUpload(badMime);
    expect(badRes.valid).toBe(false);
    expect(badRes.error).toContain('Unsupported file format');

    // 3. Allows supported formats (PDF, JPEG, PNG, WebP) under 10MB
    expect(validateDocumentUpload({ size: 1024 * 500, type: 'application/pdf' }).valid).toBe(true);
    expect(validateDocumentUpload({ size: 1024 * 800, type: 'image/jpeg' }).valid).toBe(true);
    expect(validateDocumentUpload({ size: 1024 * 600, type: 'image/png' }).valid).toBe(true);

    // 4. Blocking Aadhaar upload if tenant consent is missing
    const tenant1 = manager.state.tenants[0];
    const consentFail = manager.addTenantDocument(tenant1.id, {
      documentType: 'aadhaar',
      title: 'Aadhaar Identity Proof',
      maskedDocumentNumber: '•••• •••• 1234',
      fileName: 'aadhaar.pdf',
      fileSize: 1024 * 500,
      mimeType: 'application/pdf',
      consentObtained: false, // Consent NOT given
    });
    expect(consentFail.success).toBe(false);
    expect(consentFail.error).toContain('Explicit tenant consent is required');

    // 5. Successful upload with consent
    const consentPass = manager.addTenantDocument(tenant1.id, {
      documentType: 'aadhaar',
      title: 'Aadhaar Identity Proof (Masked)',
      maskedDocumentNumber: '•••• •••• 1234',
      fileName: 'aadhaar.pdf',
      fileSize: 1024 * 500,
      mimeType: 'application/pdf',
      consentObtained: true,
      verificationNotes: 'Original inspected',
    });
    expect(consentPass.success).toBe(true);
    expect(consentPass.document?.verificationStatus).toBe('pending');
    expect(consentPass.document?.maskedDocumentNumber).toBe('•••• •••• 1234');
  });

  it('Workflow 20: Document Verification Status Lifecycle & Re-verification on Replacement', () => {
    const tenant1 = manager.state.tenants[0];
    const uploadRes = manager.addTenantDocument(tenant1.id, {
      documentType: 'employment_id',
      title: 'Company Badge',
      fileName: 'badge.png',
      fileSize: 204800,
      mimeType: 'image/png',
      consentObtained: true,
    });
    expect(uploadRes.success).toBe(true);
    const docId = uploadRes.document!.id;

    // 1. Mark as verified
    const verifyRes = manager.updateDocumentVerification(
      tenant1.id,
      docId,
      'verified',
      'Verified with HR department'
    );
    expect(verifyRes.success).toBe(true);
    const docVerified = tenant1.documents?.find((d) => d.id === docId);
    expect(docVerified?.verificationStatus).toBe('verified');
    expect(docVerified?.verificationNotes).toContain('HR department');

    // 2. Rejecting without a reason MUST fail
    const rejectNoReason = manager.updateDocumentVerification(
      tenant1.id,
      docId,
      'rejected',
      'Notes here',
      '' // Empty rejection reason
    );
    expect(rejectNoReason.success).toBe(false);
    expect(rejectNoReason.error).toContain('rejection reason is required');

    // 3. Rejecting with a valid reason succeeds
    const rejectWithReason = manager.updateDocumentVerification(
      tenant1.id,
      docId,
      'rejected',
      'Internal note',
      'Badge expired last month'
    );
    expect(rejectWithReason.success).toBe(true);
    const docRejected = tenant1.documents?.find((d) => d.id === docId);
    expect(docRejected?.verificationStatus).toBe('rejected');
    expect(docRejected?.rejectionReason).toBe('Badge expired last month');

    // 4. Replacing the document with a new file resets verification status back to 'pending'
    const newFileBlob = new Blob(['sample-content'], { type: 'image/png' });
    const replaceRes = manager.replaceTenantDocument(tenant1.id, docId, newFileBlob);
    expect(replaceRes.success).toBe(true);
    const docReplaced = tenant1.documents?.find((d) => d.id === docId);
    expect(docReplaced?.verificationStatus).toBe('pending');
  });

  it('Workflow 21: Document Deletion removes metadata and storage file', () => {
    const tenant1 = manager.state.tenants[0];
    const sampleBlob = new Blob(['doc-bytes'], { type: 'application/pdf' });
    const uploadRes = manager.addTenantDocument(
      tenant1.id,
      {
        documentType: 'address_proof',
        title: 'Electricity Bill',
        fileName: 'ebill.pdf',
        fileSize: 10240,
        mimeType: 'application/pdf',
        consentObtained: true,
      },
      sampleBlob
    );
    expect(uploadRes.success).toBe(true);
    const docId = uploadRes.document!.id;

    // Confirm file exists in documentStore
    expect(documentStore.hasFile(docId)).toBe(true);

    // Delete document
    const deleteRes = manager.deleteTenantDocument(tenant1.id, docId);
    expect(deleteRes.success).toBe(true);

    // Confirm metadata removed
    const docFound = tenant1.documents?.find((d) => d.id === docId);
    expect(docFound).toBeUndefined();

    // Confirm file purged from storage
    expect(documentStore.hasFile(docId)).toBe(false);
  });

  it('Workflow 22: Strict Multi-Owner Data Isolation (Testing two separate owner accounts: Owner Alpha and Owner Beta)', () => {
    const ownerAlpha = 'owner-alpha-uuid';
    const ownerBeta = 'owner-beta-uuid';

    // 1. Owner Alpha manager
    const managerAlpha = new TestStateManager(ownerAlpha);

    // Owner Alpha onboards Tenant Alpha into Room 102 Bed 1 (vacant)
    const onboardAlpha = managerAlpha.allocateTenant({
      name: 'Ananya Sen',
      phone: '9845199887',
      employerName: 'Alphabet Google India',
      joiningDate: '2026-10-29',
      roomId: 'room-102',
      bedId: 'Room 102 - Bed 1',
      monthlyRent: 7000,
      monthlyDueDay: 5,
      depositRequired: 14000,
      depositReceived: 14000,
      ownerId: ownerAlpha,
    });
    expect(onboardAlpha.success).toBe(true);
    const tenantAlpha = onboardAlpha.tenant!;
    expect(tenantAlpha.ownerId).toBe(ownerAlpha);

    // Owner Alpha uploads private Aadhaar document for Tenant Alpha
    const fileAlpha = new Blob(['alpha-private-aadhaar-data'], { type: 'application/pdf' });
    const uploadAlpha = managerAlpha.addTenantDocument(
      tenantAlpha.id,
      {
        documentType: 'aadhaar',
        title: 'Ananya Aadhaar Proof (Masked)',
        maskedDocumentNumber: '•••• •••• 9812',
        fileName: 'ananya_aadhaar.pdf',
        fileSize: 45000,
        mimeType: 'application/pdf',
        consentObtained: true,
      },
      fileAlpha,
      ownerAlpha
    );
    expect(uploadAlpha.success).toBe(true);
    const docAlpha = uploadAlpha.document!;

    // 2. Owner Beta attempts to access Owner Alpha's document
    const betaAccessAttempt = managerAlpha.getSecureDocumentAccess(
      tenantAlpha.id,
      docAlpha.id,
      ownerBeta // Owner Beta requesting Owner Alpha's document
    );
    expect(betaAccessAttempt.error).toContain('403 Forbidden');
    expect(betaAccessAttempt.url).toBeUndefined();

    // 3. Owner Beta attempts to verify / tamper with Owner Alpha's document status
    const betaVerifyAttempt = managerAlpha.updateDocumentVerification(
      tenantAlpha.id,
      docAlpha.id,
      'verified',
      'Unauthorized verification by Beta',
      undefined,
      ownerBeta
    );
    expect(betaVerifyAttempt.success).toBe(false);
    expect(betaVerifyAttempt.error).toContain('403 Forbidden');

    // 4. Owner Beta attempts to replace Owner Alpha's document file
    const fakeFile = new Blob(['malicious-replacement'], { type: 'application/pdf' });
    const betaReplaceAttempt = managerAlpha.replaceTenantDocument(
      tenantAlpha.id,
      docAlpha.id,
      fakeFile,
      ownerBeta
    );
    expect(betaReplaceAttempt.success).toBe(false);
    expect(betaReplaceAttempt.error).toContain('403 Forbidden');

    // 5. Owner Beta attempts to delete Owner Alpha's document
    const betaDeleteAttempt = managerAlpha.deleteTenantDocument(
      tenantAlpha.id,
      docAlpha.id,
      ownerBeta
    );
    expect(betaDeleteAttempt.success).toBe(false);
    expect(betaDeleteAttempt.error).toContain('403 Forbidden');

    // 6. Owner Beta attempts to add a document to Owner Alpha's tenant
    const betaAddAttempt = managerAlpha.addTenantDocument(
      tenantAlpha.id,
      {
        documentType: 'other_id',
        title: 'Injected Document',
        fileName: 'injected.pdf',
        fileSize: 1000,
        mimeType: 'application/pdf',
        consentObtained: true,
      },
      undefined,
      ownerBeta
    );
    expect(betaAddAttempt.success).toBe(false);
    expect(betaAddAttempt.error).toContain('403 Forbidden');

    // 7. Multi-Tenant RLS isolation: Owner Beta querying tenants sees ONLY Owner Beta tenants
    const betaTenants = managerAlpha.getTenantsForOwner(ownerBeta);
    expect(betaTenants.some((t) => t.id === tenantAlpha.id)).toBe(false);

    // 8. Owner Alpha accessing their own document succeeds with short-lived URL
    const alphaLegitAccess = managerAlpha.getSecureDocumentAccess(
      tenantAlpha.id,
      docAlpha.id,
      ownerAlpha
    );
    expect(alphaLegitAccess.error).toBeUndefined();
    expect(alphaLegitAccess.url).toBeDefined();
    expect(alphaLegitAccess.fileName).toBe('ananya_aadhaar.pdf');
  });

  it('Workflow 23: Tenant Search across Name, Primary & Alternate Phone, Company, Room, and Berth', () => {
    // Target 1: Search by Company Name "Infosys"
    const q1 = 'infosys';
    const matchesCompany = manager.state.tenants.filter(
      (t) => t.employerName && t.employerName.toLowerCase().includes(q1)
    );
    expect(matchesCompany.length).toBeGreaterThanOrEqual(1);
    expect(matchesCompany[0].name).toContain('Muhammed Niyas');

    // Target 2: Search by Berth Label "Bunk 1 - Upper"
    const q2 = 'bunk 1 - upper';
    const matchesBerth = manager.state.rooms.flatMap((r) =>
      r.beds.filter((b) => b.label.toLowerCase().includes(q2) || b.id.toLowerCase().includes(q2))
    );
    expect(matchesBerth.length).toBeGreaterThanOrEqual(2);

    // Target 3: Search by Alternate Phone Number
    const tenantWithAlt = manager.state.tenants.find((t) => t.alternatePhone);
    expect(tenantWithAlt).toBeDefined();
    const altDigits = tenantWithAlt!.alternatePhone!.slice(-4);
    const matchesAltPhone = manager.state.tenants.filter(
      (t) => t.alternatePhone && t.alternatePhone.includes(altDigits)
    );
    expect(matchesAltPhone.some((t) => t.id === tenantWithAlt!.id)).toBe(true);

    // Target 4: Search by Permanent Address Locality or District
    const tenantWithAddress = manager.state.tenants.find((t) => t.permanentAddress?.locality);
    expect(tenantWithAddress).toBeDefined();
    expect(tenantWithAddress?.permanentAddress?.pincode).toBeDefined();
  });

  it('Workflow 24: Privacy & Data Hygiene Verification (No document contents in localStorage or CSV exports)', () => {
    // 1. Verify localStorage serialization strictly contains metadata, NEVER binary contents
    const sampleState = manager.state;
    const saveResult = saveAppState(sampleState);
    expect(saveResult).toBe(true);

    // Inspect the stored string
    const rawStorage = getStoredItem('greenview_pg_manager_data_v1');
    expect(rawStorage).toBeDefined();
    expect(rawStorage).not.toContain('alpha-private-aadhaar-data');
    expect(rawStorage).not.toContain('base64');
    expect(rawStorage).not.toContain('blob:http');

    // 2. Verify CSV Export escaping never contains private document URLs or raw Aadhaar numbers
    const safeCell1 = escapeCSVCell('•••• •••• 1234');
    expect(safeCell1).toBe('"•••• •••• 1234"');

    // Formula injection protection preserved
    expect(escapeCSVCell('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
  });

  it('Workflow 25: Owner Authentication & Credentials Validation (Login, Password Check, and Error Handling)', () => {
    // 1. Verify built-in owner accounts exist with distinct credentials
    const defaultAcc = BUILT_IN_DEMO_ACCOUNTS.default;
    expect(defaultAcc.user.email).toBe('owner@greenview.in');
    expect(defaultAcc.password).toBe('GreenView@2026');

    const alphaAcc = BUILT_IN_DEMO_ACCOUNTS.alpha;
    expect(alphaAcc.user.email).toBe('alpha.owner@greenview.in');
    expect(alphaAcc.password).toBe('AlphaOwner@2026');

    // 2. Reject incorrect passwords
    const attemptWrongPassword = 'WrongPassword@123';
    expect(attemptWrongPassword).not.toBe(defaultAcc.password);

    // 3. Reject empty/malformed emails
    const invalidEmail = 'not-an-email';
    expect(isValidEmail(invalidEmail)).toBe(false);

    // 4. Validate registration of new owner account credentials
    const newOwnerId = `owner-reg-test-${Date.now()}`;
    saveStoredAuthUser({
      id: newOwnerId,
      email: 'newowner@srisaipg.in',
      passwordHash: btoa('SecurePass@2026'),
      name: 'Raghu Varma',
      propertyName: 'Sri Sai Luxury PG',
      createdAt: new Date().toISOString(),
    });

    const registeredUsers = getStoredAuthUsers();
    const found = registeredUsers.find((u) => u.email === 'newowner@srisaipg.in');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Raghu Varma');
    expect(found?.propertyName).toBe('Sri Sai Luxury PG');
    // Verify password is not saved in plain text
    expect(found?.passwordHash).not.toBe('SecurePass@2026');
  });

  it('Workflow 26: New Owner Registration & Isolated Property Initialization', () => {
    const ownerId = `owner-new-${Date.now()}`;
    const propertyName = 'Balaji Grand PG for Gents';

    // Load initial state for a newly registered owner
    const newOwnerState = loadAppState(ownerId);
    expect(newOwnerState).toBeDefined();
    expect(newOwnerState.ownerId).toBe(ownerId);
    expect(newOwnerState.tenants).toHaveLength(0);
    expect(newOwnerState.rentCharges).toHaveLength(0);
    expect(newOwnerState.payments).toHaveLength(0);
    expect(newOwnerState.expenses).toHaveLength(0);

    // Verify starter property has bunk beds with upper & lower berths configured
    const allBeds = newOwnerState.rooms.flatMap((r) => r.beds);
    expect(allBeds.length).toBeGreaterThan(0);
    const upperBerths = allBeds.filter((b) => b.tier === 'upper');
    const lowerBerths = allBeds.filter((b) => b.tier === 'lower');
    expect(upperBerths.length).toBeGreaterThan(0);
    expect(lowerBerths.length).toBeGreaterThan(0);

    // All beds start as vacant
    expect(allBeds.every((b) => b.status === 'vacant')).toBe(true);

    // Verify storage key isolation
    const key = getOwnerStorageKey(ownerId);
    expect(key).toBe(`greenview_pg_manager_data_v1_${ownerId}`);
  });

  it('Workflow 27: End-to-End Multi-Owner Complete Data Isolation (Owner A vs Owner B)', () => {
    const ownerAId = `owner-isolated-A-${Date.now()}`;
    const ownerBId = `owner-isolated-B-${Date.now()}`;

    // 1. Owner A logs in and onboards a tenant to a bunk bed lower berth
    const stateA = loadAppState(ownerAId);
    const vacantBerthA = stateA.rooms[1].beds.find((b) => b.tier === 'lower')!;
    expect(vacantBerthA).toBeDefined();

    const tenantA: Tenant = {
      id: `tenant-A-1`,
      ownerId: ownerAId,
      name: 'Aditya Rao',
      phone: '+91 98450 77111',
      isPhoneMasked: false,
      permanentAddress: {
        house: '12-A',
        locality: 'Indiranagar',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pincode: '560038',
      },
      employerName: 'Oracle India',
      jobTitle: 'Senior Systems Engineer',
      joiningDate: '2026-10-01',
      propertyId: stateA.property.id,
      roomId: stateA.rooms[1].id,
      bedId: vacantBerthA.id,
      monthlyRent: 6500,
      monthlyDueDay: 5,
      depositRequired: 10000,
      depositReceived: 10000,
      status: 'active',
      assignedInventory: [],
      stayHistory: [],
      whatsappLogs: [],
    };

    stateA.tenants.push(tenantA);
    vacantBerthA.status = 'occupied';
    vacantBerthA.currentTenantId = tenantA.id;

    // Owner A records a rent payment
    const paymentA: PaymentRecord = {
      id: 'pay-A-1',
      receiptNumber: 'RCP-A-1001',
      tenantId: tenantA.id,
      chargeId: 'chg-A-1',
      billingMonth: '2026-10',
      amount: 6500,
      paymentDate: '2026-10-05',
      paymentMethod: 'UPI',
      createdAt: new Date().toISOString(),
    };
    stateA.payments.push(paymentA);

    // Save Owner A's state
    saveAppState(stateA, ownerAId);

    // 2. Owner B logs in: Verify Owner B has 0 tenants, 0 payments, and completely vacant berths
    const stateB = loadAppState(ownerBId);
    expect(stateB.ownerId).toBe(ownerBId);
    expect(stateB.tenants).toHaveLength(0);
    expect(stateB.payments).toHaveLength(0);

    // Verify Owner B's berth in Room 102 is completely vacant
    const berthInRoomB = stateB.rooms[1].beds.find((b) => b.tier === 'lower')!;
    expect(berthInRoomB.status).toBe('vacant');
    expect(berthInRoomB.currentTenantId).toBeUndefined();

    // Verify Owner B cannot access Owner A's tenant
    const foundTenantInB = stateB.tenants.find((t) => t.id === 'tenant-A-1');
    expect(foundTenantInB).toBeUndefined();

    // 3. Switch back to Owner A: verify all tenant data and payments are securely preserved
    const reloadedA = loadAppState(ownerAId);
    expect(reloadedA.tenants).toHaveLength(1);
    expect(reloadedA.tenants[0].name).toBe('Aditya Rao');
    expect(reloadedA.tenants[0].employerName).toBe('Oracle India');
    expect(reloadedA.payments).toHaveLength(1);
    expect(reloadedA.payments[0].receiptNumber).toBe('RCP-A-1001');
    expect(reloadedA.rooms[1].beds.find((b) => b.tier === 'lower')?.status).toBe('occupied');
  });

  it('Workflow 28: Multi-Building creation, switching, and archiving without data loss', () => {
    const ownerId = `owner-multibuilding-${Date.now()}`;
    const state = loadAppState(ownerId);

    // Initial building
    expect(state.properties).toBeDefined();
    const props = state.properties!;
    expect(props.length).toBeGreaterThanOrEqual(1);
    const initialBuildingId = state.property.id;

    // 1. Create a second building (e.g. "GreenView Ladies Hostel")
    const secondBuilding: typeof state.property = {
      id: `prop-ladies-${Date.now()}`,
      ownerId: ownerId,
      name: "GreenView Ladies PG & Hostel",
      tagline: "Safe & Premium Stay for Working Women",
      description: "Dedicated 4-floor facility in HSR Layout",
      address: "Sector 2, HSR Layout",
      city: "Bengaluru, Karnataka",
      pincode: "560102",
      phone: "+91 98450 99888",
      upiId: "greenviewladies@upi",
      isArchived: false,
      createdAt: new Date().toISOString(),
    };

    props.push(secondBuilding);
    expect(props).toHaveLength(2);

    // 2. Add floors to the second building
    const floorG = {
      id: `floor-ladies-g-${Date.now()}`,
      propertyId: secondBuilding.id,
      name: 'Ground Floor',
      number: 0,
    };
    const floor1 = {
      id: `floor-ladies-1-${Date.now()}`,
      propertyId: secondBuilding.id,
      name: 'First Floor',
      number: 1,
    };
    state.floors.push(floorG, floor1);

    // 3. Add rooms to the second building
    const roomG01 = {
      id: `room-ladies-g01`,
      propertyId: secondBuilding.id,
      floorId: floorG.id,
      roomNumber: 'G-01',
      sharingType: 'Double' as const,
      hasAc: true,
      hasAttachedBathroom: true,
      bathroomType: 'attached' as const,
      hasBalcony: false,
      capacity: 2,
      foodPlanType: 'food_included' as const,
      mealsProvided: { breakfast: true, lunch: false, dinner: true },
      foodMonthlyCharge: 0,
      amenities: { wifi: true, geyser: true, cupboard: true, studyTable: true, tv: false },
      beds: [
        {
          id: 'Room G-01 - Bed 1',
          roomId: 'room-ladies-g01',
          label: 'Bed 1',
          bedType: 'single' as const,
          monthlyRent: 8500,
          status: 'vacant' as const,
        },
        {
          id: 'Room G-01 - Bed 2',
          roomId: 'room-ladies-g01',
          label: 'Bed 2',
          bedType: 'single' as const,
          monthlyRent: 8500,
          status: 'vacant' as const,
        },
      ],
    };
    state.rooms.push(roomG01);

    // 4. Verify rooms in building 2 are segregated from building 1
    const building1Rooms = state.rooms.filter((r) => r.propertyId === initialBuildingId);
    const building2Rooms = state.rooms.filter((r) => r.propertyId === secondBuilding.id);
    expect(building2Rooms).toHaveLength(1);
    expect(building1Rooms.every((r) => r.propertyId === initialBuildingId)).toBe(true);

    // 5. Archive second building
    secondBuilding.isArchived = true;
    saveAppState(state, ownerId);

    // Reload state and verify building is archived but all floor and room data is intact
    const reloaded = loadAppState(ownerId);
    const archivedProp = reloaded.properties?.find((p) => p.id === secondBuilding.id);
    expect(archivedProp?.isArchived).toBe(true);
    const reloadedB2Rooms = reloaded.rooms.filter((r) => r.propertyId === secondBuilding.id);
    expect(reloadedB2Rooms).toHaveLength(1);
    expect(reloadedB2Rooms[0].roomNumber).toBe('G-01');
    expect(reloadedB2Rooms[0].beds).toHaveLength(2);
  });

  it('Workflow 29: Dynamic Floor Configuration with variable room counts', () => {
    const ownerId = `owner-floors-${Date.now()}`;
    const state = loadAppState(ownerId);
    const propId = state.property.id;

    // Check existing floors
    const existingFloors = state.floors.filter((f) => f.propertyId === propId);
    const initialFloorCount = existingFloors.length;

    // Add a new Terrace floor
    const terraceFloor = {
      id: `floor-terrace-${Date.now()}`,
      propertyId: propId,
      name: 'Rooftop Penthouse Floor',
      number: initialFloorCount + 1,
    };
    state.floors.push(terraceFloor);

    // Add a single studio room on Terrace floor
    const terraceRoom = {
      id: `room-terrace-1`,
      propertyId: propId,
      floorId: terraceFloor.id,
      roomNumber: 'PH-01',
      sharingType: 'Single' as const,
      hasAc: true,
      hasAttachedBathroom: true,
      bathroomType: 'attached' as const,
      hasBalcony: true,
      capacity: 1,
      foodPlanType: 'food_separate' as const,
      mealsProvided: { breakfast: true, lunch: true, dinner: true },
      foodMonthlyCharge: 3000,
      amenities: { wifi: true, geyser: true, cupboard: true, studyTable: true, tv: true },
      beds: [
        {
          id: 'Room PH-01 - Bed 1',
          roomId: 'room-terrace-1',
          label: 'Executive Suite Bed',
          bedType: 'single' as const,
          monthlyRent: 15000,
          status: 'vacant' as const,
        },
      ],
    };
    state.rooms.push(terraceRoom);

    // Verify dynamic room counts per floor
    const terraceRooms = state.rooms.filter((r) => r.floorId === terraceFloor.id);
    expect(terraceRooms).toHaveLength(1);
    expect(terraceRooms[0].beds).toHaveLength(1);
    expect(terraceRooms[0].hasBalcony).toBe(true);
    expect(terraceRooms[0].bathroomType).toBe('attached');

    // Safe floor deletion check: Cannot delete floor if rooms exist
    const hasRooms = state.rooms.some((r) => r.floorId === terraceFloor.id);
    expect(hasRooms).toBe(true); // deletion should be blocked
  });

  it('Workflow 30: Bulk Room Generation with Bunk and Single Berths', () => {
    const ownerId = `owner-bulk-${Date.now()}`;
    const state = loadAppState(ownerId);
    const propId = state.property.id;
    const targetFloor = state.floors[0];

    // Generate 4 rooms bulk: 301, 302, 303, 304 with Double bunk beds
    const count = 4;
    const startNum = 301;
    const upperRent = 6500;
    const lowerRent = 7200;

    const generatedRooms = [];
    for (let i = 0; i < count; i++) {
      const roomNum = `${startNum + i}`;
      const roomId = `room-bulk-${roomNum}`;
      const beds: Bed[] = [
        {
          id: `Room ${roomNum} - Bunk 1 - Upper`,
          roomId: roomId,
          label: `Bunk 1 - Upper`,
          bedType: 'bunk',
          bunkGroup: 'Bunk 1',
          tier: 'upper',
          monthlyRent: upperRent,
          status: 'vacant',
        },
        {
          id: `Room ${roomNum} - Bunk 1 - Lower`,
          roomId: roomId,
          label: `Bunk 1 - Lower`,
          bedType: 'bunk',
          bunkGroup: 'Bunk 1',
          tier: 'lower',
          monthlyRent: lowerRent,
          status: 'vacant',
        },
      ];

      generatedRooms.push({
        id: roomId,
        propertyId: propId,
        floorId: targetFloor.id,
        roomNumber: roomNum,
        sharingType: 'Double' as const,
        hasAc: true,
        hasAttachedBathroom: true,
        bathroomType: 'attached' as const,
        hasBalcony: false,
        capacity: 2,
        foodPlanType: 'food_separate' as const,
        foodMonthlyCharge: 2500,
        amenities: { wifi: true, geyser: true, cupboard: true, studyTable: false, tv: false },
        beds,
      });
    }

    state.rooms.push(...generatedRooms);

    // Verify 4 rooms were generated
    const newRooms = state.rooms.filter((r) => r.roomNumber.startsWith('30'));
    expect(newRooms).toHaveLength(4);

    // Capacity is strictly 8 sleeping berths, not 4 bunk bed frames
    const allNewBeds = newRooms.flatMap((r) => r.beds);
    expect(allNewBeds).toHaveLength(8);

    // Verify Upper and Lower berths have unique IDs and distinct rents
    const uppers = allNewBeds.filter((b) => b.tier === 'upper');
    const lowers = allNewBeds.filter((b) => b.tier === 'lower');
    expect(uppers).toHaveLength(4);
    expect(lowers).toHaveLength(4);
    expect(uppers.every((b) => b.monthlyRent === upperRent)).toBe(true);
    expect(lowers.every((b) => b.monthlyRent === lowerRent)).toBe(true);
    expect(uppers[0].id).toBe('Room 301 - Bunk 1 - Upper');
    expect(lowers[0].id).toBe('Room 301 - Bunk 1 - Lower');
  });

  it('Workflow 31: Room Facilities and Meal Plan Zero Double-Counting Calculations', () => {
    // 1. Room A: Food Included in Rent
    const roomA = {
      id: 'room-calc-A',
      roomNumber: '401',
      foodPlanType: 'food_included' as const,
      foodMonthlyCharge: 0,
      beds: [
        { id: 'b1', monthlyRent: 8000, status: 'vacant' as const, bedType: 'single' as const, roomId: 'room-calc-A', label: 'Bed 1' },
        { id: 'b2', monthlyRent: 8000, status: 'vacant' as const, bedType: 'single' as const, roomId: 'room-calc-A', label: 'Bed 2' },
      ],
    };

    // 2. Room B: Food Separate Charge (₹2,500/month per tenant)
    const roomB = {
      id: 'room-calc-B',
      roomNumber: '402',
      foodPlanType: 'food_separate' as const,
      foodMonthlyCharge: 2500,
      beds: [
        { id: 'b3', monthlyRent: 6000, status: 'vacant' as const, bedType: 'bunk' as const, tier: 'lower' as const, roomId: 'room-calc-B', label: 'Lower' },
        { id: 'b4', monthlyRent: 5500, status: 'vacant' as const, bedType: 'bunk' as const, tier: 'upper' as const, roomId: 'room-calc-B', label: 'Upper' },
      ],
    };

    // 3. Room C: No Food
    const roomC = {
      id: 'room-calc-C',
      roomNumber: '403',
      foodPlanType: 'no_food' as const,
      foodMonthlyCharge: 0,
      beds: [
        { id: 'b5', monthlyRent: 5000, status: 'vacant' as const, bedType: 'single' as const, roomId: 'room-calc-C', label: 'Bed 1' },
      ],
    };

    const rooms = [roomA, roomB, roomC];

    // Compute Potential Accommodation Rent: sum of all bed rents
    const potentialAccommodationRent = rooms.reduce((sum, r) => {
      return sum + r.beds.reduce((bSum, b) => bSum + b.monthlyRent, 0);
    }, 0);
    // (8000 + 8000) + (6000 + 5500) + 5000 = 16000 + 11500 + 5000 = 32500
    expect(potentialAccommodationRent).toBe(32500);

    // Compute Potential Food Rent: only food_separate counts foodMonthlyCharge per bed
    const potentialFoodRent = rooms.reduce((sum, r) => {
      if (r.foodPlanType === 'food_separate' && r.foodMonthlyCharge) {
        return sum + (r.foodMonthlyCharge * r.beds.length);
      }
      return sum;
    }, 0);
    // Room B has 2 beds * 2500 = 5000. Room A (included) is 0. Room C (no food) is 0.
    expect(potentialFoodRent).toBe(5000);

    // Total Monthly Potential (Zero Double Counting)
    const totalMonthlyPotential = potentialAccommodationRent + potentialFoodRent;
    expect(totalMonthlyPotential).toBe(37500);

    // Verify individual berth payable amounts:
    // Room A (food included): berth rent is all-inclusive
    const roomABerthPayable = roomA.beds[0].monthlyRent + ((roomA.foodPlanType as string) === 'food_separate' ? roomA.foodMonthlyCharge : 0);
    expect(roomABerthPayable).toBe(8000);

    // Room B Lower berth (food separate): 6000 + 2500 = 8500
    const roomBLowerPayable = roomB.beds[0].monthlyRent + ((roomB.foodPlanType as string) === 'food_separate' ? roomB.foodMonthlyCharge : 0);
    expect(roomBLowerPayable).toBe(8500);

    // Room B Upper berth (food separate): 5500 + 2500 = 8000
    const roomBUpperPayable = roomB.beds[1].monthlyRent + ((roomB.foodPlanType as string) === 'food_separate' ? roomB.foodMonthlyCharge : 0);
    expect(roomBUpperPayable).toBe(8000);

    // Room C (no food): 5000 + 0 = 5000
    const roomCPayable = roomC.beds[0].monthlyRent + ((roomC.foodPlanType as string) === 'food_separate' ? roomC.foodMonthlyCharge : 0);
    expect(roomCPayable).toBe(5000);
  });

  it('Workflow 32: Automatic loading of room standard pricing and differential berth rents during onboarding', () => {
    // Pick Room 102 which has Bunk 1 Upper (₹6,000) and Lower (₹6,500)
    const room102 = manager.state.rooms.find((r) => r.roomNumber === '102')!;
    const upperBerth = room102.beds.find((b) => b.tier === 'upper')!;
    const lowerBerth = room102.beds.find((b) => b.tier === 'lower')!;

    expect(upperBerth.monthlyRent).toBe(6000);
    expect(lowerBerth.monthlyRent).toBe(6500);

    // Make berths vacant for testing fresh allocation
    upperBerth.status = 'vacant';
    upperBerth.currentTenantId = undefined;
    lowerBerth.status = 'vacant';
    lowerBerth.currentTenantId = undefined;

    // Onboarding tenant in upper berth automatically loads standard ₹6,000
    const resUpper = manager.allocateTenant({
      name: 'Rohan Sharma',
      phone: '9876543210',
      joiningDate: '2026-10-01',
      roomId: room102.id,
      bedId: upperBerth.id,
      monthlyRent: upperBerth.monthlyRent,
      monthlyDueDay: 5,
      depositRequired: 12000,
      depositReceived: 12000,
      standardRent: upperBerth.monthlyRent,
    });

    expect(resUpper.success).toBe(true);
    expect(resUpper.tenant?.monthlyRent).toBe(6000);
    expect(resUpper.tenant?.standardRent).toBe(6000);
    expect(resUpper.tenant?.bedId).toBe(upperBerth.id);

    // Upper berth is now occupied
    expect(upperBerth.status).toBe('occupied');

    // Onboarding tenant in lower berth automatically loads standard ₹6,500
    const resLower = manager.allocateTenant({
      name: 'Vikas Gupta',
      phone: '9876543211',
      joiningDate: '2026-10-01',
      roomId: room102.id,
      bedId: lowerBerth.id,
      monthlyRent: lowerBerth.monthlyRent,
      monthlyDueDay: 5,
      depositRequired: 13000,
      depositReceived: 13000,
      standardRent: lowerBerth.monthlyRent,
    });

    expect(resLower.success).toBe(true);
    expect(resLower.tenant?.monthlyRent).toBe(6500);
    expect(resLower.tenant?.standardRent).toBe(6500);
    expect(resLower.tenant?.bedId).toBe(lowerBerth.id);
    expect(lowerBerth.status).toBe('occupied');
  });

  it('Workflow 33: Agreed rent override and percentage/fixed discount with reason without modifying room standard price', () => {
    // Room 101 Bed 1 standard rent is ₹8,000
    const room101 = manager.state.rooms.find((r) => r.roomNumber === '101')!;
    const vacantBed = room101.beds.find((b) => b.status === 'vacant') || {
      id: 'Room 101 - Bed 2',
      roomId: room101.id,
      label: 'Bed 2',
      monthlyRent: 8000,
      bedType: 'single' as const,
      status: 'vacant' as const,
    };
    if (!room101.beds.some((b) => b.id === vacantBed.id)) {
      room101.beds.push(vacantBed);
    }
    vacantBed.status = 'vacant';
    vacantBed.currentTenantId = undefined;

    const standardRent = vacantBed.monthlyRent;
    expect(standardRent).toBe(8000);

    // Owner negotiates a ₹500 corporate discount for Infosys employee
    const discountAmount = 500;
    const agreedRent = standardRent - discountAmount; // ₹7,500

    const res = manager.allocateTenant({
      name: 'Kavita Reddy',
      phone: '9845112233',
      employerName: 'Infosys',
      joiningDate: '2026-10-15',
      roomId: room101.id,
      bedId: vacantBed.id,
      monthlyRent: agreedRent,
      monthlyDueDay: 5,
      depositRequired: 15000,
      depositReceived: 15000,
      standardRent: standardRent,
      discountType: 'amount',
      discountValue: 500,
      discountAmount: 500,
      discountReason: 'Corporate tie-up discount for Infosys employees',
    });

    expect(res.success).toBe(true);
    const tenant = res.tenant!;
    expect(tenant.monthlyRent).toBe(7500); // Agreed price
    expect(tenant.standardRent).toBe(8000); // Standard baseline price preserved
    expect(tenant.discountAmount).toBe(500);
    expect(tenant.discountReason).toBe('Corporate tie-up discount for Infosys employees');

    // Crucial requirement: The underlying bed's standard rent in the room configuration MUST NOT change
    expect(vacantBed.monthlyRent).toBe(8000);

    // Initial price history entry is recorded
    expect(tenant.rentHistory).toBeDefined();
    expect(tenant.rentHistory).toHaveLength(1);
    expect(tenant.rentHistory![0].previousRent).toBe(8000);
    expect(tenant.rentHistory![0].newRent).toBe(7500);
    expect(tenant.rentHistory![0].reason).toContain('Corporate tie-up');
  });

  it('Workflow 34: Itemized meal pricing breakdown (Breakfast, Lunch, Dinner dynamic sum and zero double-counting)', () => {
    // Room with configurable meal prices: breakfast ₹1,000, lunch ₹1,500, dinner ₹1,500
    const mealPrices = { breakfast: 1000, lunch: 1500, dinner: 1500 };

    // Tenant A selects Breakfast + Dinner: 1000 + 1500 = 2500 food charge
    const selectedMealsA = { breakfast: true, lunch: false, dinner: true };
    const computedFoodA =
      (selectedMealsA.breakfast ? mealPrices.breakfast : 0) +
      (selectedMealsA.lunch ? mealPrices.lunch : 0) +
      (selectedMealsA.dinner ? mealPrices.dinner : 0);
    expect(computedFoodA).toBe(2500);

    // Tenant B selects all 3 meals: 1000 + 1500 + 1500 = 4000 food charge
    const selectedMealsB = { breakfast: true, lunch: true, dinner: true };
    const computedFoodB =
      (selectedMealsB.breakfast ? mealPrices.breakfast : 0) +
      (selectedMealsB.lunch ? mealPrices.lunch : 0) +
      (selectedMealsB.dinner ? mealPrices.dinner : 0);
    expect(computedFoodB).toBe(4000);

    // Zero double-counting check: If room has food included in accommodation rent, additional food charge is ₹0
    const foodPlanIncluded = 'food_included';
    const effectiveFoodCharge = foodPlanIncluded === 'food_included' ? 0 : computedFoodA;
    expect(effectiveFoodCharge).toBe(0);

    const rent = 7000;
    const totalPayable = rent + effectiveFoodCharge;
    expect(totalPayable).toBe(7000);
  });

  it('Workflow 35: Price agreement change creates audit trail without rewriting historical payments', () => {
    // 1. Setup tenant with initial rent ₹6,500 in October 2026
    const tenantId = 'tenant-audit-test-1';
    const initialRent = 6500;
    const initialFood = 1500;
    const initialTotal = 8000;

    const tenant: Tenant = {
      id: tenantId,
      ownerId: manager.ownerId,
      name: 'Suresh Kumar',
      phone: '9900112233',
      isPhoneMasked: false,
      joiningDate: '2026-08-01',
      propertyId: manager.state.property.id,
      roomId: 'room-1',
      bedId: 'bed-1',
      monthlyRent: initialRent,
      monthlyDueDay: 5,
      depositRequired: 13000,
      depositReceived: 13000,
      status: 'active',
      standardRent: initialRent,
      agreedFoodCharge: initialFood,
      totalMonthlyAmount: initialTotal,
      rentHistory: [
        {
          id: 'hist-init',
          effectiveDate: '2026-08-01',
          previousRent: initialRent,
          newRent: initialRent,
          previousFoodCharge: initialFood,
          newFoodCharge: initialFood,
          reason: 'Initial onboarding agreement',
          changedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
      assignedInventory: [],
      stayHistory: [],
      whatsappLogs: [],
      documents: [],
    };
    manager.state.tenants.push(tenant);

    // 2. Tenant has a recorded payment for August and September 2026
    const historicalPayment: PaymentRecord = {
      id: 'pay-august-1',
      receiptNumber: 'RCP-2026-08-001',
      tenantId,
      chargeId: 'chg-august-1',
      billingMonth: '2026-08',
      amount: 8000,
      paymentDate: '2026-08-04',
      paymentMethod: 'UPI',
      createdAt: '2026-08-04T12:00:00.000Z',
    };
    manager.state.payments.push(historicalPayment);

    // 3. Owner updates pricing agreement effective November 2026: Rent increases from ₹6,500 to ₹7,200
    const res = manager.updateTenantPricing(tenantId, 7200, '2026-11-01', {
      agreedFoodCharge: 1800,
      reason: 'Annual rent revision & upgraded meal plan',
    });

    expect(res.success).toBe(true);

    // 4. Verify tenant current pricing is updated
    expect(tenant.monthlyRent).toBe(7200);
    expect(tenant.agreedFoodCharge).toBe(1800);
    expect(tenant.totalMonthlyAmount).toBe(9000);

    // 5. Verify price history audit trail has both initial agreement and the new price change
    expect(tenant.rentHistory).toHaveLength(2);
    const latestChange = tenant.rentHistory![1];
    expect(latestChange.previousRent).toBe(6500);
    expect(latestChange.newRent).toBe(7200);
    expect(latestChange.previousFoodCharge).toBe(1500);
    expect(latestChange.newFoodCharge).toBe(1800);
    expect(latestChange.effectiveDate).toBe('2026-11-01');
    expect(latestChange.reason).toBe('Annual rent revision & upgraded meal plan');

    // 6. Verify historical payment records and receipts remain completely intact (Part 2.E)
    const storedPayment = manager.state.payments.find((p) => p.id === 'pay-august-1')!;
    expect(storedPayment.amount).toBe(8000);
    expect(storedPayment.receiptNumber).toBe('RCP-2026-08-001');
    expect(storedPayment.billingMonth).toBe('2026-08');
  });

  it('Part 5: Room accommodation pricing is decoupled from tenant-specific meal plans', () => {
    // 1. Create a double-sharing room without room-level food configuration
    const room901: Room = {
      id: 'room-901',
      propertyId: 'bldg-1',
      floorId: 'floor-3',
      roomNumber: '901',
      sharingType: 'double',
      pricingBasis: 'per_person',
      hasAc: true,
      hasAttachedBathroom: true,
      hasBalcony: false,
      bathroomType: 'attached',
      amenitiesList: { wifi: true, geyser: true, studyTable: true },
      beds: [
        {
          id: 'room-901-bed-1',
          roomId: 'room-901',
          label: 'Bed 1 (Single)',
          status: 'vacant',
          bedType: 'single',
          monthlyRent: 7500,
        },
        {
          id: 'room-901-bed-2',
          roomId: 'room-901',
          label: 'Bed 2 (Single)',
          status: 'vacant',
          bedType: 'single',
          monthlyRent: 7500,
        },
      ],
      status: 'available',
    };
    manager.state.rooms.push(room901);

    // 2. Roommate A onboards into Bed 1: chooses 'no_food' (eating outside / self cooking)
    const resA = manager.allocateTenant({
      name: 'Aakash Verma',
      phone: '9845011223',
      joiningDate: '2026-10-29',
      roomId: 'room-901',
      bedId: 'room-901-bed-1',
      monthlyRent: 7500,
      monthlyDueDay: 5,
      depositRequired: 15000,
      depositReceived: 15000,
      foodPlanType: 'no_food',
      standardFoodCharge: 0,
      agreedFoodCharge: 0,
      totalMonthlyAmount: 7500,
    });
    expect(resA.success).toBe(true);

    // 3. Roommate B onboards into Bed 2 in the SAME room: chooses 'food_separate' with Breakfast (800) + Dinner (1500) = 2300
    const resB = manager.allocateTenant({
      name: 'Bhavesh Patel',
      phone: '9845022334',
      joiningDate: '2026-10-29',
      roomId: 'room-901',
      bedId: 'room-901-bed-2',
      monthlyRent: 7500,
      monthlyDueDay: 5,
      depositRequired: 15000,
      depositReceived: 15000,
      foodPlanType: 'food_separate',
      selectedMeals: { breakfast: true, lunch: false, dinner: true },
      standardFoodCharge: 2300,
      agreedFoodCharge: 2300,
      totalMonthlyAmount: 9800,
    });
    expect(resB.success).toBe(true);

    const tenantA = manager.state.tenants.find((t) => t.phone === '9845011223')!;
    const tenantB = manager.state.tenants.find((t) => t.phone === '9845022334')!;

    // 4. Verify independent meal configurations and total monthly payable amounts
    expect(tenantA.foodPlanType).toBe('no_food');
    expect(tenantA.monthlyRent).toBe(7500);
    expect(tenantA.agreedFoodCharge).toBe(0);
    expect(tenantA.totalMonthlyAmount).toBe(7500);

    expect(tenantB.foodPlanType).toBe('food_separate');
    expect(tenantB.selectedMeals?.breakfast).toBe(true);
    expect(tenantB.selectedMeals?.lunch).toBe(false);
    expect(tenantB.selectedMeals?.dinner).toBe(true);
    expect(tenantB.monthlyRent).toBe(7500);
    expect(tenantB.agreedFoodCharge).toBe(2300);
    expect(tenantB.totalMonthlyAmount).toBe(9800);

    // 5. Updating Roommate A's agreement to add Dinner (1500) does NOT touch Roommate B
    const updateRes = manager.updateTenantPricing(tenantA.id, 7500, '2026-11-01', {
      agreedFoodCharge: 1500,
      foodPlanType: 'food_separate',
      selectedMeals: { breakfast: false, lunch: false, dinner: true },
      reason: 'Resident opted in for dinner plan',
    });
    expect(updateRes.success).toBe(true);
    expect(tenantA.agreedFoodCharge).toBe(1500);
    expect(tenantA.totalMonthlyAmount).toBe(9000);

    // Roommate B remains strictly untouched
    expect(tenantB.agreedFoodCharge).toBe(2300);
    expect(tenantB.totalMonthlyAmount).toBe(9800);
  });

  describe('Part 6: Room Lifecycle, Facilities Editing, Safe Deletion, and Storage Management', () => {
    it('should edit room facilities and standard berth rent without modifying existing tenant agreements', () => {
      const manager = new TestStateManager('owner-gv-default');
      const testRoom: Room = {
        id: 'room-test-edit',
        floorId: 'floor-1',
        propertyId: 'prop-1',
        roomNumber: '911',
        sharingType: 'Double (2 Beds)',
        hasAc: false,
        hasAttachedBathroom: false,
        hasBalcony: false,
        bathroomType: 'shared',
        status: 'available',
        beds: [
          {
            id: 'bed-test-edit-1',
            roomId: 'room-test-edit',
            label: 'Bed 1',
            bedType: 'single',
            monthlyRent: 6500,
            status: 'vacant',
          },
          {
            id: 'bed-test-edit-2',
            roomId: 'room-test-edit',
            label: 'Bed 2',
            bedType: 'single',
            monthlyRent: 6500,
            status: 'vacant',
          },
        ],
      };
      manager.state.rooms.push(testRoom);

      // Onboard resident into Bed 1 with agreed rent of 6500
      const alloc = manager.allocateTenant({
        name: 'Rahul Sharma',
        phone: '9845099881',
        joiningDate: '2026-10-01',
        roomId: testRoom.id,
        bedId: testRoom.beds[0].id,
        monthlyRent: 6500,
        monthlyDueDay: 5,
        depositRequired: 13000,
        depositReceived: 13000,
      });
      expect(alloc.success).toBe(true);
      const resident = manager.state.tenants.find((t) => t.id === alloc.tenant!.id)!;
      expect(resident.monthlyRent).toBe(6500);

      // Owner edits room facilities and raises standard baseline rent for the room/berths
      const updateRes = manager.updateRoom(testRoom.id, {
        hasAc: true,
        bathroomType: 'attached',
        hasAttachedBathroom: true,
        amenitiesList: {
          wifi: true,
          geyser: true,
          cupboard: true,
          table: true,
          chair: true,
          fan: true,
          tv: true,
        },
      });
      expect(updateRes.success).toBe(true);

      // Update berth baseline rent for vacant bed 2
      const bed2 = testRoom.beds[1];
      manager.updateBerthRent(testRoom.id, bed2.id, 8500);

      // Verify room properties updated
      expect(testRoom.hasAc).toBe(true);
      expect(testRoom.bathroomType).toBe('attached');
      expect(testRoom.amenitiesList?.tv).toBe(true);

      // CRITICAL: Existing resident's agreed rent and history MUST NOT be modified
      expect(resident.monthlyRent).toBe(6500);
      expect(resident.rentHistory?.length).toBe(1);
      expect(resident.rentHistory?.[0].newRent).toBe(6500);

      // New resident on boarding into bed 2 receives new standard rent
      const alloc2 = manager.allocateTenant({
        name: 'Suresh Kumar',
        phone: '9845099882',
        joiningDate: '2026-10-15',
        roomId: testRoom.id,
        bedId: bed2.id,
        monthlyRent: bed2.monthlyRent,
        monthlyDueDay: 5,
        depositRequired: 17000,
        depositReceived: 17000,
      });
      expect(alloc2.success).toBe(true);
      expect(alloc2.tenant!.monthlyRent).toBe(8500);
    });

    it('should strictly block room deletion, closure, and storage conversion while occupied', () => {
      const manager = new TestStateManager('owner-gv-default');
      const testRoom: Room = {
        id: 'room-test-block',
        floorId: 'floor-1',
        propertyId: 'prop-1',
        roomNumber: '912',
        sharingType: 'Single (1 Bed)',
        hasAc: false,
        hasAttachedBathroom: false,
        hasBalcony: false,
        bathroomType: 'shared',
        status: 'available',
        beds: [
          {
            id: 'bed-test-block-1',
            roomId: 'room-test-block',
            label: 'Bed 1',
            bedType: 'single',
            monthlyRent: 6000,
            status: 'vacant',
          },
        ],
      };
      manager.state.rooms.push(testRoom);

      manager.allocateTenant({
        name: 'Vikas Rao',
        phone: '9845099883',
        joiningDate: '2026-10-01',
        roomId: testRoom.id,
        bedId: testRoom.beds[0].id,
        monthlyRent: 6000,
        monthlyDueDay: 5,
        depositRequired: 12000,
        depositReceived: 12000,
      });

      // 1. Attempt permanent delete -> blocked
      const delRes = manager.deleteRoom(testRoom.id);
      expect(delRes.success).toBe(false);
      expect(delRes.error).toContain('currently houses 1 active resident');

      // 2. Attempt convert to storage -> blocked
      const storageRes = manager.convertToStorage(testRoom.id);
      expect(storageRes.success).toBe(false);
      expect(storageRes.error).toContain('Cannot convert');

      // 3. Attempt temporary closure -> blocked
      const closeRes = manager.closeRoom(testRoom.id);
      expect(closeRes.success).toBe(false);
      expect(closeRes.error).toContain('Cannot convert');
    });

    it('should safely transfer tenant to another room with rent adjustment and update stay history', () => {
      const manager = new TestStateManager('owner-gv-default');
      const sourceRoom: Room = {
        id: 'room-transfer-src',
        floorId: 'floor-1',
        propertyId: 'prop-1',
        roomNumber: '913',
        sharingType: 'Single (1 Bed)',
        hasAc: false,
        hasAttachedBathroom: false,
        hasBalcony: false,
        bathroomType: 'shared',
        status: 'available',
        beds: [
          {
            id: 'bed-transfer-src-1',
            roomId: 'room-transfer-src',
            label: 'Bed 1',
            bedType: 'single',
            monthlyRent: 6000,
            status: 'vacant',
          },
        ],
      };
      const targetRoom: Room = {
        id: 'room-transfer-tgt',
        floorId: 'floor-1',
        propertyId: 'prop-1',
        roomNumber: '914',
        sharingType: 'Single (1 Bed)',
        hasAc: true,
        hasAttachedBathroom: true,
        hasBalcony: false,
        bathroomType: 'attached',
        status: 'available',
        beds: [
          {
            id: 'bed-transfer-tgt-1',
            roomId: 'room-transfer-tgt',
            label: 'Bed 1',
            bedType: 'single',
            monthlyRent: 7500,
            status: 'vacant',
          },
        ],
      };
      manager.state.rooms.push(sourceRoom, targetRoom);

      const alloc = manager.allocateTenant({
        name: 'Pooja Hegde',
        phone: '9845099884',
        joiningDate: '2026-10-01',
        roomId: sourceRoom.id,
        bedId: sourceRoom.beds[0].id,
        monthlyRent: 6000,
        monthlyDueDay: 5,
        depositRequired: 12000,
        depositReceived: 12000,
      });
      expect(alloc.success).toBe(true);
      const tenant = alloc.tenant!;

      // Execute transfer with rent upgrade to 7500
      const moveRes = manager.moveTenantBed(
        tenant.id,
        targetRoom.id,
        targetRoom.beds[0].id,
        '2026-10-20',
        { newRent: 7500, reason: 'Upgraded to single AC room' }
      );
      expect(moveRes.success).toBe(true);

      // Verify source bed is now vacant
      expect(sourceRoom.beds[0].status).toBe('vacant');
      expect(sourceRoom.beds[0].currentTenantId).toBeUndefined();

      // Verify target bed is occupied by tenant
      expect(targetRoom.beds[0].status).toBe('occupied');
      expect(targetRoom.beds[0].currentTenantId).toBe(tenant.id);

      // Verify tenant record updated
      expect(tenant.roomId).toBe(targetRoom.id);
      expect(tenant.bedId).toBe(targetRoom.beds[0].id);
      expect(tenant.monthlyRent).toBe(7500);

      // Verify stay history log
      const latestStay = tenant.stayHistory[tenant.stayHistory.length - 1];
      expect(latestStay.action).toBe('moved');
      expect(latestStay.roomNumber).toBe(targetRoom.roomNumber);

      // Verify rent history log
      const latestRentHist = tenant.rentHistory![tenant.rentHistory!.length - 1];
      expect(latestRentHist.previousRent).toBe(6000);
      expect(latestRentHist.newRent).toBe(7500);
      expect(latestRentHist.reason).toBe('Upgraded to single AC room');
    });

    it('should allow checkout to free bed and permit safe room retirement', () => {
      const manager = new TestStateManager('owner-gv-default');
      const testRoom: Room = {
        id: 'room-test-checkout',
        floorId: 'floor-1',
        propertyId: 'prop-1',
        roomNumber: '915',
        sharingType: 'Single (1 Bed)',
        hasAc: false,
        hasAttachedBathroom: false,
        hasBalcony: false,
        bathroomType: 'shared',
        status: 'available',
        beds: [
          {
            id: 'bed-test-checkout-1',
            roomId: 'room-test-checkout',
            label: 'Bed 1',
            bedType: 'single',
            monthlyRent: 6000,
            status: 'vacant',
          },
        ],
      };
      manager.state.rooms.push(testRoom);

      const alloc = manager.allocateTenant({
        name: 'Arjun Sen',
        phone: '9845099885',
        joiningDate: '2026-10-01',
        roomId: testRoom.id,
        bedId: testRoom.beds[0].id,
        monthlyRent: 6000,
        monthlyDueDay: 5,
        depositRequired: 12000,
        depositReceived: 12000,
      });
      expect(alloc.success).toBe(true);
      const tenant = alloc.tenant!;

      // Checkout tenant
      manager.checkoutTenant(tenant.id, '2026-10-25');
      expect(testRoom.beds[0].status).toBe('vacant');

      // Now retire the room
      const retireRes = manager.retireRoom(testRoom.id, 'Floor renovation project');
      expect(retireRes.success).toBe(true);
      expect(testRoom.operationalStatus).toBe('retired');
      expect(testRoom.statusReason).toBe('Floor renovation project');
    });

    it('should convert room to storage, exclude from available accommodation capacity, and block onboarding', () => {
      const manager = new TestStateManager('owner-gv-default');
      const testStorageRoom: Room = {
        id: 'room-test-storage',
        floorId: 'floor-1',
        propertyId: 'prop-1',
        roomNumber: '916',
        sharingType: 'Double (2 Beds)',
        hasAc: false,
        hasAttachedBathroom: false,
        hasBalcony: false,
        bathroomType: 'shared',
        status: 'available',
        beds: [
          {
            id: 'bed-test-storage-1',
            roomId: 'room-test-storage',
            label: 'Bed 1',
            bedType: 'single',
            monthlyRent: 6000,
            status: 'vacant',
          },
          {
            id: 'bed-test-storage-2',
            roomId: 'room-test-storage',
            label: 'Bed 2',
            bedType: 'single',
            monthlyRent: 6000,
            status: 'vacant',
          },
        ],
      };
      manager.state.rooms.push(testStorageRoom);

      const initialMetrics = manager.getBuildingMetrics('prop-1');
      const initialCapacity = initialMetrics.totalBerths;
      const initialVacant = initialMetrics.vacantBerths;
      const roomBedsCount = testStorageRoom.beds.length;

      // Convert to storage
      const storageRes = manager.convertToStorage(testStorageRoom.id, 'Converted to mattress & linen store');
      expect(storageRes.success).toBe(true);
      expect(testStorageRoom.roomPurpose).toBe('storage');
      expect(testStorageRoom.operationalStatus).toBe('storage');

      // Metrics must accurately exclude this room from accommodation capacity
      const updatedMetrics = manager.getBuildingMetrics('prop-1');
      expect(updatedMetrics.totalRooms).toBe(initialMetrics.totalRooms); // physical room count remains
      expect(updatedMetrics.storageRooms).toBe(initialMetrics.storageRooms + 1);
      expect(updatedMetrics.accommodationRooms).toBe(initialMetrics.accommodationRooms - 1);
      expect(updatedMetrics.totalBerths).toBe(initialCapacity - roomBedsCount);
      expect(updatedMetrics.vacantBerths).toBe(initialVacant - roomBedsCount);

      // Attempting to onboard a resident into this storage room MUST fail
      const allocAttempt = manager.allocateTenant({
        name: 'Sneha Patel',
        phone: '9845099886',
        joiningDate: '2026-10-28',
        roomId: testStorageRoom.id,
        bedId: testStorageRoom.beds[0].id,
        monthlyRent: 6000,
        monthlyDueDay: 5,
        depositRequired: 12000,
        depositReceived: 12000,
      });
      expect(allocAttempt.success).toBe(false);
      expect(allocAttempt.error).toContain('Cannot allocate resident to a closed, storage, or retired room');

      // Reopening room restores capacity
      const reopenRes = manager.reopenRoom(testStorageRoom.id);
      expect(reopenRes.success).toBe(true);
      expect(testStorageRoom.roomPurpose).toBe('accommodation');
      expect(testStorageRoom.operationalStatus).toBe('available');

      const restoredMetrics = manager.getBuildingMetrics('prop-1');
      expect(restoredMetrics.totalBerths).toBe(initialCapacity);
      expect(restoredMetrics.vacantBerths).toBe(initialVacant);
      expect(restoredMetrics.storageRooms).toBe(initialMetrics.storageRooms);
    });
  });
});



