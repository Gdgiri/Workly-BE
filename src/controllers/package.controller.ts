import { Request, Response } from 'express';
import { packageService } from '../services/package.service';

export class PackageController {
    async getAllPackages(req: Request, res: Response) {
        try {
            let authId = (req as any).user?.authId || (req as any).user?.id;
            let adminId = (req as any).user?.adminId;

            // Fix: If authId is present but adminId is missing (due to optionalAuth), fetch the user to get adminId
            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({
                    where: { authId: authId }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }

            const filterId = adminId; // Strict filtering by DB ID for Admin context
            // console.log(`📦 GetAllPackages: authId=${authId}, resolved adminId=${adminId}`);

            const packages = await packageService.getAllPackages(filterId);
            res.json(packages);
        } catch (error: any) {
            console.error('Error in getAllPackages:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getActivePackages(req: Request, res: Response) {
        try {
            let authId = (req as any).user?.authId || (req as any).user?.id;
            let adminId = (req as any).user?.adminId;

            // Allow public filtering by adminId or businessName via query params
            // This is crucial for the public store page to fetch relevant packages
            if (req.query.adminId) {
                adminId = req.query.adminId as string;
            } else if (req.query.businessName) {
                // Resolve adminId from businessName if provided
                const prisma = require('../prisma').default;
                const businessUser = await prisma.user.findFirst({
                    where: { businessName: req.query.businessName as string }
                });
                if (businessUser) {
                    adminId = businessUser.id;
                }
            }

            // Fallback: If authId is present but adminId is missing (logged in user context)
            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({
                    where: { authId: authId }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }

            const filterId = adminId;

            const packages = await packageService.getActivePackages(filterId);
            res.json(packages);
        } catch (error: any) {
            console.error('Error in getActivePackages:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async createPackage(req: Request, res: Response) {
        try {
            // Extract authId and adminId from authenticated user
            let authId = (req as any).user?.id || (req as any).user?.authId;
            let adminId = (req as any).user?.adminId; // Strict DB ID usage

            // STRICT FIX: Ensure adminId is Database ID, not Auth ID
            if (authId && !adminId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ where: { authId } });
                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else if (dbUser.role === 'STYLIST' || dbUser.role === 'STAFF' || dbUser.role === 'MANAGER') {
                        const stylist = await prisma.stylist.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = stylist?.adminId;
                    } else if (dbUser.role === 'CUSTOMER') {
                        const customer = await prisma.customer.findFirst({
                            where: { authId: authId },
                            select: { adminId: true }
                        });
                        adminId = customer?.adminId;
                    }
                }
            }

            console.log('📦 Creating package with adminId:', adminId);

            const newPackage = await packageService.createPackage({
                ...req.body,
                authId, // Add authId to track which user created this package
                adminId // Add adminId for multi-tenancy (DB ID)
            });

            console.log('✅ Package created with authId:', newPackage.authId);
            res.status(201).json(newPackage);
        } catch (error: any) {
            console.error('❌ Error creating package:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async updatePackage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updatedPackage = await packageService.updatePackage(parseInt(id), req.body);
            res.json(updatedPackage);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async deletePackage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await packageService.deletePackage(parseInt(id));
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}

export const packageController = new PackageController();
