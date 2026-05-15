
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚨 STARTING DATABASE CLEANUP (Preserving ADMINs) 🚨');

    try {
        // 1. Transactional Data (Delete All)
        console.log('🗑️  Deleting Transactional Data...');
        await prisma.inventoryMovement.deleteMany({});
        console.log('   - Inventory Movements deleted');

        await prisma.payment.deleteMany({});
        console.log('   - Payments deleted');

        await prisma.sale.deleteMany({});
        console.log('   - Sales deleted');

        await prisma.voucherClaim.deleteMany({});
        console.log('   - Voucher Claims deleted');

        await prisma.voucher.deleteMany({});
        console.log('   - Vouchers deleted');

        await prisma.expense.deleteMany({});
        console.log('   - Expenses deleted');

        await prisma.reconciliation.deleteMany({});
        console.log('   - Reconciliations deleted');

        await prisma.customerPackage.deleteMany({});
        console.log('   - Customer Packages deleted');

        await prisma.appointment.deleteMany({});
        console.log('   - Appointments deleted');


        // 2. Master Data (Delete All)
        console.log('🗑️  Deleting Master Data...');
        await prisma.product.deleteMany({});
        console.log('   - Products deleted');

        await prisma.package.deleteMany({});
        console.log('   - Packages deleted');

        await prisma.service.deleteMany({});
        console.log('   - Services deleted');

        await prisma.stylist.deleteMany({});
        console.log('   - Stylists deleted');

        await prisma.customer.deleteMany({});
        console.log('   - Customers deleted');

        await prisma.category.deleteMany({});
        console.log('   - Categories deleted');


        // 3. User & Settings Cleanup
        console.log('🗑️  Cleaning Users (Keeping ADMINs)...');

        // Find non-admin users to delete subscriptions for first
        const nonAdminUsers = await prisma.user.findMany({
            where: {
                role: {
                    not: 'ADMIN' // Keep standard ADMINs
                }
            },
            select: { id: true, subscriptionId: true }
        });

        const nonAdminUserIds = nonAdminUsers.map(u => u.id);
        const nonAdminSubscriptionIds = nonAdminUsers
            .map(u => u.subscriptionId)
            .filter((id): id is string => !!id);

        console.log(`   Found ${nonAdminUserIds.length} non-admin users to delete.`);

        // Delete associated subscriptions for non-admins
        if (nonAdminSubscriptionIds.length > 0) {
            await prisma.subscription.deleteMany({
                where: {
                    id: { in: nonAdminSubscriptionIds }
                }
            });
            console.log(`   - Deleted ${nonAdminSubscriptionIds.length} subscriptions for non-admins`);
        }

        // Delete non-admin settings if linked? Settings linked by unique adminId usually.
        // If we delete users, settings might orphan if not careful, checking Settings model:
        // model Settings { adminId String @unique ... }
        // It doesn't relation to User table directly via FK constraints usually shown in schema.
        // But we should clean settings that don't belong to remaining admins.
        // Actually, let's keep Settings for now to avoid complexity unless user explicitly asked,
        // but generally "clear db" implies it.
        // Let's delete settings where adminId is IN the list of deleted users. Note: adminId in Settings is usually the User.id.

        if (nonAdminUserIds.length > 0) {
            await prisma.settings.deleteMany({
                where: {
                    adminId: { in: nonAdminUserIds }
                }
            });
            console.log('   - Deleted settings for non-admin users');

            // Delete the users
            await prisma.user.deleteMany({
                where: {
                    id: { in: nonAdminUserIds }
                }
            });
            console.log(`   - Deleted ${nonAdminUserIds.length} non-admin users`);
        } else {
            console.log('   - No non-admin users found to delete.');
        }

        console.log('✅ DATABASE CLEANUP COMPLETE (Admins Preserved)');

    } catch (error) {
        console.error('❌ Cleanup Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
