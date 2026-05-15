import axios from 'axios';
import { IWhatsAppProvider } from '../interfaces/whatsapp-provider.interface';

export class CustomProvider implements IWhatsAppProvider {
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    requiresTemplate(): boolean {
        return this.config.requiresTemplate || false;
    }

    async sendMessage(params: { to: string; message: string }): Promise<void> {
        try {
            const headers: any = {
                'Content-Type': 'application/json',
                ...(this.config.headers || {})
            };

            if (this.config.apiKey) {
                headers['Authorization'] = `Bearer ${this.config.apiKey}`;
            }

            await axios.post(
                this.config.url,
                {
                    to: params.to,
                    message: params.message
                },
                { headers }
            );

            console.log(`✅ Custom WhatsApp sent to ${params.to}`);
        } catch (error: any) {
            console.error('Custom API Error:', error.response?.data || error.message);
            throw new Error(`Custom API Error: ${error.message}`);
        }
    }

    async sendTemplateMessage(params: {
        to: string;
        templateType: string;
        variables: Record<string, string>;
    }): Promise<void> {
        // Custom implementation based on provider's API
        // This is a placeholder - customize based on actual provider requirements
        throw new Error('Template messaging not implemented for custom provider');
    }
}
