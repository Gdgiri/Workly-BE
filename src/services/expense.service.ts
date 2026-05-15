import prisma from '../prisma';

export class ExpenseService {
    async getAllExpenses(filterId?: string) {
        const where: any = {};
        if (filterId) {
            where.OR = [
                { authId: filterId },
                { adminId: filterId }
            ];
        } else {
            return [];
        }

        return await prisma.expense.findMany({
            where,
            orderBy: {
                date: 'desc',
            },
        });
    }

    async getExpenseById(id: string) {
        return await prisma.expense.findUnique({
            where: { id },
        });
    }

    async createExpense(data: {
        authId?: string;
        adminId?: string;
        title: string;
        amount: number;
        category: string;
        date?: Date;
        description?: string;
        attachments?: any;
    }) {
        const { ...expenseData } = data;
        return await prisma.expense.create({
            data: expenseData,
        });
    }

    async updateExpense(id: string, data: {
        title?: string;
        amount?: number;
        category?: string;
        date?: Date;
        description?: string;
        attachments?: any;
    }) {
        return await prisma.expense.update({
            where: { id },
            data: data,
        });
    }

    async deleteExpense(id: string) {
        return await prisma.expense.delete({
            where: { id },
        });
    }
}

export const expenseService = new ExpenseService();
