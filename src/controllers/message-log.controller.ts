import { Request, Response } from 'express';
import { MessageLogService } from '../services/message-log.service';

const messageLogService = new MessageLogService();

class MessageLogController {
    async createLog(req: Request, res: Response) {
        try {
            const data = req.body;
            let adminId = (req as any).user?.adminId || (req as any).user?.id;
            let authId = (req as any).user?.authId || (req as any).user?.id;

            if (!adminId) {
                return res.status(401).json({ error: 'Admin ID is required' });
            }

            const log = await messageLogService.createLog({
                ...data,
                adminId,
                authId,
            });

            return res.status(201).json({ success: true, log });
        } catch (error: any) {
            console.error('Create message log error:', error);
            return res.status(500).json({ error: error.message || 'Failed to create message log' });
        }
    }

    async listLogs(req: Request, res: Response) {
        try {
            const { status } = req.query;
            let adminId = (req as any).user?.adminId || (req as any).user?.id;

            if (!adminId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const logs = await messageLogService.listLogs(adminId, status as string);

            return res.json(logs);
        } catch (error: any) {
            console.error('List message logs error:', error);
            return res.status(500).json({ error: error.message || 'Failed to fetch message logs' });
        }
    }

    async resendMessage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            let adminId = (req as any).user?.adminId || (req as any).user?.id;

            if (!adminId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const log = await messageLogService.getLogById(id);
            if (!log) {
                return res.status(404).json({ error: 'Message log not found' });
            }

            if (log.adminId !== adminId) {
                return res.status(403).json({ error: 'Forbidden' });
            }

            // Import here to avoid circular dependency if any
            const { whatsappService } = await import('../services/whatsapp/whatsapp.service');

            let success = false;

            // Check if this is a template message (has metadata with template info)
            const metadata = log.metadata as any;
            let templateType = metadata?.templateType;
            let variables = metadata?.variables || {};

            // Smart Fallback for legacy messages: Try to parse template info from content
            if (!templateType && log.content?.startsWith('[Template:')) {
                const templateMatch = log.content.match(/\[Template:\s*([^\]]+)\]/);
                const variablesMatch = log.content.match(/Variables:\s*(.*)$/);

                if (templateMatch) {
                    templateType = templateMatch[1];
                    console.log('🧠 Smart Resend: Inferred template type:', templateType);

                    if (variablesMatch) {
                        const varsString = variablesMatch[1];
                        const pairs = varsString.split(/,\s*/);
                        pairs.forEach(pair => {
                            const [key, ...valueParts] = pair.split('=');
                            const value = valueParts.join('='); // Handle values that might contain '='
                            if (key && value) {
                                // Map short keys to expected keys
                                let finalKey = key.trim();
                                if (finalKey === 'customer') finalKey = 'customer_name';
                                if (finalKey === 'salon') finalKey = 'salon_name';
                                if (finalKey === 'service') finalKey = 'service_name';
                                if (finalKey === 'time') finalKey = 'time'; // Already time, but for clarity
                                if (finalKey === 'date') finalKey = 'date';
                                if (finalKey === 'stylist') finalKey = 'stylist_name';

                                variables[finalKey] = value.trim();
                            }
                        });

                        // Fallback: If stylist_name is missing but we have stylist, ensure it's set
                        if (variables.stylist && !variables.stylist_name) {
                            variables.stylist_name = variables.stylist;
                        }

                        console.log('🧠 Smart Resend: Parsed variables:', variables);
                    }
                }
            }

            if (templateType) {
                // This is a template message - use sendMessage with template info
                console.log('📤 Resending template message:', templateType);

                success = await whatsappService.sendMessage({
                    adminId,
                    to: log.customerPhone,
                    templateType: templateType as any,
                    variables: variables
                });
            } else {
                // Regular message - use sendMessage
                console.log('📤 Resending regular message');

                success = await whatsappService.sendMessage({
                    adminId,
                    to: log.customerPhone,
                    message: log.content || ''
                });
            }

            if (success) {
                await messageLogService.updateLogStatus(id, 'SENT');
                return res.json({ success: true });
            } else {
                await messageLogService.updateLogStatus(id, 'FAILED', 'Failed to send message via WhatsApp');
                return res.status(500).json({ error: 'Failed to send message via WhatsApp', success: false });
            }

        } catch (error: any) {
            console.error('Resend message error:', error);
            return res.status(500).json({ error: error.message || 'Failed to resend message' });
        }
    }
}

export default new MessageLogController();
