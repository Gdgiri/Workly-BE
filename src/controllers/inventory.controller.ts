import { Request, Response } from 'express';
import inventoryService from '../services/inventory.service';

class InventoryController {
    async getAllProducts(req: Request, res: Response) {
        try {
            // Extract authId and adminId from authenticated user (if available)
            const user = (req as any).user;
            const authId = user?.authId || user?.id;
            const adminId = user?.adminId; // Strict DB ID for Admin

            // console.log('🔍 GET /inventory - Filtering Debug:', {
            //     userObject: user,
            //     extractedAuthId: authId,
            //     extractedAdminId: adminId
            // });

            // Pass adminId (Tenant ID) to service for filtering
            // If adminId is available (Admin/Stylist/Customer), use it.
            // Fallback to authId only if adminId is missing (shouldn't happen for valid users)
            // Pass adminId (Tenant ID) to service for filtering
            const filterId = adminId;

            // console.log('🔍 Filtering products with ID:', filterId);

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            const products = await inventoryService.getAllProducts(filterId);
            res.json(products);
        } catch (error) {
            console.error('Error fetching products:', error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    }

    async getProductById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const product = await inventoryService.getProductById(id);

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            res.json(product);
        } catch (error) {
            console.error('Error fetching product:', error);
            res.status(500).json({ error: 'Failed to fetch product' });
        }
    }

    async createProduct(req: Request, res: Response) {
        try {
            console.log('📦 Create product request body:', req.body);
            const { name, category, sku, price, stock, imgUrl, isActive } = req.body;

            console.log('Validation check:', { name, category, sku, price, stock, isActive });

            if (!name || !category || !sku || price === undefined || stock === undefined) {
                console.log('❌ Validation failed - missing fields');
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Extract authId and adminId from authenticated user (if available)
            let authId = (req as any).user?.id || (req as any).user?.authId;
            let adminId = (req as any).user?.adminId; // Strict usage: Admin's DB ID

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

            // Debug logging
            console.log('🔍 Creating product with authId tracking:');
            console.log('   req.user:', (req as any).user);
            console.log('   Extracted authId:', authId);
            console.log('   Resolved adminId (DB ID):', adminId);
            console.log('   Product name:', name);

            const product = await inventoryService.createProduct({
                authId, // Track which admin created this product (Auth ID)
                adminId, // Business Owner's ID (Database ID)
                name,
                category,
                sku,
                price: parseFloat(price),
                stock: parseInt(stock),
                imgUrl,
                isActive: isActive !== undefined ? isActive : true
            });

            console.log('✅ Product created successfully with authId:', product.authId);
            res.status(201).json(product);
        } catch (error: any) {
            console.error('Error creating product:', error);
            if (error.code === 'P2002') {
                return res.status(400).json({ error: 'SKU already exists' });
            }
            res.status(500).json({ error: 'Failed to create product' });
        }
    }

    async updateProduct(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const product = await inventoryService.updateProduct(id, updates);
            res.json(product);
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ error: 'Failed to update product' });
        }
    }

    async deleteProduct(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await inventoryService.deleteProduct(id);
            res.json({ message: 'Product deleted successfully' });
        } catch (error) {
            console.error('Error deleting product:', error);
            res.status(500).json({ error: 'Failed to delete product' });
        }
    }

    async updateStock(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { quantity, type, remarks } = req.body;
            const authId = (req as any).user?.id || (req as any).user?.userId;
            const adminId = (req as any).user?.adminId;

            if (!quantity || !type || !['add', 'remove'].includes(type)) {
                return res.status(400).json({ error: 'Invalid request' });
            }

            const product = await inventoryService.updateStock(id, parseInt(quantity), type, remarks, authId, undefined, adminId);
            res.json(product);
        } catch (error) {
            console.error('Error updating stock:', error);
            res.status(500).json({ error: 'Failed to update stock' });
        }
    }

    async getProductHistory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const history = await inventoryService.getProductHistory(id);
            res.json(history);
        } catch (error) {
            console.error('Error fetching product history:', error);
            res.status(500).json({ error: 'Failed to fetch product history' });
        }
    }

    async getGlobalHistory(req: Request, res: Response) {
        try {
            const authId = (req as any).user?.authId || (req as any).user?.id;
            const adminId = (req as any).user?.adminId;
            const filterId = adminId; // Strict filtering

            const history = await inventoryService.getAllInventoryHistory(filterId);
            res.json(history);
        } catch (error: any) {
            console.error('Error fetching global history:', error);
            res.status(500).json({ error: 'Failed to fetch inventory history', details: error.message });
        }
    }

    async bulkCreateProducts(req: Request, res: Response) {
        try {
            const { products } = req.body;

            if (!products || !Array.isArray(products)) {
                return res.status(400).json({ error: 'Invalid products data' });
            }

            // Extract authId and adminId from authenticated user (if available)
            let authId = (req as any).user?.id || (req as any).user?.authId;
            let adminId = (req as any).user?.adminId;

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

            if (!adminId) {
                return res.status(403).json({ error: 'Unauthorized: Could not resolve business ID' });
            }

            const result = await inventoryService.bulkCreateProducts({
                authId,
                adminId,
                products
            });

            res.status(200).json(result);
        } catch (error: any) {
            console.error('Error bulk uploading products:', error);
            res.status(500).json({ error: 'Failed to bulk upload products', details: error.message });
        }
    }
}

export default new InventoryController();
