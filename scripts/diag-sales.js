const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    console.log(`Checking sales between ${today.toISOString()} and ${tomorrow.toISOString()}`);

    const sales = await prisma.sale.findMany({
        where: {
            createdAt: {
                gte: today,
                lt: tomorrow
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log('--- SALES FOUND TODAY ---');
    sales.forEach(s => {
        console.log(`Num: ${s.saleNumber} | AuthId: ${s.authId} | Total: ${s.totalAmount} | Time: ${s.createdAt.toISOString()}`);
    });
    console.log('-------------------------');
}

main().catch(console.error).finally(() => prisma.$disconnect());
