import { IWhatsAppProvider } from './interfaces/whatsapp-provider.interface';
import { SapprowProvider } from './providers/sapprow.provider';
import { MetaProvider } from './providers/meta.provider';
import { CustomProvider } from './providers/custom.provider';

export class WhatsAppProviderFactory {
    static create(config: any): IWhatsAppProvider {
        const provider = config.provider?.toLowerCase();

        switch (provider) {
            case 'sapprow':
                return new SapprowProvider(config);

            case 'meta':
                return new MetaProvider(config);

            case 'custom':
                return new CustomProvider(config);

            default:
                throw new Error(`Unsupported WhatsApp provider: ${config.provider}`);
        }
    }
}
