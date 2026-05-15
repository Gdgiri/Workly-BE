export interface IWhatsAppProvider {
    /**
     * Check if this provider requires templates
     */
    requiresTemplate(): boolean;

    /**
     * Send simple text message
     */
    sendMessage(params: {
        to: string;
        message: string;
    }): Promise<void>;

    /**
     * Send template-based message
     */
    sendTemplateMessage(params: {
        to: string;
        templateType: string;
        variables: Record<string, string>;
    }): Promise<void>;
}

export interface WhatsAppConfig {
    name: string;
    type: string;
    provider: string;
    enabled: boolean;
    url: string;
    requiresTemplate: boolean;
    [key: string]: any;
}

export interface SendMessageParams {
    adminId: string;
    to: string;
    message?: string;
    templateType?: 'appointmentConfirmation' | 'appointmentReminder' | 'paymentReminder' | 'voucherCode' | 'salesReceipt' | 'packageUsage' | 'salesAndPackageReceipt' | 'otp_verification' | 'voucherUsage';
    variables?: Record<string, string>;
}
