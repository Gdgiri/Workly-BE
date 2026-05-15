const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateStats() {
    try {
        const adminId = '6302dd5b-247d-47d5-95b3-d82d6bf02e62'; // From your logs
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const newCustomersTodayRaw = await prisma.customer.findMany({
            where: {
                adminId: adminId,
                createdAt: { gte: today, lt: tomorrow }
            },
            select: {
                id: true,
                name: true,
                email: true,
                city: true,
                createdAt: true,
                createdBy: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        const mapped = newCustomersTodayRaw.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            city: c.city,
            joinedAt: c.createdAt,
            createdBy: c.createdBy
        }));

        console.log('📦 Mapped New Customers Table:');
        console.table(mapped);

        console.log('\n🔍 Raw JSON of first customer:');
        console.log(JSON.stringify(mapped[0], null, 2));

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

simulateStats();
