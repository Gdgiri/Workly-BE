const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmins() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const customers = await prisma.customer.findMany({
            where: { createdAt: { gte: today } },
            select: { adminId: true, name: true, createdBy: true }
        });

        const adminIds = [...new Set(customers.map(c => c.adminId))];
        console.log('👤 Admin IDs with customers today:', adminIds);
        console.log('📊 Total customers found today:', customers.length);
        console.log('📝 First 3 customers JSON:', JSON.stringify(customers.slice(0, 3), null, 2));
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkAdmins();
