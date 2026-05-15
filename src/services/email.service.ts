import nodemailer from 'nodemailer';
import { MessageLogService } from './message-log.service';

const messageLogService = new MessageLogService();

export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    async sendReconciliationEmail(data: {
        adminId: string;
        to: string;
        salonName: string;
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
            const { adminId, to, salonName, systemTotal, countedTotal, difference, symbol, cashier, notes, status, paymentBreakdown } = data;

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
            const headerColor = isDiscrepancy ? '#ef4444' : '#10b981';
            const headerTitle = isDiscrepancy ? 'Discrepancy Alert' : 'Day End Report';

            const subject = `${headerTitle} - ${salonName}`;
            const textMessage = `
${headerTitle}

Shop: ${salonName || 'Salon'}
Time: ${timestamp}
Status: ${status.toUpperCase()}

Expected: ${symbol}${systemTotal.toFixed(2)}
Collected: ${symbol}${countedTotal.toFixed(2)}
Difference: ${symbol}${Math.abs(difference).toFixed(2)} (${type} ${emoji})

Cashier: ${cashier}
Notes: ${notes || 'No notes provided'}
            `;

            const htmlMessage = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <div style="background-color: ${headerColor}; color: white; padding: 24px; text-align: center;">
                        <h2 style="margin: 0; font-size: 24px; letter-spacing: -0.025em;">${headerTitle}</h2>
                        <p style="margin: 8px 0 0 0; opacity: 0.9;">End of Day Report</p>
                    </div>
                    <div style="padding: 32px; color: #1e293b; background-color: #ffffff;">
                        <div style="margin-bottom: 24px;">
                            <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: 600;">Shop Name</p>
                            <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 700;">${salonName || 'Salon'}</p>
                        </div>
                        <div style="margin-bottom: 24px;">
                            <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: 600;">Date/Time</p>
                            <p style="margin: 4px 0 0 0; font-size: 16px;">${timestamp}</p>
                        </div>

                        <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 32px 0;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 12px 0; color: #64748b;">System Expected</td>
                                    <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 16px; color: #1e293b;">${symbol}${systemTotal.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 0; color: #64748b;">Physical Count</td>
                                    <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 16px; color: #1e293b;">${symbol}${countedTotal.toFixed(2)}</td>
                                </tr>
                                <tr style="border-top: 2px solid #e2e8f0;">
                                    <td style="padding: 16px 0 12px 0; font-weight: 700; color: ${headerColor}; font-size: 18px;">Difference</td>
                                    <td style="padding: 16px 0 12px 0; text-align: right; font-weight: 800; color: ${headerColor}; font-size: 24px;">${symbol}${Math.abs(difference).toFixed(2)}<br><span style="font-size: 14px; font-weight: 600;">(${type} ${emoji})</span></td>
                                </tr>
                            </table>
                        </div>

                        <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                            <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px; font-weight: 600; text-transform: uppercase;">Payment Breakdown</p>
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                                ${Object.entries(paymentBreakdown || {}).map(([method, amount]) => `
                                    <tr>
                                        <td style="padding: 8px 0; color: #475569; text-transform: capitalize;">${method}</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e293b;">${symbol}${Number(amount).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </table>

                            <p style="margin: 0 0 4px 0; color: #64748b; font-size: 14px; font-weight: 600;">Cashier</p>
                            <p style="margin: 0 0 20px 0; font-weight: 600;">${cashier}</p>
                            
                            <p style="margin: 0 0 4px 0; color: #64748b; font-size: 14px; font-weight: 600;">Notes & Remarks</p>
                            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; font-style: italic; color: #475569;">
                                ${notes || 'No notes provided'}
                            </div>
                        </div>
                    </div>
                    <div style="background-color: #f8fafc; color: #94a3b8; padding: 24px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
                        This is an automated day-end report from Workly Salon Pro.<br>
                        © ${new Date().getFullYear()} Workly Salon
                    </div>
                </div>
            `;

            const mailOptions = {
                from: process.env.SMTP_FROM,
                to: to,
                subject: subject,
                text: textMessage,
                html: htmlMessage,
            };

            // Log attempt
            const log = await messageLogService.createLog({
                adminId,
                customerPhone: to,
                customerName: 'Admin Email',
                type: isDiscrepancy ? 'Email Alert' : 'Day End Report',
                status: 'PENDING',
                content: textMessage,
            });

            try {
                const info = await this.transporter.sendMail(mailOptions);
                console.log('✅ Reconciliation email sent:', info.messageId);
                await messageLogService.updateLogStatus(log.id, 'SENT');
                return { success: true, messageId: info.messageId };
            } catch (sendError: any) {
                console.error('[EmailService] SMTP Send Error:', sendError.message);
                await messageLogService.updateLogStatus(log.id, 'FAILED', sendError.message);
                return { success: false, error: sendError.message };
            }

        } catch (error: any) {
            console.error('[EmailService] Error in sendReconciliationEmail:', error);
            return { success: false, error: error.message };
        }
    }

    // Alias for backward compatibility if needed, though we just introduced it
    async sendDiscrepancyEmail(data: any) {
        return this.sendReconciliationEmail({ ...data, status: 'discrepancy' });
    }
}

export const emailService = new EmailService();
