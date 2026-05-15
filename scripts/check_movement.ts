import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Fetching latest Inventory Movement...');
        const movement = await prisma.inventoryMovement.findFirst({
            orderBy: { createdAt: 'desc' },
            include: { product: true }
        });

        if (movement) {
            console.log('\n--- Latest Inventory Movement ---');
            console.log(`ID: ${movement.id}`);
            console.log(`Product: ${movement.product.name} (SKU: ${movement.product.sku})`);
            console.log(`Type: ${movement.type}`);
            console.log(`Quantity: ${movement.quantity}`);
            console.log(`Remarks: ${movement.remarks}`);
            console.log(`Created At: ${movement.createdAt}`);
            console.log('---------------------------------\n');
            console.log('NOTE: Verify that "Remarks" contains your comment.');
        } else {
            console.log('No inventory movements found.');
        }
    } catch (e) {
        console.error('Error fetching movement:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
