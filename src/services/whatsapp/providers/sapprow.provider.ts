import axios from 'axios';
import { IWhatsAppProvider } from '../interfaces/whatsapp-provider.interface';

export class SapprowProvider implements IWhatsAppProvider {
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    requiresTemplate(): boolean {
        return false;
    }

    async sendMessage(params: { to: string; message: string }): Promise<void> {
        try {
            await axios.post(
                this.config.url,
                {
                    phone: params.to,
                    message: params.message
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`✅ Sapprow WhatsApp sent to ${params.to}`);
        } catch (error: any) {
            console.error('Sapprow API Error:', error.response?.data || error.message);
            throw new Error(`Sapprow API Error: ${error.message}`);
        }
    }

    async sendTemplateMessage(): Promise<void> {
        throw new Error('Sapprow does not support template messages');
    }
}
