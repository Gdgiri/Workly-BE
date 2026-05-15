import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8000';
const APP_NAME = 'workly-salon';

const ADMINS = [
    { email: 'admin17@gmail.com', password: 'Admin@123', name: 'Admin 17', phone: '9898989817' },
    { email: 'admin18@gmail.com', password: 'Admin@123', name: 'Admin 18', phone: '9898989818' }
];

async function getOrCreateAuthUser(admin: any) {
    try {
        // Try Login first to see if exists
        console.log(`Checking AuthService for ${admin.email}...`);
        const loginRes = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
            email: admin.email,
            password: admin.password,
            app_id: APP_NAME
        });
        console.log(`✅ User exists in AuthService: ${loginRes.data.data.user.id}`);
        return loginRes.data.data.user;
    } catch (err: any) {
        // If login failed, maybe user doesn't exist? Try register
        if (err.response?.status === 401 || err.response?.status === 404) {
            console.log(`User not found or invalid creds. Attempting validation check...`);
            // Actually, if we want to force this password, we probably can't if user exists with diff password.
            // But Assuming clean state or known state. 
            // Let's try register.
            try {
                console.log(`Registering ${admin.email}...`);
                const regRes = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, {
                    app_id: APP_NAME,
                    name: admin.name,
                    email: admin.email,
                    phone: admin.phone,
                    password: admin.password,
                    role: 'ADMIN'
                });
                console.log(`✅ Registered in AuthService: ${regRes.data.data.user.id}`);
                return regRes.data.data.user;
            } catch (regErr: any) {
                if (regErr.response?.data?.message?.includes('already exists')) {
                    // It exists but Login failed? Maybe wrong password in our script vs DB?
                    // Or maybe we can fetch it via our new "getUserByEmail" fix?
                    console.log(`User exists but login failed (maybe wrong pass?). Fetching via API...`);
                    // We can use the endpoint we just fixed!
                    const fetchRes = await axios.get(`${AUTH_SERVICE_URL}/auth/user/email/${admin.email}`, {
                        params: { app_id: APP_NAME }
                    });
                    console.log(`✅ Fetched user from AuthService: ${fetchRes.data.data.user.id}`);
                    return fetchRes.data.data.user;
                }
                console.error('❌ Registration failed:', regErr.response?.data || regErr.message);
                throw regErr;
            }
        }
        throw err;
    }
}

async function main() {
    console.log('🚀 Starting Admin Registration Script...');

    // 1. Ensure Subscription Plan exists
    const ENT_PLAN = await prisma.subscriptionPlan.upsert({
        where: { name: 'Enterprise' },
        update: {},
        create: {
            name: 'Enterprise',
            monthlyPrice: 99.99,
            quarterlyPrice: 289.99,
            yearlyPrice: 999.99,
            maxStylists: 50,
            maxAppointments: 10000,
            maxCustomers: 10000,
            maxStaff: 100,
            features: JSON.stringify(['all']),
            isActive: true
        }
    });
    console.log(`✅ Plan ensured: ${ENT_PLAN.name} (${ENT_PLAN.id})`);

    for (const adminData of ADMINS) {
        console.log(`\nProcessing ${adminData.email}...`);

        // 2. Get Auth ID
        const authUser = await getOrCreateAuthUser(adminData);
        if (!authUser || !authUser.id) {
            console.error(`❌ Could not get Auth ID for ${adminData.email}`);
            continue;
        }

        // 3. Create/Update Local User
        const user = await prisma.user.upsert({
            where: { authId: authUser.id },
            update: {
                role: 'ADMIN',
                isActive: true
                // Don't overwrite existing subscriptionId yet if it exists, wait for step 4
            },
            create: {
                authId: authUser.id,
                role: 'ADMIN',
                isActive: true
            }
        });
        console.log(`✅ Local User synced: ${user.id} (AuthId: ${user.authId})`);

        // 4. Create/Update Subscription
        // Check if user already has a subscription
        let sub = await prisma.subscription.findUnique({
            where: { userId: user.id }
        });

        if (!sub) {
            console.log(`Creating new subscription...`);
            sub = await prisma.subscription.create({
                data: {
                    userId: user.id,
                    planId: ENT_PLAN.id,
                    status: 'ACTIVE',
                    startDate: new Date(),
                    authId: user.authId, // Creator
                    amount: ENT_PLAN.monthlyPrice
                }
            });
        } else {
            console.log(`Subscription already exists: ${sub.id}`);
        }

        // 5. Link Subscription to User (if not already)
        if (user.subscriptionId !== sub.id) {
            await prisma.user.update({
                where: { id: user.id },
                data: { subscriptionId: sub.id }
            });
            console.log(`✅ Linked Subscription ${sub.id} to User`);
        }

        // 6. Ensure Settings exist (required for many admin functions)
        await prisma.settings.upsert({
            where: { adminId: user.authId },
            update: {},
            create: {
                adminId: user.authId,
                authId: user.authId,
                salonName: `${adminData.name}'s Salon`,
                currency: 'INR'
            }
        });
        console.log(`✅ Settings ensured for Admin`);

    }

    console.log('\n✨ All Done!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
