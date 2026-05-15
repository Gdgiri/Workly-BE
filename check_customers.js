
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTodayCustomers() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Today Range (Local):', today.toString(), 'to', tomorrow.toString());
    console.log('Today Range (ISO):', today.toISOString(), 'to', tomorrow.toISOString());

    try {
        const allCustomers = await prisma.customer.findMany({
            select: { id: true, name: true, createdAt: true, adminId: true }
        });

        console.log(`Total Customers in DB: ${allCustomers.length}`);

        const todayCustomers = allCustomers.filter(c => {
            const d = new Date(c.createdAt);
            return d >= today && d < tomorrow;
        });

        console.log(`Customers created today (filtered in JS): ${todayCustomers.length}`);
        todayCustomers.forEach(c => {
            console.log(`- ${c.name} (${c.id}) Admin: ${c.adminId} CreatedAt: ${c.createdAt.toISOString()}`);
        });

        // Try the same query with Prisma
        // We need to know an adminId to test correctly. Let's find one.
        const sampleAdminId = allCustomers.length > 0 ? allCustomers[0].adminId : null;
        if (sampleAdminId) {
            console.log(`Testing Prisma query for adminId: ${sampleAdminId}`);
            const prismaToday = await prisma.customer.findMany({
                where: {
                    adminId: sampleAdminId,
                    createdAt: { gte: today, lt: tomorrow }
                }
            });
            console.log(`Prisma query result count: ${prismaToday.length}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

checkTodayCustomers();
