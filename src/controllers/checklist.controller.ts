import { Request, Response } from 'express';
import { checklistService } from '../services/checklist.service';

export const checklistController = {
    // Templates
    async createTemplate(req: Request, res: Response) {
        try {
            const { adminId, authId } = (req as any).user;
            const template = await checklistService.createTemplate(adminId, authId, req.body);
            res.status(201).json({ status: 'success', data: template });
        } catch (error: any) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    },

    async getAllTemplates(req: Request, res: Response) {
        try {
            const { adminId } = (req as any).user;
            const templates = await checklistService.getTemplates(adminId || '');
            res.json({ status: 'success', data: templates });
        } catch (error: any) {
            console.error('❌ Error in getAllTemplates:', error);
            res.status(500).json({ status: 'error', message: 'Failed to fetch templates' });
        }
    },

    async getTemplateById(req: Request, res: Response) {
        try {
            const { adminId } = (req as any).user;
            const templates = await checklistService.getTemplates(adminId);
            const template = templates.find((t: any) => t.id === req.params.id);
            if (!template) return res.status(404).json({ status: 'error', message: 'Template not found' });
            res.json({ status: 'success', data: template });
        } catch (error: any) {
            console.error('❌ Error in getTemplateById:', error);
            res.status(500).json({ status: 'error', message: 'Failed to fetch template' });
        }
    },

    async updateTemplate(req: Request, res: Response) {
        try {
            const { adminId } = (req as any).user;
            const { id } = req.params;
            const result = await checklistService.updateTemplate(id, adminId, req.body);
            res.json({ status: 'success', data: result });
        } catch (error: any) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    },

    async deleteTemplate(req: Request, res: Response) {
        try {
            const { adminId } = (req as any).user;
            const { id } = req.params;
            await checklistService.deleteTemplate(id, adminId);
            res.json({ status: 'success', message: 'Template deleted successfully' });
        } catch (error: any) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    },

    // Submissions
    async submitChecklist(req: Request, res: Response) {
        try {
            const { authId: staffId } = (req as any).user;
            const submission = await checklistService.submitChecklist({ ...req.body, staffId });
            res.status(201).json({ status: 'success', data: submission });
        } catch (error: any) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    },

    async getSubmissionByAppointment(req: Request, res: Response) {
        try {
            const { id: appointmentId } = req.params;
            const { serviceId } = req.query; // Capture optional serviceId from query
            const submission = await checklistService.getSubmissionByAppointment(appointmentId, serviceId as string);
            
            if (!submission || (Array.isArray(submission) && submission.length === 0)) {
                return res.status(404).json({ status: 'error', message: 'No checklist found for this appointment' });
            }
            res.json({ status: 'success', data: submission });
        } catch (error: any) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    },

    // Association
    async attachToService(req: Request, res: Response) {
        try {
            const { adminId } = (req as any).user;
            const { serviceId, templateId } = req.body;
            await checklistService.attachToService(serviceId, templateId, adminId);
            res.json({ status: 'success', message: 'Checklist tagged to service' });
        } catch (error: any) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    }
};
