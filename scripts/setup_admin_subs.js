const { PrismaClient: PrismaAuth } = require('@prisma/client');
const { PrismaClient: PrismaSalon } = require('@prisma/client');

// Connect to AuthService DB
const prismaAuth = new PrismaAuth({
    datasources: {
        db: {
            url: 'mysql://root:HapEGjPLIEwqmqiJNjwbkgsyOYEIRLRB@maglev.proxy.rlwy.net:35622/railway'
        }
    }
});

// Connect to Salon BE DB  
const prismaSalon = new PrismaSalon();

async function main() {
    console.log('🚀 Setting up admin users with subscriptions...');

    try {
        // Get admin users from AuthService
        const authAdmin17 = await prismaAuth.user.findFirst({
            where: { email: 'admin17@gmail.com' }
        });

        const authAdmin18 = await prismaAuth.user.findFirst({
            where: { email: 'admin18@gmail.com' }
        });

        if (!authAdmin17 || !authAdmin18) {
            console.log('❌ Admin users not found in AuthService');
            console.log(`admin17: ${authAdmin17 ? 'Found' : 'Not found'}`);
            console.log(`admin18: ${authAdmin18 ? 'Not found'}`);
            return;
        }

        console.log(`✅ Found admin17 in AuthService: ${authAdmin17.id}`);
        console.log(`✅ Found admin18 in AuthService: ${authAdmin18.id}`);

        // Create or find subscription plan
        let plan = await prismaSalon.subscriptionPlan.findFirst({
            where: { name: 'Professional' }
        });

        if (!plan) {
            console.log('📦 Creating Professional subscription plan...');
            plan = await prismaSalon.subscriptionPlan.create({
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

        // Process admin17
        let salonUser17 = await prismaSalon.user.findUnique({
            where: { authId: authAdmin17.id }
        });

        if (!salonUser17) {
            console.log('📝 Creating salon_be1 user for admin17...');
            salonUser17 = await prismaSalon.user.create({
                data: {
                    authId: authAdmin17.id,
                    role: 'ADMIN',
                    isActive: true,
                    approvalStatus: 'APPROVED',
                    businessName: 'Admin17 Salon',
                    businessEmail: 'admin17@gmail.com',
                    businessPhone: '+1234567890'
                }
            });
        }

        // Create subscription for admin17
        let subscription17 = await prismaSalon.subscription.findUnique({
            where: { userId: salonUser17.id }
        });

        if (!subscription17) {
            console.log('📝 Creating subscription for admin17...');
            subscription17 = await prismaSalon.subscription.create({
                data: {
                    userId: salonUser17.id,
                    authId: authAdmin17.id,
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

        // Link subscription to user
        await prismaSalon.user.update({
            where: { id: salonUser17.id },
            data: { subscriptionId: subscription17.id }
        });

        console.log(`✅ admin17 setup complete - subscriptionId: ${subscription17.id}`);

        // Process admin18
        let salonUser18 = await prismaSalon.user.findUnique({
            where: { authId: authAdmin18.id }
        });

        if (!salonUser18) {
            console.log('📝 Creating salon_be1 user for admin18...');
            salonUser18 = await prismaSalon.user.create({
                data: {
                    authId: authAdmin18.id,
                    role: 'ADMIN',
                    isActive: true,
                    approvalStatus: 'APPROVED',
                    businessName: 'Admin18 Salon',
                    businessEmail: 'admin18@gmail.com',
                    businessPhone: '+1234567891'
                }
            });
        }

        // Create subscription for admin18
        let subscription18 = await prismaSalon.subscription.findUnique({
            where: { userId: salonUser18.id }
        });

        if (!subscription18) {
            console.log('📝 Creating subscription for admin18...');
            subscription18 = await prismaSalon.subscription.create({
                data: {
                    userId: salonUser18.id,
                    authId: authAdmin18.id,
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

        // Link subscription to user
        await prismaSalon.user.update({
            where: { id: salonUser18.id },
            data: { subscriptionId: subscription18.id }
        });

        console.log(`✅ admin18 setup complete - subscriptionId: ${subscription18.id}`);
        console.log('');
        console.log('🎉 All done! Both admin users now have active subscriptions.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prismaAuth.$disconnect();
        await prismaSalon.$disconnect();
    }
}

main();
