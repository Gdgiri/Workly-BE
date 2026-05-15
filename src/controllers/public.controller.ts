import { Request, Response } from 'express';
import prisma from '../prisma';
import { serviceService } from '../services/service.service';
import { stylistService } from '../services/stylist.service';
import { authService } from '../services/auth.service';

export const publicController = {
    /**
     * Get Public Info (Services, Stylists, Settings) by Store Name
     */
    getStoreData: async (req: Request, res: Response) => {
        try {
            const { businessName } = req.params;

            // 1. Resolve Admin ID from Store Name
            const admin = await (prisma.user as any).findFirst({
                where: { businessName: businessName },
                select: { id: true, businessName: true, authId: true }
            });

            if (!admin) {
                return res.status(404).json({ error: 'Store not found' });
            }

            // 2. Fetch Data using Admin ID and Auth ID (for robust filtering)
            const services = await serviceService.getAllServices(admin.id);
            const stylists = await stylistService.getAllStylists(admin.id);

            // Settings mock (or fetch from DB if you have a settings service)
            const settings = {
                currency: 'INR',
                salonName: admin.businessName,
                partialPaymentPercentage: 20,
                allowPartialPayment: true,
                allowNoPayment: true, // Allow credit booking for guests? Maybe configurable
                allowFullPayment: false
            };

            res.json({
                services,
                stylists,
                settings,
                storeInfo: {
                    businessName: admin.businessName,
                    adminId: admin.id,
                    adminAuthId: admin.authId
                }
            });

        } catch (error: any) {
            console.error('Error fetching store data:', error);
            res.status(500).json({ error: 'Failed to fetch store data' });
        }
    },

    /**
     * Get Services for a Store
     */
    getServices: async (req: Request, res: Response) => {
        try {
            const { businessName } = req.params;
            const admin = await (prisma.user as any).findFirst({ where: { businessName } });
            if (!admin) return res.status(404).json({ error: 'Store not found' });

            const services = await serviceService.getAllServices(admin.id);
            res.json(services);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed' });
        }
    },

    /**
    * Get Stylists for a Store
    */
    getStylists: async (req: Request, res: Response) => {
        try {
            const { businessName } = req.params;
            const admin = await (prisma.user as any).findFirst({ where: { businessName } });
            if (!admin) return res.status(404).json({ error: 'Store not found' });

            const stylists = await stylistService.getAllStylists(admin.id);
            res.json(stylists);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed' });
        }
    },

    /**
     * Forgot Password Proxy
     */
    forgotPassword: async (req: Request, res: Response) => {
        try {
            console.log('📬 [PublicController] Forgot Password Request:', req.body);
            const { email, app_id, businessName } = req.body;
            if (!email || !app_id || !businessName) {
                console.warn('⚠️ [PublicController] Missing parameters in forgotPassword request');
                return res.status(400).json({ error: 'Email, app_id, and businessName are required' });
            }

            const result = await (authService as any).forgotPassword(email, app_id, businessName);
            console.log('✅ [PublicController] Forgot Password Proxy Success');
            return res.json(result);
        } catch (error: any) {
            console.error('❌ [PublicController] Forgot Password Proxy Error:', error.message);
            if (error.response) {
                console.error('📦 [PublicController] Error Response Data:', JSON.stringify(error.response.data));
            }
            return res.status(500).json({ status: 'error', error: error.message });
        }
    },

    /**
     * Reset Password Proxy
     */
    resetPassword: async (req: Request, res: Response) => {
        try {
            console.log('📬 [PublicController] Reset Password Request');
            const { password, token } = req.body;
            if (!password || !token) {
                return res.status(400).json({ error: 'Password and token are required' });
            }

            const result = await (authService as any).resetPassword(password, token);
            console.log('✅ [PublicController] Reset Password Proxy Success');
            return res.json(result);
        } catch (error: any) {
            console.error('❌ [PublicController] Reset Password Proxy Error:', error.message);
            return res.status(500).json({ status: 'error', error: error.message });
        }
    },

    /**
     * Discover stores where an email is registered as a staff member
     * GET /api/v1/public/discover-staff?email=...
     */
    discoverStaff: async (req: Request, res: Response) => {
        try {
            const { email } = req.query;
            if (!email || typeof email !== 'string') {
                return res.status(400).json({ error: 'Email is required' });
            }

            console.log(`🔍 [PublicController] discoverStaff for: ${email}`);

            // Find all stylists with this email
            const stylistAssociations = await (prisma.stylist as any).findMany({
                where: {
                    email: email,
                }
            });

            if (stylistAssociations.length === 0) {
                return res.json({ businesses: [] });
            }

            // Get business details for each associated admin
            const adminIds = stylistAssociations.map((s: any) => s.adminId);
            const admins = await (prisma.user as any).findMany({
                where: {
                    id: { in: adminIds },
                    isActive: true
                },
                select: {
                    id: true,
                    businessName: true,
                    businessPhone: true,
                    businessAddress: true
                }
            });

            const results = stylistAssociations.map((stylist: any) => {
                const admin = admins.find((a: any) => a.id === stylist.adminId);
                if (!admin) return null;
                return {
                    adminId: admin.id,
                    businessName: admin.businessName,
                    salonName: admin.businessName,
                    staffName: stylist.name,
                    role: 'STAFF',
                    isAvailable: stylist.isAvailable
                };
            }).filter((item: any) => item !== null);

            res.json({
                count: results.length,
                businesses: results
            });

        } catch (error: any) {
            console.error('Error discovering staff stores:', error);
            res.status(500).json({ error: 'Discovery failed' });
        }
    }
};
