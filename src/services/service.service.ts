import prisma from '../prisma';

export class ServiceService {
    async getAllServices(adminId: string, authId?: string) {
        console.log(`🔍 [ServiceService] REQUESTED AdminID: '${adminId}', AuthID: '${authId}'`);

        // DEBUG: Fetch ALL services to see what's actually in the DB
        // const allServices = await prisma.service.findMany({ select: { id: true, name: true, adminId: true, authId: true } });
        // ... (logging removed for brevity)

        // Robustly filter by adminId OR authId (if provided)
        const where: any = {
            OR: [
                { adminId: adminId },
                ...(authId ? [{ authId: authId }] : [])
            ]
        };

        const services = await prisma.service.findMany({
            where,
            orderBy: [
                { isActive: 'desc' },
                { name: 'asc' }
            ],
        });

        // console.log(`✅ [ServiceService] Final Query returned ${services.length} services.`);
        return services;
    }

    async getServiceById(id: string) {
        return await prisma.service.findUnique({
            where: { id },
        });
    }

    private async ensureServiceCategory(categoryName: string, adminId: string, authId: string) {
        if (!categoryName) return;

        const normalizedName = categoryName.trim();
        if (!normalizedName) return;

        // Check if category exists for this admin
        const existingCategory = await prisma.category.findFirst({
            where: {
                adminId: adminId,
                name: normalizedName,
                type: 'SERVICE'
            }
        });

        if (!existingCategory) {
            console.log(`🆕 [ServiceService] Auto-creating category: '${normalizedName}' for AdminID: ${adminId}`);
            await prisma.category.create({
                data: {
                    name: normalizedName,
                    type: 'SERVICE',
                    adminId: adminId,
                    authId: authId || adminId, // Fallback if authId is missing
                    isActive: true
                }
            });
        }
    }

    async createService(data: { authId?: string; adminId?: string; name: string; description?: string; duration: number; price: number; isActive?: boolean; category?: string; imgUrl?: string }) {
        // Auto-create category if it doesn't exist
        if (data.category && data.adminId) {
            await this.ensureServiceCategory(data.category, data.adminId, data.authId || data.adminId);
        }

        return await prisma.service.create({
            data: {
                authId: data.authId,
                adminId: data.adminId, // Store adminId
                name: data.name,
                description: data.description,
                duration: data.duration,
                price: data.price,
                isActive: data.isActive !== undefined ? data.isActive : true,
                category: data.category || 'General',
                imgUrl: data.imgUrl
            },
        });
    }

    async updateService(id: string, data: { name?: string; description?: string; duration?: number; price?: number; isActive?: boolean; category?: string; imgUrl?: string }) {
        // Fetch existing service for validation and category logic
        const currentService = await prisma.service.findUnique({
            where: { id },
            select: { name: true, adminId: true, authId: true, isActive: true }
        });

        if (!currentService) {
            throw new Error('Service not found');
        }

        // Validation: Block inactivation if service is part of an active package
        if (data.isActive === false && currentService.isActive === true) {
            const activePackages = await prisma.package.findMany({
                where: {
                    adminId: currentService.adminId,
                    active: true
                }
            });

            const isInActivePackage = activePackages.some(pkg => {
                const items = pkg.items as any[];
                return Array.isArray(items) && items.some(item =>
                    (item.type === 'service' && item.name === currentService.name) ||
                    (item.type === 'service' && item.id === id) ||
                    (item.type === 'service' && item.serviceId === id)
                );
            });

            if (isInActivePackage) {
                throw new Error('Cannot inactivate service: It is part of an active combo package. Please inactivate or update the package first.');
            }
        }

        if (data.category && currentService.adminId) {
            await this.ensureServiceCategory(data.category, currentService.adminId, currentService.authId || currentService.adminId);
        }

        return await prisma.service.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.duration && { duration: data.duration }),
                ...(data.price && { price: data.price }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.category && { category: data.category }),
                ...(data.imgUrl !== undefined && { imgUrl: data.imgUrl })
            },
        });
    }

    async deleteService(id: string) {
        // Fetch service details for validation
        const currentService = await prisma.service.findUnique({
            where: { id },
            select: { name: true, adminId: true }
        });

        if (!currentService) {
            throw new Error('Service not found');
        }

        // Validation: Block deletion if service is part of an active package
        const activePackages = await prisma.package.findMany({
            where: {
                adminId: currentService.adminId,
                active: true
            }
        });

        const isInActivePackage = activePackages.some(pkg => {
            const items = pkg.items as any[];
            return Array.isArray(items) && items.some(item =>
                (item.type === 'service' && item.name === currentService.name) ||
                (item.type === 'service' && item.id === id) ||
                (item.type === 'service' && item.serviceId === id)
            );
        });

        if (isInActivePackage) {
            throw new Error('Cannot delete service: It is part of an active combo package. Please remove the service from the package or inactivate the package first.');
        }

        return await prisma.service.delete({
            where: { id },
        });
    }

    async createBulkServices(services: any[], adminId: string, authId: string) {
        const results = {
            created: [] as any[],
            skipped: [] as any[],
            errors: [] as any[]
        };

        // Cache categories to avoid excessive DB lookups
        const existingCategories = new Set(
            (await prisma.category.findMany({
                where: { adminId, type: 'SERVICE' },
                select: { name: true }
            })).map(c => c.name.toLowerCase())
        );

        // Process sequentially to check duplicates accurately
        for (const service of services) {
            try {
                // Check if service with same name exists for this admin
                const existing = await prisma.service.findFirst({
                    where: {
                        adminId: adminId,
                        name: service.name
                    }
                });

                if (existing) {
                    results.skipped.push({
                        name: service.name,
                        reason: 'Duplicate name'
                    });
                    continue;
                }

                // Handle Category Auto-creation
                const catName = service.category || 'General';
                if (!existingCategories.has(catName.toLowerCase())) {
                    await this.ensureServiceCategory(catName, adminId, authId);
                    existingCategories.add(catName.toLowerCase());
                }

                const created = await prisma.service.create({
                    data: {
                        authId: authId,
                        adminId: adminId,
                        name: service.name,
                        description: service.description,
                        duration: parseInt(service.duration),
                        price: parseFloat(service.price),
                        isActive: service.isActive !== undefined ? service.isActive : true,
                        category: catName,
                        imgUrl: service.imgUrl
                    }
                });
                results.created.push(created);

            } catch (error: any) {
                results.errors.push({
                    name: service.name,
                    error: error.message
                });
            }
        }

        return results;
    }
}

export const serviceService = new ServiceService();
