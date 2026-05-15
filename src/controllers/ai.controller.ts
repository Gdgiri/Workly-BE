import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { aiService } from '../services/ai.service';

class AIController {
    async chat(req: AuthRequest, res: Response) {
        try {
            const adminId = req.user?.adminId;
            const { messages, currencySymbol } = req.body;

            if (!adminId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: 'Messages array is required' });
            }

            const response = await aiService.getChatResponse(adminId, messages, currencySymbol);

            return res.json({ success: true, response });
        } catch (error: any) {
            console.error('AI Chat Error:', error);
            return res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    }
}

export default new AIController();
