const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedSubscriptionPlans() {
    console.log('🌱 Seeding subscription plans...');

    // Create Trial Plan
    const trialPlan = await prisma.subscriptionPlan.upsert({
        where: { name: 'Trial' },
        update: {},
        create: {
            name: 'Trial',
            description: '14-day free trial with limited features',
            monthlyPrice: 0,
            quarterlyPrice: 0,
            yearlyPrice: 0,
            maxStylists: 2,
            maxAppointments: 50,
            maxCustomers: 100,
            maxStaff: 2,
            features: JSON.stringify(['Basic Dashboard', 'Appointment Management', 'Customer Management']),
            isActive: true,
            isDefault: false,
            isTrial: true,
            trialDays: 14,
        },
    });
    console.log('✅ Created Trial plan');

    // Create Starter Plan
    const starterPlan = await prisma.subscriptionPlan.upsert({
        where: { name: 'Starter' },
        update: {},
        create: {
            name: 'Starter',
            description: 'Perfect for small salons just getting started',
            monthlyPrice: 999,
            quarterlyPrice: 2699,
            yearlyPrice: 9999,
            maxStylists: 5,
            maxAppointments: 200,
            maxCustomers: 500,
            maxStaff: 5,
            features: JSON.stringify([
                'All Trial Features',
                'SMS Notifications',
                'Email Support',
                'Basic Reports',
                'Inventory Management',
            ]),
            isActive: true,
            isDefault: true,
            isTrial: false,
            trialDays: 14,
        },
    });
    console.log('✅ Created Starter plan');

    // Create Professional Plan
    const professionalPlan = await prisma.subscriptionPlan.upsert({
        where: { name: 'Professional' },
        update: {},
        create: {
            name: 'Professional',
            description: 'For growing salons with multiple staff members',
            monthlyPrice: 1999,
            quarterlyPrice: 5399,
            yearlyPrice: 19999,
            maxStylists: 15,
            maxAppointments: 1000,
            maxCustomers: 2000,
            maxStaff: 15,
            features: JSON.stringify([
                'All Starter Features',
                'Advanced Reports & Analytics',
                'WhatsApp Integration',
                'Priority Support',
                'Staff Performance Tracking',
                'Loyalty Programs',
                'Custom Branding',
            ]),
            isActive: true,
            isDefault: false,
            isTrial: false,
            trialDays: 14,
        },
    });
    console.log('✅ Created Professional plan');

    // Create Enterprise Plan
    const enterprisePlan = await prisma.subscriptionPlan.upsert({
        where: { name: 'Enterprise' },
        update: {},
        create: {
            name: 'Enterprise',
            description: 'For large salon chains with multiple locations',
            monthlyPrice: 4999,
            quarterlyPrice: 13499,
            yearlyPrice: 49999,
            maxStylists: 100,
            maxAppointments: 10000,
            maxCustomers: 10000,
            maxStaff: 100,
            features: JSON.stringify([
                'All Professional Features',
                'Multi-location Management',
                'Dedicated Account Manager',
                '24/7 Phone Support',
                'Custom Integrations',
                'Advanced API Access',
                'White-label Options',
                'Franchise Management',
            ]),
            isActive: true,
            isDefault: false,
            isTrial: false,
            trialDays: 30,
        },
    });
    console.log('✅ Created Enterprise plan');

    console.log('\n📊 Subscription Plans Summary:');
    console.log(`  - Trial: ₹0/month (14 days)`);
    console.log(`  - Starter: ₹${starterPlan.monthlyPrice}/month (Default)`);
    console.log(`  - Professional: ₹${professionalPlan.monthlyPrice}/month`);
    console.log(`  - Enterprise: ₹${enterprisePlan.monthlyPrice}/month`);
}

async function main() {
    try {
        await seedSubscriptionPlans();
        console.log('\n✅ Seeding completed successfully!');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
