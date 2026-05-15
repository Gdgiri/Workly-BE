import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const checklistService = {
    // TEMPLATES
    async createTemplate(adminId: string, authId: string | null, data: any) {
        return prisma.checklistTemplate.create({
            data: {
                adminId,
                authId,
                name: data.name,
                description: data.description,
                fields: data.fields, // Should be an array of field objects
                isActive: data.isActive !== undefined ? data.isActive : true
            }
        });
    },

    async getTemplates(adminId: string) {
        return prisma.checklistTemplate.findMany({
            where: { adminId },
            include: { services: true }
        });
    },

    async updateTemplate(id: string, adminId: string, data: any) {
        return prisma.checklistTemplate.update({
            where: { id },
            data: {
                name: data.name,
                description: data.description,
                fields: data.fields,
                isActive: data.isActive
            }
        });
    },

    async deleteTemplate(id: string, adminId: string) {
        return prisma.checklistTemplate.deleteMany({
            where: { id, adminId }
        });
    },

    // SUBMISSIONS
    async submitChecklist(data: any) {
        try {
            const { appointmentId, serviceId } = data;
            
            // Look up existing submission by (appointmentId, serviceId) OR saleId
            const whereClause: any = {};
            if (appointmentId && serviceId) {
                whereClause.appointmentId_serviceId = { appointmentId, serviceId };
            } else if (appointmentId) {
                // Fallback for transition: look for one without serviceId or just use findFirst
                // But with the new schema, we'll favor the composite key
                whereClause.appointmentId_serviceId = { appointmentId, serviceId: serviceId || null };
            } else if (data.saleId) {
                whereClause.saleId = data.saleId;
            }

            const existing = await (prisma as any).checklistSubmission.findUnique({
                where: whereClause,
                include: { appointment: { select: { sales: { select: { saleStatus: true } } } } }
            });

            if (existing) {
                // Check if already finalized (linked to COMPLETED sale)
                if (existing.saleId) {
                    const sale = await prisma.sale.findUnique({ where: { id: existing.saleId }, select: { saleStatus: true } });
                    if (sale?.saleStatus === 'COMPLETED') {
                        throw new Error('This checklist belongs to a finalized sale and cannot be edited. History is preserved.');
                    }
                }

                return await (prisma as any).checklistSubmission.update({
                    where: { id: existing.id },
                    data: {
                        data: data.data,
                        remarks: data.remarks || {},
                        staffId: data.staffId,
                        attachments: data.attachments || []
                    }
                });
            }

            return await (prisma as any).checklistSubmission.create({
                data: {
                    templateId: data.templateId,
                    appointmentId: data.appointmentId,
                    serviceId: data.serviceId,
                    saleId: data.saleId,
                    staffId: data.staffId,
                    data: data.data,
                    remarks: data.remarks || {},
                    attachments: data.attachments || []
                }
            });
        } catch (error: any) {
            console.error('❌ Error in submitChecklist:', error);
            throw error;
        }
    },

    async getSubmissionByAppointment(appointmentId: string, serviceId?: string) {
        if (serviceId) {
            return (prisma.checklistSubmission as any).findUnique({
                where: {
                    appointmentId_serviceId: { appointmentId, serviceId }
                },
                include: { template: true }
            });
        }
        
        // If no serviceId provided, return all submissions for this appointment
        return (prisma.checklistSubmission as any).findMany({
            where: { appointmentId },
            include: { template: true }
        });
    },

    // ATTACHMENT TO SERVICES
    async attachToService(serviceId: string, docId: string, adminId: string) {
        return prisma.service.updateMany({
            where: { id: serviceId, adminId },
            data: { checklistTemplateId: docId }
        });
    }
};
