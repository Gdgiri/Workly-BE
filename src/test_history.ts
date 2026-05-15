
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- START TEST ---');
    try {
        console.log('1. Checking connection...');
        // Simple query to wake it up
        await prisma.$queryRaw`SELECT 1`;
        console.log('   Connection OK');

        console.log('2. Counting InventoryMovements...');
        const count = await prisma.inventoryMovement.count();
        console.log('   Count:', count);

        console.log('3. Fetching History with Relation...');
        const history = await prisma.inventoryMovement.findMany({
            include: {
                product: {
                    select: { name: true, sku: true }
                }
            },
            take: 5
        });
        console.log('   Fetched items:', history.length);
        if (history.length > 0) {
            console.log('   Sample:', JSON.stringify(history[0]));
        }
    } catch (error) {
        console.error('--- ERROR OCCURRED ---');
        console.error(error);
    } finally {
        await prisma.$disconnect();
        console.log('--- END TEST ---');
    }
}

main();
