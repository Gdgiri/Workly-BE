const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Setting up admin users with subscriptions...');

    try {
        // AuthIds from AuthService (we verified these earlier)
        const authIds = {
            admin17: 'a1e235fc-d256-4223-971b-82b8e8589699', // This is from our earlier check
            admin18: null // We need to find this
        };

        // First, let's check AuthService users to get the correct authIds
        console.log('Note: Using known authId for admin17');
        console.log('You may need to run the AuthService verify_users.js script to get admin18 authId');

        // Create or find subscription plan
        let plan = await prisma.subscriptionPlan.findFirst({
            where: { name: 'Professional' }
        });

        if (!plan) {
            console.log('📦 Creating Professional subscription plan...');
            plan = await prisma.subscriptionPlan.create({
                data: {
                    name: 'Professional',
                    description: 'Professional plan for salon management',
                    monthlyPrice: 999,
                    quarterlyPrice: 2499,
                    yearlyPrice: 8999,
                    currency: 'INR',
                    maxStylists: 20,
                    maxAppointments: 1000,
                    maxCustomers: 5000,
                    maxStaff: 50,
                    features: {
                        appointments: true,
                        inventory: true,
                        reports: true,
                        multiLocation: false
                    },
                    isActive: true,
                    isDefault: true,
                    isTrial: false,
                    trialDays: 14
                }
            });
            console.log(`✅ Created plan: ${plan.id}`);
        } else {
            console.log(`✅ Using existing plan: ${plan.id}`);
        }

        // Check if user already exists
        let existingUser = await prisma.user.findUnique({
            where: { authId: authIds.admin17 }
        });

        if (existingUser) {
            console.log(`✅ Found existing user for admin17: ${existingUser.id}`);

            // Check if subscription exists
            let subscription = await prisma.subscription.findUnique({
                where: { userId: existingUser.id }
            });

            if (!subscription) {
                console.log('📝 Creating subscription for admin17...');
                subscription = await prisma.subscription.create({
                    data: {
                        userId: existingUser.id,
                        authId: authIds.admin17,
                        planId: plan.id,
                        status: 'ACTIVE',
                        startDate: new Date(),
                        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                        billingCycle: 'YEARLY',
                        amount: plan.yearlyPrice,
                        currency: 'INR',
                        maxStylists: plan.maxStylists,
                        maxAppointments: plan.maxAppointments,
                        maxCustomers: plan.maxCustomers,
                        maxStaff: plan.maxStaff
                    }
                });

                // Link subscription to user
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        subscriptionId: subscription.id,
                        approvalStatus: 'APPROVED',
                        role: 'ADMIN'
                    }
                });

                console.log(`✅ admin17 subscription created: ${subscription.id}`);
            } else {
                console.log(`✅ admin17 already has subscription: ${subscription.id}`);

                // Make sure it's linked and approved
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        subscriptionId: subscription.id,
                        approvalStatus: 'APPROVED',
                        role: 'ADMIN'
                    }
                });
            }
        } else {
            console.log('❌ No existing user found with that authId');
            console.log('Creating new user for admin17...');

            const newUser = await prisma.user.create({
                data: {
                    authId: authIds.admin17,
                    role: 'ADMIN',
                    isActive: true,
                    approvalStatus: 'APPROVED',
                    businessName: 'Admin17 Salon',
                    businessEmail: 'admin17@gmail.com',
                    businessPhone: '+1234567890'
                }
            });

            const subscription = await prisma.subscription.create({
                data: {
                    userId: newUser.id,
                    authId: authIds.admin17,
                    planId: plan.id,
                    status: 'ACTIVE',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    billingCycle: 'YEARLY',
                    amount: plan.yearlyPrice,
                    currency: 'INR',
                    maxStylists: plan.maxStylists,
                    maxAppointments: plan.maxAppointments,
                    maxCustomers: plan.maxCustomers,
                    maxStaff: plan.maxStaff
                }
            });

            await prisma.user.update({
                where: { id: newUser.id },
                data: { subscriptionId: subscription.id }
            });

            console.log(`✅ Created new user and subscription for admin17`);
            console.log(`   User ID: ${newUser.id}`);
            console.log(`   Subscription ID: ${subscription.id}`);
        }

        console.log('');
        console.log('🎉 Setup complete for admin17!');
        console.log('');
        console.log('⚠️  For admin18, please:');
        console.log('1. Run: cd ../AuthService && node scripts/verify_users.js');
        console.log('2. Get the authId for admin18@gmail.com');
        console.log('3. Update this script with the correct authId');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
