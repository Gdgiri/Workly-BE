import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
    console.log('🗑️  Starting database cleanup...\n');

    try {
        // Disable foreign key checks temporarily
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

        // Clear all salon backend tables in correct order (respecting dependencies)
        console.log('Clearing VoucherClaims...');
        await prisma.voucherClaim.deleteMany({});

        console.log('Clearing Vouchers...');
        await prisma.voucher.deleteMany({});

        console.log('Clearing Reconciliations...');
        await prisma.reconciliation.deleteMany({});

        console.log('Clearing CustomerPackages...');
        await prisma.customerPackage.deleteMany({});

        console.log('Clearing Packages...');
        await prisma.package.deleteMany({});

        console.log('Clearing InventoryMovements...');
        await prisma.inventoryMovement.deleteMany({});

        console.log('Clearing Products...');
        await prisma.product.deleteMany({});

        console.log('Clearing Payments...');
        await prisma.payment.deleteMany({});

        console.log('Clearing Sales...');
        await prisma.sale.deleteMany({});

        console.log('Clearing Appointments...');
        await prisma.appointment.deleteMany({});

        console.log('Clearing Customers...');
        await prisma.customer.deleteMany({});

        console.log('Clearing Stylists...');
        await prisma.stylist.deleteMany({});

        console.log('Clearing Services...');
        await prisma.service.deleteMany({});

        console.log('Clearing Categories...');
        await prisma.category.deleteMany({});

        console.log('Clearing Expenses...');
        await prisma.expense.deleteMany({});

        console.log('Clearing Settings...');
        await prisma.settings.deleteMany({});

        console.log('Clearing Subscriptions...');
        await prisma.subscription.deleteMany({});

        console.log('Clearing SubscriptionPlans...');
        await prisma.subscriptionPlan.deleteMany({});

        console.log('Clearing Users (salon backend only - NOT AuthService users)...');
        await prisma.user.deleteMany({});

        // Re-enable foreign key checks
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

        console.log('\n✅ Database cleared successfully!');
        console.log('📝 Note: AuthService tables (apps, users, otp_logs, refresh_tokens) were NOT affected.');

    } catch (error) {
        console.error('❌ Error clearing database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

clearDatabase()
    .then(() => {
        console.log('\n✨ Database cleanup complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed to clear database:', error);
        process.exit(1);
    });
