import { Request, Response } from 'express';
import { stylistService } from '../services/stylist.service';
import { updateRosterSchema } from '../schemas/stylist.schema';
import { PrismaClient } from '@prisma/client';
import { getAppId } from '../utils/auth.utils';

const prisma = new PrismaClient();

export class StylistController {
    async getAllStylists(req: Request, res: Response) {
        // Extract admin's adminId (DB ID) for filtering
        const adminId = (req as any).user?.adminId;
        console.log('🔍 Fetching stylists for adminId:', adminId);
        const stylists = await stylistService.getAllStylists(adminId);
        console.log(`✅ Found ${stylists.length} stylists`);
        res.json(stylists);
    }

    async getStylistById(req: Request, res: Response) {
        const { id } = req.params;
        const stylist = await stylistService.getStylistById(id);

        if (!stylist) {
            return res.status(404).json({ error: 'Stylist not found' });
        }

        res.json(stylist);
    }

    async updateRoster(req: Request, res: Response) {
        const { id } = req.params;
        const validatedData = updateRosterSchema.parse(req.body);

        const stylist = await stylistService.getStylistById(id);
        if (!stylist) {
            return res.status(404).json({ error: 'Stylist not found' });
        }

        const updated = await stylistService.updateRoster(id, validatedData);
        res.json(updated);
    }

    async createStylist(req: Request, res: Response) {
        try {
            const { name, email, phone, specialization, workingHours, authId, permissions, gender, imgUrl } = req.body;

            if (!name || !email || !phone) {
                return res.status(400).json({ error: 'Name, email, and phone are required' });
            }

            const adminId = (req as any).user?.adminId;

            // Early check for duplicate stylist in local database
            const existingStylist = await prisma.stylist.findFirst({
                where: {
                    email,
                    adminId
                }
            });

            if (existingStylist) {
                return res.status(409).json({
                    error: 'A specialist with this email already exists in your salon'
                });
            }

            let createdAuthId = authId; // Use provided authId or create new one

            // Auto-create user in AuthService for login if authId not provided
            if (!createdAuthId) {
                const axios = require('axios');
                const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8000';

                try {
                    // Generate password from last 4 digits of phone
                    const password = `Specialist@${phone.slice(-4)}`;

                    console.log(`📝 Creating AuthService account for: ${email}`);

                    // Register user in AuthService
                    // IMPORTANT: Use /auth/register (not /api/auth/register) to bypass gateway middleware
                    const registerResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, {
                        app_id: getAppId(req),
                        name,
                        email,
                        phone_number: phone || '',
                        password,
                        role: 'STAFF' // Assign STAFF role for sidebar access
                    }, {
                        timeout: 30000 // 30 second timeout (increased from 10s)
                    });

                    // AuthService returns { status, message, data: { user, accessToken, refreshToken } }
                    const responseData = registerResponse.data?.data;
                    const authUser = responseData?.user;

                    if (!authUser || !authUser.id) {
                        console.error('❌ Invalid response from AuthService:', registerResponse.data);
                        throw new Error('Invalid response from AuthService');
                    }

                    createdAuthId = authUser.id;
                    console.log(`✅ AuthService account created: ${createdAuthId}`);
                    console.log(`   Login credentials - Email: ${email}, Password: ${password}`);

                } catch (authError: any) {
                    const errorMsg = authError.response?.data?.message || authError.message;
                    console.error('❌ Error creating AuthService account:', errorMsg);

                    // If email already exists, we MUST get the existing authId
                    if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
                        console.log('   ℹ️  Email already registered in AuthService');
                        console.log('   🔍 Attempting to fetch existing user details...');

                        try {
                            let retrievedUser = null;
                            const { authService } = await import('../services/auth.service');

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
                                console.log(`   ✅ Found existing CUSTOMER record: ${existingCustomer.name}`);
                                retrievedUser = { id: existingCustomer.authId };
                            } else {
                                // Check Stylist table
                                const existingStylist = await prisma.stylist.findFirst({
                                    where: { email },
                                    select: { authId: true, name: true, adminId: true }
                                });

                                if (existingStylist && existingStylist.authId) {
                                    console.log(`   ✅ Found existing STYLIST record: ${existingStylist.name}`);
                                    retrievedUser = { id: existingStylist.authId };
                                }
                            }

                            // ---------------------------------------------------------
                            // STEP 2: Fallback to AuthService (Login Strategy)
                            // ---------------------------------------------------------
                            if (!retrievedUser) {
                                console.log('   ⚠️  Email exists in AuthService but not in local database (Orphaned User)');
                                console.log('   🔍 Step 2: Attempting to retrieve via Login Strategy...');

                                // Try to login as Stylist first (if they were a stylist before)
                                if (phone) {
                                    // Try Stylist Password format
                                    const stylistPassword = `Specialist@${phone.slice(-4)}`;
                                    console.log(`      Trying login with Stylist password format...`);
                                    retrievedUser = await authService.login(email, stylistPassword, getAppId(req));

                                    if (!retrievedUser) {
                                        // Try Customer Password format (most common case for upgrade)
                                        const customerPassword = `Customer@${phone.slice(-4)}`;
                                        console.log(`      Trying login with Customer password format...`);
                                        retrievedUser = await authService.login(email, customerPassword, getAppId(req));
                                    }
                                }

                                // Last resort: Try standard lookup (might fail due to endpoint 404)
                                if (!retrievedUser) {
                                    console.log('      Trying standard email lookup...');
                                    retrievedUser = await authService.getUserByEmail(email, getAppId(req));
                                }
                            }

                            // ---------------------------------------------------------
                            // FINAL CHECK
                            // ---------------------------------------------------------
                            if (retrievedUser && retrievedUser.id) {
                                createdAuthId = retrievedUser.id;
                                console.log(`   ✅ Successfully retrieved authId: ${createdAuthId}`);
                            } else {
                                // CRITICAL: Could not retrieve authId - REJECT
                                console.error('   ❌ Could not retrieve authId from Local DB, Login, or Lookup');
                                throw new Error('AuthId retrieval failed - User exists but cannot verified');
                            }

                        } catch (fetchError: any) {
                            console.error('   ❌ Error during authId retrieval:', fetchError);
                            console.error('   ❌ Stylist creation REJECTED - authId is required');

                            return res.status(400).json({
                                error: 'This email is already registered but we cannot verify the account. Please try again or check if the email is correct.',
                                code: 'AUTH_ID_RETRIEVAL_FAILED',
                                details: fetchError.message
                            });
                        }
                    } else {
                        // Other auth errors
                        console.error('   ❌ AuthService error - Stylist creation REJECTED');
                        return res.status(500).json({ error: 'AuthService error', details: errorMsg });
                    }
                }
            }

            // Final check for authId
            if (!createdAuthId) {
                return res.status(500).json({ error: 'Failed to obtain Auth ID for stylist' });
            }

            // Create stylist in database with authId and adminId
            console.log('========================================');
            console.log('🔍 CREATING STYLIST - DEBUG INFO');
            console.log('========================================');
            console.log('req.user object:', JSON.stringify((req as any).user, null, 2));
            console.log('req.user.id:', (req as any).user?.id);
            console.log('req.user.authId:', (req as any).user?.authId);
            console.log('req.user.userId:', (req as any).user?.userId);

            console.log('Extracted adminId (DB ID):', adminId);
            console.log('Stylist Auth ID (from AuthService):', createdAuthId);
            console.log('Stylist Name:', name);
            console.log('Stylist Email:', email);
            console.log('========================================');

            const stylist = await stylistService.createStylist({
                authId: createdAuthId,
                adminId,
                name,
                email,
                phone,
                specialization: specialization || 'General',
                workingHours: workingHours || {},
                permissions: permissions || [],

                gender,
                imgUrl
            });

            console.log('✅ STYLIST CREATED SUCCESSFULLY');
            console.log('Stylist ID:', stylist.id);
            console.log('Stylist authId:', stylist.authId);
            console.log('Stylist adminId:', (stylist as any).adminId);
            console.log('========================================');

            res.status(201).json(stylist);
        } catch (error: any) {
            console.error('Error creating stylist:', error);

            // Handle unique constraint violation (duplicate email)
            if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
                return res.status(409).json({
                    error: 'A stylist with this email already exists'
                });
            }

            res.status(500).json({ error: 'Failed to create stylist' });
        }
    }

    async updateStylist(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { name, email, phone, specialization, leaves, workingHours, dateSpecificHours, isAvailable, permissions, gender, imgUrl } = req.body;

            const updateData: any = {};

            // Update basic stylist information
            if (name !== undefined) {
                updateData.name = name;
            }

            if (email !== undefined) {
                updateData.email = email;
            }

            if (phone !== undefined) {
                updateData.phone = phone;
            }

            if (specialization !== undefined) {
                updateData.specialization = specialization;
            }

            if (isAvailable !== undefined) {
                updateData.isAvailable = isAvailable;
            }

            // Update roster-related fields
            if (leaves !== undefined) {
                updateData.leaves = leaves;
            }

            if (workingHours !== undefined) {
                updateData.workingHours = workingHours;
            }

            if (dateSpecificHours !== undefined) {
                updateData.dateSpecificHours = dateSpecificHours;
            }

            if (permissions !== undefined) {
                updateData.permissions = permissions;
            }

            if (gender !== undefined) {
                updateData.gender = gender;
            }

            if (imgUrl !== undefined) {
                updateData.imgUrl = imgUrl;
            }

            // Sync with AuthService if relevant fields changed
            const currentStylist = await prisma.stylist.findUnique({
                where: { id },
                select: { authId: true }
            });

            if (currentStylist?.authId && (name || email || phone)) {
                try {
                    const { authService } = await import('../services/auth.service');
                    console.log(`🔄 Syncing stylist update to AuthService: ${currentStylist.authId}`);
                    await authService.updateUser(currentStylist.authId, {
                        name,
                        email,
                        phone
                    });
                    console.log('✅ AuthService sync successful');
                } catch (authError) {
                    console.error('⚠️ AuthService sync failed:', authError);
                }
            }

            const stylist = await stylistService.updateStylist(id, updateData);
            res.json(stylist);
        } catch (error: any) {
            console.error('Error updating stylist:', error);
            res.status(500).json({ error: 'Failed to update stylist' });

        }

    }

    async deleteStylist(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await stylistService.deleteStylist(id);
            res.status(204).send();
        } catch (error) {
            console.error('Error deleting stylist:', error);
            res.status(500).json({ error: 'Failed to delete stylist' });
        }
    }
}

export const stylistController = new StylistController();
