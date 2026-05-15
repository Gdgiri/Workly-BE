export interface JWTPayload {
    sub: string; // user id
    role?: string;
    subscription?: any;
    adminId?: string; // For multi-tenancy
    iat?: number;
    exp?: number;
}

export interface AuthUser {
    id: string;        // Database user ID
    userId?: string;   // Alias for id (for compatibility)
    authId: string;    // Auth Service user ID (from token.sub)
    email: string;
    phone: string;
    name: string;
    role: string;      // From database
    app_id: string;
    subscription?: any; // Subscription data
    adminId?: string;  // Admin ID for multi-tenancy
    stylistId?: string; // Stylist record ID (if role is STYLIST/STAFF)
    businessName?: string;
    businessPhone?: string;
    businessAddress?: string;
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}