import { PrismaClient, UserRole, SubscriptionStatus, BillingCycle } from '@prisma/client';

const prisma = new PrismaClient();
const AUTH_ID = '90a8896b-612f-482f-aa9a-51b07af64097';

async function main() {
    console.log('Setting up Admin 31 in Salon Backend...');

    // 1. Create/Update User
    const user = await prisma.user.upsert({
        where: { authId: AUTH_ID },
        update: {
            role: UserRole.ADMIN,
            isActive: true
        },
        create: {
            authId: AUTH_ID,
            role: UserRole.ADMIN,
            isActive: true,
            businessName: 'Admin 31 Salon',
            businessEmail: 'admin31@gmail.com'
        }
    });
    console.log(`✅ User ensured: ${user.id} (AuthID: ${user.authId})`);

    // 2. Ensure Subscription Plan
    let plan = await prisma.subscriptionPlan.findFirst({
        where: { isActive: true }
    });

    if (!plan) {
        console.log('No active plan found, creating default Premium Plan...');
        plan = await prisma.subscriptionPlan.create({
            data: {
                name: 'Premium Plan (Auto)',
                monthlyPrice: 99.00,
                quarterlyPrice: 250.00,
                yearlyPrice: 900.00,
                maxStylists: 10,
                maxAppointments: 500,
                maxCustomers: 1000,
                maxStaff: 20,
                features: { all: true },
                isActive: true,
                isDefault: true
            }
        });
    }
    console.log(`Using Plan: ${plan.name} (${plan.id})`);

    // 3. Create Subscription
    // Check if exists
    const existingSub = await prisma.subscription.findUnique({
        where: { userId: user.id }
    });

    if (!existingSub) {
        const sub = await prisma.subscription.create({
            data: {
                userId: user.id,
                planId: plan.id,
                status: SubscriptionStatus.ACTIVE,
                billingCycle: BillingCycle.YEARLY,
                amount: plan.yearlyPrice,
                startDate: new Date(),
                endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                maxStylists: plan.maxStylists,
                maxAppointments: plan.maxAppointments,
                maxCustomers: plan.maxCustomers,
                maxStaff: plan.maxStaff
            }
        });

        // Link to user
        await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionId: sub.id }
        });

        console.log(`✅ Subscription created: ${sub.id}`);
    } else {
        // If exists, ensure it is linked to user correctly
        await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionId: existingSub.id }
        });
        console.log(`ℹ️ Subscription already exists: ${existingSub.id}`);
    }

    console.log('Setup Complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
