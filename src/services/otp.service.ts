import prisma from '../prisma';
import { whatsappService } from './whatsapp/whatsapp.service';

export class OtpService {
    private static instance: OtpService;
    private readonly OTP_TTL_MINUTES = 5;

    public static getInstance(): OtpService {
        if (!OtpService.instance) {
            OtpService.instance = new OtpService();
        }
        return OtpService.instance;
    }

    private generateOtp(length: number = 6): string {
        const min = Math.pow(10, length - 1);
        const max = Math.pow(10, length) - 1;
        return Math.floor(min + Math.random() * (max - min + 1)).toString();
    }

    async sendOtp(adminId: string, customerId: string, phone: string, type: string = 'standard'): Promise<any> {
        if (!phone) {
            throw new Error('Customer does not have a phone number');
        }

        const isVoucher = type === 'voucher_redemption';
        const code = this.generateOtp(isVoucher ? 4 : 6);
        const expiresAt = new Date(Date.now() + this.OTP_TTL_MINUTES * 60 * 1000);

        console.log(`[OtpService] 🔑 Generated OTP for customer ${customerId}: ${code}`);

        // Save to DB
        await prisma.otp.create({
            data: {
                adminId,
                customerId,
                identifier: phone,
                code,
                expiresAt,
            },
        });

        // Send via WhatsApp
        try {
            const templateType = type === 'voucher_redemption' ? 'voucherCode' : 'otp_verification';
            const sent = await whatsappService.sendMessage({
                adminId,
                to: phone,
                templateType: templateType as any,
                variables: {
                    otp: code
                }
            });

            if (!sent) {
                console.warn(`[OtpService] ⚠️ WhatsApp NOT sent for customer ${customerId}. Check if notifications are enabled or provider is configured.`);
            } else {
                console.log(`[OtpService] ✅ WhatsApp sent for customer ${customerId}`);
            }
        } catch (error: any) {
            console.error(`[OtpService] ❌ WhatsApp send failed for customer ${customerId}:`, error.message);
            // We don't throw here to allow the process to continue since we have the console log fallback
        }

        return { message: 'OTP flow initiated' };
    }

    async verifyOtp(adminId: string, customerId: string, otp: string): Promise<boolean> {
        const latestOtp = await prisma.otp.findFirst({
            where: {
                adminId,
                customerId,
                isUsed: false,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!latestOtp) {
            throw new Error('No active OTP found');
        }

        if (latestOtp.expiresAt < new Date()) {
            throw new Error('OTP has expired');
        }

        if (latestOtp.attemptCount >= 3) {
            throw new Error('Too many failed attempts. Please request a new OTP.');
        }

        if (latestOtp.code !== otp) {
            await prisma.otp.update({
                where: { id: latestOtp.id },
                data: { attemptCount: { increment: 1 } },
            });
            throw new Error('Invalid OTP code');
        }

        // Mark as used
        await prisma.otp.update({
            where: { id: latestOtp.id },
            data: { isUsed: true },
        });

        return true;
    }
}

export const otpService = OtpService.getInstance();
