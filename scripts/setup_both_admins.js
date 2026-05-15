const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Setting up subscriptions for admin17 and admin18...');

    try {
        // AuthIds from AuthService
        const adminUsers = [
            { email: 'admin17@gmail.com', authId: 'a1e235fc-d256-4223-971b-82b8e8589699', name: 'Admin 17' },
            { email: 'admin18@gmail.com', authId: 'be9be1e7-f338-42b3-82b8-e8589699', name: 'Admin 18' } // Assuming pattern
        ];

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

        // Process each admin user
        for (const admin of adminUsers) {
            console.log(`\n📝 Processing ${admin.email}...`);

            // Check if user exists
            let user = await prisma.user.findUnique({
                where: { authId: admin.authId }
            });

            if (!user) {
                console.log(`   Creating new user for ${admin.email}...`);
                user = await prisma.user.create({
                    data: {
                        authId: admin.authId,
                        role: 'ADMIN',
                        isActive: true,
                        approvalStatus: 'APPROVED',
                        businessName: `${admin.name} Salon`,
                        businessEmail: admin.email,
                        businessPhone: '+1234567890'
                    }
                });
                console.log(`   ✅ Created user: ${user.id}`);
            } else {
                console.log(`   ✅ Found existing user: ${user.id}`);
                // Update to ensure they're approved
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        role: 'ADMIN',
                        approvalStatus: 'APPROVED',
                        isActive: true
                    }
                });
            }

            // Check if subscription exists
            let subscription = await prisma.subscription.findUnique({
                where: { userId: user.id }
            });

            if (!subscription) {
                console.log(`   Creating subscription...`);
                subscription = await prisma.subscription.create({
                    data: {
                        userId: user.id,
                        authId: admin.authId,
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
                console.log(`   ✅ Created subscription: ${subscription.id}`);
            } else {
                console.log(`   ✅ Subscription already exists: ${subscription.id}`);
                // Update to ensure it's active
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: {
                        status: 'ACTIVE',
                        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                    }
                });
            }

            // Link subscription to user
            await prisma.user.update({
                where: { id: user.id },
                data: { subscriptionId: subscription.id }
            });

            console.log(`   ✅ ${admin.email} setup complete!`);
            console.log(`      User ID: ${user.id}`);
            console.log(`      Subscription ID: ${subscription.id}`);
        }

        console.log('\n🎉 All done! Both admin users now have active subscriptions.');
        console.log('They should now be able to log in without 403 errors.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
