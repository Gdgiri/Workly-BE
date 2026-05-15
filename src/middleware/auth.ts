import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import prisma from '../prisma';
import { AUTH_CONFIG } from '../config/auth';
import { AuthUser } from '../types/auth.types';
import { getAppId } from '../utils/auth.utils';


const DEBUG = true;

const logDebug = (message: string) => {
    if (DEBUG) console.log(`[AuthMiddleware] ${message}`);
};

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export type AuthRequest = Request;

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        // console.log('🛡️ [AUTH MIDDLEWARE] Hit:', req.path);
        // console.log('   Headers:', JSON.stringify(req.headers['authorization'] ? 'Bearer [PRESENT]' : 'None'));

        if (!authHeader?.startsWith('Bearer ')) {
            logDebug('No token provided');
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.substring(7);
        let user: AuthUser | null = null;

        // Skip local JWT verification (tokens are HS256, not RS256)
        // Use AuthService validation directly
        // logDebug('Validating token with AuthService...');
        // console.log('Sending token to:', AUTH_CONFIG.AUTH_SERVICE_URL + '/auth/validate');

        const validation = await authService.validateToken(token);

        // logDebug('Auth Service Validation Result: ' + JSON.stringify(validation));
        // console.log('Validation Details:', {
        //     valid: validation.valid,
        //     hasUser: !!validation.user,
        //     error: validation.error,
        // });

        if (!validation.valid || !validation.user) {
            // logDebug('❌ Auth Service says INVALID');
            return res.status(401).json({ error: validation.error || 'Invalid token' });
        }

        user = { ...validation.user, authId: validation.user.id };

        // Validate app_id
        // logDebug(`Checking AppID match: User(${user.app_id}) vs Config(${AUTH_CONFIG.ALLOWED_APP_ID})`);

        // ALLOW DYNAMIC APP IDs for Multi-Tenancy (e.g., workly-salon, workly-tailor, etc.)
        if (!user.app_id || !AUTH_CONFIG.isValidAppId(user.app_id)) {
            logDebug(`❌ Auth failed: AppID Mismatch. Received: "${user.app_id}"`);
            return res.status(403).json({ error: 'Invalid app access' });
        }

        // Step 3: Fetch user from database by authId (gets role and subscription)
        const { userService } = await import('../services/user.service');
        // console.log(`🔍 [AUTH MIDDLEWARE] Fetching DB User: ID=${user.id}, Email=${user.email}`);
        const dbUser = await (userService as any).findOrCreateUser(user.id, user.role, user.email);
        // console.log(`👤 [AUTH MIDDLEWARE] DB User Found: ID=${dbUser.id}, Role=${dbUser.role}, Active=${dbUser.isActive}`);

        if (!dbUser.isActive) {
            return res.status(403).json({
                error: 'Account is inactive',
                code: 'ACCOUNT_INACTIVE'
            });
        }

        // ADMIN-SPECIFIC CHECKS (Business accounts require approval and subscription)
        if (dbUser.role === 'ADMIN') {
            // Check approval status
            if (dbUser.approvalStatus === 'PENDING') {
                return res.status(403).json({
                    error: 'Business account pending approval',
                    code: 'PENDING_APPROVAL',
                    message: 'Your salon business account is awaiting Super Admin approval. You will be notified once approved.'
                });
            }

            if (dbUser.approvalStatus === 'REJECTED') {
                return res.status(403).json({
                    error: 'Business account rejected',
                    code: 'ACCOUNT_REJECTED',
                    reason: dbUser.rejectionReason || 'Your business application was not approved.'
                });
            }

            // Check subscription status
            if (!dbUser.subscription) {
                // console.error(`❌ [AUTH MIDDLEWARE] No Subscription! User=${dbUser.id}`);
                return res.status(403).json({
                    error: 'No subscription assigned',
                    code: 'SUBSCRIPTION_REQUIRED',
                    message: 'Please contact Super Admin to activate your subscription.'
                });
            }
            // console.log(`✅ [AUTH MIDDLEWARE] Subscription Status: ${dbUser.subscription.status}`);

            if (dbUser.subscription.status === 'EXPIRED') {
                return res.status(403).json({
                    error: 'Subscription expired',
                    code: 'SUBSCRIPTION_EXPIRED',
                    message: 'Your subscription has expired. Please renew to continue.'
                });
            }

            if (dbUser.subscription.status === 'SUSPENDED') {
                return res.status(403).json({
                    error: 'Subscription suspended',
                    code: 'SUBSCRIPTION_SUSPENDED',
                    message: 'Your subscription has been suspended. Please contact support.'
                });
            }

            if (dbUser.subscription.status !== 'ACTIVE' && dbUser.subscription.status !== 'TRIAL') {
                return res.status(403).json({
                    error: 'No active subscription',
                    code: 'SUBSCRIPTION_INACTIVE',
                    message: 'Your subscription is not active.'
                });
            }
        }

        // Fetch adminId for multi-tenancy context
        // Check for 'x-business-name' header to switch context
        const businessNameHeader = req.headers['x-business-name'];
        let adminId: string | undefined;

        if (dbUser.role === 'ADMIN') {
            adminId = dbUser.id; // Fix: Use Database ID, not Auth ID
        } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER' || dbUser.role === 'EMPLOYEE') {
            // ENHANCEMENT: Support specific store selection for staff members belonging to multiple businesses
            if (businessNameHeader && typeof businessNameHeader === 'string') {
                logDebug(`Staff Context Switch: User ${user.email} targeting business '${businessNameHeader}'`);

                // 1. Find the admin/business they want to access
                const businessAdmin = await prisma.user.findFirst({
                    where: {
                        businessName: businessNameHeader,
                        role: 'ADMIN'
                    },
                    select: { id: true }
                });

                if (businessAdmin) {
                    // 2. Verify the staff member belongs to THIS specific business (Check ID or Email)
                    const stylist = await prisma.stylist.findFirst({
                        where: {
                            adminId: businessAdmin.id,
                            OR: [
                                { authId: user.id },
                                { email: user.email }
                            ]
                        },
                        select: { id: true, adminId: true }
                    });

                    if (stylist) {
                        adminId = stylist.adminId;
                        (user as any).stylistId = stylist.id;
                        logDebug(`✅ Staff Context Switch SUCCESS for '${businessNameHeader}'`);
                    } else {
                        logDebug(`⚠️ Staff User not found in business '${businessNameHeader}'. Falling back...`);
                    }
                }
            }

            // Fallback: If no header provided or business not found, use first association (Original behavior)
            if (!adminId) {
                const stylist = await prisma.stylist.findFirst({
                    where: {
                        OR: [
                            { authId: user.id },
                            { email: user.email }
                        ]
                    },
                    select: { id: true, adminId: true }
                });
                adminId = stylist?.adminId;
                (user as any).stylistId = stylist?.id;
            }

        } else if (dbUser.role === 'CUSTOMER') {
            // STRICT MULTI-TENANCY CHECK
            if (businessNameHeader && typeof businessNameHeader === 'string') {
                logDebug(`Context Switch: Checking access for business '${businessNameHeader}'`);

                // 1. Find the admin who owns this business
                const businessAdmin = await prisma.user.findFirst({
                    where: {
                        businessName: businessNameHeader,
                        role: { in: ['ADMIN'] }
                    },
                    select: { id: true }
                });

                if (!businessAdmin) {
                    return res.status(404).json({ error: `Business '${businessNameHeader}' not found` });
                }

                // 2. Verify the user is a customer of THIS business
                const customerRecord = await prisma.customer.findFirst({
                    where: {
                        authId: user.id,
                        adminId: businessAdmin.id
                    },
                    select: { adminId: true }
                });

                if (customerRecord) {
                    adminId = customerRecord.adminId;
                    logDebug(`✅ Access Granted: User is a customer of '${businessNameHeader}'`);
                } else {
                    logDebug(`⚠️ User not registered with '${businessNameHeader}'. Auto-joining...`);

                    // AUTO-JOIN: Create Customer record for this store
                    try {
                        const newCustomer = await prisma.customer.create({
                            data: {
                                authId: user.id,
                                adminId: businessAdmin.id,
                                email: user.email,
                                name: user.name || 'Valued Customer',
                                phone: user.phone
                            }
                        });

                        adminId = newCustomer.adminId;
                        logDebug(`✅ Auto-join successful. Access Granted to '${businessNameHeader}'`);
                    } catch (joinError) {
                        console.error('Auto-join failed:', joinError);
                        // Fallback to error if creation fails (e.g. duplicate constraint, though we checked findFirst)
                        return res.status(403).json({
                            error: 'Access Denied',
                            message: `You are not registered with ${businessNameHeader}. Please register explicitly to access this store.`,
                            code: 'NOT_A_MEMBER'
                        });
                    }
                }

            } else {
                // FALLBACK (Legacy behavior - pick first association)
                // This might be risky if we want strict enforcement, but okay for generic calls not targeting a store
                logDebug('⚠️ No x-business-name header, using default association');
                const customer = await prisma.customer.findFirst({
                    where: {
                        OR: [
                            { authId: user.id },
                            { email: user.email }
                        ]
                    },
                    select: { adminId: true }
                });
                adminId = customer?.adminId;
            }
        }

        // console.log('🔍 [Middleware Debug] dbUser:', {
        //     id: dbUser.id,
        //     role: dbUser.role,
        //     businessName: dbUser.businessName,
        //     adminId: adminId
        // });

        // Fetch business name based on adminId
        let businessName = dbUser.businessName;
        let businessPhone = dbUser.businessPhone;
        let businessAddress = dbUser.businessAddress;

        if ((!businessName || !businessPhone || !businessAddress) && adminId) {
            // console.log('🔍 [Middleware Debug] Fetching business details from admin:', adminId);
            // If user is missing any business details, try to get them from their admin
            const adminUser = await prisma.user.findUnique({
                where: { id: adminId },
                select: {
                    businessName: true,
                    businessPhone: true,
                    businessAddress: true
                }
            });
            // console.log('🔍 [Middleware Debug] Admin user result:', adminUser);
            if (adminUser) {
                if (!businessName) businessName = adminUser.businessName;
                if (!businessPhone) businessPhone = adminUser.businessPhone;
                if (!businessAddress) businessAddress = adminUser.businessAddress;
            }
        }

        // console.log('🔍 [Middleware Debug] Final businessName:', businessName);

        // Attach user to request
        req.user = {
            id: user.id,
            userId: user.id, // Alias for compatibility
            authId: user.id, // Auth Service user ID
            email: user.email,
            phone: user.phone,
            name: user.name,
            role: dbUser.role,
            app_id: getAppId(req),
            subscription: dbUser.subscription,
            adminId: adminId,
            stylistId: (user as any).stylistId,
            businessName: businessName,
            businessPhone: businessPhone,
            businessAddress: businessAddress
        };

        // logDebug(`User authenticated: Role=${dbUser.role}, AdminID=${adminId}`);

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};
