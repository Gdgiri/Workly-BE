import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixNullAuthIds() {
    try {
        console.log('🔍 Finding customers with NULL authId...');

        const customersWithoutAuth = await prisma.customer.findMany({
            where: {
                authId: null
            }
        });

        console.log(`Found ${customersWithoutAuth.length} customers without authId`);

        if (customersWithoutAuth.length === 0) {
            console.log('✅ All customers have authId');
            return;
        }

        console.log('\n⚠️  These customers will be DELETED (cannot have NULL authId):');
        console.log('─'.repeat(80));

        for (const customer of customersWithoutAuth) {
            console.log(`   - ${customer.name} (${customer.email}) - ID: ${customer.id}`);
        }

        console.log('\n🗑️  Deleting customers without authId...');

        const result = await prisma.customer.deleteMany({
            where: {
                authId: null
            }
        });

        console.log(`✅ Deleted ${result.count} customers`);
        console.log('\n💡 These customers need to be re-created with proper authId');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixNullAuthIds();
