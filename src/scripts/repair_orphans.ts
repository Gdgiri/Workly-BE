import prisma from '../prisma';

async function main() {
    console.log('🔧 Starting orphan repair...');

    try {
        // 1. Find orphan appointments
        const appointments = await prisma.appointment.findMany();
        const customers = await prisma.customer.findMany({ select: { id: true } });
        const validCustomerIds = new Set(customers.map(c => c.id));

        const orphans = appointments.filter(a => !validCustomerIds.has(a.userId));
        console.log(`⚠️ Found ${orphans.length} orphan appointments.`);

        if (orphans.length === 0) {
            console.log('✅ No orphans to repair.');
            return;
        }

        const orphanUserIds = [...new Set(orphans.map(o => o.userId))];
        console.log(`👥 Found ${orphanUserIds.length} unique users with missing customer profiles.`);

        for (const userId of orphanUserIds) {
            try {
                // 2. Try to find the user in the 'users' table (using raw query since it's not in Prisma model)
                const users = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}` as any[];
                const user = Array.isArray(users) ? users[0] : null;

                if (user) {
                    console.log(`👤 Found matching User record: ${user.name} (${user.email})`);

                    // 3. Create missing Customer record
                    // Handle potential nulls
                    const email = user.email || `missing_email_${userId}@placeholder.com`;
                    const phone = user.phone_number || null;
                    const name = user.name || 'Unknown';

                    await prisma.$executeRaw`
                        INSERT INTO customers (id, name, email, phone, created_at, updated_at)
                        VALUES (${user.id}, ${name}, ${email}, ${phone}, NOW(), NOW())
                    `;
                    console.log(`✅ Restored Customer profile for user: ${userId}`);
                } else {
                    console.log(`❌ User ${userId} not found in users table. Deleting associated appointments...`);
                    await prisma.appointment.deleteMany({
                        where: { userId }
                    });
                    console.log(`🗑️ Deleted appointments for non-existent user ${userId}`);
                }
            } catch (err) {
                console.error(`⚠️ Failed to process user ${userId}:`, (err as Error).message);
            }
        }

    } catch (error) {
        console.error('❌ Repair failed:', error);
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
