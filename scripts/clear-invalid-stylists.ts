import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearInvalidStylists() {
    try {
        console.log('🗑️  Starting cleanup of invalid stylists...');

        // Find them again to get IDs
        const invalidStylists = await prisma.stylist.findMany({
            where: {
                OR: [
                    { authId: null },
                    { adminId: null }
                ]
            }
        });

        if (invalidStylists.length === 0) {
            console.log('✅ No invalid stylists found.');
            return;
        }

        console.log(`Found ${invalidStylists.length} stylists to delete.`);
        const invalidIds = invalidStylists.map(s => s.id);

        // Check for appointments
        const appointments = await prisma.appointment.findMany({
            where: {
                stylistId: { in: invalidIds }
            }
        });

        if (appointments.length > 0) {
            console.log(`⚠️  Found ${appointments.length} appointments linked to these stylists. Deleting appointments first...`);
            await prisma.appointment.deleteMany({
                where: {
                    stylistId: { in: invalidIds }
                }
            });
            console.log('✅ Linked appointments deleted.');
        }

        // Delete stylists
        const result = await prisma.stylist.deleteMany({
            where: {
                id: { in: invalidIds }
            }
        });

        console.log(`✅ Deleted ${result.count} invalid stylists.`);

        // Log details of deleted
        for (const s of invalidStylists) {
            console.log(`   - Deleted: ${s.name} (${s.email})`);
        }

    } catch (error) {
        console.error('❌ Error clearing stylists:', error);
    } finally {
        await prisma.$disconnect();
    }
}

clearInvalidStylists();
