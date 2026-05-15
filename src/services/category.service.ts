
import { Category } from '@prisma/client';
import prisma from '../prisma';

class CategoryService {
    async createCategory(data: {
        name: string;
        type: string;
        description?: string;
        authId: string;
        adminId: string;
        imgUrl?: string;
    }) {
        return await prisma.category.create({
            data: {
                name: data.name,
                type: data.type,
                description: data.description,
                authId: data.authId,
                adminId: data.adminId, // REQUIRED: Multi-tenancy
                isActive: true,
                imgUrl: data.imgUrl
            }
        });
    }

    async getAllCategories(adminId: string, type?: string) {
        const where: any = {
            adminId: adminId
        };

        if (type) {
            where.type = type;
        }

        const categories = await prisma.category.findMany({
            where,
            orderBy: [
                { isActive: 'desc' },
                { name: 'asc' }
            ]
        });

        // Fetch counts based on category name (since no FK relation)
        let serviceCounts: { category: string | null; _count: { id: number } }[] = [];
        let productCounts: { category: string; _count: { id: number } }[] = [];

        if (!type || type === 'SERVICE') {
            const result = await prisma.service.groupBy({
                by: ['category'],
                where: {
                    adminId,
                    isActive: true,
                    category: { not: null }
                },
                _count: { id: true }
            });
            serviceCounts = result as any;
        }

        if (!type || type === 'PRODUCT') {
            const result = await prisma.product.groupBy({
                by: ['category'],
                where: {
                    adminId,
                    isActive: true
                },
                _count: { id: true }
            });
            productCounts = result as any;
        }

        // Map counts to categories
        return categories.map(cat => {
            let count = 0;
            if (cat.type === 'SERVICE') {
                const found = serviceCounts.find(c => c.category === cat.name);
                count = found ? found._count.id : 0;
            } else if (cat.type === 'PRODUCT') {
                const found = productCounts.find(c => c.category === cat.name);
                count = found ? found._count.id : 0;
            }
            return {
                ...cat,
                _count: { services: count } // Using nested structure to match previous plan or flat? Plan said _count.services
            };
        });
    }

    async updateCategory(id: string, data: Partial<Category>) {
        return await prisma.category.update({
            where: { id },
            data
        });
    }

    async deleteCategory(id: string) {
        // Soft delete
        return await prisma.category.update({
            where: { id },
            data: { isActive: false }
        });
    }
}

export default new CategoryService();
