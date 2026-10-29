import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isValidUUID,
  mapPropertyRowToEntity,
  mapPropertyEntityToRow,
  mapFloorRowToEntity,
  mapRoomRowToEntity,
  mapBedRowToEntity,
  mapTenantRowToEntity,
  mapTenantEntityToRow,
  mapPaymentRowToEntity,
  mapPaymentEntityToRow,
  mapExpenseRowToEntity,
  loadCloudDataForOwner,
  initializeCloudOwner,
  upsertCloudTenant,
  upsertCloudPayment,
  upsertCloudExpense,
  upsertCloudRoom,
  upsertCloudBed,
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
import { getCachedAppState, saveAppState } from '../persistence/storage';
import {
  Property,
  Floor,
  Room,
  Bed,
  Tenant,
  PaymentRecord,
  Expense,
  MaintenanceTicket,
  TenantDocument,
} from '../types';

// Mock global localStorage for Node test runner
const localStore: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => (key in localStore ? localStore[key] : null),
    setItem: (key: string, val: string) => {
      localStore[key] = String(val);
    },
    removeItem: (key: string) => {
      delete localStore[key];
    },
    clear: () => {
      for (const k of Object.keys(localStore)) {
        delete localStore[k];
      }
    },
    key: (i: number) => Object.keys(localStore)[i] || null,
    get length() {
      return Object.keys(localStore).length;
    },
  };
}

// Mock Supabase client
vi.mock('../services/supabaseClient', () => {
  let mockAuthUser: any = null;
  let mockDbData: Record<string, any[]> = {};
  let mockStorageFiles: Record<string, Blob | File> = {};

  return {
    isSupabaseConfigured: () => true,
    supabase: {
      auth: {
        getUser: vi.fn(async () => {
          if (!mockAuthUser) {
            return { data: { user: null }, error: new Error('Not logged in') };
          }
          return { data: { user: mockAuthUser }, error: null };
        }),
      },
      from: vi.fn((tableName: string) => {
        let currentFilterOwnerId: string | null = null;
        let queryParams: any = {};

        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn((col: string, val: any) => {
            if (col === 'owner_id') {
              currentFilterOwnerId = val;
            }
            queryParams[col] = val;
            return chain;
          }),
          order: vi.fn(() => chain),
          insert: vi.fn((rows: any | any[]) => {
            const rowList = Array.isArray(rows) ? rows : [rows];
            if (!mockDbData[tableName]) mockDbData[tableName] = [];
            mockDbData[tableName].push(...rowList);
            const insertResult = {
              data: rowList,
              error: null,
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: rowList[0], error: null })),
                then: (resolve: any) => resolve({ data: rowList, error: null }),
              })),
              single: vi.fn(async () => ({ data: rowList[0], error: null })),
              then: (resolve: any) => resolve({ data: rowList, error: null }),
            };
            return insertResult;
          }),
          upsert: vi.fn(async (rows: any | any[]) => {
            const rowList = Array.isArray(rows) ? rows : [rows];
            if (!mockDbData[tableName]) mockDbData[tableName] = [];
            for (const row of rowList) {
              const idx = mockDbData[tableName].findIndex((r) => r.id === row.id);
              if (idx >= 0) {
                mockDbData[tableName][idx] = { ...mockDbData[tableName][idx], ...row };
              } else {
                mockDbData[tableName].push(row);
              }
            }
            return { data: rowList, error: null };
          }),
          single: vi.fn(async () => {
            let rows = mockDbData[tableName] || [];
            if (currentFilterOwnerId) {
              rows = rows.filter((r) => r.owner_id === currentFilterOwnerId);
            }
            for (const [col, val] of Object.entries(queryParams)) {
              if (col !== 'owner_id') {
                rows = rows.filter((r) => r[col] === val);
              }
            }
            if (rows.length === 0) return { data: null, error: { message: 'Row not found in table ' + tableName, code: 'PGRST116' } };
            return { data: rows[0], error: null };
          }),
          update: vi.fn((updates: any) => {
            const updateFilter: Record<string, any> = {};
            const updateChain: any = {
              eq: vi.fn((col: string, val: any) => {
                updateFilter[col] = val;
                return updateChain;
              }),
              then: (resolve: any) => {
                if (mockDbData[tableName]) {
                  mockDbData[tableName] = mockDbData[tableName].map((r) => {
                    const matches = Object.entries(updateFilter).every(([k, v]) => r[k] === v);
                    return matches ? { ...r, ...updates } : r;
                  });
                }
                resolve({ error: null });
              },
            };
            return updateChain;
          }),
          delete: vi.fn(() => {
            const deleteChain: any = {
              eq: vi.fn((col: string, val: any) => {
                if (mockDbData[tableName]) {
                  mockDbData[tableName] = mockDbData[tableName].filter((r) => r[col] !== val);
                }
                return deleteChain;
              }),
              then: (resolve: any) => resolve({ error: null }),
            };
            return deleteChain;
          }),
        };

        // Enable await on the chain for SELECT queries
        chain.then = (resolve: any, reject: any) => {
          let rows = mockDbData[tableName] || [];
          if (currentFilterOwnerId) {
            rows = rows.filter((r) => r.owner_id === currentFilterOwnerId);
          }
          for (const [col, val] of Object.entries(queryParams)) {
            if (col !== 'owner_id') {
              rows = rows.filter((r) => r[col] === val);
            }
          }
          resolve({ data: rows, error: null });
        };

        return chain;
      }),
      storage: {
        from: vi.fn((bucket: string) => ({
          upload: vi.fn(async (path: string, file: any) => {
            if (bucket !== 'tenant-documents') {
              return { data: null, error: new Error('Invalid bucket') };
            }
            mockStorageFiles[`${bucket}/${path}`] = file;
            return { data: { path }, error: null };
          }),
          createSignedUrl: vi.fn(async (path: string, expiresIn: number) => {
            return {
              data: {
                signedUrl: `https://sqrnxichsdmfbtzzdwgi.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock-jwt-expires-${expiresIn}`,
              },
              error: null,
            };
          }),
          remove: vi.fn(async (paths: string[]) => {
            paths.forEach((p) => {
              delete mockStorageFiles[`${bucket}/${p}`];
            });
            return { data: paths, error: null };
          }),
        })),
      },
      __setMockAuthUser: (user: any) => {
        mockAuthUser = user;
      },
      __setMockDbData: (data: Record<string, any[]>) => {
        mockDbData = data;
      },
      __getMockDbData: () => mockDbData,
      __getMockStorageFiles: () => mockStorageFiles,
    },
  };
});

describe('Cloud Persistence & Multi-Owner Isolation Suite', () => {
  const OWNER_ALPHA_UUID = '11111111-1111-4111-8111-111111111111';
  const OWNER_BETA_UUID = '22222222-2222-4222-8222-222222222222';
  const DEMO_OWNER_ID = 'owner-gv-default';

  let supabaseMock: any;

  beforeEach(async () => {
    localStorage.clear();
    const mod = await import('../services/supabaseClient');
    supabaseMock = (mod.supabase as any);
    supabaseMock.__setMockAuthUser({ id: OWNER_ALPHA_UUID, email: 'owner.alpha@greenviewpg.com' });
    supabaseMock.__setMockDbData({});
  });

  // 1. UUID Validation
  describe('1. UUID and Identity Ownership Validation', () => {
    it('accepts genuine RFC 4122 UUIDs for cloud persistence', () => {
      expect(isValidUUID(OWNER_ALPHA_UUID)).toBe(true);
      expect(isValidUUID(OWNER_BETA_UUID)).toBe(true);
      expect(isValidUUID('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(true);
    });

    it('strictly rejects demo account identifiers from being treated as cloud UUIDs', () => {
      expect(isValidUUID(DEMO_OWNER_ID)).toBe(false);
      expect(isValidUUID('owner-gv-user')).toBe(false);
      expect(isValidUUID('demo-user-123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID('undefined')).toBe(false);
    });
  });

  // 2. Data Mappers (snake_case <-> camelCase)
  describe('2. Bidirectional Database Schema Mappings', () => {
    it('maps property entity to database row and back accurately', () => {
      const prop: Property = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ownerId: OWNER_ALPHA_UUID,
        name: 'GreenView Executive PG',
        tagline: 'Modern Living',
        description: 'Prime accommodation in HSR Layout',
        address: '24th Main, Sector 2',
        city: 'Bengaluru',
        pincode: '560102',
        phone: '+91 98765 43210',
        upiId: 'greenview@upi',
        totalFloors: 4,
        isArchived: false,
        createdAt: '2026-10-29T10:00:00Z',
      };

      const row = mapPropertyEntityToRow(prop, OWNER_ALPHA_UUID);
      expect(row.owner_id).toBe(OWNER_ALPHA_UUID);
      expect(row.is_archived).toBe(false);
      expect(row.upi_id).toBe('greenview@upi');

      const restored = mapPropertyRowToEntity(row);
      expect(restored.id).toBe(prop.id);
      expect(restored.name).toBe(prop.name);
      expect(restored.address).toBe(prop.address);
      expect(restored.upiId).toBe(prop.upiId);
    });

    it('maps tenant with individual agreement pricing and structured address', () => {
      const tenant: Tenant = {
        id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
        name: 'Rahul Sharma',
        phone: '9876543210',
        alternatePhone: '9876543211',
        email: 'rahul.s@example.com',
        isPhoneMasked: false,
        permanentAddress: {
          house: 'Flat 402, Sunshine Heights',
          locality: 'Indira Nagar',
          district: 'Bengaluru Urban',
          state: 'Karnataka',
          pincode: '560038',
        },
        emergencyContact: 'Sunil Sharma - 9876500000 (Father)',
        emergencyContactName: 'Sunil Sharma',
        emergencyContactPhone: '9876500000',
        emergencyContactRelation: 'Father',
        employerName: 'Infosys Ltd',
        jobTitle: 'Senior Systems Engineer',
        workplaceAddress: 'Electronic City Phase 1',
        propertyId: 'prop-101',
        roomId: 'room-101',
        bedId: 'Room 101 - Bed A',
        status: 'active',
        joiningDate: '2026-10-01',
        moveInDate: '2026-10-01',
        monthlyDueDay: 5,
        monthlyRent: 8500,
        agreedFoodCharge: 1500,
        totalMonthlyAmount: 10000,
        pricingBasis: 'per_person',
        depositRequired: 20000,
        depositReceived: 20000,
        assignedInventory: [],
        stayHistory: [],
        whatsappLogs: [],
        documents: [],
        rentHistory: [
          {
            id: 'rh-1',
            effectiveDate: '2026-10-01',
            previousRent: 8000,
            newRent: 8500,
            previousFoodCharge: 1500,
            newFoodCharge: 1500,
            reason: 'Initial agreed lease',
            changedAt: '2026-10-01T00:00:00Z',
          },
        ],
      };

      const row = mapTenantEntityToRow(tenant, OWNER_ALPHA_UUID);
      expect(row.owner_id).toBe(OWNER_ALPHA_UUID);
      expect(row.total_monthly_amount).toBe(10000);
      expect(row.agreed_food_charge).toBe(1500);
      expect(row.permanent_address.pincode).toBe('560038');
      expect(row.rent_history).toHaveLength(1);

      const restored = mapTenantRowToEntity(row, []);
      expect(restored.id).toBe(tenant.id);
      expect(restored.totalMonthlyAmount).toBe(10000);
      expect(restored.permanentAddress?.pincode).toBe('560038');
      expect(restored.rentHistory).toHaveLength(1);
      expect(restored.rentHistory![0].reason).toBe('Initial agreed lease');
    });
  });

  // 3. New Owner Provisioning in Supabase
  describe('3. Authenticated Cloud Owner Initialization', () => {
    it('initializes starter property and floors in Supabase for a newly registered owner', async () => {
      const res = await initializeCloudOwner(OWNER_ALPHA_UUID, 'GreenView Phase 2');
      expect(res.success).toBe(true);
      expect(res.property).toBeDefined();
      expect(res.property?.ownerId).toBe(OWNER_ALPHA_UUID);
      expect(res.property?.name).toBe('GreenView Phase 2');

      const mockDb = supabaseMock.__getMockDbData();
      expect(mockDb.properties).toHaveLength(1);
      expect(mockDb.properties[0].owner_id).toBe(OWNER_ALPHA_UUID);
      expect(mockDb.floors).toHaveLength(3); // Ground Floor + Floor 1 + Floor 2
      expect(mockDb.floors[0].owner_id).toBe(OWNER_ALPHA_UUID);
    });
  });

  // 4. Strict Isolation Between Two Authenticated Owners
  describe('4. Multi-Owner Cloud Isolation', () => {
    it('ensures Owner A cannot view or manipulate Owner B records', async () => {
      // Seed Owner Alpha records
      const propAlpha = {
        id: 'prop-alpha',
        owner_id: OWNER_ALPHA_UUID,
        name: 'Alpha Heights PG',
        address: 'Alpha Road',
        city: 'Bengaluru',
        pincode: '560001',
        phone: '9999911111',
        total_floors: 2,
        is_archived: false,
      };
      const roomAlpha = {
        id: 'room-alpha-101',
        property_id: 'prop-alpha',
        owner_id: OWNER_ALPHA_UUID,
        room_number: '101',
        capacity: 2,
        beds: [],
      };
      const tenantAlpha = {
        id: 'tenant-alpha-1',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-alpha',
        name: 'Alpha Resident',
        phone: '9999900001',
        monthly_rent: 7000,
        status: 'active',
      };

      // Seed Owner Beta records
      const propBeta = {
        id: 'prop-beta',
        owner_id: OWNER_BETA_UUID,
        name: 'Beta Sanctuary PG',
        address: 'Beta Road',
        city: 'Bengaluru',
        pincode: '560002',
        phone: '9999922222',
        total_floors: 3,
        is_archived: false,
      };
      const tenantBeta = {
        id: 'tenant-beta-1',
        owner_id: OWNER_BETA_UUID,
        property_id: 'prop-beta',
        name: 'Beta Resident',
        phone: '9999900002',
        monthly_rent: 9500,
        status: 'active',
      };

      supabaseMock.__setMockDbData({
        properties: [propAlpha, propBeta],
        rooms: [roomAlpha],
        tenants: [tenantAlpha, tenantBeta],
        floors: [],
        beds: [],
        payments: [],
        rent_charges: [],
        expenses: [],
        maintenance_tickets: [],
        inventory_items: [],
        tenant_documents: [],
      });

      // Load for Owner Alpha
      const loadAlpha = await loadCloudDataForOwner(OWNER_ALPHA_UUID);
      expect(loadAlpha.success).toBe(true);
      expect(loadAlpha.data?.property.id).toBe('prop-alpha');
      expect(loadAlpha.data?.tenants).toHaveLength(1);
      expect(loadAlpha.data?.tenants[0].name).toBe('Alpha Resident');

      // Verify Beta records are completely absent from Alpha's loaded state
      const betaFoundInAlpha = loadAlpha.data?.tenants.some((t) => t.id === 'tenant-beta-1');
      expect(betaFoundInAlpha).toBe(false);

      // Load for Owner Beta
      const loadBeta = await loadCloudDataForOwner(OWNER_BETA_UUID);
      expect(loadBeta.success).toBe(true);
      expect(loadBeta.data?.property.id).toBe('prop-beta');
      expect(loadBeta.data?.tenants).toHaveLength(1);
      expect(loadBeta.data?.tenants[0].name).toBe('Beta Resident');
    });
  });

  // 5. Offline Cache and Reload Safety
  describe('5. Offline Cache and Reload Resilience', () => {
    it('reads offline cache for authenticated owner without generating empty demo data', () => {
      const stateToCache = {
        version: 1,
        ownerId: OWNER_ALPHA_UUID,
        property: {
          id: 'prop-cached',
          ownerId: OWNER_ALPHA_UUID,
          name: 'Cached Cloud PG',
          address: 'Cached Address',
          city: 'Bengaluru',
          pincode: '560100',
          phone: '9888877777',
          upiId: 'cached@upi',
          totalFloors: 2,
          isArchived: false,
          createdAt: new Date().toISOString(),
        },
        properties: [],
        floors: [],
        rooms: [
          {
            id: 'room-cached-1',
            propertyId: 'prop-cached',
            floorId: 'floor-1',
            roomNumber: 'G01',
            sharingType: 'Single',
            capacity: 1,
            hasAc: false,
            hasAttachedBathroom: true,
            hasBalcony: false,
            bathroomType: 'attached' as const,
            roomRent: 8000,
            pricingBasis: 'per_person' as const,
            status: 'available' as const,
            foodPlan: 'no_food' as const,
            beds: [],
          },
        ],
        tenants: [],
        rentCharges: [],
        payments: [],
        securityDeposits: [],
        expenses: [],
        maintenanceTickets: [],
        amenities: [],
        demoDate: '2026-10-29',
        selectedMonth: '2026-10',
      };

      saveAppState(stateToCache, OWNER_ALPHA_UUID);

      const cached = getCachedAppState(OWNER_ALPHA_UUID);
      expect(cached).not.toBeNull();
      expect(cached?.property.name).toBe('Cached Cloud PG');
      expect(cached?.rooms).toHaveLength(1);

      // Non-existent owner cache returns null rather than polluting with dummy data
      const nonExistent = getCachedAppState('99999999-9999-9999-9999-999999999999');
      expect(nonExistent).toBeNull();
    });
  });

  // 6. Tenant Documents and Private Supabase Storage
  describe('6. Tenant Documents & Private Cloud Storage', () => {
    it('uploads tenant document to private bucket and retrieves signed time-limited URL', async () => {
      const doc: TenantDocument = {
        id: 'doc-aadhaar-1',
        tenantId: 't-101',
        documentType: 'aadhaar',
        title: 'Aadhaar Card (Masked)',
        maskedDocumentNumber: 'XXXX-XXXX-4321',
        fileName: 'aadhaar_masked.pdf',
        fileSize: 102400,
        mimeType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
        verificationStatus: 'verified',
        storagePath: `${OWNER_ALPHA_UUID}/t-101/doc-aadhaar-1.pdf`,
        consentObtained: true,
        ownerId: OWNER_ALPHA_UUID,
      };

      const mockFile = new Blob(['sample pdf content'], { type: 'application/pdf' });

      // 1. Upload to Supabase Storage
      const uploadRes = await uploadTenantDocumentCloud(doc, mockFile, OWNER_ALPHA_UUID);
      expect(uploadRes.success).toBe(true);

      const storageFiles = supabaseMock.__getMockStorageFiles();
      expect(storageFiles[`tenant-documents/${doc.storagePath}`]).toBeDefined();

      // 2. Obtain Signed URL
      const signedRes = await getSignedDocumentUrlCloud(doc.storagePath);
      expect(signedRes.success).toBe(true);
      expect(signedRes.signedUrl).toContain('token=mock-jwt-expires-300');

      // 3. Delete Document from Cloud Storage
      const deleteRes = await deleteTenantDocumentCloud(doc.id, OWNER_ALPHA_UUID, doc.storagePath);
      expect(deleteRes.success).toBe(true);
      expect(supabaseMock.__getMockStorageFiles()[`tenant-documents/${doc.storagePath}`]).toBeUndefined();
    });
  });

  // 7. Owner-Controlled Pricing & Rent History Cloud Sync
  describe('7. Pricing Agreement & Rent History Persistence', () => {
    it('persists agreed rent adjustments and protects against price contamination', async () => {
      const tenant: Tenant = {
        id: 't-202',
        name: 'Priya Patel',
        phone: '9876543222',
        propertyId: 'prop-101',
        roomId: 'room-102',
        bedId: 'Room 102 - Bed B',
        status: 'active',
        joiningDate: '2026-09-01',
        moveInDate: '2026-09-01',
        monthlyRent: 9000,
        agreedFoodCharge: 2000,
        totalMonthlyAmount: 11000,
        pricingBasis: 'per_person',
        isPhoneMasked: false,
        monthlyDueDay: 1,
        depositRequired: 18000,
        depositReceived: 18000,
        assignedInventory: [],
        stayHistory: [],
        whatsappLogs: [],
        documents: [],
        rentHistory: [
          {
            id: 'rh-init',
            effectiveDate: '2026-09-01',
            previousRent: 9000,
            newRent: 9000,
            previousFoodCharge: 2000,
            newFoodCharge: 2000,
            reason: 'Move-in agreed rate',
            changedAt: '2026-09-01T00:00:00Z',
          },
        ],
      };

      // Upsert into Supabase
      const upsertRes = await upsertCloudTenant(tenant, OWNER_ALPHA_UUID);
      expect(upsertRes.success).toBe(true);

      const dbRows = supabaseMock.__getMockDbData().tenants;
      expect(dbRows).toHaveLength(1);
      expect(dbRows[0].monthly_rent).toBe(9000);
      expect(dbRows[0].agreed_food_charge).toBe(2000);
      expect(dbRows[0].total_monthly_amount).toBe(11000);

      // Now owner negotiates rent adjustment (+500 rent, food unchanged)
      const adjustedTenant: Tenant = {
        ...tenant,
        monthlyRent: 9500,
        totalMonthlyAmount: 11500,
        rentHistory: [
          ...tenant.rentHistory!,
          {
            id: 'rh-revised',
            effectiveDate: '2026-11-01',
            previousRent: 9000,
            newRent: 9500,
            previousFoodCharge: 2000,
            newFoodCharge: 2000,
            reason: 'Annual agreement adjustment',
            changedAt: '2026-10-29T12:00:00Z',
          },
        ],
      };

      const secondUpsert = await upsertCloudTenant(adjustedTenant, OWNER_ALPHA_UUID);
      expect(secondUpsert.success).toBe(true);

      const updatedRows = supabaseMock.__getMockDbData().tenants;
      expect(updatedRows).toHaveLength(1);
      expect(updatedRows[0].monthly_rent).toBe(9500);
      expect(updatedRows[0].total_monthly_amount).toBe(11500);
      expect(updatedRows[0].rent_history).toHaveLength(2);
      expect(updatedRows[0].rent_history[1].reason).toBe('Annual agreement adjustment');
    });
  });

  // 8. Tenant Checkout Cloud Persistence
  describe('8. Tenant Checkout Cloud Persistence', () => {
    it('persists tenant checkout, frees assigned bed, and records stay history in Supabase', async () => {
      // Setup active tenant and occupied bed in mock DB
      const tenantRow = {
        id: 't-chk-001',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-101',
        room_id: 'room-101',
        bed_id: 'bed-101-1',
        name: 'Rohan Mehra',
        phone: '9845012399',
        status: 'active',
        monthly_rent: 7000,
      };
      const bedRow = {
        id: 'bed-101-1',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-101',
        room_id: 'room-101',
        label: 'Bed 1',
        status: 'occupied',
        current_tenant_id: 't-chk-001',
      };
      supabaseMock.__getMockDbData().tenants = [tenantRow];
      supabaseMock.__getMockDbData().beds = [bedRow];

      const checkoutRes = await checkoutCloudTenant(
        't-chk-001',
        '2026-10-31',
        OWNER_ALPHA_UUID,
        { roomNumber: '101', bedLabel: 'Bed 1', notes: 'Checkout clearance complete' },
        5000
      );
      expect(checkoutRes.success).toBe(true);

      // Verify bed is released to vacant
      const updatedBed = supabaseMock.__getMockDbData().beds.find((b: any) => b.id === 'bed-101-1');
      expect(updatedBed.status).toBe('vacant');
      expect(updatedBed.current_tenant_id).toBeNull();

      // Verify tenant status is checked_out
      const updatedTenant = supabaseMock.__getMockDbData().tenants.find((t: any) => t.id === 't-chk-001');
      expect(updatedTenant.status).toBe('checked_out');
      expect(updatedTenant.actual_checkout_date).toBe('2026-10-31');

      // Verify stay history log
      const stayLogs = supabaseMock.__getMockDbData().stay_history || [];
      expect(stayLogs.length).toBeGreaterThanOrEqual(1);
      const log = stayLogs.find((s: any) => s.tenant_id === 't-chk-001');
      expect(log.action).toBe('checked_out');
      expect(log.room_number).toBe('101');
    });
  });

  // 9. Room/Berth Transfer Cloud Persistence
  describe('9. Room/Berth Transfer Cloud Persistence', () => {
    it('persists berth transfer, frees source bed, occupies target bed, and updates rent history', async () => {
      const tenantRow = {
        id: 't-mov-001',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-101',
        room_id: 'room-101',
        bed_id: 'bed-101-1',
        name: 'Karan Johar',
        monthly_rent: 6000,
        agreed_food_charge: 1000,
        total_monthly_amount: 7000,
        rent_history: [],
      };
      const oldBedRow = {
        id: 'bed-101-1',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-101',
        status: 'occupied',
        current_tenant_id: 't-mov-001',
      };
      const targetBedRow = {
        id: 'bed-201-1',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-101',
        status: 'vacant',
        current_tenant_id: null,
      };

      supabaseMock.__getMockDbData().tenants = [tenantRow];
      supabaseMock.__getMockDbData().beds = [oldBedRow, targetBedRow];

      const moveRes = await transferCloudTenant(
        't-mov-001',
        'room-201',
        'bed-201-1',
        '2026-11-01',
        'room-101',
        'bed-101-1',
        OWNER_ALPHA_UUID,
        { newRent: 7500, reason: 'Room upgrade' },
        { roomNumber: '201', bedLabel: 'Single Bed 1' }
      );
      expect(moveRes.success).toBe(true);

      // Verify old bed is vacant
      const updatedOldBed = supabaseMock.__getMockDbData().beds.find((b: any) => b.id === 'bed-101-1');
      expect(updatedOldBed.status).toBe('vacant');
      expect(updatedOldBed.current_tenant_id).toBeNull();

      // Verify target bed is occupied
      const updatedTargetBed = supabaseMock.__getMockDbData().beds.find((b: any) => b.id === 'bed-201-1');
      expect(updatedTargetBed.status).toBe('occupied');
      expect(updatedTargetBed.current_tenant_id).toBe('t-mov-001');

      // Verify tenant room and rent updated
      const updatedT = supabaseMock.__getMockDbData().tenants.find((t: any) => t.id === 't-mov-001');
      expect(updatedT.room_id).toBe('room-201');
      expect(updatedT.bed_id).toBe('bed-201-1');
      expect(updatedT.monthly_rent).toBe(7500);
      expect(updatedT.total_monthly_amount).toBe(8500); // 7500 + 1000 food
      expect(updatedT.rent_history).toHaveLength(1);
      expect(updatedT.rent_history[0].newRent).toBe(7500);
    });
  });

  // 10. Tenant Notice Handling Cloud Persistence
  describe('10. Tenant Notice Handling Cloud Persistence', () => {
    it('persists notice status to tenant, bed, and stay history in Supabase', async () => {
      const tenantRow = {
        id: 't-not-001',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-101',
        bed_id: 'bed-101-2',
        status: 'active',
      };
      const bedRow = {
        id: 'bed-101-2',
        owner_id: OWNER_ALPHA_UUID,
        property_id: 'prop-101',
        status: 'occupied',
        current_tenant_id: 't-not-001',
      };

      supabaseMock.__getMockDbData().tenants = [tenantRow];
      supabaseMock.__getMockDbData().beds = [bedRow];

      const noticeRes = await setNoticeCloudTenant(
        't-not-001',
        '2026-10-29',
        '2026-11-29',
        OWNER_ALPHA_UUID,
        'Relocating to another city',
        { roomNumber: '101', bedLabel: 'Bed 2' }
      );
      expect(noticeRes.success).toBe(true);

      // Verify bed status updated to notice
      const updatedBed = supabaseMock.__getMockDbData().beds.find((b: any) => b.id === 'bed-101-2');
      expect(updatedBed.status).toBe('notice');

      // Verify tenant status updated to notice
      const updatedT = supabaseMock.__getMockDbData().tenants.find((t: any) => t.id === 't-not-001');
      expect(updatedT.status).toBe('notice');
    });
  });

  // 11. Rent Charges & Maintenance Tickets Cloud Persistence
  describe('11. Rent Charges & Maintenance Tickets Persistence', () => {
    it('persists batch rent charges and maintenance tickets with owner UUID', async () => {
      const charges = [
        {
          id: 'chg-101',
          tenantId: 't-001',
          billingMonth: '2026-11',
          dueDate: '2026-11-05',
          amount: 8000,
          isProrated: false,
          createdAt: new Date().toISOString(),
        },
      ];

      const chargesRes = await upsertCloudRentCharges(charges, 'prop-101', OWNER_ALPHA_UUID);
      expect(chargesRes.success).toBe(true);

      const dbCharges = supabaseMock.__getMockDbData().rent_charges || [];
      expect(dbCharges).toHaveLength(1);
      expect(dbCharges[0].amount).toBe(8000);
      expect(dbCharges[0].owner_id).toBe(OWNER_ALPHA_UUID);

      const ticket: MaintenanceTicket = {
        id: 'tkt-001',
        ticketNumber: 'TKT-101',
        title: 'Geyser repair in Room 102',
        description: 'Water heating coil broken',
        floorId: 'floor-1',
        roomId: 'room-102',
        category: 'plumbing',
        priority: 'high',
        status: 'pending',
        createdDate: '2026-10-29T10:00:00Z',
        estimatedCost: 1500,
      };

      const ticketRes = await upsertCloudMaintenanceTicket(ticket, 'prop-101', OWNER_ALPHA_UUID);
      expect(ticketRes.success).toBe(true);

      const dbTickets = supabaseMock.__getMockDbData().maintenance_tickets || [];
      expect(dbTickets).toHaveLength(1);
      expect(dbTickets[0].title).toBe('Geyser repair in Room 102');
      expect(dbTickets[0].owner_id).toBe(OWNER_ALPHA_UUID);
    });
  });

  // 12. Multi-Building Creation & Archiving Cloud Persistence
  describe('12. Multi-Building Creation & Archiving Cloud Persistence', () => {
    it('persists new building, associated floors, and supports archiving', async () => {
      const newProperty: Property = {
        id: 'prop-building-2',
        ownerId: OWNER_ALPHA_UUID,
        name: 'GreenView Men PG - Annex',
        address: '456 Tech Park Road',
        city: 'Bengaluru',
        pincode: '560100',
        phone: '+91 98450 99999',
        upiId: 'annex@upi',
        totalFloors: 2,
        isArchived: false,
      };

      const propRes = await upsertCloudProperty(newProperty, OWNER_ALPHA_UUID);
      expect(propRes.success).toBe(true);

      const floors: Floor[] = [
        { id: 'floor-1-b2', propertyId: 'prop-building-2', number: 1, name: 'Ground Floor', totalRooms: 4 },
        { id: 'floor-2-b2', propertyId: 'prop-building-2', number: 2, name: 'First Floor', totalRooms: 4 },
      ];
      const floorsRes = await upsertCloudFloors(floors, OWNER_ALPHA_UUID);
      expect(floorsRes.success).toBe(true);

      const dbProps = supabaseMock.__getMockDbData().properties || [];
      expect(dbProps.some((p: any) => p.id === 'prop-building-2')).toBe(true);

      // Archive building
      const archiveRes = await archiveCloudProperty('prop-building-2', true, OWNER_ALPHA_UUID);
      expect(archiveRes.success).toBe(true);

      const archivedProp = dbProps.find((p: any) => p.id === 'prop-building-2');
      expect(archivedProp.is_archived).toBe(true);
    });
  });

  // 13. Two-Owner Strict Cloud Isolation
  describe('13. Strict Two-Owner Cloud Isolation', () => {
    it('strictly prevents Owner Alpha from accessing or modifying Owner Beta records', async () => {
      // Owner Beta owns a tenant and a bed
      const betaTenant = {
        id: 't-beta-999',
        owner_id: OWNER_BETA_UUID,
        property_id: 'prop-beta-1',
        bed_id: 'bed-beta-1',
        name: 'Secret Beta Resident',
        status: 'active',
      };
      supabaseMock.__getMockDbData().tenants = [betaTenant];

      // Owner Alpha tries to checkout Owner Beta's tenant -> fails
      const checkoutAttempt = await checkoutCloudTenant('t-beta-999', '2026-10-31', OWNER_ALPHA_UUID);
      expect(checkoutAttempt.success).toBe(false);
      expect(checkoutAttempt.error?.toLowerCase()).toContain('not found');

      // Tenant remains active under Owner Beta
      expect(betaTenant.status).toBe('active');
    });
  });

  // 14. Failure Visibility
  describe('14. Cloud Failure Visibility', () => {
    it('rejects unauthenticated requests or invalid owner UUIDs without reporting success', async () => {
      const res = await checkoutCloudTenant('t-001', '2026-10-31', 'not-a-valid-uuid');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Unauthenticated cloud session.');

      const moveRes = await transferCloudTenant(
        't-001',
        'r-1',
        'b-1',
        '2026-10-31',
        'r-0',
        'b-0',
        'demo-id-prohibited'
      );
      expect(moveRes.success).toBe(false);
      expect(moveRes.error).toBe('Unauthenticated cloud session.');
    });
  });
});
