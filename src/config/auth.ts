import fs from 'fs';
import path from 'path';

export const AUTH_CONFIG = {

    // Use environment variable from .env
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:8000',


    // Ensure correct App ID mapping for multi-tenancy
    // This allows prefixes like 'workly-salon', 'workly-tailor', etc.
    ALLOWED_APP_PREFIXES: ['workly-salon', 'workly-tailor', 'workly-service'],

    DEFAULT_APP_ID: 'workly-salon',

    /**
     * Helper to check if an app_id is valid for this backend
     */
    isValidAppId: (appId: string): boolean => {
        if (!appId) return false;
        const normalized = appId.replace('_', '-');
        return AUTH_CONFIG.ALLOWED_APP_PREFIXES.some(prefix => normalized.startsWith(prefix));
    },

    PUBLIC_KEY_PATH: path.join(process.cwd(), 'keys', 'public.pem'),
};

/**
 * Get the public key for JWT verification
 * This key should match the private key used by AuthService
 */
export const getPublicKey = (): string => {
    try {
        console.log('🔑 [AUTH CONFIG] Loading Public Key...');
        console.log('🌐 [AUTH CONFIG] Service URL:', AUTH_CONFIG.AUTH_SERVICE_URL);
        const publicKeyPath = AUTH_CONFIG.PUBLIC_KEY_PATH;

        if (!fs.existsSync(publicKeyPath)) {
            console.warn(`⚠️  Public key not found at ${publicKeyPath}`);
            console.warn('   JWT local verification will fail. Falling back to AuthService validation.');
            return '';
        }

        const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        return publicKey;
    } catch (error) {
        console.error('Error reading public key:', error);
        return '';
    }
};
