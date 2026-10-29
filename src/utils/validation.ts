/**
 * Validation helpers for Indian PG Management.
 */

/**
 * Checks if a phone number is an unmasked valid 10-digit Indian mobile number
 * (or with +91 prefix).
 */
export function isValidIndianPhone(phone: string): boolean {
  if (!phone) return false;
  // If it contains mask letters like X
  if (/X/i.test(phone)) return false;

  // Clean non-digits
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return true;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]\d{9}$/.test(digits.slice(2))) {
    return true;
  }
  return false;
}

/**
 * Check if the phone number is marked or formatted as masked demo number
 */
export function isMaskedPhone(phone: string): boolean {
  return /X/i.test(phone);
}

/**
 * Format 10-digit or 12-digit number to standard +91 XXXXX XXXXX
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  if (isMaskedPhone(phone)) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const raw = digits.slice(2);
    return `+91 ${raw.slice(0, 5)} ${raw.slice(5)}`;
  }
  return phone;
}

/**
 * Generate wa.me link with URL-encoded message
 */
export function generateWhatsAppLink(phone: string, message: string): string | null {
  if (!isValidIndianPhone(phone)) return null;
  const digits = phone.replace(/\D/g, '');
  const internationalNumber = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${internationalNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * Validate 6-digit Indian Postal PIN Code (e.g. 560038)
 */
export function isValidIndianPIN(pin: string): boolean {
  if (!pin) return false;
  const clean = pin.trim().replace(/\s/g, '');
  return /^[1-9][0-9]{5}$/.test(clean);
}

/**
 * Validate standard email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

/**
 * Mask Aadhaar number to retain ONLY the last 4 digits (e.g. "•••• •••• 1234").
 * Strictly prevents storing, transmitting, or displaying the first 8 digits.
 */
export function maskAadhaarNumber(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 4) {
    const last4 = digits.slice(-4);
    return `•••• •••• ${last4}`;
  }
  return input.trim();
}

/**
 * Validate document file format and size limits for private Supabase storage.
 * Enforces:
 * - Allowed types: PDF, JPEG, PNG, WebP
 * - Maximum size: 10MB (10,485,760 bytes)
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function validateDocumentUpload(file: { size: number; type: string; name?: string }): {
  valid: boolean;
  error?: string;
} {
  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  // Size limit check (10MB)
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeInMB}MB) exceeds the maximum allowed limit of 10MB.`,
    };
  }

  // Allowed MIME types
  if (file.type && !ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload PDF, JPEG, PNG, or WebP files.',
    };
  }

  return { valid: true };
}

