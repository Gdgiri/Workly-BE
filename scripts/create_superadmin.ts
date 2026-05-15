
import axios from 'axios';
import { PrismaClient, UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const AUTH_SERVICE_URL = 'http://localhost:8000';
const APP_NAME = 'workly-salon';

async function createSuperAdmin() {
    const email = 'superadmin@workly.com';
    const password = 'Super@123';
    const name = 'Super Admin';
    const role = 'SUPER_ADMIN'; // Enum in salon_be1

    console.log(`🚀 Starting Super Admin creation...`);

    let authId = '';

    try {
        // 1. Register in AuthService
        console.log(`📝 Registering in AuthService: ${email}`);
        const regResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, {
            app_id: APP_NAME,
            name,
            email,
            password,
            // role field might be ignored by AuthService if not in schema, but sending anyway as per example
            role: 'SUPERADMIN'
        });

        console.log('✅ Registration successful!');
        console.log('Response data:', JSON.stringify(regResponse.data, null, 2));

        // Handle different response structures
        if (regResponse.data.user && regResponse.data.user.id) {
            authId = regResponse.data.user.id;
        } else if (regResponse.data.id) {
            authId = regResponse.data.id;
        } else {
            console.error('❌ Unexpected response structure:', regResponse.data);
            process.exit(1);
        }

    } catch (error: any) {
        if (error.response?.data?.message?.includes('already exists')) {
            console.log('ℹ️  User already exists in AuthService. Logging in to get ID...');
            try {
                const loginResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
                    email,
                    password,
                    app_id: APP_NAME
                });
                console.log('✅ Login successful!');
                // console.log('Login Response data:', JSON.stringify(loginResponse.data, null, 2));

                if (loginResponse.data.user && loginResponse.data.user.id) {
                    authId = loginResponse.data.user.id;
                } else if (loginResponse.data.id) {
                    authId = loginResponse.data.id;
                } else if (loginResponse.data.accessToken) {
                    console.log('ℹ️ User ID not in response, decoding token...');
                    const decoded: any = jwt.decode(loginResponse.data.accessToken);
                    if (decoded && decoded.id) {
                        authId = decoded.id;
                    } else if (decoded && decoded.sub) {
                        authId = decoded.sub;
                    } else {
                        console.error('❌ Could not find ID in decoded token:', decoded);
                        process.exit(1);
                    }
                } else {
                    console.error('❌ Could not find user ID or Token in login response:', loginResponse.data);
                    process.exit(1);
                }
            } catch (loginError: any) {
                console.error('❌ Login failed:', loginError.response?.data || loginError.message);
                process.exit(1);
            }
        } else {
            console.error('❌ Registration failed:', error.response?.data || error.message);
            process.exit(1);
        }
    }

    if (!authId) {
        console.error('❌ Failed to obtain Auth ID.');
        process.exit(1);
    }

    console.log(`🔑 Auth ID: ${authId}`);

    // 2. Create/Update in Salon Backend (salon_be1)
    console.log(`💾 Seeding user in salon_be1 DB...`);

    try {
        const user = await prisma.user.upsert({
            where: { authId },
            update: {
                role: 'SUPER_ADMIN',
                isActive: true
            },
            create: {
                authId,
                role: 'SUPER_ADMIN',
                isActive: true
            }
        });
        console.log(`✅ Super Admin created/updated in salon_be1:`, user);
    } catch (dbError: any) {
        console.error('❌ Database operation failed:', dbError.message);
    } finally {
        await prisma.$disconnect();
    }
}

createSuperAdmin();
