import { Request } from 'express';
import { AUTH_CONFIG } from '../config/auth';

export interface UserContext {
    authId: string;
    adminId: string;
    userName?: string;
    userRole?: string;
    email?: string;
}

/**
 * Extract user context from authenticated request
 * Provides consistent user identification across all controllers
 * 
 * @param req - Express request object with authenticated user
 * @returns UserContext with authId, adminId, and optional user details
 * @throws Error if user is not authenticated or authId is missing
 */
export function extractUserContext(req: Request): UserContext {
    const user = (req as any).user;

    if (!user) {
        throw new Error('User not authenticated');
    }

    // Extract authId (user's unique identifier)
    const authId = user.authId || user.id;

    // Extract adminId (for multi-tenancy)
    // For ADMIN users, adminId is their own id
    // For other users (STAFF, STYLIST), adminId is their business owner's id
    const adminId = user.adminId || user.id;

    if (!authId) {
        throw new Error('User authId not found in request');
    }

    return {
        authId,
        adminId,
        userName: user.name || user.email || user.businessName,
        userRole: user.role,
        email: user.email,
    };
}

/**
 * Extract IP address from request
 * Handles proxies and load balancers
 * 
 * @param req - Express request object
 * @returns IP address string or undefined
 */
export function extractIpAddress(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];

    if (forwarded) {
        // x-forwarded-for can be a comma-separated list, take the first one
        return typeof forwarded === 'string'
            ? forwarded.split(',')[0].trim()
            : forwarded[0];
    }

    return req.socket.remoteAddress;
}

/**
 * Extract user agent from request
 * 
 * @param req - Express request object
 * @returns User agent string or undefined
 */
export function extractUserAgent(req: Request): string | undefined {
    return req.headers['user-agent'];
}

/**
 * Generate a unique request ID for tracking
 * Uses existing request ID header or generates a new one
 * 
 * @param req - Express request object
 * @returns Request ID string
 */
export function extractRequestId(req: Request): string {
    const existingId = req.headers['x-request-id'];

    if (existingId && typeof existingId === 'string') {
        return existingId;
    }

    // Generate simple request ID
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract app_id from request
 * 1. x-app-id header
 * 2. user profile in token
 * 3. Fallback to default
 */
export function getAppId(req: Request): string {
    // 1. Check Header (Primary)
    const headerAppId = req.headers['x-app-id'] || req.headers['app-id'];
    if (headerAppId && typeof headerAppId === 'string' && AUTH_CONFIG.isValidAppId(headerAppId)) {
        return headerAppId.replace('_', '-');
    }

    // 2. Check Query or Body (Secondary - common for mobile app requests)
    const requestAppId = req.query?.appId || req.query?.app_id || req.body?.appId || req.body?.app_id;
    if (requestAppId && typeof requestAppId === 'string' && AUTH_CONFIG.isValidAppId(requestAppId)) {
        return requestAppId.replace('_', '-');
    }

    // 3. Check User profile from token
    const user = (req as any).user;
    if (user?.app_id && AUTH_CONFIG.isValidAppId(user.app_id)) {
        return user.app_id;
    }

    return AUTH_CONFIG.DEFAULT_APP_ID;
}
