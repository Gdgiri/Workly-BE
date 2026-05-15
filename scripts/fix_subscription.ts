
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_AUTH_ID = 'c3d14ddf-9da1-4464-b7ae-5a2f92f2d046';

async function main() {
    console.log(`🔍 Checking subscription for user: ${TARGET_AUTH_ID}...`);

    const user = await prisma.user.findUnique({
        where: { authId: TARGET_AUTH_ID },
        include: { subscription: true },
    });

    if (!user) {
        console.error('❌ User not found!');
        return;
    }

    console.log('👤 User found:', {
        id: user.id,
        role: user.role,
        subscription: user.subscription,
    });

    if (user.subscription && user.subscription.status === 'ACTIVE') {
        console.log('✅ User already has an active subscription.');
        return;
    }

    // Find or create a plan
    let plan = await prisma.subscriptionPlan.findFirst({
        where: { name: 'Pro Plan' }
    });

    if (!plan) {
        console.log('⚠️ No plan found, creating default Pro Plan...');
        plan = await prisma.subscriptionPlan.create({
            data: {
                name: 'Pro Plan',
                monthlyPrice: 29.99,
                quarterlyPrice: 79.99,
                yearlyPrice: 299.99,
                maxStylists: 10,
                maxAppointments: 1000,
                maxCustomers: 5000,
                maxStaff: 20,
                features: JSON.stringify(['appointments', 'pos', 'inventory']),
                isActive: true,
                isDefault: true
            }
        });
    }

    console.log('🔄 Creating/Updating subscription...');

    // Create subscription
    const sub = await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
            status: 'ACTIVE',
            planId: plan.id,
            startDate: new Date(),
            billingCycle: 'MONTHLY',
            amount: plan.monthlyPrice,
            maxStylists: plan.maxStylists,
            maxAppointments: plan.maxAppointments,
            maxCustomers: plan.maxCustomers,
            maxStaff: plan.maxStaff,
        },
        create: {
            userId: user.id,
            planId: plan.id,
            status: 'ACTIVE',
            startDate: new Date(),
            billingCycle: 'MONTHLY',
            amount: plan.monthlyPrice,
            maxStylists: plan.maxStylists,
            maxAppointments: plan.maxAppointments,
            maxCustomers: plan.maxCustomers,
            maxStaff: plan.maxStaff,
        }
    });

    // Link subscription to user record if not already linked (though relation should handle it via userId)
    // But User model has subscriptionId field too?
    // User model: subscriptionId String? @unique, subscription Subscription? @relation(fields: [subscriptionId], references: [id])
    // Wait, schema says:
    // subscriptionId    String?           @unique
    // subscription      Subscription?     @relation(fields: [subscriptionId], references: [id])
    // BUT Subscription model says:
    // userId            String              @unique
    // user              User?

    // This is a 1:1 relation. Usually one side holds the FK. 
    // Schema: User has subscriptionId. Subscription has userId. 
    // If User has @relation(fields: [subscriptionId], references: [id]), then User holds the FK.

    await prisma.user.update({
        where: { id: user.id },
        data: {
            subscriptionId: sub.id,
            businessName: user.businessName || 'My Salon', // Ensure business name is set too
            approvalStatus: 'APPROVED'
        }
    });

    console.log('✅ Subscription added and user updated successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
