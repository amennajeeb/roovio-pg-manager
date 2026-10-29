import { AppState, AuthUser } from '../types';
import { getInitialSeedData, createStarterStateForOwner } from '../fixtures/seedData';

const BASE_STORAGE_KEY = 'greenview_pg_manager_data_v1';
const AUTH_USERS_KEY = 'greenview_auth_registered_users_v1';
const CURRENT_VERSION = 1;

export function getOwnerStorageKey(ownerId?: string): string {
  if (!ownerId || ownerId === 'owner-gv-default') {
    return BASE_STORAGE_KEY;
  }
  return `${BASE_STORAGE_KEY}_${ownerId}`;
}

// In-memory fallback for environments without window.localStorage (e.g. Node.js unit tests)
const fallbackStorage = new Map<string, string>();

export function getStoredItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Fall through to in-memory store
  }
  return fallbackStorage.get(key) || null;
}

export function setStoredItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fall through to in-memory store
  }
  fallbackStorage.set(key, value);
}

export function sanitizeStateForStorage(state: AppState): AppState {
  const sanitizedTenants = state.tenants.map((tenant) => ({
    ...tenant,
    documents: tenant.documents?.map((doc) => {
      // Explicitly keep only metadata, never file contents, raw bytes, or blob strings
      const {
        id,
        tenantId,
        documentType,
        title,
        maskedDocumentNumber,
        fileName,
        fileSize,
        mimeType,
        uploadedAt,
        verificationStatus,
        verificationNotes,
        rejectionReason,
        verifiedAt,
        verifiedBy,
        storagePath,
        consentObtained,
        ownerId,
      } = doc;
      return {
        id,
        tenantId,
        documentType,
        title,
        maskedDocumentNumber,
        fileName,
        fileSize,
        mimeType,
        uploadedAt,
        verificationStatus,
        verificationNotes,
        rejectionReason,
        verifiedAt,
        verifiedBy,
        storagePath,
        consentObtained,
        ownerId,
      };
    }),
  }));

  return {
    ...state,
    tenants: sanitizedTenants,
  };
}

/**
 * Safely inspect and retrieve existing cached state without manufacturing seed data.
 * Used for safe offline fallback when cloud loading is active.
 */
export function getCachedAppState(ownerId?: string): AppState | null {
  const key = getOwnerStorageKey(ownerId);
  try {
    const raw = getStoredItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CURRENT_VERSION) {
      return null;
    }
    if (!parsed.rooms || !parsed.tenants || !parsed.rentCharges || !parsed.expenses) {
      return null;
    }
    const properties = Array.isArray(parsed.properties) && parsed.properties.length > 0
      ? parsed.properties
      : [parsed.property];
    const activePropertyId = parsed.activePropertyId || properties[0]?.id || parsed.property?.id;
    const activeProperty = properties.find((p: any) => p.id === activePropertyId) || properties[0] || parsed.property;

    return {
      ...parsed,
      properties,
      activePropertyId,
      property: activeProperty,
    } as AppState;
  } catch {
    return null;
  }
}

export function loadAppState(ownerId?: string): AppState {
  const key = getOwnerStorageKey(ownerId);
  try {
    const raw = getStoredItem(key);
    if (!raw) {
      const initial =
        ownerId && ownerId !== 'owner-gv-default'
          ? createStarterStateForOwner(ownerId)
          : getInitialSeedData();
      saveAppState(initial, ownerId);
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== CURRENT_VERSION) {
      console.warn('Storage schema version mismatch or invalid format. Resetting to initial seed.');
      const initial =
        ownerId && ownerId !== 'owner-gv-default'
          ? createStarterStateForOwner(ownerId)
          : getInitialSeedData();
      saveAppState(initial, ownerId);
      return initial;
    }

    // Basic structure validation
    if (!parsed.rooms || !parsed.tenants || !parsed.rentCharges || !parsed.expenses) {
      console.warn('Missing vital arrays in stored state. Restoring default seed.');
      const initial =
        ownerId && ownerId !== 'owner-gv-default'
          ? createStarterStateForOwner(ownerId)
          : getInitialSeedData();
      saveAppState(initial, ownerId);
      return initial;
    }

    // Ensure properties array and activePropertyId are initialized for backward compatibility
    const properties = Array.isArray(parsed.properties) && parsed.properties.length > 0
      ? parsed.properties
      : [parsed.property];
    const activePropertyId = parsed.activePropertyId || properties[0]?.id || parsed.property.id;
    const activeProperty = properties.find((p: any) => p.id === activePropertyId) || properties[0] || parsed.property;

    return {
      ...parsed,
      properties,
      activePropertyId,
      property: activeProperty,
    } as AppState;
  } catch (err) {
    console.error('Failed to load state from storage:', err);
    const initial =
      ownerId && ownerId !== 'owner-gv-default'
        ? createStarterStateForOwner(ownerId)
        : getInitialSeedData();
    saveAppState(initial, ownerId);
    return initial;
  }
}

export function saveAppState(state: AppState, ownerId?: string): boolean {
  const activeOwnerId = ownerId || state.ownerId;
  const key = getOwnerStorageKey(activeOwnerId);
  try {
    // Sanitize state before saving: strictly strip any binary data or URLs
    const sanitizedState = sanitizeStateForStorage({
      ...state,
      ownerId: activeOwnerId || 'owner-gv-default',
    });
    const serialized = JSON.stringify(sanitizedState);
    setStoredItem(key, serialized);
    return true;
  } catch (err) {
    console.error('Failed to save state to storage:', err);
    return false;
  }
}

export function resetAppState(ownerId?: string): AppState {
  const initial =
    ownerId && ownerId !== 'owner-gv-default'
      ? createStarterStateForOwner(ownerId)
      : getInitialSeedData();
  saveAppState(initial, ownerId);
  return initial;
}

export interface RegisteredAccount {
  id: string;
  email: string;
  passwordHash: string; // Stored securely/hashed for local fallback
  name: string;
  propertyName: string;
  createdAt: string;
}

export function getStoredAuthUsers(): RegisteredAccount[] {
  try {
    const raw = getStoredItem(AUTH_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredAuthUser(user: RegisteredAccount): void {
  const existing = getStoredAuthUsers();
  const filtered = existing.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
  filtered.push(user);
  setStoredItem(AUTH_USERS_KEY, JSON.stringify(filtered));
}

export function exportAppStateJSON(state: AppState): void {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `roovio_pg_backup_${state.demoDate}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function validateImportedJSON(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Partial<AppState>;
  return (
    typeof obj.version === 'number' &&
    Array.isArray(obj.floors) &&
    Array.isArray(obj.rooms) &&
    Array.isArray(obj.tenants) &&
    Array.isArray(obj.rentCharges) &&
    Array.isArray(obj.payments) &&
    Array.isArray(obj.expenses) &&
    typeof obj.property === 'object' &&
    typeof obj.demoDate === 'string'
  );
}

