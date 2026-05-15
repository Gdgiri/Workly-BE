import prisma from '../prisma';

async function main() {
    console.log('🔍 Starting orphan appointment cleanup...');

    try {
        // 1. Get all appointments with their userIds
        const appointments = await prisma.appointment.findMany({
            select: {
                id: true,
                userId: true
            }
        });

        console.log(`📊 Found ${appointments.length} total appointments.`);

        // 2. Get all valid customer IDs
        const customers = await prisma.customer.findMany({
            select: { id: true }
        });

        const validCustomerIds = new Set(customers.map(c => c.id));
        console.log(`👥 Found ${customers.length} valid customers.`);

        // 3. Find orphans (appointments where userId is not in validCustomerIds)
        const orphans = appointments.filter(appt => !validCustomerIds.has(appt.userId));

        console.log(`⚠️ Found ${orphans.length} orphan appointments.`);

        if (orphans.length > 0) {
            console.log('🧹 Deleting orphans...');
            const orphanIds = orphans.map(o => o.id);

            const deleteResult = await prisma.appointment.deleteMany({
                where: {
                    id: { in: orphanIds }
                }
            });

            console.log(`✅ Successfully deleted ${deleteResult.count} orphan appointments.`);
        } else {
            console.log('✨ Database is clean! No orphan appointments found.');
        }

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
