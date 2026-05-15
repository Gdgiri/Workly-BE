import { Request, Response } from 'express';
import { customerPackageService } from '../services/customer-package.service';

export class CustomerPackageController {
    /**
     * Purchase a package for a customer
     * POST /api/v1/customers/:customerId/packages
     */
    async purchasePackage(req: Request, res: Response) {
        try {
            const { customerId } = req.params;
            const { packageId } = req.body;
            const authId = (req as any).user?.id;
            const adminId = (req as any).user?.adminId;

            if (!packageId) {
                return res.status(400).json({ error: 'Package ID is required' });
            }

            const customerPackage = await customerPackageService.purchasePackage({
                customerId,
                packageId: parseInt(packageId),
                authId,
                adminId
            });

            res.status(201).json(customerPackage);
        } catch (error: any) {
            console.error('Error purchasing package:', error);
            res.status(500).json({ error: error.message || 'Failed to purchase package' });
        }
    }

    /**
     * Get all packages for a customer
     * GET /api/v1/customers/:customerId/packages
     */
    async getCustomerPackages(req: Request, res: Response) {
        try {
            const { customerId } = req.params;
            const packages = await customerPackageService.getCustomerPackages(customerId);
            res.json(packages);
        } catch (error: any) {
            console.error('Error fetching customer packages:', error);
            res.status(500).json({ error: 'Failed to fetch customer packages' });
        }
    }

    /**
     * Get active packages for a customer
     * GET /api/v1/customers/:customerId/packages/active
     */
    async getActivePackages(req: Request, res: Response) {
        try {
            const { customerId } = req.params;
            const packages = await customerPackageService.getActivePackages(customerId);
            res.json(packages);
        } catch (error: any) {
            console.error('Error fetching active packages:', error);
            res.status(500).json({ error: 'Failed to fetch active packages' });
        }
    }

    /**
     * Use one service from a package
     * PATCH /api/v1/customer-packages/:id/use
     */
    async usePackageService(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { itemId } = req.body; // Expect itemId for granular redemption
            const customerPackage = await customerPackageService.usePackageService(id, itemId);
            res.json(customerPackage);
        } catch (error: any) {
            console.error('Error using package service:', error);
            res.status(400).json({ error: error.message || 'Failed to use package service' });
        }
    }

    /**
     * Get package by ID
     * GET /api/v1/customer-packages/:id
     */
    async getPackageById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const customerPackage = await customerPackageService.getPackageById(id);

            if (!customerPackage) {
                return res.status(404).json({ error: 'Package not found' });
            }

            res.json(customerPackage);
        } catch (error: any) {
            console.error('Error fetching package:', error);
            res.status(500).json({ error: 'Failed to fetch package' });
        }
    }

    /**
     * Cancel a customer package
     * PATCH /api/v1/customer-packages/:id/cancel
     */
    async cancelPackage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const customerPackage = await customerPackageService.cancelPackage(id);
            res.json(customerPackage);
        } catch (error: any) {
            console.error('Error cancelling package:', error);
            res.status(500).json({ error: 'Failed to cancel package' });
        }
    }

    /**
     * Expire packages (admin/cron job)
     * POST /api/v1/customer-packages/expire
     */
    async expirePackages(req: Request, res: Response) {
        try {
            const result = await customerPackageService.expirePackages();
            res.json({ message: 'Packages expired successfully', count: result.count });
        } catch (error: any) {
            console.error('Error expiring packages:', error);
            res.status(500).json({ error: 'Failed to expire packages' });
        }
    }
}

export const customerPackageController = new CustomerPackageController();
