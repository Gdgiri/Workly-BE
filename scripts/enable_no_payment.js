const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Updating all settings to enable "Allow No Payment" by default...');

    try {
        const result = await prisma.settings.updateMany({
            data: {
                allowNoPayment: true
            }
        });

        console.log(`✅ Updated ${result.count} settings record(s)`);
        console.log('   "Allow No Payment (Credit)" is now enabled for all users');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
