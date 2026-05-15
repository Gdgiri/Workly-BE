import prisma from '../prisma';

export class MessageLogService {
    async createLog(data: {
        adminId: string;
        authId?: string;
        customerPhone: string;
        customerName?: string;
        orderId?: string;
        type?: string;
        status?: string;
        content?: string;
        error?: string;
        metadata?: any;
    }) {
        return prisma.messageLog.create({
            data: {
                adminId: data.adminId,
                authId: data.authId,
                customerPhone: data.customerPhone,
                customerName: data.customerName,
                orderId: data.orderId,
                type: data.type || 'Custom',
                status: data.status || 'PENDING',
                content: data.content,
                error: data.error,
                metadata: data.metadata || {},
            },
        });
    }

    async listLogs(adminId: string, status?: string) {
        return prisma.messageLog.findMany({
            where: {
                adminId,
                ...(status ? { status } : {}),
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async getLogById(id: string) {
        return prisma.messageLog.findUnique({
            where: { id },
        });
    }

    async updateLogStatus(id: string, status: string, error?: string) {
        return prisma.messageLog.update({
            where: { id },
            data: {
                status,
                ...(error ? { error } : {}),
            },
        });
    }
}
