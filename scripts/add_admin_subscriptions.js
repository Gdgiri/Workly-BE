const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Adding subscriptions for admin users...');

    try {
        // Find admin17 and admin18 users in salon_be1
        const admin17 = await prisma.user.findFirst({
            where: { businessEmail: 'admin17@gmail.com' }
        });

        const admin18 = await prisma.user.findFirst({
            where: { businessEmail: 'admin18@gmail.com' }
        });

        if (!admin17) {
            console.log('❌ admin17@gmail.com not found');
            return;
        }

        if (!admin18) {
            console.log('❌ admin18@gmail.com not found');
            return;
        }

        console.log(`✅ Found admin17: ${admin17.id}`);
        console.log(`✅ Found admin18: ${admin18.id}`);

        // Check if subscription plan exists, create if not
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

        // Create or update subscription for admin17
        const existingSub17 = await prisma.subscription.findUnique({
            where: { userId: admin17.id }
        });

        if (existingSub17) {
            console.log('📝 Updating subscription for admin17...');
            await prisma.subscription.update({
                where: { userId: admin17.id },
                data: {
                    status: 'ACTIVE',
                    planId: plan.id,
                    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
                }
            });
        } else {
            console.log('📝 Creating subscription for admin17...');
            await prisma.subscription.create({
                data: {
                    userId: admin17.id,
                    authId: admin17.authId,
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
        }

        // Create or update subscription for admin18
        const existingSub18 = await prisma.subscription.findUnique({
            where: { userId: admin18.id }
        });

        if (existingSub18) {
            console.log('📝 Updating subscription for admin18...');
            await prisma.subscription.update({
                where: { userId: admin18.id },
                data: {
                    status: 'ACTIVE',
                    planId: plan.id,
                    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                }
            });
        } else {
            console.log('📝 Creating subscription for admin18...');
            await prisma.subscription.create({
                data: {
                    userId: admin18.id,
                    authId: admin18.authId,
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
        }

        // Update users to link subscriptions
        const sub17 = await prisma.subscription.findUnique({
            where: { userId: admin17.id }
        });

        const sub18 = await prisma.subscription.findUnique({
            where: { userId: admin18.id }
        });

        await prisma.user.update({
            where: { id: admin17.id },
            data: { subscriptionId: sub17.id }
        });

        await prisma.user.update({
            where: { id: admin18.id },
            data: { subscriptionId: sub18.id }
        });

        console.log('✅ Successfully added subscriptions for both admin users!');
        console.log(`   admin17 subscription: ${sub17.id}`);
        console.log(`   admin18 subscription: ${sub18.id}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
