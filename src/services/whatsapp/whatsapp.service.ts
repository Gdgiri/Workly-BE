import axios from 'axios';
import { settingsService } from '../settings.service';
import { WhatsAppProviderFactory } from './whatsapp-provider.factory';
import { IWhatsAppProvider } from './interfaces/whatsapp-provider.interface';
import { MessageLogService } from '../message-log.service';
import prisma from '../../prisma';

const messageLogService = new MessageLogService();

export class WhatsAppService {
    /**
     * Get enabled WhatsApp provider for an admin
     */
    private async getProvider(adminId: string): Promise<IWhatsAppProvider | null> {
        try {
            const settings = await settingsService.getOrCreateSettings(adminId);

            // Parse apiIntegrations
            let integrations = settings.apiIntegrations;
            if (typeof integrations === 'string') {
                integrations = JSON.parse(integrations);
            }

            if (!Array.isArray(integrations)) {
                return null;
            }

            // Find enabled WhatsApp integration
            const whatsappConfig = integrations.find(
                (integration: any) =>
                    integration.type === 'whatsapp' &&
                    integration.enabled === true
            ) as any;

            if (!whatsappConfig) {
                console.log('No enabled WhatsApp provider found for admin:', adminId);
                return null;
            }

            console.log('📝 WhatsApp Config Found for Admin:', adminId, JSON.stringify(whatsappConfig, null, 2));

            // Inject adminId and salonName into config for potential fallback use
            // Also ensure otp_verification template has a default if not explicitly mapped
            const configWithContext = {
                ...(whatsappConfig as object),
                adminId,
                businessName: settings.salonName,
                templates: {
                    ...(whatsappConfig.templates || {}),
                    otp_verification: whatsappConfig.templates?.otp_verification || 'otp_verification'
                }
            };

            if (!whatsappConfig.templates?.otp_verification) {
                console.log('ℹ️ No explicit otp_verification template mapped, using default: "otp_verification"');
            }

            // Create provider instance
            return WhatsAppProviderFactory.create(configWithContext);
        } catch (error) {
            console.error('Error getting WhatsApp provider:', error);
            return null;
        }
    }

    /**
     * Sanitize phone number to contain only digits
     * Automatically prepends correct country code based on salon currency
     */
    private async sanitizePhoneNumber(phone: string, adminId: string): Promise<string> {
        if (!phone) return '';
        const digits = phone.replace(/\D/g, '');

        try {
            const settings = await settingsService.getOrCreateSettings(adminId);
            const currency = settings.currency || 'INR';

            // India (INR) Logic: If 10 digits, prepend 91
            if (currency === 'INR' && digits.length === 10) {
                return `91${digits}`;
            }

            // Singapore (SGD) Logic: If 8 digits, prepend 65
            if (currency === 'SGD' && digits.length === 8) {
                return `65${digits}`;
            }
        } catch (error) {
            console.error('Error fetching currency for phone sanitization:', error);
        }

        return digits;
    }

    /**
     * Send WhatsApp message (auto-detects template requirement)
     */
    async sendMessage(params: {
        adminId: string;
        to: string;
        message?: string;
        templateType?: 'appointmentConfirmation' | 'appointmentReminder' | 'paymentReminder' | 'voucherCode' | 'salesReceipt' | 'packageUsage' | 'salesAndPackageReceipt' | 'otp_verification' | 'voucherUsage';
        variables?: Record<string, string>;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);

            if (!provider) {
                console.log('WhatsApp not configured for admin:', params.adminId);
                return false;
            }

            // Sanitize phone number (strip spaces, dashes, etc.)
            const sanitizedTo = await this.sanitizePhoneNumber(params.to, params.adminId);

            console.log(`📡 WhatsApp sendMessage Triggered:`, {
                adminId: params.adminId,
                to: params.to,
                sanitizedTo,
                templateType: params.templateType,
                provider: (provider as any).constructor.name
            });
            if (provider.requiresTemplate()) {
                if (!params.templateType) {
                    throw new Error('Template type required for this provider');
                }

                // Send template message
                await provider.sendTemplateMessage({
                    to: sanitizedTo,
                    templateType: params.templateType,
                    variables: params.variables || {}
                });
            } else {
                // Send simple message
                if (!params.message) {
                    throw new Error('Message content required for non-template provider');
                }

                await provider.sendMessage({
                    to: sanitizedTo,
                    message: params.message
                });
            }

            return true;
        } catch (error) {
            console.error('WhatsApp send failed:', error);
            return false;
        }
    }

    /**
     * Send appointment confirmation
     */
    async sendAppointmentConfirmation(params: {
        adminId: string;
        customerPhone: string;
        customerName: string;
        salonName: string;
        date: string;
        time: string;
        serviceName: string;
        stylistName: string;
        appointmentId?: string;
    }): Promise<boolean> {
        try {
            // Check if WhatsApp notifications are enabled in settings
            const settings = await settingsService.getOrCreateSettings(params.adminId);
            if (!settings.whatsappNotifications) {
                console.log(`⚠️ WhatsApp notifications explicitly disabled in Settings for admin: ${params.adminId}`);
                console.log(`   (Current settings.whatsappNotifications is: ${settings.whatsappNotifications})`);
                return false;
            }

            const provider = await this.getProvider(params.adminId);
            if (!provider) return false;

            let message = '';
            let sent = false;

            if (provider.requiresTemplate()) {
                // Use template
                message = `[Template: appointmentConfirmation] Variables: customer=${params.customerName}, salon=${params.salonName}, date=${params.date}, time=${params.time}, service=${params.serviceName}`;
                sent = await this.sendMessage({
                    adminId: params.adminId,
                    to: params.customerPhone,
                    templateType: 'appointmentConfirmation',
                    variables: {
                        customer_name: params.customerName,
                        salon_name: params.salonName,
                        date: params.date,
                        time: params.time,
                        service_name: params.serviceName,
                        stylist_name: params.stylistName
                    }
                });
            } else {
                // Use simple message
                message = `Hello ${params.customerName},\n\nYour appointment at ${params.salonName} is confirmed for ${params.date} at ${params.time}.\n\nService: ${params.serviceName}\nStylist: ${params.stylistName}\n\nSee you soon!`;

                sent = await this.sendMessage({
                    adminId: params.adminId,
                    to: params.customerPhone,
                    message
                });
            }

            // Log to MessageLog
            try {
                const sanitizedLogPhone = await this.sanitizePhoneNumber(params.customerPhone, params.adminId);
                await messageLogService.createLog({
                    adminId: params.adminId,
                    customerPhone: sanitizedLogPhone,
                    customerName: params.customerName,
                    orderId: params.appointmentId,
                    type: 'Appointment Confirmation',
                    status: sent ? 'SENT' : 'FAILED',
                    content: message,
                    metadata: {
                        templateType: provider.requiresTemplate() ? 'appointmentConfirmation' : undefined,
                        variables: provider.requiresTemplate() ? {
                            customer_name: params.customerName,
                            salon_name: params.salonName,
                            date: params.date,
                            time: params.time,
                            service_name: params.serviceName,
                            stylist_name: params.stylistName
                        } : undefined,
                        appointmentId: params.appointmentId,
                        service: params.serviceName,
                        date: params.date,
                        time: params.time
                    }
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp message:', logError);
            }

            return sent;
        } catch (error) {
            console.error('Appointment confirmation failed:', error);
            return false;
        }
    }

    /**
     * Send appointment reminder
     */
    async sendAppointmentReminder(params: {
        adminId: string;
        customerPhone: string;
        customerName: string;
        salonName: string;
        date: string;
        time: string;
        serviceName: string;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);

            if (!provider) return false;

            let message = '';
            let sent = false;
            let variables = {};

            if (provider.requiresTemplate()) {
                variables = {
                    customer_name: params.customerName,
                    salon_name: params.salonName,
                    date: params.date,
                    time: params.time,
                    service_name: params.serviceName
                };
                message = `[Template: appointmentReminder] Variables: customer=${params.customerName}, salon=${params.salonName}, date=${params.date}, time=${params.time}, service=${params.serviceName}`;
                sent = await this.sendMessage({
                    adminId: params.adminId,
                    to: params.customerPhone,
                    templateType: 'appointmentReminder',
                    variables: variables as Record<string, string>
                });
            } else {
                message = `Reminder: Your appointment at ${params.salonName} is on ${params.date} at ${params.time}.\n\nService: ${params.serviceName}\n\nSee you soon!`;

                sent = await this.sendMessage({
                    adminId: params.adminId,
                    to: params.customerPhone,
                    message
                });
            }

            // Log to MessageLog
            try {
                const sanitizedLogPhone = await this.sanitizePhoneNumber(params.customerPhone, params.adminId);
                await messageLogService.createLog({
                    adminId: params.adminId,
                    customerPhone: sanitizedLogPhone,
                    customerName: params.customerName,
                    type: 'Appointment Reminder',
                    status: sent ? 'SENT' : 'FAILED',
                    content: message,
                    metadata: {
                        templateType: provider.requiresTemplate() ? 'appointmentReminder' : undefined,
                        variables: provider.requiresTemplate() ? variables : undefined,
                        service: params.serviceName,
                        date: params.date,
                        time: params.time
                    }
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp reminder:', logError);
            }

            return sent;
        } catch (error) {
            console.error('Appointment reminder failed:', error);
            return false;
        }
    }

    /**
     * Send payment reminder
     */
    async sendPaymentReminder(params: {
        adminId: string;
        customerPhone: string;
        customerName: string;
        amount: number;
        currency: string;
        date: string;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);

            if (!provider) return false;

            let message = '';
            let sent = false;
            let variables = {};

            if (provider.requiresTemplate()) {
                variables = {
                    customer_name: params.customerName,
                    currency: params.currency,
                    amount: params.amount.toString(),
                    date: params.date
                };
                message = `[Template: paymentReminder] Variables: customer=${params.customerName}, amount=${params.currency}${params.amount}`;
                sent = await this.sendMessage({
                    adminId: params.adminId,
                    to: params.customerPhone,
                    templateType: 'paymentReminder',
                    variables: variables as Record<string, string>
                });
            } else {
                message = `Hi ${params.customerName},\n\nYou have a pending payment of ${params.currency}${params.amount} for your appointment on ${params.date}.\n\nPlease settle at your earliest convenience.`;

                sent = await this.sendMessage({
                    adminId: params.adminId,
                    to: params.customerPhone,
                    message
                });
            }

            // Log to MessageLog
            try {
                const sanitizedLogPhone = await this.sanitizePhoneNumber(params.customerPhone, params.adminId);
                await messageLogService.createLog({
                    adminId: params.adminId,
                    customerPhone: sanitizedLogPhone,
                    customerName: params.customerName,
                    type: 'Payment Reminder',
                    status: sent ? 'SENT' : 'FAILED',
                    content: message,
                    metadata: {
                        templateType: provider.requiresTemplate() ? 'paymentReminder' : undefined,
                        variables: provider.requiresTemplate() ? variables : undefined,
                        amount: params.amount,
                        currency: params.currency,
                        date: params.date
                    }
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp payment reminder:', logError);
            }

            return sent;
        } catch (error) {
            console.error('Payment reminder failed:', error);
            return false;
        }
    }

    /**
     * Send custom message
     */
    async sendCustomMessage(params: {
        adminId: string;
        to: string;
        message: string;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);

            if (!provider) return false;

            if (provider.requiresTemplate()) {
                console.warn('Provider requires templates, cannot send custom message');
                return false;
            }

            return this.sendMessage({
                adminId: params.adminId,
                to: params.to,
                message: params.message
            });
        } catch (error) {
            console.error('Custom message failed:', error);
            return false;
        }
    }

    /**
     * Send a discrepancy alert to the admin
     */
    async sendReconciliationAlert(data: {
        adminId: string;
        salonName: string;
        salonPhone: string;
        systemTotal: number;
        countedTotal: number;
        difference: number;
        symbol: string;
        cashier: string;
        notes: string;
        status: string;
        paymentBreakdown: Record<string, number>;
    }) {
        try {
            const { adminId, salonName, salonPhone, systemTotal, countedTotal, difference, symbol, cashier, notes, status, paymentBreakdown } = data;

            // 1. Format the message
            const timestamp = new Date().toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const isDiscrepancy = status === 'discrepancy';
            const emoji = isDiscrepancy ? (difference > 0 ? '📈' : '📉') : '✅';
            const type = isDiscrepancy ? (difference > 0 ? 'Over' : 'Short') : 'Balanced';
            const header = isDiscrepancy ? '⚠️ *Reconciliation Discrepancy Alert* ⚠️' : '📊 *Day End Reconciliation Report*';

            const message = `${header}\n` +
                `🏪 *Shop:* ${salonName || 'Salon'}\n` +
                `📅 *Time:* ${timestamp}\n` +
                `📝 *Status:* ${status.toUpperCase()}\n\n` +
                `💵 *Expected:* ${symbol}${systemTotal.toFixed(2)}\n` +
                `💰 *Collected:* ${symbol}${countedTotal.toFixed(2)}\n` +
                `🚨 *Difference:* ${symbol}${Math.abs(difference).toFixed(2)} (${type} ${emoji})\n\n` +
                `📊 *Breakdown:*\n${Object.entries(paymentBreakdown || {}).map(([m, a]) => `  - ${m}: ${symbol}${Number(a).toFixed(2)}`).join('\n')}\n\n` +
                `👤 *Cashier:* ${cashier}\n` +
                `📝 *Notes:* ${notes || 'No notes provided'}`;

            // 2. Log the intent in MessageLog table
            const sanitizedSalonPhone = await this.sanitizePhoneNumber(salonPhone, adminId);
            const log = await messageLogService.createLog({
                adminId,
                customerPhone: sanitizedSalonPhone,
                customerName: 'Admin',
                type: isDiscrepancy ? 'Reconciliation Alert' : 'Day End Report',
                status: 'PENDING',
                content: message,
                metadata: {
                    systemTotal,
                    countedTotal,
                    difference,
                    timestamp,
                    status
                }
            });

            // 3. Send using custom message logic
            let sent = false;
            const provider = await this.getProvider(adminId);

            if (provider && !provider.requiresTemplate()) {
                sent = await this.sendCustomMessage({
                    adminId,
                    to: salonPhone,
                    message
                });
            } else {
                // FALLBACK to legacy Grow API
                const settings = await settingsService.getOrCreateSettings(adminId);
                const integrations = settings.apiIntegrations ? (typeof settings.apiIntegrations === 'string' ? JSON.parse(settings.apiIntegrations) : settings.apiIntegrations) : [];
                const growConfig = integrations.find((i: any) =>
                    i.enabled && (i.name.toLowerCase().includes('grow') || i.name.toLowerCase().includes('whatsapp'))
                );

                if (growConfig) {
                    const apiUrl = process.env.WHATSAPP_API_URL || 'https://api.grow.com/v1/whatsapp/send';
                    try {
                        const response = await axios.post(apiUrl, {
                            phone: salonPhone.replace(/\D/g, ''),
                            message: message,
                            apiKey: growConfig.apiKey,
                            apiSecret: growConfig.apiSecret
                        }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
                        sent = response.status === 200 || response.status === 201;
                    } catch (e: any) {
                        console.error('Legacy WhatsApp fallback failed:', e.message);
                    }
                }
            }

            if (sent) {
                await messageLogService.updateLogStatus(log.id, 'SENT');
                return { success: true };
            } else {
                await messageLogService.updateLogStatus(log.id, 'FAILED', 'Failed to send via any provider');
                return { success: false, error: 'SEND_FAILED' };
            }

        } catch (error: any) {
            console.error('[WhatsAppService] Error in sendReconciliationAlert:', error);
            return { success: false, error: error.message };
        }
    }

    // Alias for backward compatibility
    async sendDiscrepancyAlert(data: any) {
        return this.sendReconciliationAlert({ ...data, status: 'discrepancy' });
    }

    /**
     * Send sales receipt
     */
    async sendSalesReceipt(params: {
        adminId: string;
        customerPhone: string;
        customerName: string;
        saleNumber: string;
        totalAmount: number;
        currency: string;
        date: string;
        itemsSummary: string;
        packageBalance?: string;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);
            if (!provider) return false;


            // Map currency code to symbol
            let currencySymbol = params.currency;
            if (params.currency === 'SGD') currencySymbol = '$';
            else if (params.currency === 'USD') currencySymbol = '$';
            else if (params.currency === 'INR') currencySymbol = '₹';

            const variables = {
                customer_name: params.customerName,
                sale_number: params.saleNumber,
                items_summary: params.itemsSummary,
                total_amount: `${currencySymbol}${params.totalAmount.toFixed(2)}`,
                package_balance: params.packageBalance || '0',
                date: params.date
            };

            const sent = await this.sendMessage({
                adminId: params.adminId,
                to: params.customerPhone,
                templateType: 'salesReceipt' as any,
                variables: variables
            });

            // Log to MessageLog
            try {
                const sanitizedLogPhone = await this.sanitizePhoneNumber(params.customerPhone, params.adminId);
                await messageLogService.createLog({
                    adminId: params.adminId,
                    customerPhone: sanitizedLogPhone,
                    customerName: params.customerName,
                    orderId: params.saleNumber,
                    type: 'Sales Receipt',
                    status: sent ? 'SENT' : 'FAILED',
                    content: `Sales Receipt #${params.saleNumber} for ${params.customerName}`,
                    metadata: {
                        templateType: 'salesReceipt',
                        variables: variables,
                        saleNumber: params.saleNumber,
                        totalAmount: params.totalAmount,
                        date: params.date
                    }
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp sales receipt:', logError);
            }

            return sent;
        } catch (error) {
            console.error('Sales receipt failed:', error);
            return false;
        }
    }

    /**
     * Send package usage notification
     */
    async sendPackageUsage(params: {
        adminId: string;
        customerPhone: string;
        customerName: string;
        packageName: string;
        serviceName: string;
        remainingQuantity: number;
        expiryDate: string;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);
            if (!provider) return false;

            const variables = {
                customer_name: params.customerName,
                package_name: params.packageName,
                service_name: params.serviceName,
                remaining_quantity: params.remainingQuantity.toString(),
                expiry_date: params.expiryDate
            };

            const sent = await this.sendMessage({
                adminId: params.adminId,
                to: params.customerPhone,
                templateType: 'packageUsage' as any,
                variables: variables
            });

            // Log to MessageLog
            try {
                const sanitizedLogPhone = await this.sanitizePhoneNumber(params.customerPhone, params.adminId);
                await messageLogService.createLog({
                    adminId: params.adminId,
                    customerPhone: sanitizedLogPhone,
                    customerName: params.customerName,
                    type: 'Package Usage',
                    status: sent ? 'SENT' : 'FAILED',
                    content: `Package Usage: ${params.packageName} - ${params.serviceName} used by ${params.customerName}`,
                    metadata: {
                        templateType: 'packageUsage',
                        variables: variables,
                        packageName: params.packageName,
                        serviceName: params.serviceName,
                        remainingQuantity: params.remainingQuantity
                    }
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp package usage:', logError);
            }

            return sent;
        } catch (error) {
            console.error('Package usage notification failed:', error);
            return false;
        }
    }

    /**
     * Send combined sales and package receipt
     */
    async sendSalesAndPackageReceipt(params: {
        adminId: string;
        customerPhone: string;
        customerName: string;
        saleNumber: string;
        totalAmount: number;
        currency: string;
        date: string;
        itemsSummary: string;
        packageBalance: string;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);
            if (!provider) return false;

            const variables = {
                customer_name: params.customerName,
                sale_number: params.saleNumber,
                items_summary: params.itemsSummary,
                total_amount: `${params.currency}${params.totalAmount.toFixed(2)}`,
                package_balance: params.packageBalance,
                date: params.date
            };

            const sent = await this.sendMessage({
                adminId: params.adminId,
                to: params.customerPhone,
                templateType: 'salesAndPackageReceipt' as any,
                variables: variables
            });

            // Log to MessageLog
            try {
                const sanitizedLogPhone = await this.sanitizePhoneNumber(params.customerPhone, params.adminId);
                await messageLogService.createLog({
                    adminId: params.adminId,
                    customerPhone: sanitizedLogPhone,
                    customerName: params.customerName,
                    orderId: params.saleNumber,
                    type: 'Sales & Package Receipt',
                    status: sent ? 'SENT' : 'FAILED',
                    content: `Sales & Package Receipt #${params.saleNumber} for ${params.customerName}`,
                    metadata: {
                        templateType: 'salesAndPackageReceipt',
                        variables: variables,
                        saleNumber: params.saleNumber,
                        totalAmount: params.totalAmount,
                        date: params.date
                    }
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp sales & package receipt:', logError);
            }

            return sent;
        } catch (error) {
            console.error('Combined receipt failed:', error);
            return false;
        }
    }
    /**
     * Send voucher usage notification
     */
    async sendVoucherUsageNotification(params: {
        adminId: string;
        customerPhone: string;
        customerName: string;
        voucherName: string;
        saleNumber: string;
        redeemedAmount: number;
        remainingBalance: number;
        currency: string;
    }): Promise<boolean> {
        try {
            const provider = await this.getProvider(params.adminId);
            if (!provider) return false;

            // Map currency code to symbol
            let currencySymbol = params.currency;
            if (params.currency === 'SGD') currencySymbol = '$';
            else if (params.currency === 'USD') currencySymbol = '$';
            else if (params.currency === 'INR') currencySymbol = '₹';

            const variables = {
                voucher_name: params.voucherName,
                sale_number: params.saleNumber,
                redeemed_amount: `${currencySymbol}${params.redeemedAmount.toFixed(2)}`,
                remaining_balance: `${currencySymbol}${params.remainingBalance.toFixed(2)}`,
                business_name: (provider as any).config.businessName || 'Salon', // Fallback or from config
                // We can also pass customer_name if needed by some templates, but user spec didn't list it for the body
                customer_name: params.customerName
            };

            const sent = await this.sendMessage({
                adminId: params.adminId,
                to: params.customerPhone,
                templateType: 'voucherUsage' as any,
                variables: variables as any
            });

            // Log to MessageLog
            try {
                const sanitizedLogPhone = await this.sanitizePhoneNumber(params.customerPhone, params.adminId);
                await messageLogService.createLog({
                    adminId: params.adminId,
                    customerPhone: sanitizedLogPhone,
                    customerName: params.customerName,
                    orderId: params.saleNumber,
                    type: 'Voucher Usage',
                    status: sent ? 'SENT' : 'FAILED',
                    content: `Voucher Usage: ${params.voucherName} - ${currencySymbol}${params.redeemedAmount} used. Balance: ${currencySymbol}${params.remainingBalance}`,
                    metadata: {
                        templateType: 'voucherUsage',
                        variables: variables,
                        voucherName: params.voucherName,
                        redeemedAmount: params.redeemedAmount,
                        remainingBalance: params.remainingBalance
                    }
                });
            } catch (logError) {
                console.error('Failed to log WhatsApp voucher usage:', logError);
            }

            return sent;
        } catch (error) {
            console.error('Voucher usage notification failed:', error);
            return false;
        }
    }
}

export const whatsappService = new WhatsAppService();
