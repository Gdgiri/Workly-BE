import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPublicKey } from '../config/auth';
import { authService } from '../services/auth.service';
import { JWTPayload, AuthUser } from '../types/auth.types';
import { AuthRequest } from '../middleware/auth';

/**
 * Optional authentication middleware
 * Tries to decode JWT token if present, but doesn't block request if missing/invalid
 * This allows role-based filtering when token is present, but still allows access without auth
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('📭 No auth token provided');
            return next();
        }

        const token = authHeader.substring(7);
        // console.log('🎫 Token received (first 50 chars):', token.substring(0, 50) + '...');
        let user: AuthUser | null = null;

        // Decode JWT token locally (without verification for now)
        try {
            // Decode without verification to get payload
            const decoded: any = jwt.decode(token);
            // console.log('🔍 Decoded JWT payload:', JSON.stringify(decoded, null, 2));

            if (decoded) {
                // Extract user info from token payload
                const userId = decoded.sub || decoded.userId || decoded.id;
                user = {
                    id: userId,
                    authId: userId,
                    email: decoded.email || '',
                    phone: decoded.phone_number || decoded.phone || '',
                    name: decoded.name || '',
                    role: decoded.role || 'user', // Extract role from token
                    app_id: decoded.appId || decoded.app_id || ''
                };

                // console.log('✅ User info extracted from token:', {
                //     id: user.id,
                //     email: user.email,
                //     role: user.role,
                //     name: user.name
                // });
            } else {
                console.log('❌ Failed to decode token - token is null or invalid');
            }
        } catch (decodeError: any) {
            console.log('⚠️ Token decode error:', decodeError.message);
        }

        if (user) {
            // [Multi-tenancy Fix] Also resolve adminId for optional auth
            let adminId: string | undefined;
            try {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({
                    where: { authId: user.id },
                    select: { id: true, role: true }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: user.id },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: user.id },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            } catch (authDbError) {
                console.warn('⚠️ Optional Auth DB lookup failed:', authDbError);
            }

            req.user = {
                ...user,
                adminId
            };
        } else {
            console.log('👤 No user info available, continuing without auth');
        }

        next();
    } catch (error: any) {
        console.error('❌ Optional authentication error:', error);
        next();
    }
};
