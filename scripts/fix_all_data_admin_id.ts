
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The Auth ID that currently exists in the `adminId` column of the data (from screenshot)
const OLD_ADMIN_ID = 'c3d14ddf-9da1-4464-b7ae-5a2f92f2d046';

// The Auth ID used to look up the user
const TARGET_AUTH_ID = 'c3d14ddf-9da1-4464-b7ae-5a2f92f2d046';

async function main() {
    console.log(`🔍 Finding User DB ID for Auth ID: ${TARGET_AUTH_ID}...`);

    const user = await prisma.user.findUnique({
        where: { authId: TARGET_AUTH_ID },
    });

    if (!user) {
        console.error('❌ User not found!');
        return;
    }

    const NEW_ADMIN_ID = user.id;
    console.log(`✅ Found User DB ID (Target): ${NEW_ADMIN_ID}`);
    console.log(`⚠️  Old Admin ID (Source): ${OLD_ADMIN_ID}`);

    if (NEW_ADMIN_ID === OLD_ADMIN_ID) {
        console.log('⚠️ IDs match. Data stored with this ID *should* be visible if the system is querying with this ID.');
        console.log('If data is still invisible, consider if the system is using a DIFFERENT mechanism.');
    }

    // Helper to safely update
    const migrateTable = async (modelName: string, model: any) => {
        try {
            console.log(`🔄 Migrating ${modelName}...`);

            // Special case for Settings (Unique Constraint)
            if (modelName === 'Settings') {
                // Check if settings already exist for new ID
                const existing = await model.findUnique({ where: { adminId: NEW_ADMIN_ID } });
                if (existing) {
                    console.log(`   ⚠️ Settings already exist for new ID. Deleting them to allow migration...`);
                    await model.delete({ where: { adminId: NEW_ADMIN_ID } });
                }
            }

            const result = await model.updateMany({
                where: { adminId: OLD_ADMIN_ID },
                data: { adminId: NEW_ADMIN_ID }
            });
            console.log(`   ✅ ${modelName}: Updated ${result.count} records.`);
        } catch (e: any) {
            console.error(`   ❌ ${modelName}: Failed - ${e.message}`);
        }
    };

    console.log('------------------------------------------------');
    console.log('🚀 Starting Full Data Migration...');
    console.log('------------------------------------------------');

    await migrateTable('Settings', prisma.settings);
    await migrateTable('Service', prisma.service);
    await migrateTable('Stylist', prisma.stylist);
    await migrateTable('Appointment', prisma.appointment);
    await migrateTable('Customer', prisma.customer);
    await migrateTable('Product', prisma.product);
    await migrateTable('InventoryMovement', prisma.inventoryMovement);
    await migrateTable('Package', prisma.package);
    await migrateTable('CustomerPackage', prisma.customerPackage);
    await migrateTable('Expense', prisma.expense);
    await migrateTable('Payment', prisma.payment);
    await migrateTable('Sale', prisma.sale);
    await migrateTable('Reconciliation', prisma.reconciliation);
    await migrateTable('ReconciliationAudit', prisma.reconciliationAudit);
    await migrateTable('Voucher', prisma.voucher);
    await migrateTable('VoucherClaim', prisma.voucherClaim);
    await migrateTable('Category', prisma.category);
    await migrateTable('MessageLog', prisma.messageLog);

    console.log('------------------------------------------------');
    console.log('✅ Migration Job Complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
