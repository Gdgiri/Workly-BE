import prisma from '../src/prisma';

async function main() {
    console.log('--- Debugging "Beard Trim" issue ---');

    // Check Services
    const services = await prisma.service.findMany({
        where: { name: { contains: 'Beard' } }
    });
    console.log('\nServices matching "Beard":');
    console.table(services.map(s => ({ id: s.id, name: s.name, adminId: s.adminId, isActive: s.isActive })));

    // Check Sales
    const sales = await prisma.sale.findMany({
        where: {
            items: {
                contains: 'Beard'
            }
        },
        take: 10
    });

    console.log('\nSales containing "Beard" in items (Top 10):');
    sales.forEach(s => {
        console.log(`Sale ID: ${s.id}, SaleNumber: ${s.saleNumber}, AdminId: ${s.adminId}`);
        try {
            const items = typeof s.items === 'string' ? JSON.parse(s.items) : s.items;
            console.log('Items:', JSON.stringify(items, null, 2));
        } catch (e) {
            console.log('Items Raw:', s.items);
        }
        console.log('---');
    });

    // Count total occurrences in sales
    const allSales = await prisma.sale.findMany({
        select: { items: true, adminId: true }
    });

    const beardSalesCount = new Map<string, number>();
    allSales.forEach(s => {
        const itemsRaw = s.items;
        const itemsStr = typeof itemsRaw === 'string' ? itemsRaw : JSON.stringify(itemsRaw);
        if (itemsStr.includes('Beard Trim')) {
            beardSalesCount.set(s.adminId || 'unknown', (beardSalesCount.get(s.adminId || 'unknown') || 0) + 1);
        }
    });

    console.log('\nBeard Trim Sales Count by AdminId:');
    beardSalesCount.forEach((count, adminId) => {
        console.log(`AdminId: ${adminId}, Count: ${count}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
