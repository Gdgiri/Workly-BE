
import { Request, Response } from 'express';
import categoryService from '../services/category.service';

class CategoryController {
    async createCategory(req: Request, res: Response) {
        try {
            const { name, type, description, imgUrl } = req.body;
            const user = (req as any).user;

            if (!user || !user.adminId) {
                return res.status(401).json({ error: 'Unauthorized: Missing Admin Context' });
            }

            if (!name || !type) {
                return res.status(400).json({ error: 'Name and Type are required' });
            }

            const category = await categoryService.createCategory({
                name,
                type,
                description,
                authId: user.id || user.userId,
                adminId: user.adminId,
                imgUrl
            });

            res.status(201).json(category);
        } catch (error) {
            console.error('Error creating category:', error);
            res.status(500).json({ error: 'Failed to create category' });
        }
    }

    async getAllCategories(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const { type } = req.query;

            if (!user || !user.adminId) {
                // Return empty list instead of error for UI safety, but log it
                console.warn('⚠️ getAllCategories called without adminId context.');
                return res.json([]);
            }

            const categories = await categoryService.getAllCategories(
                user.adminId,
                type as string
            );
            res.json(categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            res.status(500).json({ error: 'Failed to fetch categories' });
        }
    }

    async updateCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const category = await categoryService.updateCategory(id, updates);
            res.json(category);
        } catch (error) {
            console.error('Error updating category:', error);
            res.status(500).json({ error: 'Failed to update category' });
        }
    }

    async deleteCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await categoryService.deleteCategory(id);
            res.json({ message: 'Category deleted successfully' });
        } catch (error) {
            console.error('Error deleting category:', error);
            res.status(500).json({ error: 'Failed to delete category' });
        }
    }
}

export default new CategoryController();
