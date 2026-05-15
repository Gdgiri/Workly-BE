import Razorpay from 'razorpay';

export const RAZORPAY_CONFIG = {
    KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    CURRENCY: 'INR',
    RECEIPT_PREFIX: 'rcpt_',
};

// Lazy-load Razorpay instance to avoid initialization errors
let razorpayInstanceCache: Razorpay | null = null;

export const getRazorpayInstance = (): Razorpay => {
    if (!razorpayInstanceCache) {
        if (!RAZORPAY_CONFIG.KEY_ID || !RAZORPAY_CONFIG.KEY_SECRET) {
            console.warn('Razorpay credentials not configured. Payment features will be disabled.');
            // Return a mock instance that throws errors when used
            return {} as Razorpay;
        }

        razorpayInstanceCache = new Razorpay({
            key_id: RAZORPAY_CONFIG.KEY_ID,
            key_secret: RAZORPAY_CONFIG.KEY_SECRET,
        });
    }
    return razorpayInstanceCache;
};

