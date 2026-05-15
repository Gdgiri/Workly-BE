import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service';
import { resolveDefaultAdminId } from '../utils/user.utils';

export class SettingsController {
    // GET /api/v1/settings - Get current admin's settings
    async getSettings(req: Request, res: Response, next: NextFunction) {
        try {
            // Get adminId from authenticated user (strict mode)
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.authId || (req as any).user?.id;

            // Strict Admin ID Enforcement:
            if (!adminId && authId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ 
                    where: { authId },
                    select: { id: true, role: true, businessEmail: true }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else {
                        // Look for Stylist profile (By AuthID or Email)
                        const stylist = await prisma.stylist.findFirst({
                            where: {
                                OR: [
                                    { authId: authId },
                                    { email: dbUser.businessEmail || (req as any).user?.email }
                                ]
                            },
                            select: { adminId: true }
                        });
                        
                        if (stylist) {
                            adminId = stylist.adminId;
                        } else if (dbUser.role === 'CUSTOMER') {
                            const customer = await prisma.customer.findFirst({
                                where: {
                                    OR: [
                                        { authId: authId },
                                        { email: dbUser.businessEmail || (req as any).user?.email }
                                    ]
                                },
                                select: { adminId: true }
                            });
                            adminId = customer?.adminId;
                        }
                    }
                }
            }

            // Fallback to default only if no authenticated identity or no associations found
            if (!adminId) {
                console.warn(`⚠️ [SettingsController] No specific business context for user ${authId || 'Guest'}. Using default.`);
                adminId = await resolveDefaultAdminId();
            }

            const settings = await settingsService.getOrCreateSettings(adminId);

            // Return actual secret - frontend has show/hide toggle for security
            res.json({
                id: settings.id,
                razorpayKeyId: settings.razorpayKeyId,
                razorpayKeySecret: settings.razorpayKeySecret,

                hasRazorpaySecret: !!settings.razorpayKeySecret,
                currency: settings.currency || 'INR',
                // Salon Information
                salonName: settings.salonName,
                salonPhone: settings.salonPhone,
                salonAddress: settings.salonAddress,
                // Booking Configuration
                openingTime: settings.openingTime,
                closingTime: settings.closingTime,
                maxAdvanceBookingDays: settings.maxAdvanceBookingDays,
                cancellationPolicyHours: settings.cancellationPolicyHours,
                whatsappNotifications: settings.whatsappNotifications,
                // Payment Modes
                activePaymentMethods: settings.activePaymentMethods,
                // New Fields
                salesIdPrefix: settings.salesIdPrefix,
                invoiceStartNumber: settings.invoiceStartNumber || '1',
                inventoryAdjustmentConfig: settings.inventoryAdjustmentConfig,
                enableInventoryAdjustment: settings.enableInventoryAdjustment,
                allowPartialPayment: settings.allowPartialPayment,
                partialPaymentPercentage: settings.partialPaymentPercentage,
                allowNoPayment: settings.allowNoPayment,
                allowFullPayment: settings.allowFullPayment,
                allowRazorpay: settings.allowRazorpay,
                fraudProtection: settings.fraudProtection,
                enableVoucherOtp: settings.enableVoucherOtp,
                // API Configuration
                apiIntegrations: settings.apiIntegrations,

                createdAt: settings.createdAt,
                updatedAt: settings.updatedAt,
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /api/v1/settings/generate-url - Generate user-side URL
    async generateUserURL(req: Request, res: Response, next: NextFunction) {
        try {
            const { businessName, shortenUrl } = req.body;

            if (!businessName) {
                return res.status(400).json({ error: 'Business name is required' });
            }

            // Get base URL from environment
            const baseUrl = process.env.USER_SITE_URL || 'https://wkuser.netlify.app';

            // Sanitize business name for URL (lowercase, replace spaces with hyphens)
            const sanitizedBusinessName = businessName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            // Generate full URL
            const fullUrl = `${baseUrl}/${sanitizedBusinessName}/login`;

            let shortUrl = fullUrl;

            // If shortening is requested, use custom backend shortener
            if (shortenUrl) {
                try {
                    const adminId = (req as any).user?.adminId || (req as any).user?.id;
                    const prisma = require('../prisma').default;

                    if (!adminId) {
                        throw new Error('Admin ID not found');
                    }

                    // Check if admin already has a short code
                    const existingSettings = await prisma.settings.findUnique({
                        where: { adminId }
                    });

                    let shortCode = existingSettings?.shortCode;

                    // If no short code exists OR forceRegenerate is true, generate a new one
                    if (!shortCode || req.body.forceRegenerate) {
                        // Generate random 6-character short code
                        shortCode = this.generateShortCode();

                        // Ensure uniqueness
                        let isUnique = false;
                        let attempts = 0;

                        while (!isUnique && attempts < 10) {
                            const existing = await prisma.settings.findUnique({
                                where: { shortCode }
                            });

                            if (!existing) {
                                isUnique = true;
                            } else {
                                shortCode = this.generateShortCode();
                                attempts++;
                            }
                        }

                        if (!isUnique) {
                            throw new Error('Failed to generate unique short code');
                        }

                        // Save short code to settings
                        await prisma.settings.update({
                            where: { adminId },
                            data: { shortCode }
                        });
                    }

                    // Generate short URL using backend domain
                    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
                    shortUrl = `${backendUrl}/${shortCode}`; // Removed /s/ prefix

                } catch (error) {
                    console.error('Error generating custom short URL:', error);
                    shortUrl = fullUrl; // Fallback to full URL
                }
            }

            res.json({
                success: true,
                fullUrl,
                shortUrl: shortUrl || fullUrl,
                businessName: sanitizedBusinessName
            });
        } catch (error) {
            console.error('❌ Error generating URL:', error);
            next(error);
        }
    }

    // Helper: Generate random 6-character alphanumeric code (no words to avoid copyright)
    // Pattern: alternates between numbers and letters to prevent forming words
    private generateShortCode(): string {
        const numbers = '0123456789';
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        let code = '';

        // Alternate: number, letter, number, letter, number, letter
        // Example: 3k9m2x, 7a4b1c, 5z8q2w (no words possible)
        for (let i = 0; i < 6; i++) {
            if (i % 2 === 0) {
                // Even positions: numbers (0, 2, 4)
                code += numbers.charAt(Math.floor(Math.random() * numbers.length));
            } else {
                // Odd positions: letters (1, 3, 5)
                code += letters.charAt(Math.floor(Math.random() * letters.length));
            }
        }
        return code;
    }

    // GET /api/v1/settings/public - Get public settings (no secrets)
    async getPublicSettings(req: Request, res: Response, next: NextFunction) {
        try {
            // Get the first available settings record (for single-tenant salon)
            // Support multi-tenancy via query param OR custom header (common in user frontend)
            const businessName = (req.query.businessName as string) || (req.headers['x-business-name'] as string);

            let settings;
            if (businessName) {
                console.log(`🔍 Fetching public settings for business: ${businessName}`);
                settings = await settingsService.getSettingsByBusinessName(businessName);
            } else {
                console.log('🔍 Fetching default public settings (no businessName provided)');
                settings = await settingsService.getFirstSettings();
            }

            res.json({
                razorpayKeyId: settings.razorpayKeyId, // Only return Key ID, NOT Secret
                currency: settings.currency || 'INR',
                salonName: settings.salonName,
                salonPhone: settings.salonPhone,
                salonAddress: settings.salonAddress,
                openingTime: settings.openingTime,
                closingTime: settings.closingTime,
                activePaymentMethods: settings.activePaymentMethods,
                partialPaymentPercentage: settings.partialPaymentPercentage || 20,
                allowPartialPayment: settings.allowPartialPayment,
                allowNoPayment: settings.allowNoPayment,
                allowFullPayment: settings.allowFullPayment,
            });
        } catch (error) {
            next(error);
        }
    }

    // PUT /api/v1/settings - Update settings
    async updateSettings(req: Request, res: Response, next: NextFunction) {
        try {
            // Get adminId from authenticated user
            let adminId = (req as any).user?.adminId;

            // Extract authId from authenticated user
            const authId = (req as any).user?.id || (req as any).user?.authId;

            // Strict Admin ID Enforcement for updates
            if (!adminId && authId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ 
                    where: { authId },
                    select: { id: true, role: true, businessEmail: true }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else {
                        const stylist = await prisma.stylist.findFirst({
                            where: {
                                OR: [
                                    { authId: authId },
                                    { email: dbUser.businessEmail || (req as any).user?.email }
                                ]
                            },
                            select: { adminId: true }
                        });
                        if (stylist) {
                            adminId = stylist.adminId;
                        }
                    }
                }
            }
            if (!adminId) adminId = await resolveDefaultAdminId();

            console.log('⚙️ Updating settings with authId:', authId, 'adminId:', adminId);
            console.log('   req.user:', (req as any).user);

            const {
                razorpayKeyId, razorpayKeySecret, currency,
                salonName, salonPhone, salonAddress,
                openingTime, closingTime, maxAdvanceBookingDays, cancellationPolicyHours, whatsappNotifications,
                activePaymentMethods,
                // New Fields
                salesIdPrefix, invoiceStartNumber, inventoryAdjustmentConfig, enableInventoryAdjustment,
                allowPartialPayment, partialPaymentPercentage, allowNoPayment, allowFullPayment, allowRazorpay, fraudProtection,
                enableVoucherOtp,
                // API/AI Config
                apiIntegrations
            } = req.body;

            console.log('📝 [DEBUG] Update Settings Payload:');
            console.log('   - allowRazorpay:', allowRazorpay);
            console.log('   - fraudProtection:', fraudProtection);
            console.log('   - activePaymentMethods (type):', typeof activePaymentMethods);
            console.log('   - activePaymentMethods (value):', JSON.stringify(activePaymentMethods, null, 2));

            const settings = await settingsService.updateSettings(adminId, {
                authId,
                razorpayKeyId,
                razorpayKeySecret,
                currency,
                salonName,
                salonPhone,
                salonAddress,
                openingTime,
                closingTime,
                maxAdvanceBookingDays,
                cancellationPolicyHours,
                whatsappNotifications,
                activePaymentMethods,
                salesIdPrefix,
                invoiceStartNumber,
                inventoryAdjustmentConfig,
                enableInventoryAdjustment,
                allowPartialPayment,
                partialPaymentPercentage,
                allowNoPayment,
                allowFullPayment,
                allowRazorpay,
                fraudProtection,
                enableVoucherOtp,
                apiIntegrations
            });

            console.log('✅ Settings updated with authId:', settings.authId);
            res.json({
                message: 'Settings updated successfully',
                settings: {
                    id: settings.id,
                    razorpayKeyId: settings.razorpayKeyId,
                    hasRazorpaySecret: !!settings.razorpayKeySecret,
                    updatedAt: settings.updatedAt,
                },
            });
        } catch (error) {
            console.error('❌ Error updating settings:', error);
            console.error('Request body:', req.body);
            next(error);
        }
    }

    // PUT /api/v1/settings/payment-methods - Update payment methods
    async updatePaymentMethods(req: Request, res: Response, next: NextFunction) {
        try {
            // Get adminId from authenticated user (same logic as other settings endpoints)
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            // Strict Admin ID Enforcement
            if (!adminId && authId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ 
                    where: { authId },
                    select: { id: true, role: true, businessEmail: true }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else {
                        const stylist = await prisma.stylist.findFirst({
                            where: {
                                OR: [
                                    { authId: authId },
                                    { email: dbUser.businessEmail || (req as any).user?.email }
                                ]
                            },
                            select: { adminId: true }
                        });
                        if (stylist) adminId = stylist.adminId;
                    }
                }
            }
            if (!adminId) adminId = await resolveDefaultAdminId();

            console.log('⚙️ Updating payment methods for adminId:', adminId);

            const { paymentMethods } = req.body;

            if (!Array.isArray(paymentMethods)) {
                return res.status(400).json({ error: 'paymentMethods must be an array' });
            }

            const settings = await settingsService.updatePaymentMethods(adminId, paymentMethods);

            console.log('✅ Payment methods updated successfully for adminId:', adminId);
            res.json({
                message: 'Payment methods updated successfully',
                activePaymentMethods: settings.activePaymentMethods,
            });
        } catch (error) {
            console.error('❌ Error updating payment methods:', error);
            next(error);
        }
    }
}

export const settingsController = new SettingsController();
