import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function linkExistingAuthAccounts() {
    try {
        console.log('🔍 Finding customers without authId...');

        // Get customers without authId
        const customersWithoutAuth = await prisma.customer.findMany({
            where: {
                authId: null
            }
        });

        console.log(`Found ${customersWithoutAuth.length} customers without authId`);

        if (customersWithoutAuth.length === 0) {
            console.log('✅ All customers already have authId');
            return;
        }

        console.log('\n📋 Customers without authId:');
        console.log('─'.repeat(80));

        for (const customer of customersWithoutAuth) {
            console.log(`\n👤 Customer: ${customer.name} (${customer.email})`);
            console.log(`   ⚠️  Email exists in AuthService but we cannot retrieve the ID`);
            console.log(`   💡 Options:`);
            console.log(`      1. Admin can manually update authId in database`);
            console.log(`      2. Customer can reset password via auth service`);
            console.log(`      3. Leave as NULL - customer can still be managed without login`);
        }

        console.log('\n' + '─'.repeat(80));
        console.log('ℹ️  Summary:');
        console.log(`   - Customers with authId: ${await prisma.customer.count({ where: { authId: { not: null } } })}`);
        console.log(`   - Customers without authId: ${customersWithoutAuth.length}`);
        console.log(`   - All customers have adminId: ${await prisma.customer.count({ where: { adminId: { not: null } } })}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

linkExistingAuthAccounts();
