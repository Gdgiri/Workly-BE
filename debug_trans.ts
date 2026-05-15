import prisma from './src/prisma';

async function check() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        console.log('--- DATE RANGE ---');
        console.log('Today:', today.toISOString());
        console.log('Tomorrow:', tomorrow.toISOString());

        const sales = await prisma.sale.findMany({
            where: {
                createdAt: { gte: today, lt: tomorrow }
            },
            include: {
                payments: true
            }
        });

        const payments = await prisma.payment.findMany({
            where: {
                createdAt: { gte: today, lt: tomorrow }
            }
        });

        console.log('\n--- SALES ---');
        console.log(JSON.stringify(sales, null, 2));

        console.log('\n--- PAYMENTS ---');
        console.log(JSON.stringify(payments, null, 2));

    } catch (e) {
        console.error('Error during check:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
