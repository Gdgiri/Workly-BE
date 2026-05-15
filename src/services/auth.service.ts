import axios from 'axios';
import { AUTH_CONFIG } from '../config/auth';

export interface AuthValidationResponse {
    valid: boolean;
    user?: {
        id: string;
        email: string;
        phone: string;
        name: string;
        role: string;
        app_id: string;
    };
    error?: string;
}

export class AuthService {
    private static instance: AuthService;
    private baseURL: string;

    private constructor() {
        this.baseURL = AUTH_CONFIG.AUTH_SERVICE_URL;
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    async validateToken(token: string): Promise<AuthValidationResponse> {
        try {
            // logDebug skipped for brevity but let's add one here
            console.log(`🌐 [AuthService] Validating token (len: ${token.length}, snippet: ${token.substring(0, 10)}...)`);
            console.log(`📡 URL: ${this.baseURL}/auth/validate`);

            const response = await axios.get(`${this.baseURL}/auth/validate`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                timeout: 30000, // Increased to 30s as per cold start observation
            });

            const data = response.data.data;
            return {
                valid: data.valid,
                user: data.user ? {
                    ...data.user,
                    phone: data.user.phone || data.user.phone_number
                } : undefined,
                error: data.error
            };
        } catch (error: any) {
            console.error('❌ Token Validation Error:', {
                message: error.message,
                code: error.code,
                url: `${this.baseURL}/auth/validate`,
                stack: error.stack?.split('\n').slice(0, 2).join('\n')
            });

            if (axios.isAxiosError(error) && error.response) {
                const responseData = error.response.data;
                const errorMsg = responseData?.data?.error || responseData?.error || responseData?.message || 'Token validation failed';

                return {
                    valid: false,
                    error: errorMsg,
                };
            }
            return {
                valid: false,
                error: `Auth service unavailable: ${error.message}`,
            };
        }
    }

    async getUserByEmail(email: string, appId: string): Promise<{ id: string; email: string; name: string; role: string } | null> {
        try {
            console.log(`🌐 [AuthService] GET user by email: ${email} (AppID: ${appId})`);
            const response = await axios.get(`${this.baseURL}/auth/user/email/${encodeURIComponent(email)}`, {
                params: { app_id: appId },
                timeout: 5000,
            });

            const user = response.data?.data?.user;
            if (user && user.id) {
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                };
            }
            return null;
        } catch (error) {
            // Log but don't throw, let caller handle null
            // console.error('Error fetching user by email from AuthService:', error); 
            return null;
        }
    }

    async getUserByPhone(phone: string, appId: string): Promise<{ id: string; email: string; name: string; role: string } | null> {
        try {
            console.log(`🌐 [AuthService] GET user by phone: ${phone} (AppID: ${appId})`);
            const response = await axios.get(`${this.baseURL}/auth/user/phone/${encodeURIComponent(phone)}`, {
                params: { app_id: appId },
                timeout: 5000,
            });

            const user = response.data?.data?.user;
            if (user && user.id) {
                console.log(`✅ [AuthService] Found user by phone: ${phone} -> ${user.id}`);
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                };
            }
            return null;
        } catch (error) {
            // Log but don't throw, let caller handle null
            return null;
        }
    }

    async login(email: string, password: string, appId: string): Promise<{ id: string; email: string; name: string; role: string } | null> {
        try {
            const response = await axios.post(`${this.baseURL}/auth/login`, {
                email,
                password,
                app_id: appId
            }, {
                timeout: 5000
            });

            const user = response.data?.data?.user;
            if (user && user.id) {
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                };
            }
            return null;
        } catch (error) {
            // Login failed (wrong password, etc)
            return null;
        }
    }

    async registerUser(data: { name: string; email: string; password: string; phone?: string; app_id: string; role?: string }): Promise<any> {
        try {
            const response = await axios.post(`${this.baseURL}/auth/register`, {
                ...data,
                role: data.role || 'USER'
            }, {
                timeout: 30000 // Increased to 30s for Render cold starts
            });
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(error.response.data?.error || error.response.data?.message || 'Registration failed');
            }
            console.error('Auth Service Error:', error);
            throw new Error('Auth service unavailable (Timeout or Network Error)');
        }
    }

    async updateUser(authId: string, data: { name?: string; email?: string; phone?: string; password?: string }): Promise<any> {
        try {
            // Map 'phone' to 'phoneNumber' for AuthService
            const payload: any = { ...data };
            if (data.phone) {
                payload.phoneNumber = data.phone;
                delete payload.phone;
            }

            // Handle empty string as null to avoid unique constraint issues
            if (payload.email === "") {
                payload.email = null;
            }

            console.log(`🌐 [AuthService] PATCH request to: ${this.baseURL}/auth/user/${authId}`);
            console.log(`📦 [AuthService] Payload:`, JSON.stringify(payload, null, 2));

            const response = await axios.patch(`${this.baseURL}/auth/user/${authId}`, payload, {
                timeout: 10000
            });
            console.log(`✅ [AuthService] Update successful:`, response.status);
            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                const status = error.response.status;
                const data = error.response.data;
                console.error(`❌ [AuthService] Update failed (${status}):`, JSON.stringify(data, null, 2));
                throw new Error(`AuthService Update failed (${status}): ${data?.message || data?.error || 'Update failed'}`);
            }
            console.error('❌ [AuthService] Service unavailable:', error.message);
            throw new Error('Auth service unavailable during update');
        }
    }

    async forgotPassword(email: string, appId: string, businessName: string): Promise<any> {
        try {
            console.log(`🌐 [AuthService] POST forgot-password for: ${email} (Business: ${businessName})`);
            const response = await axios.post(`${this.baseURL}/auth/forgot-password`, {
                email,
                app_id: appId,
                businessName: businessName
            }, {
                timeout: 10000
            });
            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(error.response.data?.error || error.response.data?.message || 'Failed to send reset link');
            }
            throw new Error('Auth service unavailable');
        }
    }

    async resetPassword(password: string, token: string): Promise<any> {
        try {
            console.log(`🌐 [AuthService] POST reset-password`);
            const response = await axios.post(`${this.baseURL}/auth/reset-password`, {
                password,
                token
            }, {
                timeout: 10000
            });
            return response.data;
        } catch (error: any) {
            if (axios.isAxiosError(error) && error.response) {
                throw new Error(error.response.data?.error || error.response.data?.message || 'Password reset failed');
            }
            throw new Error('Auth service unavailable');
        }
    }
}

export const authService = AuthService.getInstance();