import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    console.log('📊 Verifying Payment Categorization...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments = await prisma.payment.findMany({
        where: {
            createdAt: { gte: today }
        }
    });

    let stats = {
        totalCash: 0,
        totalDigital: 0,
        totalRevenue: 0,
        count: payments.length
    };

    payments.forEach(p => {
        stats.totalRevenue += p.amount;
        if (p.paymentMethod === 'CASH') {
            stats.totalCash += p.amount;
        } else {
            stats.totalDigital += p.amount;
        }
        console.log(`[${p.paymentMethod}] ${p.amount} | Notes: ${p.notes}`);
    });

    console.log('\n📈 Final Totals for Today:');
    console.log(JSON.stringify(stats, null, 2));

    // Also check for any remaining CASH payments with digital notes in the entire DB
    const miscategorized = await prisma.payment.findMany({
        where: {
            paymentMethod: 'CASH',
            notes: { contains: 'Method:' }
        }
    });

    if (miscategorized.length > 0) {
        console.log(`\n⚠️ Warning: Found ${miscategorized.length} payments marked as CASH but having "Method:" in notes.`);
    } else {
        console.log('\n✅ No miscategorized CASH payments found.');
    }
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
