import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export class UserService {
    /**
     * Find user by authId, create with default CUSTOMER role if doesn't exist
     * This is called during authentication to get user's role and subscription
     */
    /**
     * Find user by authId, create with default CUSTOMER role if doesn't exist
     * This is called during authentication to get user's role and subscription
     */
    async findOrCreateUser(authId: string, roleFromAuth?: string, email?: string): Promise<any> {
        try {
            // Try to find existing user with subscription data
            let user = await prisma.user.findUnique({
                where: { authId },
                select: {
                    id: true,
                    authId: true,
                    role: true,
                    isActive: true,
                    approvalStatus: true,
                    approvedBy: true,
                    approvedAt: true,
                    rejectionReason: true,
                    subscriptionId: true,
                    businessName: true,
                    businessEmail: true,
                    businessPhone: true,
                    businessAddress: true,
                    createdAt: true,
                    updatedAt: true,
                    subscription: {
                        include: {
                            plan: true
                        }
                    }
                }
            });

            // FALLBACK: If no user found by authId, try to find by businessEmail (if provided)
            // This handles cases where a user was registered with a different authId but same email
            if (!user && email) {
                user = await prisma.user.findFirst({
                    where: { businessEmail: email },
                    include: {
                        subscription: { include: { plan: true } }
                    }
                });
                
                if (user) {
                    console.log(`🔗 [UserService] Linked existing user ${user.id} to new authId: ${authId} via email: ${email}`);
                    // Optionally update the authId for this user to keep them synced
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { authId }
                    });
                }
            }

            // If user doesn't exist, create with appropriate role
            if (!user) {
                console.log(`📝 Creating new user with authId: ${authId} (Email: ${email || 'N/A'})`);

                // Check if this authId or email belongs to a stylist
                const stylist = await prisma.stylist.findFirst({
                    where: {
                        OR: [
                            { authId },
                            ...(email ? [{ email }] : [])
                        ]
                    }
                });

                let userRole: UserRole = stylist ? UserRole.STAFF : UserRole.CUSTOMER;

                // If role comes from Auth Service (e.g. ADMIN), respect it
                if (roleFromAuth === 'ADMIN' || roleFromAuth === 'SUPER_ADMIN') {
                    if (roleFromAuth === 'ADMIN') userRole = UserRole.ADMIN;
                    if (roleFromAuth === 'SUPER_ADMIN') userRole = UserRole.SUPER_ADMIN;
                }

                console.log(`   User is ${stylist ? 'a STYLIST' : 'a CUSTOMER/ADMIN'} - assigning role: ${userRole} (Requested: ${roleFromAuth})`);

                user = await prisma.user.create({
                    data: {
                        authId,
                        role: userRole,
                        ...(email && { businessEmail: email }),
                        isActive: true,
                        approvalStatus: (roleFromAuth === 'ADMIN' || roleFromAuth === 'SUPER_ADMIN') ? 'APPROVED' : 'APPROVED', 
                    },
                    include: {
                        subscription: {
                            include: {
                                plan: true
                            }
                        }
                    }
                });
                console.log(`✅ User created with role: ${user.role}`);
            } else {
                // ENSURE ROLE UPGRADE: If user is currently a CUSTOMER but exists in Stylist table, upgrade to STAFF
                if (user.role === UserRole.CUSTOMER) {
                    const stylist = await prisma.stylist.findFirst({
                        where: {
                            OR: [
                                { authId },
                                ...(email ? [{ email }] : [])
                            ]
                        }
                    });

                    if (stylist) {
                        console.log(`📈 [UserService] Upgrading user ${user.id} from CUSTOMER to STAFF (found stylist record)`);
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: { role: UserRole.STAFF },
                            include: {
                                subscription: { include: { plan: true } }
                            }
                        });
                    }
                }
            }

            return user;
        } catch (error) {
            console.error('Error in findOrCreateUser:', error);
            throw new Error('Failed to find or create user');
        }
    }

    /**
     * Update user profile (self-update)
     */
    async updateUserProfile(userId: string, data: { name?: string; email?: string; phone?: string; businessName?: string; businessType?: string }): Promise<any> {
        try {
            return await prisma.user.update({
                where: { id: userId },
                data: {
                    ...data,
                },
            });
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw new Error('Failed to update user profile');
        }
    }

    /**
     * Update user role (admin only - enforced by RBAC middleware)
     */
    async updateUserRole(userId: string, role: UserRole): Promise<any> {
        try {
            const user = await prisma.user.update({
                where: { id: userId },
                data: { role },
            });
            return user;
        } catch (error) {
            console.error('Error updating user role:', error);
            throw new Error('Failed to update user role');
        }
    }

    /**
     * Get user by ID with subscription data
     */
    async getUserById(userId: string): Promise<any> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    subscription: {
                        include: {
                            plan: true
                        }
                    }
                }
            });
            return user;
        } catch (error) {
            console.error('Error getting user:', error);
            throw new Error('Failed to get user');
        }
    }

    /**
     * Get current user info (called from /users/me endpoint)
     */
    async getCurrentUser(authId: string): Promise<any> {
        try {
            const user = await prisma.user.findUnique({
                where: { authId },
                include: {
                    subscription: {
                        include: {
                            plan: true
                        }
                    }
                }
            });
            return user;
        } catch (error) {
            console.error('Error getting current user:', error);
            throw new Error('Failed to get current user');
        }
    }
    /**
     * Get all users (admin only)
     */
    async getAllUsers(): Promise<any[]> {
        try {
            return await prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    subscription: {
                        include: {
                            plan: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error getting all users:', error);
            throw new Error('Failed to get users');
        }
    }

    /**
     * Deactivate user
     */
    async deactivateUser(userId: string): Promise<any> {
        try {
            return await prisma.user.update({
                where: { id: userId },
                data: { isActive: false }
            });
        } catch (error) {
            console.error('Error deactivating user:', error);
            throw new Error('Failed to deactivate user');
        }
    }

    /**
     * Initialize user with full details (Country, Currency, etc.)
     * Called from Auth Service sync
     */
    async initUser(data: {
        authId: string;
        name: string;
        email: string;
        phone?: string;
        role: string;
        country?: string;
        currency?: string;
        businessName?: string
    }): Promise<any> {
        try {
            console.log(`🚀 [UserService] Initializing user: ${data.email} (${data.role})`);
            console.log(`   - Country: ${data.country}, Currency: ${data.currency}`);

            let user = await prisma.user.findUnique({
                where: { authId: data.authId }
            });

            let userId = user?.id;

            if (!user) {
                let userRole: UserRole = UserRole.CUSTOMER;
                if (data.role === 'ADMIN') userRole = UserRole.ADMIN;
                if (data.role === 'SUPER_ADMIN') userRole = UserRole.SUPER_ADMIN;

                console.log(`   Creating new user with role: ${userRole}`);

                user = await prisma.user.create({
                    data: {
                        authId: data.authId,
                        role: userRole,
                        country: data.country, // Will likely fallback to "India" default if undefined, but explicit null is better handled if needed
                        businessName: data.businessName,
                        businessEmail: data.email,
                        businessPhone: data.phone,
                        isActive: true,
                        approvalStatus: 'APPROVED'
                    }
                });
                userId = user.id;
                console.log(`✅ Created User: ${userId}`);
            } else {
                // Update country if provided
                if (data.country) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: { country: data.country }
                    });
                }
            }

            // Handle Settings (Currency) for Admins
            if (userId && (data.role === 'ADMIN' || data.role === 'SUPER_ADMIN')) {
                if (data.currency) {
                    try {
                        const { settingsService } = await import('./settings.service');
                        await settingsService.updateSettings(userId, {
                            currency: data.currency
                        });
                        console.log(`✅ Updated Settings for User: ${userId} with Currency: ${data.currency}`);
                    } catch (settingsError) {
                        console.error('Failed to update settings/currency:', settingsError);
                        // Convert currency update failure to non-fatal?
                    }
                }
            }

            // If Customer, ensure Customer record exists?
            // Existing logic in customer.controller handles this separately. 
            // logic in AuthService registers specific user types. 
            // If checking out as Guest/Customer, authService calls POST /customers.
            // If registering Business, authService calls THIS endpoint.

            return user;
        } catch (error) {
            console.error('Error in initUser:', error);
            throw new Error('Failed to initialize user');
        }
    }
}

export const userService = new UserService();
