import { PrismaClient, PaymentMethod } from '@prisma/client';
import { resolvePaymentMethod, normalizePaymentMethod } from './src/services/payment.service';

const prisma = new PrismaClient();

async function migrate() {
    console.log('🚀 Starting Payment Method Migration...');

    // Find all payments currently marked as CASH
    const payments = await prisma.payment.findMany({
        where: {
            paymentMethod: 'CASH',
        },
    });

    console.log(`🔍 Found ${payments.length} CASH payments to check.`);

    let fixedCount = 0;

    for (const payment of payments) {
        // Look for "Method: [Name]" in notes
        const match = payment.notes?.match(/Method:\s*([^|]+)/i);
        if (match && match[1]) {
            const originalMethod = match[1].trim();
            const { method, notes } = resolvePaymentMethod(originalMethod);

            if (method !== 'CASH') {
                console.log(`✅ Fixing payment ${payment.id}: CASH -> ${method} (Original: ${originalMethod})`);

                await prisma.payment.update({
                    where: { id: payment.id },
                    data: {
                        paymentMethod: method as PaymentMethod,
                        // Update notes if resolvePaymentMethod added something new or keep existing
                    }
                });
                fixedCount++;
            }
        }
    }

    console.log(`\n✨ Migration complete! Fixed ${fixedCount} payments.`);
}

migrate()
    .catch((e) => {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
