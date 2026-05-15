const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceUpdate() {
    try {
        console.log('🔄 Starting force update of createdBy field...');
        const result = await prisma.customer.updateMany({
            data: {
                createdBy: 'Business Admin'
            }
        });
        console.log(`✅ Successfully updated ${result.count} customers.`);

        const verification = await prisma.customer.findMany({
            take: 5,
            select: { name: true, createdBy: true }
        });
        console.log('📋 Verification of data:');
        console.log(JSON.stringify(verification, null, 2));
    } catch (err) {
        console.error('❌ Error during update:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

forceUpdate();
