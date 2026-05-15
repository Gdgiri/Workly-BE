
import prisma from '../src/prisma';

async function main() {
    console.log('Starting AdminID Backfill...');

    // 1. Products
    const products = await prisma.product.findMany({ where: { adminId: null } });
    console.log(`Found ${products.length} products to update.`);
    for (const p of products) {
        if (p.authId) {
            await prisma.product.update({
                where: { id: p.id },
                data: { adminId: p.authId }
            });
        }
    }

    // 2. Services
    const services = await prisma.service.findMany({ where: { adminId: null } });
    console.log(`Found ${services.length} services to update.`);
    for (const s of services) {
        if (s.authId) {
            await prisma.service.update({
                where: { id: s.id },
                data: { adminId: s.authId }
            });
        }
    }

    // 3. Packages
    const packages = await prisma.package.findMany({ where: { adminId: null } });
    console.log(`Found ${packages.length} packages to update.`);
    for (const p of packages) {
        if (p.authId) {
            await prisma.package.update({
                where: { id: p.id },
                data: { adminId: p.authId }
            });
        }
    }

    // 4. Customers (if applicable)
    // const customers = await prisma.customer.findMany({ where: { adminId: '' } }); 
    // console.log(`Found ${customers.length} customers to update.`);
    // Since adminId is REQUIRED for customers, no need to backfill.

    console.log('Backfill complete.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
