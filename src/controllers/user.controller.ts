import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { userService } from '../services/user.service';
import { UserRole } from '@prisma/client';

import prisma from '../prisma';

export class UserController {
    /**
     * GET /users/me - Get current user profile
     * Returns user info from token + role from database
     */
    async getCurrentUser(req: AuthRequest, res: Response) {
        try {
            console.log('🔍 [UserController] getCurrentUser hit by:', req.user?.email || 'Unknown');

            if (!req.user) {
                console.warn('⚠️ [UserController] No user object on request!');
                return res.status(401).json({ error: 'Not authenticated' });
            }

            let userProfile = { ...req.user };
            console.log('👤 [UserController] User profile found:', JSON.stringify({
                id: userProfile.id,
                email: userProfile.email,
                role: userProfile.role,
                business: userProfile.businessName
            }));

            // Check if user is linked to a Stylist
            const authIdToUse = userProfile.authId || userProfile.id;
            if (authIdToUse) {
                const stylist = await prisma.stylist.findFirst({
                    where: {
                        OR: [
                            { authId: authIdToUse },
                            { email: userProfile.email }
                        ]
                    }
                });

                if (stylist) {
                    // Force role to STAFF if they are a stylist (fixes mismatched AuthService role)
                    if (userProfile.role !== 'ADMIN' && userProfile.role !== 'MANAGER' && userProfile.role !== 'SUPER_ADMIN') {
                        userProfile.role = 'STAFF';
                    }

                    // Use stylist phone if available
                    if (stylist.phone) {
                        userProfile.phone = stylist.phone;
                    }

                    // Add permissions
                    if (stylist.permissions) {
                        try {
                            // Handle both parsed JSON array and stringified JSON
                            const perms = typeof stylist.permissions === 'string'
                                ? JSON.parse(stylist.permissions)
                                : stylist.permissions;

                            (userProfile as any).permissions = Array.isArray(perms) ? perms : [];
                        } catch (e) {
                            console.error('Error parsing stylist permissions:', e);
                            (userProfile as any).permissions = [];
                        }
                    } else {
                        (userProfile as any).permissions = [];
                    }
                }
            }

            // Verify businessName presence from middleware
            if (!userProfile.businessName && userProfile.role === 'ADMIN') {
                // Final fallback: fetch from DB if missing (just for safety)
                const dbCheck = await prisma.user.findUnique({
                    where: { id: userProfile.id as string }, // Cast to string as id is UUID
                    select: { businessName: true }
                });
                if (dbCheck?.businessName) userProfile.businessName = dbCheck.businessName;
            }

            // console.log('🔍 [Controller Final] Returning user:', {
            //     id: userProfile.id,
            //     businessName: userProfile.businessName
            // });

            return res.json({
                user: userProfile,
            });
        } catch (error: any) {
            console.error('Error getting current user:', error);
            return res.status(500).json({ error: 'Failed to get user profile' });
        }
    }

    /**
     * PATCH /users/me - Update current user profile
     */
    async updateProfile(req: AuthRequest, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const { name, email, phone, businessName, businessType } = req.body;
            // req.user.id is used directly below

            // Using authId for lookup in service if needed, but update uses internal ID usually.
            // Let's check service. user.service.updateUserProfile uses 'where: { id: userId }' which implies internal UUID.
            // req.user.id from middleware is the authId (from auth service).
            // Wait, middleware says: dbUser = findOrCreateUser(user.id).
            // req.user has ...user (from auth service), role, subscription.
            // We need the internal database ID of the user to update using prisma.user.update({ where: { id: ... } }) 
            // OR we can update by authId.
            // Let's look at UserService.updateUserProfile again. I defined it to take `userId`.
            // Let's verify what `req.user.id` is. In middleware: `user = validation.user;` (AuthService user). `dbUser = findOrCreateUser(user.id)`.
            // The `dbUser` has the internal UUID. 
            // I should fetch the internal user first or update by authId.
            // Let's update UserService to findUnique by authId is safer if we only have authId.
            // BUT, let's look at `findOrCreateUser`. It returns the Prisma user object.
            // Middleware attaches: req.user = { ...user (from auth service), role: dbUser.role ... }
            // It seems req.user.id is the Auth ID.

            // Safe bet: Update by authId since that's what we have guaranteed.
            // Let me re-read UserService.updateUserProfile I just wrote.
            // "where: { id: userId }" -> this expects internal ID.

            // I will find the internal user first.
            const user = await userService.findOrCreateUser(req.user.id);

            const updatedUser = await userService.updateUserProfile(user.id, {
                name,
                email,
                phone,
                businessName,
                businessType
            });

            // CRITICAL FIX: If Business Name is provided and user is CUSTOMER, upgrade to ADMIN
            // This handles the case where Auth Service defaults to USER/CUSTOMER
            if (businessName && (req.user.role === 'CUSTOMER' || req.user.role === 'USER')) {
                console.log(`🚀 [UserController] UPGRADING user ${user.id} to ADMIN.`);
                console.log(`   - Reason: Business Registration (${businessName})`);
                console.log(`   - Current Role: ${req.user.role}`);

                try {
                    // Update role directly using service
                    await userService.updateUserRole(user.id, UserRole.ADMIN);
                    console.log('   - Role upgrade SUCCESS');
                    updatedUser.role = 'ADMIN';
                } catch (upgradeError) {
                    console.error('   - Role upgrade FAILED:', upgradeError);
                }
            } else {
                console.log(`ℹ️ [UserController] No role upgrade needed. Role: ${req.user.role}, Business: ${businessName}`);
            }

            return res.json({
                message: 'Profile updated successfully',
                user: updatedUser
            });
        } catch (error: any) {
            console.error('Error updating profile:', error);
            return res.status(500).json({ error: 'Failed to update profile' });
        }
    }

    /**
     * GET /users - List all users (admin only)
     * Returns all users with their roles
     */
    async getAllUsers(req: AuthRequest, res: Response) {
        try {
            const users = await userService.getAllUsers();
            return res.json({ users });
        } catch (error: any) {
            console.error('Error getting all users:', error);
            return res.status(500).json({ error: 'Failed to get users' });
        }
    }

    /**
     * PATCH /users/:id/role - Update user role (admin only)
     * Body: { role: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER" }
     */
    async updateUserRole(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { role } = req.body;

            // Validate role
            if (!role || !Object.values(UserRole).includes(role)) {
                return res.status(400).json({
                    error: 'Invalid role',
                    validRoles: Object.values(UserRole),
                });
            }

            // Update role
            const user = await userService.updateUserRole(id, role as UserRole);

            return res.json({
                message: 'User role updated successfully',
                user,
            });
        } catch (error: any) {
            console.error('Error updating user role:', error);
            return res.status(500).json({ error: 'Failed to update user role' });
        }
    }

    /**
     * PATCH /users/:id/deactivate - Deactivate user (admin only)
     */
    async deactivateUser(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const user = await userService.deactivateUser(id);

            return res.json({
                message: 'User deactivated successfully',
                user,
            });
        } catch (error: any) {
            console.error('Error deactivating user:', error);
            return res.status(500).json({ error: 'Failed to deactivate user' });
        }
    }

    /**
     * POST /public/users/init - Initialize user from Auth Service sync
     * Internal generic initialization
     */
    async initUser(req: any, res: Response) {
        try {
            const data = req.body;
            console.log('📥 [UserController] Received initUser request:', JSON.stringify(data));

            const user = await userService.initUser(data);

            return res.json({
                message: 'User initialized successfully',
                user,
            });
        } catch (error: any) {
            console.error('Error initializing user:', error);
            return res.status(500).json({ error: 'Failed to initialize user' });
        }
    }

    /**
     * GET /users/businesses - Get all businesses associated with the current user (Staff/Stylist)
     * Used for store selection in mobile app
     */
    async getMyBusinesses(req: AuthRequest, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const authId = req.user.id;
            const email = req.user.email;
            console.log(`🔍 [UserController] getMyBusinesses for authId: ${authId}, email: ${email}`);

            // 1. Find all stylist profiles for this authId or email (fallback)
            let stylistProfiles = await prisma.stylist.findMany({
                where: {
                    OR: [
                        { authId: authId },
                        { email: email }
                    ]
                }
            });

            if (stylistProfiles.length === 0) {
                return res.json({ businesses: [] });
            }

            // 2. Fetch business details for each adminId found in stylist profiles
            const businessIds = stylistProfiles.map(p => p.adminId);
            const businesses = await prisma.user.findMany({
                where: {
                    id: { in: businessIds },
                    role: 'ADMIN' // Ensure we only link to valid Admin accounts
                },
                select: {
                    id: true,
                    businessName: true,
                    businessPhone: true,
                    businessAddress: true
                }
            });

            // 3. Map everything into a clean response
            const responseData = stylistProfiles.map(profile => {
                const business = businesses.find(b => b.id === profile.adminId);
                return {
                    stylistId: profile.id,
                    adminId: profile.adminId,
                    staffName: profile.name,
                    specialization: profile.specialization,
                    businessName: business?.businessName || 'Unnamed Business',
                    businessPhone: business?.businessPhone,
                    businessAddress: business?.businessAddress,
                    businessCode: business?.businessName // Using businessName as code for now per middleware pattern
                };
            }).filter(item => item.businessName !== 'Unnamed Business'); // Filter out orphans if any

            return res.json({
                count: responseData.length,
                businesses: responseData
            });
        } catch (error: any) {
            console.error('Error fetching associated businesses:', error);
            return res.status(500).json({ error: 'Failed to fetch associated businesses' });
        }
    }
}

export const userController = new UserController();
