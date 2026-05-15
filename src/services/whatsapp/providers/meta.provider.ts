import axios from 'axios';
import { IWhatsAppProvider } from '../interfaces/whatsapp-provider.interface';

export class MetaProvider implements IWhatsAppProvider {
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    requiresTemplate(): boolean {
        return true;
    }

    async sendMessage(): Promise<void> {
        throw new Error('Meta requires template messages');
    }

    async sendTemplateMessage(params: {
        to: string;
        templateType: string;
        variables: Record<string, string>;
    }): Promise<void> {
        try {
            // Get template name and language from config
            const templateCfg = this.config.templates?.[params.templateType];
            const templateName = typeof templateCfg === 'object' ? templateCfg.name : templateCfg;
            const templateLang = (typeof templateCfg === 'object' && templateCfg.language)
                || this.config.templateLanguage
                || 'en';

            if (!templateName) {
                throw new Error(`Template not configured: ${params.templateType}`);
            }

            const requestBody: any = {
                phone_number: params.to,
                template_name: templateName,
                template_language: templateLang,
                from_phone_number_id: this.config.phoneNumberId,
                business_account_id: this.config.businessAccountId,
                vendor_id: this.config.businessAccountId || this.config.phoneNumberId || this.config.adminId,
                admin_id: this.config.adminId,
            };

            this.mapVariablesToFields(params.templateType, params.variables, requestBody);

            // Support dynamic URL templates with placeholders
            let apiUrl = this.config.apiUrl || this.config.url || 'https://meta.businessongo.com/api';
            let apiPath = this.config.apiPath || '';

            // If apiPath is configured, use it (with placeholder replacement if needed)
            if (this.config.apiPath) {
                console.log('🎯 Using configured API Path:', this.config.apiPath);

                // Replace placeholders if present
                if (apiPath.includes('{{') || apiPath.includes('{')) {
                    const replacements: Record<string, string> = {
                        'apiBaseUrl': apiUrl,
                        'vendorUid': this.config.businessAccountId || this.config.phoneNumberId || this.config.adminId || '',
                        'businessAccountId': this.config.businessAccountId || '',
                        'phoneNumberId': this.config.phoneNumberId || '',
                        'adminId': this.config.adminId || '',
                        'businessName': this.config.businessName || '',
                    };

                    Object.keys(replacements).forEach(key => {
                        apiPath = apiPath.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacements[key]);
                        apiPath = apiPath.replace(new RegExp(`\\{${key}\\}`, 'g'), replacements[key]);
                    });

                    console.log('✅ Resolved API Path:', apiPath);
                }

                // Build final URL
                const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
                const requestUrl = `${baseUrl}/${apiPath}`.replace(/([^:]\/)\/+/g, '$1');
                const token = this.config.apiKey || this.config.accessToken || this.config.token || '';

                console.log('🌐 Final URL:', requestUrl);

                // Try different auth schemes
                const authSchemes = [
                    { type: 'Bearer', apply: (headers: any) => ({ headers: { ...headers, 'Authorization': `Bearer ${token}` }, url: requestUrl }) },
                    { type: 'Query(access_token)', apply: (headers: any) => ({ headers, url: requestUrl.includes('?') ? `${requestUrl}&access_token=${token}` : `${requestUrl}?access_token=${token}` }) },
                    { type: 'X-ApiKey', apply: (headers: any) => ({ headers: { ...headers, 'x-api-key': token }, url: requestUrl }) },
                    { type: 'ApiKey', apply: (headers: any) => ({ headers: { ...headers, 'apikey': token }, url: requestUrl }) },
                ];

                let lastError: any;
                for (const scheme of authSchemes) {
                    const { headers, url: finalUrl } = scheme.apply({ ...this.config.headers });

                    try {
                        console.log(`🔄 Trying [${scheme.type}]`);

                        const response = await axios.post(finalUrl, requestBody, {
                            headers: {
                                'Content-Type': 'application/json',
                                ...headers
                            },
                            timeout: 10000
                        });

                        // Check for logic errors in 200 OK responses
                        const isFailedBody = response.data && (
                            response.data.result === 'failed' ||
                            response.data.status === 'failed' ||
                            (typeof response.data.message === 'string' &&
                                (response.data.message.toLowerCase().includes('invalid') ||
                                    response.data.message.toLowerCase().includes('error'))) ||
                            response.data.error
                        );

                        if (isFailedBody) {
                            const errorDetails = response.data.message || response.data.error?.message || response.data.error || 'Unknown Error';
                            console.warn(`⚠️ Logic Error:`, errorDetails);
                            lastError = new Error(errorDetails);

                            // If template is missing or field error, stop retrying
                            if (
                                (errorDetails.toLowerCase().includes('field') && errorDetails.toLowerCase().includes('required')) ||
                                (errorDetails.toLowerCase().includes('template') && errorDetails.toLowerCase().includes('not found'))
                            ) {
                                throw lastError;
                            }
                            continue;
                        }

                        console.log(`✅ SUCCESS! WhatsApp message sent via ${scheme.type}`);
                        return;
                    } catch (error: any) {
                        lastError = error;
                        const statusCode = error.response?.status;
                        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
                        console.warn(`❌ Failed [${scheme.type}] Status ${statusCode}:`, errorMsg);
                    }
                }

                // All auth schemes failed
                throw new Error(`Failed to send WhatsApp message: ${lastError?.message || 'Unknown error'}`);
            }
            console.log(requestBody);
            // Auto-discovery mode (only if no apiPath configured)
            console.log('⚠️ No apiPath configured, using auto-discovery...');

            // Use business account ID in the path (this is the correct format for meta.businessongo.com)
            const baseUrl = (this.config.url || 'https://meta.businessongo.com/api').replace(/\/$/, '');
            const vendorId = this.config.businessAccountId || this.config.phoneNumberId || this.config.adminId;

            if (vendorId) {
                const requestUrl = `${baseUrl}/${vendorId}/contact/send-template-message`;
                const token = this.config.apiKey || this.config.accessToken || this.config.token || '';

                console.log('🎯 Using URL with Business Account ID:', requestUrl);

                const authSchemes = [
                    { type: 'Bearer', apply: (headers: any) => ({ headers: { ...headers, 'Authorization': `Bearer ${token}` }, url: requestUrl }) },
                    { type: 'Query(access_token)', apply: (headers: any) => ({ headers, url: `${requestUrl}?access_token=${token}` }) },
                ];

                for (const scheme of authSchemes) {
                    const { headers, url: finalUrl } = scheme.apply({});

                    try {
                        console.log(`🔄 Trying [${scheme.type}] at: ${finalUrl}`);
                        console.log('📦 Request Body:', JSON.stringify(requestBody, null, 2));

                        const response = await axios.post(finalUrl, requestBody, {
                            headers: { 'Content-Type': 'application/json', ...headers },
                            timeout: 10000
                        });

                        console.log('📡 Response Status:', response.status);
                        console.log('📡 Response Data:', JSON.stringify(response.data, null, 2));

                        // Check for actual success (not just 200 OK)
                        // Meta API often returns 200 OK with { result: "failed", message: "..." }
                        const isFailedBody = response.data && (
                            response.data.result === 'failed' ||
                            response.data.status === 'failed' ||
                            (typeof response.data.message === 'string' &&
                                (response.data.message.toLowerCase().includes('invalid') ||
                                    response.data.message.toLowerCase().includes('error'))) ||
                            response.data.error
                        );

                        if (response.status === 200 && !isFailedBody) {
                            console.log(`✅ SUCCESS via auto-discovery!`);
                            return;
                        } else {
                            const errorDetails = response.data?.message || response.data?.error?.message || response.data?.error || 'Unknown Error';
                            console.warn(`⚠️ Logic Error in 200 response:`, errorDetails);

                            // If template is missing, stop retrying - this is a configuration error, not an auth error
                            if (errorDetails.toLowerCase().includes('template') && errorDetails.toLowerCase().includes('not found')) {
                                throw new Error(errorDetails);
                            }

                            // Continue to next auth scheme if this one failed logically
                        }
                    } catch (error: any) {
                        const errorData = error.response?.data || {};
                        const errorMsg = errorData.message || errorData.error || error.message;
                        console.error(`❌ Failed [${scheme.type}]:`, errorMsg);

                        // If it's a validation error, stop retrying
                        if (errorMsg.toString().toLowerCase().includes('field') && errorMsg.toString().toLowerCase().includes('required')) {
                            throw new Error(errorMsg);
                        }
                    }
                }
            }

            // Fallback to original auto-discovery
            await this.autoDiscoverAndSend(requestBody);

        } catch (error: any) {
            console.error('Meta API Error:', error.response?.data || error.message);
            throw new Error(`Meta API Error: ${error.response?.data?.message || error.message}`);
        }
    }

    private async autoDiscoverAndSend(requestBody: any): Promise<void> {
        // Original auto-discovery logic (keeping for backward compatibility)
        const vendorOptions: { id: string | null; name: string }[] = [];
        const isUUID = (str: string | null) => str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

        if (this.config.phoneNumberId && !isUUID(this.config.phoneNumberId)) {
            vendorOptions.push({ id: this.config.phoneNumberId, name: 'PhoneNumberId' });
        }
        if (this.config.businessAccountId && !isUUID(this.config.businessAccountId)) {
            vendorOptions.push({ id: this.config.businessAccountId, name: 'BusinessAccountId' });
        }
        if (this.config.businessName) {
            vendorOptions.push({ id: this.config.businessName, name: 'BusinessName' });
        }
        if (this.config.adminId) {
            vendorOptions.push({ id: this.config.adminId, name: 'AdminId' });
        }
        vendorOptions.push({ id: null, name: 'NoIdInPath' });

        const baseUrl = (this.config.url || 'https://meta.businessongo.com/api').replace(/\/$/, '');
        const pathPatterns = [
            '{ID}/contact/send-template-message',
            'contact/send-template-message',
        ];

        let lastError: any;
        for (const vOption of vendorOptions) {
            for (const pattern of pathPatterns) {
                if (pattern.includes('{ID}') && vOption.id === null) continue;
                if (!pattern.includes('{ID}') && vOption.id !== null) continue;

                const path = vOption.id ? pattern.replace('{ID}', vOption.id) : pattern;
                const requestUrl = `${baseUrl}/${path}`;
                const token = this.config.apiKey || this.config.accessToken || this.config.token || '';

                const authSchemes = [
                    { type: 'Bearer', apply: (headers: any) => ({ headers: { ...headers, 'Authorization': `Bearer ${token}` }, url: requestUrl }) },
                ];

                for (const scheme of authSchemes) {
                    const { headers, url: finalUrl } = scheme.apply({});
                    try {
                        const response = await axios.post(finalUrl, requestBody, {
                            headers: { 'Content-Type': 'application/json', ...headers },
                            timeout: 10000
                        });

                        const isFailedBody = response.data && (
                            response.data.result === 'failed' ||
                            response.data.status === 'failed' ||
                            (typeof response.data.message === 'string' &&
                                (response.data.message.toLowerCase().includes('invalid') ||
                                    response.data.message.toLowerCase().includes('error'))) ||
                            response.data.error
                        );

                        if (response.status === 200 && !isFailedBody) {
                            console.log(`✅ SUCCESS via auto-discovery!`);
                            return;
                        }
                    } catch (error: any) {
                        lastError = error;
                    }
                }
            }
        }

        throw lastError || new Error('Auto-discovery failed');
    }

    private mapVariablesToFields(
        templateType: string,
        variables: Record<string, string>,
        requestBody: any
    ): void {
        switch (templateType) {
            case 'appointmentConfirmation':
                requestBody.field_1 = variables.customer_name || '';
                requestBody.field_2 = variables.date || '';
                requestBody.field_3 = variables.time || '';
                requestBody.field_4 = variables.stylist_name || '';
                break;
            case 'appointmentReminder':
                requestBody.field_1 = variables.customer_name || '';
                requestBody.field_2 = variables.salon_name || '';
                requestBody.field_3 = variables.date || '';
                requestBody.field_4 = variables.time || '';
                requestBody.field_5 = variables.service_name || '';
                break;
            case 'paymentReminder':
                requestBody.field_1 = variables.customer_name || '';
                requestBody.field_2 = variables.currency || '';
                requestBody.field_3 = variables.amount || '';
                requestBody.field_4 = variables.date || '';
                break;
            case 'salesReceipt' as any:
                requestBody.field_1 = variables.customer_name || '';
                requestBody.field_2 = variables.sale_number || '';
                requestBody.field_3 = variables.items_summary || '';
                requestBody.field_4 = variables.total_amount || '';
                requestBody.field_5 = variables.package_balance || '0';
                requestBody.field_6 = variables.date || '';
                break;
            case 'packageUsage' as any:
                requestBody.field_1 = variables.customer_name || '';
                requestBody.field_2 = variables.package_name || '';
                requestBody.field_3 = variables.service_name || '';
                requestBody.field_4 = variables.remaining_quantity || '';
                requestBody.field_5 = variables.expiry_date || '';
                break;
            case 'salesAndPackageReceipt' as any:
                requestBody.field_1 = variables.customer_name || '';
                requestBody.field_2 = variables.sale_number || '';
                requestBody.field_3 = variables.items_summary || '';
                requestBody.field_4 = variables.total_amount || '';
                requestBody.field_5 = variables.package_balance || '';
                requestBody.field_6 = variables.date || '';
                break;
            case 'otp_verification' as any:
                requestBody.field_1 = variables.otp || '';
                break;
            case 'voucherCode' as any:
                requestBody.field_1 = variables.otp || '';
                // The button 0 field is required
                requestBody.button_0 = variables.otp || '';
                requestBody.button_0 = variables.otp || '';
                break;
            case 'voucherUsage' as any:
                requestBody.field_1 = variables.voucher_name || ''; // Voucher Name
                requestBody.field_2 = variables.sale_number || '';  // Order ID
                requestBody.field_3 = variables.redeemed_amount || ''; // Consumed Amount
                requestBody.field_4 = variables.remaining_balance || ''; // Final Remaining Amount
                requestBody.field_5 = variables.business_name || ''; // Business Name
                break;
            default:
                const values = Object.values(variables);
                values.forEach((value, index) => {
                    requestBody[`field_${index + 1}`] = value || " ";
                });
        }

        // Final safety check: ensure fields 1-4 are never empty strings if they exist
        // This is a common requirement for Meta templates
        ['field_1', 'field_2', 'field_3', 'field_4', 'field_5', 'field_6'].forEach(field => {
            if (requestBody[field] === '') {
                requestBody[field] = ' '; // Use a single space as a non-empty fallback
            }
        });
    }
}
