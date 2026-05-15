import { Product, Prisma } from '@prisma/client';
import prisma from '../prisma';

class InventoryService {
    async getAllProducts(authId?: string) {
        // SECURITY FIX: If no authId is provided, return empty array.
        // Do NOT return all global products.
        if (!authId) {
            console.warn('⚠️ [InventoryService] getAllProducts called without authId. Returning empty list to prevent global leak.');
            return [];
        }

        const where: any = {
            OR: [
                { authId: authId },
                { adminId: authId }
            ]
        };

        return await prisma.product.findMany({
            where,
            orderBy: [
                { isActive: 'desc' },
                { name: 'asc' }
            ],
        });
    }

    async getProductById(id: string) {
        return await prisma.product.findUnique({
            where: { id },
        });
    }

    async getProductHistory(productId: string) {
        return await prisma.inventoryMovement.findMany({
            where: { productId },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getAllInventoryHistory(filterId?: string) {
        const where: any = {};
        if (filterId) {
            where.OR = [
                { authId: filterId },
                { adminId: filterId }
            ];
        }
        return await prisma.inventoryMovement.findMany({
            where,
            include: {
                product: {
                    select: { name: true, sku: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
    }

    async createProduct(data: {
        authId: string;
        adminId?: string;
        name: string;
        category: string;
        sku: string;
        price: number;
        stock: number;
        imgUrl?: string;
        isActive?: boolean;
    }) {
        return await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    authId: data.authId,
                    adminId: data.adminId, // Store adminId
                    name: data.name,
                    category: data.category,
                    sku: data.sku,
                    price: data.price,
                    stock: data.stock,
                    imgUrl: data.imgUrl,
                    isActive: data.isActive !== undefined ? data.isActive : true
                }
            });

            // Log initial stock movement
            if (data.stock > 0) {
                await tx.inventoryMovement.create({
                    data: {
                        productId: product.id,
                        type: 'RECEIVED',
                        quantity: data.stock,
                        balanceAfter: data.stock,
                        remarks: 'Initial Stock - Product Created',
                        authId: data.authId,
                        adminId: data.adminId // Store adminId
                    }
                });
            }

            return product;
        });
    }

    async updateProduct(id: string, data: Partial<Product>) {
        return await prisma.product.update({
            where: { id },
            data,
        });
    }

    async deleteProduct(id: string) {
        return await prisma.product.delete({
            where: { id },
        });
    }

    async updateStock(id: string, quantity: number, type: 'add' | 'remove', remarks: string = '', authId?: string, movementType?: string, adminId?: string, transactionClient?: Prisma.TransactionClient) {
        const execute = async (tx: Prisma.TransactionClient) => {
            const product = await tx.product.findUnique({ where: { id } });
            if (!product) throw new Error('Product not found');

            const newStock = type === 'add'
                ? product.stock + quantity
                : Math.max(0, product.stock - quantity);

            const updatedProduct = await tx.product.update({
                where: { id },
                data: { stock: newStock },
            });

            // Determine movement type if not provided
            let mType = movementType;
            if (!mType) {
                mType = type === 'add' ? 'RECEIVED' : 'ADJUSTMENT_REMOVE';
            }

            // Log movement
            await tx.inventoryMovement.create({
                data: {
                    productId: id,
                    type: mType,
                    quantity: quantity,
                    balanceAfter: newStock,
                    remarks: remarks || (type === 'add' ? 'Stock Received' : 'Stock Removed'),
                    authId: authId,
                    adminId: adminId // Store adminId
                }
            });

            return updatedProduct;
        };

        if (transactionClient) {
            return await execute(transactionClient);
        }

        return await prisma.$transaction(async (tx) => {
            return await execute(tx);
        });
    }

    async bulkCreateProducts(data: {
        authId: string;
        adminId: string;
        products: {
            name: string;
            category: string;
            sku: string;
            price: number;
            stock: number;
            imgUrl?: string;
        }[]
    }) {
        const results = [];
        const errors = [];

        // Get all existing product categories for this admin
        const existingCategories = await prisma.category.findMany({
            where: { adminId: data.adminId, type: 'PRODUCT' },
            select: { name: true }
        });
        const categoryNames = new Set(existingCategories.map(c => c.name.toLowerCase()));

        for (const pData of data.products) {
            try {
                // Auto-create category if it doesn't exist (case insensitive check)
                const catNameTrim = (pData.category || 'General').trim();
                const catNameLower = catNameTrim.toLowerCase();

                if (!categoryNames.has(catNameLower)) {
                    await prisma.category.create({
                        data: {
                            name: catNameTrim, // Preserve casing for display
                            type: 'PRODUCT',
                            authId: data.authId,
                            adminId: data.adminId,
                            isActive: true
                        }
                    });
                    categoryNames.add(catNameLower);
                }

                const product = await this.createProduct({
                    authId: data.authId,
                    adminId: data.adminId,
                    ...pData,
                    category: catNameTrim // Use trimmed category name
                });
                results.push(product);
            } catch (err: any) {
                console.error(`Error importing product ${pData.sku}:`, err);
                let message = err.message;
                if (err.code === 'P2002') {
                    message = `SKU ${pData.sku} already exists`;
                }
                errors.push({ sku: pData.sku, name: pData.name, error: message });
            }
        }

        return {
            successCount: results.length,
            errorCount: errors.length,
            errors,
            products: results
        };
    }
}

export default new InventoryService();
