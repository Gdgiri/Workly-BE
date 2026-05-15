import prisma from './src/prisma';

async function check() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        console.log('--- INDIVIDUAL SALES (TODAY) ---');
        const sales = await prisma.sale.findMany({
            where: { createdAt: { gte: today, lt: tomorrow } },
            include: { payments: true, appointment: { include: { customer: true } } }
        });

        sales.forEach(s => {
            const customer = s.appointment?.customer?.name || s.customerId || 'Unknown';
            console.log(`Sale ${s.id.slice(-6)} | Customer: ${customer} | Total: ${s.totalAmount} | Paid: ${s.paidAmount} | Cashier: ${s.createdBy}`);
            s.payments.forEach(p => {
                console.log(`  -> Payment: ${p.amount} | Cashier: ${p.cashierName} | Status: ${p.paymentStatus}`);
            });
        });

        console.log('\n--- ALL PAYMENTS (TODAY) ---');
        const payments = await prisma.payment.findMany({
            where: { createdAt: { gte: today, lt: tomorrow } }
        });

        payments.forEach(p => {
            console.log(`Payment ${p.id.slice(-6)} | Amount: ${p.amount} | Cashier: ${p.cashierName} | SaleId: ${p.saleId?.slice(-6) || 'None'}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
