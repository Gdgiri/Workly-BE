import { Request, Response } from 'express';
import { z } from 'zod'; // Assuming zod is used given package.json
import prisma from '../prisma';
import { AUTH_CONFIG } from '../config/auth';
import { otpService } from '../services/otp.service';
import { getAppId } from '../utils/auth.utils';

// Validation Schema
const createCustomerSchema = z.object({
    authId: z.string().optional(), // AuthService user ID
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    dateOfBirth: z.string().optional().nullable(),
    ageGroup: z.string().optional().nullable(),
    attachments: z.array(z.object({
        title: z.string().optional(),
        remarks: z.string().optional(),
        imgUrl: z.string().optional(),
        url: z.string().optional()
    })).optional(),
});

export const customerController = {
    createCustomer: async (req: Request, res: Response) => {
        try {
            // Validate request body
            const data = createCustomerSchema.parse(req.body);
            const { name, city, authId, attachments, dateOfBirth, ageGroup, role } = data;
            const email = data.email || null;
            const phone = data.phone || null;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            // Get the admin's adminId (DB ID) first
            const adminId = (req as any).user?.adminId;

            // Validate that adminId exists (authentication middleware should set this)
            if (!adminId) {
                console.error('❌ adminId is missing - authentication middleware may not be working');
                console.error('   req.user:', (req as any).user);
                return res.status(401).json({
                    error: 'Unauthorized: Admin authentication required to create customers'
                });
            }

            // ---------------------------------------------------------
            // Check for existing customer with same email/phone under THIS admin
            // ---------------------------------------------------------
            const conditions: any[] = [];
            if (email) conditions.push({ email });
            if (phone) conditions.push({ phone });

            let existing = null;
            if (conditions.length > 0) {
                existing = await prisma.customer.findFirst({
                    where: {
                        adminId,
                        OR: conditions
                    },
                });
            }

            if (existing) {
                const isEmailMatch = email && existing.email === email;
                const isPhoneMatch = phone && existing.phone === phone;

                if (isEmailMatch && isPhoneMatch) {
                    return res.status(400).json({
                        error: 'A customer with this email and phone number already exists in your customer list'
                    });
                } else if (isEmailMatch) {
                    return res.status(400).json({
                        error: 'A customer with this email already exists in your customer list'
                    });
                } else {
                    return res.status(400).json({
                        error: 'A customer with this phone number already exists in your customer list'
                    });
                }
            }

            let createdAuthId = authId; // Use provided authId or create new one

            // Auto-create user in AuthService for login if authId not provided
            if (!createdAuthId) {
                const axios = require('axios');
                const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8000';

                try {
                    // Generate password from last 4 digits of phone or default
                    const password = phone ? `Customer@${phone.slice(-4)}` : `Customer@${Math.floor(1000 + Math.random() * 9000)}`;

                    console.log(`📝 Creating AuthService account for customer: ${email}`);

                    const registerResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, {
                        app_id: getAppId(req),
                        name,
                        email: email || undefined,
                        phone: phone || undefined,
                        password,
                        role: 'CUSTOMER' // Assign CUSTOMER role
                    }, {
                        timeout: 30000 // 30 second timeout
                    });

                    // AuthService returns { status, message, data: { user, accessToken, refreshToken } }
                    const responseData = registerResponse.data?.data;
                    const authUser = responseData?.user;

                    if (!authUser || !authUser.id) {
                        console.error('❌ Invalid response from AuthService:', registerResponse.data);
                        throw new Error('Invalid response from AuthService');
                    }

                    createdAuthId = authUser.id;
                    console.log(`✅ AuthService account created for customer: ${createdAuthId}`);
                    console.log(`   Login credentials - Email: ${email}, Password: ${password}`);

                } catch (authError: any) {
                    const errorMsg = authError.response?.data?.message || authError.message;
                    const errorDetails = authError.response?.data?.errors;
                    console.error('❌ Error creating AuthService account for customer:', errorMsg);
                    if (errorDetails) {
                        console.error('   Details:', JSON.stringify(errorDetails, null, 2));
                    }

                    // If email already exists, we MUST get the existing authId
                    if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
                        console.log('   ℹ️  Email already registered in AuthService');
                        console.log('   🔍 Attempting to fetch existing user details...');

                        try {
                            const { authService } = await import('../services/auth.service');
                            let retrievedUser = null;

                            // ---------------------------------------------------------
                            // STEP 1: Query LOCAL database (Cross-Role Lookup)
                            // ---------------------------------------------------------
                            console.log('   🔍 Step 1: Searching local database for existing authId...');

                            // Check Customer table first
                            const existingCustomer = await prisma.customer.findFirst({
                                where: { email },
                                select: { authId: true, name: true, adminId: true }
                            });

                            if (existingCustomer && existingCustomer.authId) {
                                // Found existing customer in local DB - reuse their authId
                                retrievedUser = { id: existingCustomer.authId };
                                console.log(`   ✅ Found existing customer in local database`);
                                console.log(`   📝 Customer name: ${existingCustomer.name}`);
                                console.log(`   📝 Existing under admin: ${existingCustomer.adminId}`);
                                console.log(`   📝 Reusing authId: ${retrievedUser.id}`);
                            } else {
                                // Check Stylist table (e.g. they might be a stylist elsewhere)
                                const existingStylist = await prisma.stylist.findFirst({
                                    where: { email },
                                    select: { authId: true, name: true, adminId: true }
                                });

                                if (existingStylist && existingStylist.authId) {
                                    retrievedUser = { id: existingStylist.authId };
                                    console.log(`   ✅ Found existing STYLIST record: ${existingStylist.name}`);
                                    console.log(`   📝 Using Stylist's authId: ${retrievedUser.id}`);
                                }
                            }

                            // ---------------------------------------------------------
                            // STEP 2: Fallback to AuthService (Login Strategy)
                            // ---------------------------------------------------------
                            if (!retrievedUser) {
                                // Email exists in AuthService but NOT in local DB
                                console.log('   ⚠️  Email exists in AuthService but not in local database (Orphaned User)');
                                console.log('   🔍 Step 2: Attempting to retrieve via Login Strategy...');

                                // Try to login as Customer first
                                if (phone) {
                                    const customerPassword = `Customer@${phone.slice(-4)}`;
                                    console.log(`      Trying login with Customer password format...`);
                                    retrievedUser = await authService.login(email, customerPassword, getAppId(req));

                                    if (!retrievedUser) {
                                        // Try Stylist Password format (maybe they were a stylist?)
                                        const stylistPassword = `Stylist@${phone.slice(-4)}`;
                                        console.log(`      Trying login with Stylist password format...`);
                                        retrievedUser = await authService.login(email, stylistPassword, getAppId(req));
                                    }
                                }

                                // Step 3: Standard lookup (Email then Phone)
                                if (!retrievedUser) {
                                    console.log('      Trying standard email lookup...');
                                    retrievedUser = await authService.getUserByEmail(email, getAppId(req));
                                }

                                if (!retrievedUser && phone) {
                                    console.log('      Trying standard phone lookup...');
                                    retrievedUser = await authService.getUserByPhone(phone, getAppId(req));
                                }
                            }

                            // ---------------------------------------------------------
                            // FINAL CHECK
                            // ---------------------------------------------------------
                            if (retrievedUser && retrievedUser.id) {
                                createdAuthId = retrievedUser.id;
                                console.log(`   ✅ Successfully retrieved authId: ${createdAuthId}`);
                            } else {
                                // Cannot get authId - REJECT
                                console.error('   ❌ Could not retrieve authId from Local DB, Login, or Lookup');
                                console.error('   ❌ Customer creation REJECTED - authId is required');

                                throw new Error('AuthId retrieval failed - User exists but cannot be verified');
                            }

                        } catch (fetchError: any) {
                            console.error('   ❌ Error during authId retrieval:', fetchError);
                            console.error('   ❌ Customer creation REJECTED - authId is required');

                            return res.status(400).json({
                                error: 'This email is already registered but we cannot verify the account. Please try again or use a different email.',
                                code: 'AUTH_SERVICE_ERROR',
                                details: fetchError.message
                            });
                        }
                    } else {
                        // Other auth service errors - also reject
                        console.error('   ❌ AuthService error - Customer creation REJECTED');
                        return res.status(500).json({
                            error: ' Please try again.',
                            code: 'AUTH_SERVICE_UNAVAILABLE',
                            details: errorMsg
                        });
                    }
                }
            }

            // At this point, createdAuthId MUST have a value
            if (!createdAuthId) {
                console.error('❌ CRITICAL: authId is still null after all attempts');
                return res.status(500).json({
                    error: 'Failed to create customer - authentication ID is missing',
                    code: 'MISSING_AUTH_ID'
                });
            }

            // console.log('🔍 Creating customer for adminId:', adminId);
            console.log('   Customer authId:', createdAuthId);

            // Create customer in database with authId from microservice and adminId
            const customer = await prisma.customer.create({
                data: {
                    authId: createdAuthId,
                    adminId: adminId, // Store which admin created this customer
                    name,
                    email,
                    phone: phone || null,
                    city: city || null,
                    dateOfBirth: dateOfBirth || null,
                    ageGroup: ageGroup || null,
                    attachments: attachments || [],
                    role: role || 'CUSTOMER', // Use provided role or default to CUSTOMER
                    createdBy: (req as any).user?.name || (req as any).user?.email || 'Unknown',
                },
            });

            console.log('✅ Customer created successfully:', customer.id);

            return res.status(201).json(customer);
        } catch (error: any) {
            console.error('Create Customer Error:', error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors[0].message });
            }
            return res.status(500).json({ error: 'Failed to create customer' });
        }
    },

    getAllCustomers: async (req: Request, res: Response) => {
        try {
            // Extract adminId for multi-tenant filtering
            const adminId = (req as any).user?.adminId;
            if (!adminId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Fetch customers filtered by adminId (tenant isolation)
            const customers = await prisma.customer.findMany({
                where: { adminId },
                orderBy: { createdAt: 'desc' },
            });

            // Batch fetch sales stats in ONE query instead of N+1
            const customerIds = customers.map(c => c.id);

            const salesStats = await prisma.sale.groupBy({
                by: ['customerId'],
                where: {
                    customerId: { in: customerIds },
                    adminId: adminId,
                    saleStatus: 'COMPLETED'
                },
                _count: { id: true },
                _sum: { totalAmount: true },
                _max: { createdAt: true },
            });

            // Build a lookup map for O(1) access
            const statsMap = new Map(
                salesStats.map(s => [s.customerId, {
                    visitCount: s._count.id,
                    totalSpend: s._sum.totalAmount || 0,
                    lastVisit: s._max.createdAt,
                }])
            );

            // Enrich customers with stats from the map
            const enrichedCustomers = customers.map(customer => {
                const stats = statsMap.get(customer.id);
                return {
                    ...customer,
                    visitCount: stats?.visitCount || 0,
                    totalVisits: stats?.visitCount || 0,
                    totalSpend: stats?.totalSpend || 0,
                    lastVisit: stats?.lastVisit || null,
                };
            });

            return res.json(enrichedCustomers);
        } catch (error) {
            console.error('Get Customers Error:', error);
            return res.status(500).json({ error: 'Failed to fetch customers' });
        }
    },

    getCustomerById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const adminId = (req as any).user?.adminId;

            if (!adminId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            console.log(`🔍 [getCustomerById] Request Params ID: "${id}"`);
            console.log(`👤 [getCustomerById] Authenticated Admin ID: "${adminId}"`);

            const customer = await prisma.customer.findUnique({
                where: { id },
                include: {
                    packages: {
                        include: {
                            package: true,
                        },
                        orderBy: {
                            createdAt: 'desc',
                        },
                    },
                    appointments: {
                        include: {
                            service: true,
                            stylist: true,
                            sales: true,
                        },
                        orderBy: {
                            startTime: 'desc',
                        },
                        take: 5,
                    },
                },
            });

            if (!customer) {
                console.error(`❌ [getCustomerById] Customer with ID "${id}" NOT FOUND in DB.`);
                return res.status(404).json({ error: 'Customer not found' });
            }

            console.log(`✅ [getCustomerById] Customer found: ${customer.name}`);

            // Fetch sales (Transaction History)
            const sales = await prisma.sale.findMany({
                where: {
                    customerId: id,
                    adminId: adminId,
                },
                include: {
                    payments: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            // Enforce legacy structure support (combos field)
            const enrichedCustomer = {
                ...customer,
                sales,
                combos: customer.packages.map(p => {
                    const usageDetails = Array.isArray(p.usageDetails) ? p.usageDetails : [];
                    return {
                        ...p,
                        comboPack: p.package,
                        totalVisits: p.totalQuantity,
                        usedVisits: p.usedQuantity,
                        remainingVisits: usageDetails.map((item: any) => ({
                            name: item.name || item.serviceName || 'Service',
                            totalQuantity: item.totalQuantity || 0,
                            usedQuantity: item.usedQuantity || 0,
                            remainingQuantity: item.remainingQuantity !== undefined
                                ? item.remainingQuantity
                                : (item.totalQuantity - item.usedQuantity) || 0
                        })),
                    };
                }),
                totalSpend: sales
                    .filter(s => s.saleStatus === 'COMPLETED')
                    .reduce((sum, s) => sum + (s.totalAmount || 0), 0),
                visitCount: sales.filter(s => s.saleStatus === 'COMPLETED').length,
                totalVisits: sales.filter(s => s.saleStatus === 'COMPLETED').length, // Add for compatibility
                lastVisited: sales.length > 0 ? sales[0].createdAt : customer.createdAt,
            };

            return res.json(enrichedCustomer);
        } catch (error: any) {
            console.error('Get Customer By ID Error:', error);
            return res.status(500).json({ error: 'Failed to fetch customer details' });
        }
    },


    searchCustomers: async (req: Request, res: Response) => {

        try {
            // Extract adminId for multi-tenant filtering
            const adminId = (req as any).user?.adminId;
            if (!adminId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { query } = req.query;
            if (!query || typeof query !== 'string') {
                return res.status(400).json({ error: 'Query parameter is required' });
            }

            const customers = await prisma.customer.findMany({
                where: {
                    adminId: adminId, // Tenant isolation - filter by admin who created the customer
                    OR: [
                        { name: { contains: query } },
                        { email: { contains: query } },
                        { phone: { contains: query } }
                    ]
                }
            });

            // Batch fetch sales stats in ONE query instead of N+1
            const customerIds = customers.map(c => c.id);

            const salesStats = await prisma.sale.groupBy({
                by: ['customerId'],
                where: {
                    customerId: { in: customerIds },
                    adminId: adminId,
                    saleStatus: 'COMPLETED'
                },
                _count: { id: true },
                _sum: { totalAmount: true },
                _max: { createdAt: true },
            });

            const statsMap = new Map(
                salesStats.map(s => [s.customerId, {
                    visitCount: s._count.id,
                    totalSpend: s._sum.totalAmount || 0,
                    lastVisit: s._max.createdAt,
                }])
            );

            const enrichedCustomers = customers.map(customer => {
                const stats = statsMap.get(customer.id);
                return {
                    ...customer,
                    visitCount: stats?.visitCount || 0,
                    totalSpend: stats?.totalSpend || 0,
                    lastVisit: stats?.lastVisit || null,
                };
            });

            return res.json(enrichedCustomers);
        } catch (error) {
            return res.status(500).json({ error: 'Search failed' });
        }
    },

    updateCustomer: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const data = createCustomerSchema.partial().parse(req.body);

            // Extract adminId for duplication check
            const adminId = (req as any).user?.adminId;

            // Check for duplicates before updating (excluding the current customer)
            if (adminId && (data.email || data.phone)) {
                const conditions: any[] = [];
                if (data.email) conditions.push({ email: data.email });
                if (data.phone) conditions.push({ phone: data.phone });

                const existing = await prisma.customer.findFirst({
                    where: {
                        adminId,
                        id: { not: id },
                        OR: conditions
                    }
                });

                if (existing) {
                    const isEmailMatch = data.email && existing.email === data.email;
                    const isPhoneMatch = data.phone && existing.phone === data.phone;

                    if (isEmailMatch && isPhoneMatch) {
                        return res.status(400).json({
                            error: 'A customer with this email and phone number already exists in your customer list'
                        });
                    } else if (isEmailMatch) {
                        return res.status(400).json({
                            error: 'A customer with this email already exists in your customer list'
                        });
                    } else {
                        return res.status(400).json({
                            error: 'A customer with this phone number already exists in your customer list'
                        });
                    }
                }
            }

            // Fetch current customer to get their authId and current values for comparison
            const currentCustomer = await prisma.customer.findUnique({
                where: { id },
                select: { authId: true, name: true, email: true, phone: true }
            });

            console.log(`👤 [UpdateCustomer] Local ID: ${id}`);
            console.log(`🔑 [UpdateCustomer] Auth ID: ${currentCustomer?.authId}`);

            // 1. Determine which fields actually changed to optimize AuthService sync
            const changedFields: any = {};
            if (data.name && data.name !== currentCustomer?.name) changedFields.name = data.name;
            if (data.email && data.email !== currentCustomer?.email) changedFields.email = data.email;
            if (data.phone && data.phone !== currentCustomer?.phone) changedFields.phone = data.phone;

            const hasAuthChanges = Object.keys(changedFields).length > 0;

            if (currentCustomer?.authId && hasAuthChanges) {
                try {
                    const { authService } = await import('../services/auth.service');
                    console.log(`🔄 Syncing customer update to AuthService: ${currentCustomer.authId}`);
                    console.log(`📦 Changed fields:`, JSON.stringify(changedFields, null, 2));

                    try {
                        await authService.updateUser(currentCustomer.authId, changedFields);
                        console.log('✅ [UpdateCustomer] AuthService sync successful');
                    } catch (syncError: any) {
                        const isNotFoundError = syncError.message.includes('404') || syncError.message.includes('not found') || syncError.message.includes('401');
                        const isConflictError = syncError.message.includes('409') || syncError.message.includes('already exists');

                        if (isNotFoundError || isConflictError) {
                            console.log(`⚠️  AuthService update failed (${isNotFoundError ? '404' : '409'}). Attempting RECOVERY...`);

                            // 1. Try finding by EMAIL (using either new or old email)
                            let recoveredUser = await authService.getUserByEmail((data.email || currentCustomer.email) as string, getAppId(req));

                            // 2. If not found by email, try finding by PHONE
                            if (!recoveredUser && (data.phone || currentCustomer.phone)) {
                                const phoneToCheck = (data.phone || currentCustomer.phone) as string;
                                recoveredUser = await authService.getUserByPhone(phoneToCheck, getAppId(req));
                            }

                            if (recoveredUser) {
                                console.log(`✅ Recovered user (by email/phone). New AuthID: ${recoveredUser.id}`);

                                // Update local authId if it changed
                                if (recoveredUser.id !== currentCustomer.authId) {
                                    await prisma.customer.update({
                                        where: { id },
                                        data: { authId: recoveredUser.id }
                                    });
                                }

                                // Retry update on the correct authId
                                await authService.updateUser(recoveredUser.id, changedFields);
                                console.log('✅ AuthService update successful after recovery');
                            } else if (isNotFoundError) {
                                // Only re-register if it was a 404 (totally missing)
                                console.log('❌ Recovery failed: User does not exist. Re-registering...');
                                const password = data.phone ? `Customer@${data.phone.slice(-4)}` : `Customer@${Math.floor(1000 + Math.random() * 9000)}`;

                                const registerResponse = await authService.registerUser({
                                    app_id: getAppId(req),
                                    name: data.name || currentCustomer.name,
                                    email: (data.email || currentCustomer.email) as string,
                                    phone: (data.phone || '') as string,
                                    password,
                                    role: 'CUSTOMER'
                                });

                                if (registerResponse.data?.user?.id) {
                                    const newAuthId = registerResponse.data.user.id;
                                    await prisma.customer.update({
                                        where: { id },
                                        data: { authId: newAuthId }
                                    });
                                    console.log(`✅ User re-registered. New AuthID: ${newAuthId}`);
                                }
                            } else {
                                // If it was a 409 and lookup failed, it's a true conflict we can't merge
                                throw syncError;
                            }
                        } else {
                            throw syncError; // Rethrow other errors (network, 500, etc)
                        }
                    }
                } catch (authError: any) {
                    console.error('⚠️ AuthService sync failed:', authError.message);
                    return res.status(400).json({
                        error: 'Failed to update customer authentication details. ' + (authError.message || 'Unknown error'),
                        details: authError.response?.data || authError.message
                    });
                }
            } else if (hasAuthChanges && !currentCustomer?.authId) {
                console.log('⚠️ Customer has no authId, skipping AuthService sync for now.');
            }

            const customer = await prisma.customer.update({
                where: { id },
                data,
            });

            return res.json(customer);
        } catch (error: any) {
            console.error('Update Customer Error:', error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors[0].message });
            }
            return res.status(500).json({ error: 'Failed to update customer' });
        }
    },

    deleteCustomer: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            await prisma.customer.delete({
                where: { id },
            });

            return res.json({ message: 'Customer deleted successfully' });
        } catch (error) {
            console.error('Delete Customer Error:', error);
            return res.status(500).json({ error: 'Failed to delete customer' });
        }
    },

    /**
     * Link the current authenticated user to a business (Admin) as a Customer.
     * Called after registration/login on the user frontend.
     */
    joinBusiness: async (req: Request, res: Response) => {
        try {
            const { businessName } = req.body;
            const authId = (req as any).user?.id;
            const email = (req as any).user?.email;
            const name = (req as any).user?.name;

            if (!authId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!businessName) {
                return res.status(400).json({ error: 'Business name is required' });
            }

            console.log(`🔗 Linking user ${email} to business: ${businessName}`);

            // 1. Find the Admin (Business Owner)
            // businessName is stored in User table for admins
            const admin = await prisma.user.findFirst({
                where: {
                    businessName: businessName,
                    role: { in: ['ADMIN', 'SUPER_ADMIN'] } // Ensure we are finding a valid business
                }
            });

            if (!admin) {
                console.error(`❌ Business not found: ${businessName}`);
                return res.status(404).json({ error: 'Business not found' });
            }

            console.log(`✅ Found Admin ID: ${admin.id} for business: ${businessName}`);
            console.log(`📋 Admin Details:`);
            console.log(`   - Admin DB ID: ${admin.id}`);
            console.log(`   - Admin authId: ${admin.authId}`);
            console.log(`   - Business Name: ${admin.businessName}`);
            console.log(`   - Admin Role: ${admin.role}`);

            // 2. Check if already linked
            const existingLink = await prisma.customer.findFirst({
                where: {
                    authId: authId,
                    adminId: admin.id // Reverted to Local ID
                }
            });

            if (existingLink) {
                console.log('ℹ️ User is already a customer of this business.');
                return res.json({ message: 'Already joined', customer: existingLink });
            }

            // 3. Create Customer Link
            const newCustomer = await prisma.customer.create({
                data: {
                    authId: authId,
                    adminId: admin.id, // Reverted to Local ID


                    name: name || email || 'Unknown', // Fallback
                    email: email,
                    role: 'CUSTOMER',
                    // Optional fields
                    phone: (req as any).user?.phone || (req as any).user?.phone_number || null
                }
            });

            console.log(`✅ Successfully linked user to business. Customer ID: ${newCustomer.id}`);

            // VERIFICATION LOG: Confirm the customer-admin relationship
            console.log('');
            console.log('🔗 CUSTOMER-ADMIN LINKAGE CONFIRMED:');
            console.log(`   ✅ Customer Email: ${email}`);
            console.log(`   ✅ Customer Name: ${newCustomer.name}`);
            console.log(`   ✅ Customer DB ID: ${newCustomer.id}`);
            console.log(`   ✅ Customer authId: ${authId}`);
            console.log(`   ✅ Linked to Admin ID: ${admin.id}`);
            console.log(`   ✅ Linked to Business: ${businessName}`);
            console.log('');

            return res.status(201).json(newCustomer);

        } catch (error) {
            console.error('Join Business Error:', error);
            return res.status(500).json({ error: 'Failed to join business' });
        }
    },

    /**
     * Public Registration Endpoint
     * Handles end-to-end registration: Auth Service + Local Customer Link
     */
    publicRegister: async (req: Request, res: Response) => {
        try {
            const { businessName } = req.params; // or req.body
            const { name, email, password, phone } = req.body;

            if (!businessName || !name || !email || !password) {
                return res.status(400).json({ error: 'Missing required fields: businessName, name, email, password' });
            }

            console.log(`🚀 Public Registration for Store: ${businessName}`);

            // 1. Find the Business Owner (Admin)
            const admin = await prisma.user.findFirst({
                where: {
                    businessName: businessName,
                    role: { in: ['ADMIN', 'SUPER_ADMIN'] }
                }
            });

            if (!admin) {
                return res.status(404).json({ error: 'Business not found' });
            }

            console.log(`🔍 DEBUG: Registering with App ID: '${getAppId(req)}'`);

            // 3. Register in Auth Service
            const { authService } = await import('../services/auth.service');

            try {
                const regResponse = await authService.registerUser({
                    name,
                    email,
                    password,
                    phone,
                    app_id: getAppId(req),
                    role: 'CUSTOMER'
                });

                const authUser = regResponse.data.user; // Assuming structure

                console.log(`✅ Auth User Created: ${authUser.id}`);

                // 4. Create Local Customer Record
                const customer = await prisma.customer.create({
                    data: {
                        authId: authUser.id,
                        adminId: admin.id, // Reverted to Local ID
                        name: name,
                        email: email,
                        phone: phone,
                        role: 'CUSTOMER'
                    }
                });
                console.log(`✅ Local Customer Created: ${customer.id}`);

                // 5. Auto-Login or Return Tokens
                const tokens = {
                    accessToken: regResponse.data.accessToken,
                    refreshToken: regResponse.data.refreshToken,
                    user: {
                        ...authUser,
                        role: 'CUSTOMER', // Enforce local role
                        adminId: admin.authId
                    }
                };

                return res.status(201).json({
                    status: 'success',
                    data: tokens
                });

            } catch (authError: any) {
                console.error('❌ Registration Failed:', authError.message);
                if (authError.message.includes('exists')) {
                    return res.status(409).json({ error: 'Account already exists in this store. Please login.' });
                }
                return res.status(500).json({ error: authError.message || 'Registration failed' });
            }

        } catch (error) {
            console.error('Public Register Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    /**
     * Validate if user is a customer of a specific business
     * Used during login to enforce business-specific access
     */
    validateBusiness: async (req: Request, res: Response) => {
        try {
            const { businessName } = req.body;
            const authId = (req as any).user?.id;
            const email = (req as any).user?.email;

            if (!authId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!businessName) {
                return res.status(400).json({ error: 'Business name is required' });
            }

            console.log(`🔍 Validating ${email} access to business: ${businessName}`);

            // 1. Find the Admin (Business Owner)
            const admin = await prisma.user.findFirst({
                where: {
                    businessName: businessName,
                    role: { in: ['ADMIN', 'SUPER_ADMIN'] }
                }
            });

            if (!admin) {
                console.error(`❌ Business not found: ${businessName}`);
                return res.status(404).json({ error: `Business "${businessName}" not found` });
            }

            // 2. Check if user is customer of this business
            const customerLink = await prisma.customer.findFirst({
                where: {
                    authId: authId,
                    adminId: admin.id // Reverted to Local ID
                }
            });

            if (!customerLink) {
                console.warn(`⚠️ User ${email} is NOT a customer of ${businessName}. Attempting to auto-join...`);

                try {
                    // AUTO-JOIN: Link user to this business
                    const newCustomer = await prisma.customer.create({
                        data: {
                            authId: authId,
                            adminId: admin.id, // Reverted to Local ID
                            name: (req as any).user?.name || email || 'Valued Customer',
                            email: email,
                            role: 'CUSTOMER',
                            phone: (req as any).user?.phone || (req as any).user?.phoneNumber || null
                        }
                    });

                    console.log(`✅ Successfully auto-joined user ${email} to business ${businessName}`);

                    // Proceed with success response
                } catch (joinError) {
                    console.error('❌ Auto-join failed:', joinError);
                    return res.status(403).json({
                        error: `You are not registered with "${businessName}". Please register or use the correct business URL.`
                    });
                }
            }

            console.log(`✅ Validated: ${email} is customer of ${businessName} (Admin AuthID: ${admin.authId})`);

            return res.json({
                valid: true,
                message: 'Access validated',
                businessName: businessName,
                adminId: admin.authId // Return AuthID
            });

        } catch (error) {
            console.error('Validate Business Error:', error);
            return res.status(500).json({ error: 'Validation failed' });
        }
    },

    async requestOtp(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const adminId = (req as any).user.adminId;
            console.log(`[OTP] Request received for customer ${id} (Admin: ${adminId})`);

            const customer = await prisma.customer.findUnique({
                where: { id, adminId }
            });

            if (!customer) {
                console.warn(`[OTP] Customer ${id} not found for admin ${adminId}`);
                return res.status(404).json({ error: 'Customer not found' });
            }

            if (!customer.phone) {
                console.warn(`[OTP] Customer ${customer.name} has no phone number`);
                return res.status(400).json({ error: 'Customer has no phone number for WhatsApp verification' });
            }

            const { type } = req.body;
            console.log(`[OTP] Sending WhatsApp to ${customer.phone}... Type: ${type || 'standard'}`);
            await otpService.sendOtp(adminId, id, customer.phone, type);
            console.log(`[OTP] Successfully sent for customer ${id}`);
            res.json({ success: true, message: 'OTP sent successfully' });
        } catch (error: any) {
            console.error('[OTP] Request Error:', error);
            res.status(500).json({ error: error.message || 'Failed to send OTP' });
        }
    },

    async verifyOtp(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { otp } = req.body;
            const adminId = (req as any).user.adminId;
            console.log(`[OTP] Verifying code for customer ${id}...`);

            await otpService.verifyOtp(adminId, id, otp);
            console.log(`[OTP] Verification successful for customer ${id}`);
            res.json({ success: true, message: 'OTP verified successfully' });
        } catch (error: any) {
            console.error('[OTP] Verification Error:', error);
            res.status(400).json({ error: error.message || 'OTP verification failed' });
        }
    }
};
