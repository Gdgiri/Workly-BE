const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndFix() {
    try {
        const customers = await prisma.customer.findMany({
            where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
            select: { id: true, name: true, createdBy: true }
        });
        console.log('👥 Daily Customers:', JSON.stringify(customers, null, 2));

        // Let's fix null ones to "Admin" for visibility
        const nullCreators = customers.filter(c => !c.createdBy);
        if (nullCreators.length > 0) {
            console.log(`🔧 Fixing ${nullCreators.length} records with null createdBy...`);
            await prisma.customer.updateMany({
                where: { id: { in: nullCreators.map(c => c.id) } },
                data: { createdBy: 'Business Admin' }
            });
            console.log('✅ Fix applied.');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkAndFix();
