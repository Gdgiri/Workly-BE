import { Request, Response } from 'express';
import { expenseService } from '../services/expense.service';

export class ExpenseController {
    async getAllExpenses(req: Request, res: Response) {
        try {
            const authId = (req as any).user?.authId || (req as any).user?.id;
            const adminId = (req as any).user?.adminId;
            const filterId = adminId || authId; // Prioritize adminId

            const expenses = await expenseService.getAllExpenses(filterId);
            return res.json(expenses);
        } catch (error) {
            console.error('Error fetching expenses:', error);
            return res.status(500).json({ error: 'Failed to fetch expenses' });
        }
    }

    async createExpense(req: Request, res: Response) {
        try {
            const { title, amount, category, date, description, attachments } = req.body;

            if (!title || !amount || !category) {
                return res.status(400).json({ error: 'Title, amount, and category are required' });
            }

            // Extract authId from authenticated user (if available)
            const authId = (req as any).user?.id || (req as any).user?.userId;

            const adminId = (req as any).user?.adminId;

            console.log('💰 Creating expense with authId:', authId, 'adminId:', adminId);
            console.log('   req.user:', (req as any).user);
            console.log('   Expense title:', title);

            const expense = await expenseService.createExpense({
                authId, // Track which admin created this expense
                adminId, // Store adminId
                title,
                amount: parseFloat(amount),
                category,
                date: date ? new Date(date) : undefined,
                description,

                attachments,
                cashierName: (req as any).user?.name || (req as any).user?.email || 'Unknown',
            } as any);

            console.log('✅ Expense created with authId:', expense.authId);
            return res.status(201).json(expense);
        } catch (error) {
            console.error('❌ Error creating expense:', error);
            return res.status(500).json({ error: 'Failed to create expense' });
        }
    }

    async updateExpense(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { title, amount, category, date, description, attachments } = req.body;

            const expense = await expenseService.updateExpense(id, {
                title,
                amount: amount ? parseFloat(amount) : undefined,
                category,
                date: date ? new Date(date) : undefined,
                description,

                attachments
            } as any);

            return res.json(expense);
        } catch (error) {
            console.error('Error updating expense:', error);
            return res.status(500).json({ error: 'Failed to update expense' });
        }
    }

    async deleteExpense(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await expenseService.deleteExpense(id);
            return res.status(204).send();
        } catch (error) {
            console.error('Error deleting expense:', error);
            return res.status(500).json({ error: 'Failed to delete expense' });
        }
    }

    async getExpenseById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const expense = await expenseService.getExpenseById(id);

            if (!expense) {
                return res.status(404).json({ error: 'Expense not found' });
            }

            return res.json(expense);
        } catch (error) {
            console.error('Error fetching expense by id:', error);
            return res.status(500).json({ error: 'Failed to fetch expense' });
        }
    }
}

export const expenseController = new ExpenseController();
