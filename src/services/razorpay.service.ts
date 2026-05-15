import { getRazorpayInstance, RAZORPAY_CONFIG } from '../config/razorpay';
import crypto from 'crypto';

interface CreateOrderParams {
    amount: number; // in rupees
    currency?: string;
    receipt?: string;
    notes?: Record<string, any>;
}

interface VerifyPaymentParams {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}

class RazorpayService {
    /**
     * Create a Razorpay order
     * @param params Order parameters
     * @param keyId Optional Razorpay Key ID (uses env if not provided)
     * @param keySecret Optional Razorpay Key Secret (uses env if not provided)
     * @returns Razorpay order object
     */
    async createOrder(params: CreateOrderParams, keyId?: string, keySecret?: string) {
        try {
            console.log('🟢 razorpayService.createOrder called with params:', {
                amount: params.amount,
                hasNotes: !!params.notes,
                hasKeyId: !!keyId,
                hasKeySecret: !!keySecret
            });

            const { amount, currency = RAZORPAY_CONFIG.CURRENCY, receipt, notes } = params;

            // Razorpay expects amount in paise (smallest currency unit)
            const amountInPaise = Math.round(amount * 100);
            console.log('💰 Amount in paise:', amountInPaise);

            // Use provided credentials or fall back to env
            const useKeyId = keyId || RAZORPAY_CONFIG.KEY_ID;
            const useKeySecret = keySecret || RAZORPAY_CONFIG.KEY_SECRET;

            console.log('🔑 Credentials check:', {
                useKeyIdLength: useKeyId?.length || 0,
                useKeySecretLength: useKeySecret?.length || 0,
                source: keyId ? 'database' : 'env'
            });

            if (!useKeyId || !useKeySecret) {
                console.error('❌ Missing credentials!');
                throw new Error('Razorpay credentials not configured');
            }

            // Create Razorpay instance with dynamic credentials
            console.log('📦 Importing Razorpay module...');
            const Razorpay = (await import('razorpay')).default;
            console.log('✅ Razorpay module imported');

            console.log('🏗️ Creating Razorpay instance...');
            const razorpayInstance = new Razorpay({
                key_id: useKeyId,
                key_secret: useKeySecret,
            });
            console.log('✅ Razorpay instance created');

            console.log('📞 Calling Razorpay API to create order...');
            const order = await razorpayInstance.orders.create({
                amount: amountInPaise,
                currency,
                receipt: receipt || `${RAZORPAY_CONFIG.RECEIPT_PREFIX}${Date.now()}`,
                notes,
            });
            console.log('✅ Order created successfully:', order.id);

            return {
                success: true,
                order,
            };
        } catch (error: any) {
            console.error('❌❌❌ Razorpay create order error  ❌❌❌');
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Error statusCode:', error.statusCode);
            console.error('Full error object:', JSON.stringify(error, null, 2));
            if (error.error) {
                console.error('Razorpay API error:', JSON.stringify(error.error, null, 2));
            }

            // Log the credentials being used (masked)
            console.error('🔑 Credentials used:');
            console.error('  Key ID:', keyId?.substring(0, 10) + '...' || 'from env');
            console.error('  Key Secret:', keySecret?.substring(0, 5) + '...' || 'from env');

            return {
                success: false,
                error: error.message || 'Failed to create Razorpay order',
            };
        }
    }

    /**
     * Verify Razorpay payment signature
     * @param params Payment verification parameters
     * @param keySecret Optional key secret (uses env if not provided)
     * @returns Verification result
     */
    verifyPaymentSignature(params: VerifyPaymentParams, keySecret?: string): boolean {
        try {
            const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

            // Use provided keySecret or fall back to env
            const secretToUse = keySecret || RAZORPAY_CONFIG.KEY_SECRET;

            console.log(`🔐 Verifying signature:`);
            console.log(`  - Order ID: ${razorpayOrderId}`);
            console.log(`  - Payment ID: ${razorpayPaymentId}`);
            console.log(`  - Using ${keySecret ? 'dynamic' : 'env'} key secret`);
            console.log(`  - Key Secret length: ${secretToUse?.length || 0}`);

            if (!secretToUse) {
                console.error('❌ Razorpay KEY_SECRET not configured');
                return false;
            }

            // Generate signature
            const text = `${razorpayOrderId}|${razorpayPaymentId}`;
            const generated_signature = crypto
                .createHmac('sha256', secretToUse)
                .update(text)
                .digest('hex');

            console.log(`  - Generated signature: ${generated_signature.substring(0, 10)}...`);
            console.log(`  - Received signature:  ${razorpaySignature.substring(0, 10)}...`);
            console.log(`  - Match: ${generated_signature === razorpaySignature ? '✅' : '❌'}`);

            return generated_signature === razorpaySignature;
        } catch (error) {
            console.error('Razorpay signature verification error:', error);
            return false;
        }
    }

    /**
     * Fetch payment details from Razorpay
     * @param paymentId Razorpay payment ID
     * @returns Payment details
     */
    async fetchPayment(paymentId: string) {
        try {
            const razorpayInstance = getRazorpayInstance();
            const payment = await razorpayInstance.payments.fetch(paymentId);
            return {
                success: true,
                payment,
            };
        } catch (error: any) {
            console.error('Razorpay fetch payment error:', error);
            return {
                success: false,
                error: error.message || 'Failed to fetch payment details',
            };
        }
    }

    /**
     * Capture a payment (for authorized payments)
     * @param paymentId Razorpay payment ID
     * @param amount Amount to capture in rupees
     * @returns Capture result
     */
    async capturePayment(paymentId: string, amount: number) {
        try {
            const amountInPaise = Math.round(amount * 100);
            const razorpayInstance = getRazorpayInstance();
            const payment = await razorpayInstance.payments.capture(paymentId, amountInPaise, RAZORPAY_CONFIG.CURRENCY);
            return {
                success: true,
                payment,
            };
        } catch (error: any) {
            console.error('Razorpay capture payment error:', error);
            return {
                success: false,
                error: error.message || 'Failed to capture payment',
            };
        }
    }

    /**
     * Initiate a refund
     * @param paymentId Razorpay payment ID
     * @param amount Amount to refund in rupees (optional, full refund if not provided)
     * @returns Refund result
     */
    async refundPayment(paymentId: string, amount?: number) {
        try {
            const refundData: any = {};
            if (amount) {
                refundData.amount = Math.round(amount * 100);
            }

            const razorpayInstance = getRazorpayInstance();
            const refund = await razorpayInstance.payments.refund(paymentId, refundData);
            return {
                success: true,
                refund,
            };
        } catch (error: any) {
            console.error('Razorpay refund error:', error);
            return {
                success: false,
                error: error.message || 'Failed to process refund',
            };
        }
    }

    /**
     * Create a Razorpay Payment Link (for QR Code)
     */
    async createPaymentLink(params: CreateOrderParams, keyId?: string, keySecret?: string) {
        try {
            const { amount, currency = RAZORPAY_CONFIG.CURRENCY, receipt, notes } = params;
            const amountInPaise = Math.round(amount * 100);
            const useKeyId = keyId || RAZORPAY_CONFIG.KEY_ID;
            const useKeySecret = keySecret || RAZORPAY_CONFIG.KEY_SECRET;

            if (!useKeyId || !useKeySecret) throw new Error('Razorpay credentials not configured');

            const Razorpay = (await import('razorpay')).default;
            const razorpayInstance = new Razorpay({ key_id: useKeyId, key_secret: useKeySecret });

            // Create Payment Link
            // See: https://razorpay.com/docs/api/payment-links/create
            const paymentLink = await razorpayInstance.paymentLink.create({
                amount: amountInPaise,
                currency,
                accept_partial: false,
                description: notes?.description || 'Salon Payment',
                customer: {
                    name: notes?.customerName || 'Customer',
                    email: notes?.customerEmail || 'customer@example.com',
                    contact: notes?.customerPhone || '+910000000000'
                },
                notify: { sms: false, email: false },
                reminder_enable: false,
                notes,
                reference_id: receipt || `pl_${Date.now()}`
            });

            return { success: true, paymentLink };
        } catch (error: any) {
            console.error('Razorpay create payment link error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fetch Payment Link Details (to check status)
     */
    async fetchPaymentLink(linkId: string, keyId?: string, keySecret?: string) {
        try {
            const useKeyId = keyId || RAZORPAY_CONFIG.KEY_ID;
            const useKeySecret = keySecret || RAZORPAY_CONFIG.KEY_SECRET;

            if (!useKeyId || !useKeySecret) throw new Error('Razorpay credentials not configured');

            const Razorpay = (await import('razorpay')).default;
            const razorpayInstance = new Razorpay({ key_id: useKeyId, key_secret: useKeySecret });

            const paymentLink = await razorpayInstance.paymentLink.fetch(linkId);
            return { success: true, paymentLink };
        } catch (error: any) {
            console.error('Razorpay fetch payment link error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default new RazorpayService();
