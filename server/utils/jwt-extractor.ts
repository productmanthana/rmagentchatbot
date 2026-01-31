/**
 * JWT Field Extractor - Flexible extraction for any JWT format
 * 
 * Supports:
 * - Microsoft .NET Identity claims (long URL field names)
 * - Standard JWT / OIDC claims
 * - Custom claim formats
 * 
 * Automatically detects and extracts: username, role, tenant
 * Even if client changes JWT format, this will auto-extract fields
 */

// ═══════════════════════════════════════════════════════════════════════════
// FIELD NAME PRIORITY LISTS - Check in order, return first match
// ═══════════════════════════════════════════════════════════════════════════

const USERNAME_FIELDS = [
  // Microsoft .NET Identity claims (your client uses these)
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/name",
  "http://schemas.microsoft.com/identity/claims/name",
  
  // Standard JWT / OIDC claims
  "preferred_username",
  "username",
  "user_name",
  "userName",
  "unique_name",
  "name",
  "email",
  "sub",
  "userId",
  "user_id",
  "uid",
  "login",
  "upn",  // User Principal Name
  "given_name",
  "nickname",
  
  // Azure AD specific
  "http://schemas.microsoft.com/identity/claims/objectidentifier",
  "oid",
];

const ROLE_FIELDS = [
  // Microsoft .NET Identity claims (your client uses these)
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role",
  "http://schemas.microsoft.com/identity/claims/role",
  
  // Standard claims
  "role",
  "roles",
  "Role",
  "Roles",
  "user_role",
  "userRole",
  "user_type",
  "userType",
  "permissions",
  "groups",
  "scope",
  "scopes",
  
  // Azure AD specific
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/groupsid",
];

const TENANT_FIELDS = [
  // Your client uses this
  "Tenant",
  "tenant",
  
  // Common variations
  "tenant_id",
  "tenantId",
  "TenantId",
  "tenant_name",
  "tenantName",
  "org",
  "organization",
  "Organization",
  "org_id",
  "orgId",
  "company",
  "Company",
  "company_id",
  "companyId",
  "client_id",
  "clientId",
  "account",
  "accountId",
  "account_id",
  
  // Azure AD specific
  "tid",
  "http://schemas.microsoft.com/identity/claims/tenantid",
];

const EXPIRY_FIELDS = [
  "exp",
  "expiry",
  "expires",
  "expires_at",
  "expiresAt",
  "expiration",
];

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT ROLE TO CHATBOT ROLE MAPPING
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_MAPPING: Record<string, 'user' | 'admin' | 'superadmin'> = {
  // Your client's roles (case-insensitive matching below)
  "admin": "admin",
  "super admin": "superadmin",
  "superadmin": "superadmin",
  "poc members": "user",
  "pocmembers": "user",
  "poradmingroup": "admin",
  "pormanagers": "user",
  
  // Common role names (fallback)
  "administrator": "admin",
  "manager": "admin",
  "supervisor": "admin",
  "user": "user",
  "member": "user",
  "viewer": "user",
  "guest": "user",
  "readonly": "user",
  "read-only": "user",
  "owner": "superadmin",
  "root": "superadmin",
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface JWTExtractedData {
  username: string | null;
  clientRole: string | null;
  mappedRole: 'user' | 'admin' | 'superadmin';
  tenant: string | null;
  expiry: number | null;
  isExpired: boolean;
  uniqueUserId: string;  // tenant_username format
  rawPayload: Record<string, any>;
}

export interface JWTDecodeResult {
  success: boolean;
  data?: JWTExtractedData;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find first matching field value from payload
 */
function findField(payload: Record<string, any>, fieldNames: string[]): string | null {
  for (const field of fieldNames) {
    const value = payload[field];
    if (value !== undefined && value !== null && value !== '') {
      // Handle array values (some claims like roles can be arrays)
      if (Array.isArray(value)) {
        return value[0]?.toString() || null;
      }
      return value.toString();
    }
  }
  return null;
}

/**
 * Find expiry field (returns number)
 */
function findExpiryField(payload: Record<string, any>): number | null {
  for (const field of EXPIRY_FIELDS) {
    const value = payload[field];
    if (value !== undefined && value !== null) {
      const numValue = typeof value === 'number' ? value : parseInt(value, 10);
      if (!isNaN(numValue)) {
        return numValue;
      }
    }
  }
  return null;
}

/**
 * Map client role to chatbot role
 */
function mapRole(clientRole: string | null): 'user' | 'admin' | 'superadmin' {
  if (!clientRole) return 'user';
  
  // Normalize: lowercase and remove extra spaces
  const normalized = clientRole.toLowerCase().trim().replace(/\s+/g, ' ');
  
  // Check exact match first
  if (ROLE_MAPPING[normalized]) {
    return ROLE_MAPPING[normalized];
  }
  
  // Check partial matches
  for (const [key, mappedRole] of Object.entries(ROLE_MAPPING)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return mappedRole;
    }
  }
  
  // Default to user if no match
  return 'user';
}

/**
 * Check if JWT is expired
 */
function isTokenExpired(expiry: number | null): boolean {
  if (!expiry) return false; // No expiry = never expires
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  return now > expiry;
}

/**
 * Decode base64url string (JWT uses base64url, not standard base64)
 */
function base64UrlDecode(str: string): string {
  // Replace base64url chars with base64 chars
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  
  // Decode - works in both browser and Node.js
  if (typeof Buffer !== 'undefined') {
    // Node.js
    return Buffer.from(base64, 'base64').toString('utf-8');
  } else {
    // Browser
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decode JWT and extract fields flexibly
 * Works with any JWT format (Microsoft .NET, OIDC, custom)
 * 
 * @param token - JWT token string (with or without "Bearer " prefix)
 * @returns Extracted data with username, role, tenant, and unique user ID
 */
export function decodeAndExtractJWT(token: string): JWTDecodeResult {
  try {
    // Remove "Bearer " prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
    
    if (!cleanToken) {
      return { success: false, error: 'Empty token provided' };
    }
    
    // Split JWT into parts
    const parts = cleanToken.split('.');
    
    if (parts.length !== 3) {
      return { success: false, error: 'Invalid JWT format - expected 3 parts' };
    }
    
    // Decode payload (second part)
    let payload: Record<string, any>;
    try {
      const payloadJson = base64UrlDecode(parts[1]);
      payload = JSON.parse(payloadJson);
    } catch (e) {
      return { success: false, error: 'Failed to decode JWT payload' };
    }
    
    // Extract fields flexibly
    const username = findField(payload, USERNAME_FIELDS);
    const clientRole = findField(payload, ROLE_FIELDS);
    const tenant = findField(payload, TENANT_FIELDS);
    const expiry = findExpiryField(payload);
    
    // Map role
    const mappedRole = mapRole(clientRole);
    
    // Check expiry
    const isExpired = isTokenExpired(expiry);
    
    // Create unique user ID: tenant_username
    // If no tenant, just use username
    // If no username, generate fallback
    let uniqueUserId: string;
    if (tenant && username) {
      uniqueUserId = `${tenant}_${username}`;
    } else if (username) {
      uniqueUserId = username;
    } else if (tenant) {
      uniqueUserId = `${tenant}_unknown`;
    } else {
      // Fallback - shouldn't happen if JWT has proper claims
      uniqueUserId = `jwt_user_${Date.now()}`;
    }
    
    return {
      success: true,
      data: {
        username,
        clientRole,
        mappedRole,
        tenant,
        expiry,
        isExpired,
        uniqueUserId,
        rawPayload: payload,
      }
    };
    
  } catch (error: any) {
    return { 
      success: false, 
      error: `JWT decode error: ${error.message}` 
    };
  }
}

/**
 * Quick validation - just check if token is valid and not expired
 */
export function isValidJWT(token: string): boolean {
  const result = decodeAndExtractJWT(token);
  return result.success && !result.data?.isExpired;
}

/**
 * Get just the unique user ID from JWT
 */
export function getUniqueUserIdFromJWT(token: string): string | null {
  const result = decodeAndExtractJWT(token);
  if (result.success && result.data) {
    return result.data.uniqueUserId;
  }
  return null;
}
