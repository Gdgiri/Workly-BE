import { Request, Response } from 'express';
import { serviceService } from '../services/service.service';

export class ServiceController {
    async getAllServices(req: Request, res: Response) {
        try {
            const user = (req as any).user;

            // STRICT SECURITY: Services must be filtered by AdminId (Tenant)
            // If the user is a Staff member, they have an 'adminId'.
            // If the user is the Admin themselves, their 'id' is the 'adminId'.
            // STRICT SECURITY: Services must be filtered by AdminId (Tenant)
            const filterId = user?.adminId;

            // console.log('🔍 [Controller] getAllServices');
            // console.log(`   User ID: ${user?.id}`);
            // console.log(`   Role: ${user?.role}`);
            // console.log(`   Filter AdminID: ${filterId}`);

            if (!filterId) {
                console.warn('⚠️ [Controller] No admin context found! Returning empty.');
                return res.json([]);
            }

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

            // DEBUG HEADERS: Help frontend see what the server sees
            res.setHeader('X-Debug-User-ID', user?.id || 'null');
            res.setHeader('X-Debug-Filter-ID', filterId || 'null');
            res.setHeader('X-Debug-Role', user?.role || 'null');

            const services = await serviceService.getAllServices(filterId);

            // console.log(`✅ [Controller] Sending ${services.length} services to frontend.`);
            res.json(services);
        } catch (error) {
            console.error('Error fetching services:', error);
            res.status(500).json({ error: 'Failed to fetch services' });
        }
    }

    async createService(req: Request, res: Response) {
        try {
            const { name, description, duration, price, isActive, category, imgUrl } = req.body;

            if (!name || !duration || !price) {
                return res.status(400).json({ error: 'Name, duration, and price are required' });
            }

            // Extract authId and adminId from authenticated user
            const authId = (req as any).user?.id;

            const adminId = (req as any).user?.adminId; // Strict usage: Admin's DB ID

            // PREVENT DUPLICATES: Check if a service with the same name already exists for this admin
            const prisma = (await import('../prisma')).default;
            const existingService = await prisma.service.findFirst({
                where: {
                    name,
                    adminId
                }
            });

            if (existingService) {
                console.log(`⚠️ [Controller] Duplicate service detected: ${name}`);
                return res.status(400).json({ error: 'A service with this name already exists in your list.' });
            }

            console.log('🔍 [Controller] createService');
            console.log(`   Saved Name: ${name}`);
            console.log(`   Saved AdminID: ${adminId}`);
            console.log(`   Saved AuthID: ${authId}`);

            const service = await serviceService.createService({
                authId, // Track which admin created this service
                adminId, // Business Owner's ID
                name,
                description,
                duration: parseInt(duration),
                price: parseFloat(price),
                isActive: isActive !== undefined ? isActive : true,
                category,
                imgUrl
            });

            console.log('✅ Service created successfully:', service.id);
            res.status(201).json(service);
        } catch (error) {
            console.error('Error creating service:', error);
            res.status(500).json({ error: 'Failed to create service' });
        }
    }

    async updateService(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { name, description, duration, price, isActive, category, imgUrl } = req.body;

            const service = await serviceService.updateService(id, {
                name,
                description,
                duration: duration ? parseInt(duration) : undefined,
                price: price ? parseFloat(price) : undefined,
                isActive,
                category,
                imgUrl
            });

            res.json(service);
        } catch (error: any) {
            console.error('Error updating service:', error);
            const status = error.message && error.message.includes('combo package') ? 400 : 500;
            res.status(status).json({ error: error.message || 'Failed to update service' });
        }
    }

    async deleteService(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await serviceService.deleteService(id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting service:', error);
            const status = error.message && error.message.includes('combo package') ? 400 : 500;
            res.status(status).json({ error: error.message || 'Failed to delete service' });
        }
    }

    async getServiceById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const service = await serviceService.getServiceById(id);

            if (!service) {
                return res.status(404).json({ error: 'Service not found' });
            }

            res.json(service);
        } catch (error) {
            console.error('Error fetching service by id:', error);
            res.status(500).json({ error: 'Failed to fetch service' });
        }
    }

    async bulkCreateServices(req: Request, res: Response) {
        try {
            let services = req.body;

            // Handle wrapped payload { services: [...] }
            if (!Array.isArray(services) && services.services && Array.isArray(services.services)) {
                services = services.services;
            }

            if (!Array.isArray(services) || services.length === 0) {
                return res.status(400).json({ error: 'Invalid input. Expected non-empty array of services.' });
            }

            const authId = (req as any).user?.id;
            const adminId = (req as any).user?.adminId;

            console.log(`📝 [Controller] Bulk Create: ${services.length} services requested.`);
            console.log(`   AdminID: ${adminId}`);

            const result = await serviceService.createBulkServices(services, adminId, authId);

            console.log(`✅ [Controller] Bulk Create: ${result.created.length} created, ${result.skipped.length} skipped.`);

            // Frontend expects specific format
            res.status(201).json({
                successCount: result.created.length,
                errorCount: result.skipped.length + result.errors.length,
                errors: [...result.skipped, ...result.errors],
                services: result.created
            });
        } catch (error) {
            console.error('Error in bulk create services:', error);
            res.status(500).json({ error: 'Failed to create services in bulk' });
        }
    }
}

export const serviceController = new ServiceController();
