const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Configuration
const AUTH_SERVICE_URL = 'http://localhost:8000';
const APP_ID = 'workly-salon';

// Super Admin Credentials
const SUPER_ADMIN = {
    name: 'Super Admin',
    email: 'superadmin456@gmail.com',
    phone: '+91 9999999999',
    password: 'Superadmin@123',
    app_id: APP_ID
};

async function createSuperAdmin() {
    console.log('🚀 Starting Super Admin Seed Script...\n');

    try {
        // Step 1: Register Super Admin in Auth Service
        console.log('📝 Step 1: Registering Super Admin in Auth Service...');
        console.log(`   Email: ${SUPER_ADMIN.email}`);

        let authId;

        try {
            const registerResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, SUPER_ADMIN);

            console.log('Auth Service Response:', JSON.stringify(registerResponse.data, null, 2));

            // Extract authId from response
            if (registerResponse.data.status === 'success') {
                // Try different possible locations for the ID
                authId = registerResponse.data.user?.id ||
                    registerResponse.data.data?.user?.id ||
                    registerResponse.data.data?.id;

                if (authId) {
                    console.log('✅ Super Admin registered in Auth Service');
                    console.log(`   Auth ID: ${authId}`);
                } else {
                    console.log('⚠️  Registration successful but could not extract Auth ID from response');
                    console.log('   Response structure:', JSON.stringify(registerResponse.data, null, 2));
                }
            }
        } catch (error) {
            if (error.response?.data?.error?.includes('already exists') ||
                error.response?.data?.message?.includes('already exists')) {
                console.log('⚠️  User already exists in Auth Service, attempting to login...');

                // Try to login to get the authId
                try {
                    const loginResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
                        email: SUPER_ADMIN.email,
                        password: SUPER_ADMIN.password,
                        app_id: APP_ID
                    });

                    console.log('Login Response:', JSON.stringify(loginResponse.data, null, 2));

                    if (loginResponse.data.status === 'success') {
                        authId = loginResponse.data.user?.id ||
                            loginResponse.data.data?.user?.id ||
                            loginResponse.data.data?.id;

                        if (authId) {
                            console.log('✅ Retrieved existing user from Auth Service');
                            console.log(`   Auth ID: ${authId}`);
                        }
                    }
                } catch (loginError) {
                    console.error('❌ Failed to login with existing credentials');
                    console.error('Login Error:', loginError.response?.data || loginError.message);
                    throw loginError;
                }
            } else {
                console.error('❌ Failed to register in Auth Service');
                console.error('Error:', error.response?.data || error.message);
                throw error;
            }
        }

        if (!authId) {
            console.error('\n❌ Could not obtain Auth ID from Auth Service');
            console.log('\n📋 Manual Steps Required:');
            console.log('1. Check Auth Service database for user with email:', SUPER_ADMIN.email);
            console.log('2. Get the user ID from the database');
            console.log('3. Run this SQL in Salon Backend database:');
            console.log(`\nUPDATE users SET role = 'SUPER_ADMIN', approvalStatus = 'APPROVED', isActive = true WHERE authId = '<AUTH_ID_HERE>';\n`);
            console.log('Or insert if user doesn\'t exist:');
            console.log(`\nINSERT INTO users (id, authId, role, approvalStatus, isActive, createdAt, updatedAt)`);
            console.log(`VALUES (UUID(), '<AUTH_ID_HERE>', 'SUPER_ADMIN', 'APPROVED', true, NOW(), NOW());\n`);
            return;
        }

        // Step 2: Create or Update Super Admin in Salon Backend
        console.log('\n📝 Step 2: Creating/Updating Super Admin in Salon Backend...');

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { authId }
        });

        let salonUser;

        if (existingUser) {
            console.log('⚠️  User already exists in Salon Backend, updating to SUPER_ADMIN...');

            salonUser = await prisma.user.update({
                where: { authId },
                data: {
                    role: 'SUPER_ADMIN',
                    approvalStatus: 'APPROVED',
                    isActive: true,
                    updatedAt: new Date()
                }
            });

            console.log('✅ Updated existing user to SUPER_ADMIN');
        } else {
            console.log('📝 Creating new SUPER_ADMIN user in Salon Backend...');

            salonUser = await prisma.user.create({
                data: {
                    authId,
                    role: 'SUPER_ADMIN',
                    approvalStatus: 'APPROVED',
                    isActive: true,
                }
            });

            console.log('✅ Created new SUPER_ADMIN user in Salon Backend');
        }

        // Step 3: Verify the setup
        console.log('\n✅ Super Admin Setup Complete!\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📋 SUPER ADMIN CREDENTIALS:');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Email:    ${SUPER_ADMIN.email}`);
        console.log(`Password: ${SUPER_ADMIN.password}`);
        console.log(`Role:     SUPER_ADMIN`);
        console.log(`Auth ID:  ${authId}`);
        console.log(`User ID:  ${salonUser.id}`);
        console.log('═══════════════════════════════════════════════════════\n');

        console.log('🎯 Next Steps:');
        console.log('1. Login at: http://localhost:3000/workly-salon/KK-salon/login');
        console.log('2. Use the credentials above');
        console.log('3. Navigate to Business Approvals to manage pending businesses\n');

        // Step 4: Check subscription plans
        console.log('📝 Step 4: Checking subscription plans...');

        const plansCount = await prisma.subscriptionPlan.count();

        if (plansCount === 0) {
            console.log('⚠️  No subscription plans found. Please run:');
            console.log('   node prisma/seed-subscriptions.js\n');
        } else {
            console.log(`✅ Found ${plansCount} subscription plans\n`);

            const plans = await prisma.subscriptionPlan.findMany({
                select: { name: true, monthlyPrice: true, isDefault: true }
            });

            console.log('Available Plans:');
            plans.forEach(plan => {
                console.log(`  - ${plan.name}: ₹${plan.monthlyPrice}/month ${plan.isDefault ? '(Default)' : ''}`);
            });
            console.log('');
        }

    } catch (error) {
        console.error('\n❌ Error during Super Admin seed:', error.message);
        if (error.response?.data) {
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed
createSuperAdmin()
    .then(() => {
        console.log('✅ Seed script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Seed script failed:', error.message);
        process.exit(1);
    });
