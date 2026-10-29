import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { AppState, TenantDocument } from '../types';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
// Normalize URL to base origin (strip trailing /rest/v1/ or slashes if provided)
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-id') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0 &&
    !supabaseAnonKey.includes('your-anon-public-key')
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
    propertyName?: string;
  };
  error?: string;
}

/**
 * Storage helpers for private Supabase documents
 */
const DOCUMENTS_BUCKET = 'tenant-documents';

export async function uploadDocumentToSupabase(
  ownerId: string,
  tenantId: string,
  file: Blob | File,
  fileName: string
): Promise<{ path?: string; error?: string }> {
  if (!supabase) {
    return { error: 'Supabase client is not configured' };
  }

  try {
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${ownerId}/${tenantId}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { error: uploadError.message };
    }

    return { path: storagePath };
  } catch (err: any) {
    return { error: err?.message || 'Failed to upload document to Supabase storage' };
  }
}

export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds: number = 300
): Promise<{ url?: string; error?: string }> {
  if (!supabase) {
    return { error: 'Supabase client is not configured' };
  }

  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      return { error: error?.message || 'Failed to generate signed document URL' };
    }

    return { url: data.signedUrl };
  } catch (err: any) {
    return { error: err?.message || 'Error retrieving signed document URL' };
  }
}

export async function deleteDocumentFromSupabase(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  try {
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([storagePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete file from storage' };
  }
}

