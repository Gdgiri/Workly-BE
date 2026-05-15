
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Starting Multi-Tenancy Verification...');

    // Use a known existing Admin ID or a dummy UUID for testing strict persistence
    // We'll use a random UUID to ensure we don't accidentally link to real data, 
    // but for "Read" tests we might need real data. 
    // For this test, we are verifying WRITE capability of adminId.
    const TEST_ADMIN_ID = 'test-admin-uuid-' + Date.now();
    const TEST_AUTH_ID = 'test-auth-uuid-' + Date.now();

    console.log(`ℹ️ Test Context: AdminId=${TEST_ADMIN_ID}, AuthId=${TEST_AUTH_ID}`);

    try {
        // 1. Verify InventoryMovement
        console.log('\n1️⃣ Verifying InventoryMovement...');
        // We need a product first
        const product = await prisma.product.create({
            data: {
                name: 'Test Product ' + Date.now(),
                category: 'Test',
                sku: 'SKU-' + Date.now(),
                price: 100,
                stock: 10,
                authId: TEST_AUTH_ID,
                adminId: TEST_ADMIN_ID,
                isActive: false // cleanup marker
            }
        });

        const movement = await prisma.inventoryMovement.create({
            data: {
                productId: product.id,
                type: 'TEST',
                quantity: 10,
                balanceAfter: 10,
                authId: TEST_AUTH_ID,
                adminId: TEST_ADMIN_ID, // FIELD BEING TESTED
                remarks: 'Multi-tenancy test'
            }
        });

        if (movement.adminId === TEST_ADMIN_ID) {
            console.log('✅ InventoryMovement stored adminId correctly.');
        } else {
            console.error('❌ InventoryMovement FAILED to store adminId.');
        }

        // 2. Verify Expense
        console.log('\n2️⃣ Verifying Expense...');
        const expense = await prisma.expense.create({
            data: {
                title: 'Test Expense',
                amount: 50,
                category: 'Test',
                authId: TEST_AUTH_ID,
                adminId: TEST_ADMIN_ID // FIELD BEING TESTED
            }
        });

        if (expense.adminId === TEST_ADMIN_ID) {
            console.log('✅ Expense stored adminId correctly.');
        } else {
            console.error('❌ Expense FAILED to store adminId.');
        }

        // 3. Verify Reconciliation
        console.log('\n3️⃣ Verifying Reconciliation...');
        const reconciliation = await prisma.reconciliation.create({
            data: {
                systemTotal: 100,
                countedTotal: 100,
                difference: 0,
                status: 'MATCHED',
                cashier: 'Tester',
                paymentBreakdown: {},
                authId: TEST_AUTH_ID,
                adminId: TEST_ADMIN_ID // FIELD BEING TESTED
            }
        });

        if (reconciliation.adminId === TEST_ADMIN_ID) {
            console.log('✅ Reconciliation stored adminId correctly.');
        } else {
            console.error('❌ Reconciliation FAILED to store adminId.');
        }

        // 4. Verify Voucher
        console.log('\n4️⃣ Verifying Voucher...');
        const voucher = await prisma.voucher.create({
            data: {
                code: 'TEST-' + Date.now(),
                value: 10,
                expiryDate: new Date(),
                authId: TEST_AUTH_ID,
                adminId: TEST_ADMIN_ID // FIELD BEING TESTED
            }
        });

        if (voucher.adminId === TEST_ADMIN_ID) {
            console.log('✅ Voucher stored adminId correctly.');
        } else {
            console.error('❌ Voucher FAILED to store adminId.');
        }

        // Clean up
        console.log('\n🧹 Cleaning up test data...');
        await prisma.inventoryMovement.delete({ where: { id: movement.id } });
        await prisma.product.delete({ where: { id: product.id } });
        await prisma.expense.delete({ where: { id: expense.id } });
        await prisma.reconciliation.delete({ where: { id: reconciliation.id } });
        await prisma.voucher.delete({ where: { id: voucher.id } });
        console.log('✨ Cleanup complete.');

    } catch (error) {
        console.error('🚨 Verification Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
