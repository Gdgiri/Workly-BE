import prisma from '../prisma';

export class PackageService {
    async getAllPackages(filterId?: string) {
        const where: any = {};
        if (filterId) {
            where.OR = [
                { authId: filterId },
                { adminId: filterId }
            ];
        } else {
            return [];
        }
        const packages = await prisma.package.findMany({
            where,
            orderBy: [
                { active: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return await this.cleanPackages(packages, filterId);
    }

    private async cleanPackages(packages: any[], businessId?: string) {
        if (!packages.length || !businessId) return packages;

        // Fetch all valid service and product names for this business
        const [services, products] = await Promise.all([
            prisma.service.findMany({
                where: { OR: [{ authId: businessId }, { adminId: businessId }] },
                select: { name: true }
            }),
            prisma.product.findMany({
                where: { OR: [{ authId: businessId }, { adminId: businessId }] },
                select: { name: true }
            })
        ]);

        const validNames = new Set([
            ...services.map(s => s.name),
            ...products.map(p => p.name)
        ]);

        return packages.map(pkg => ({
            ...pkg,
            items: (pkg.items as any[] || []).filter(item => validNames.has(item.name))
        }));
    }

    async createPackage(data: any) {
        return await prisma.package.create({
            data: {
                name: data.name,
                description: data.description,
                price: data.price,
                active: data.active,
                validityDays: data.validityDays,
                authId: data.authId, // Track which user created this package
                adminId: data.adminId, // Business Owner's ID
                items: data.items, // JSON field
                imgUrl: data.imgUrl // Package image
            }
        });
    }

    async updatePackage(id: number, data: any) {
        return await prisma.package.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                price: data.price,
                active: data.active,
                validityDays: data.validityDays,
                items: data.items,
                imgUrl: data.imgUrl
            }
        });
    }

    async getActivePackages(filterId?: string) {
        const where: any = { active: true };
        if (filterId) {
            where.OR = [
                { authId: filterId },
                { adminId: filterId }
            ];
        } else {
            return [];
        }
        const packages = await prisma.package.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        return await this.cleanPackages(packages, filterId);
    }

    async deletePackage(id: number) {
        return await prisma.package.delete({
            where: { id }
        });
    }
}

export const packageService = new PackageService();
