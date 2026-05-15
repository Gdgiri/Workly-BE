import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Repairing Admin Subscriptions...');
    console.log('Database:', process.env.DATABASE_URL);

    try {
        // 1. Get all ADMIN users
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            include: { subscription: true }
        });

        console.log(`🔍 Found ${admins.length} admins.`);

        // 2. Get or Create Basic Plan
        let plan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Basic Plan' } });
        if (!plan) {
            console.log('⚠️ Basic Plan not found, creating...');
            plan = await prisma.subscriptionPlan.create({
                data: {
                    name: 'Basic Plan',
                    monthlyPrice: 0,
                    quarterlyPrice: 0,
                    yearlyPrice: 0,
                    maxStylists: 5,
                    maxAppointments: 100,
                    maxCustomers: 500,
                    maxStaff: 5,
                    features: {},
                    isActive: true,
                    isDefault: true
                }
            });
            console.log(`✅ Basic Plan Created: ${plan.id}`);
        } else {
            console.log(`✅ Using existing Basic Plan: ${plan.id}`);
        }

        // 3. Loop through admins and fix subscriptions
        for (const admin of admins) {
            console.log(`❌ Admin ${admin.email} (${admin.id}) MISSING or UNLINKED subscription. Repairing...`);

            // Create or Update Subscription (Upsert to handle race/cache)
            const sub = await prisma.subscription.upsert({
                where: { userId: admin.id },
                update: { status: 'ACTIVE' },
                create: {
                    userId: admin.id,
                    planId: plan.id,
                    status: 'ACTIVE',
                    amount: 0,
                    billingCycle: 'MONTHLY',
                    startDate: new Date(),
                    authId: admin.authId
                }
            });

            // Link to User
            await prisma.user.update({
                where: { id: admin.id },
                data: { subscriptionId: sub.id }
            });

            console.log(`   ✅ Subscription verified/created and linked: ${sub.id}`);
        }
    } catch (error) {
        console.error('❌ FATAL ERROR:', error);
        // @ts-ignore
        if (error.meta) console.error('Meta:', error.meta);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
