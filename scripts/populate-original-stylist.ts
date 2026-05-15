import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateOriginalStylistId() {
    console.log('🔄 Starting to populate originalStylistId for existing appointments...');

    try {
        // Get all appointments where originalStylistId is null
        const appointments = await prisma.appointment.findMany({
            where: {
                originalStylistId: null
            },
            select: {
                id: true,
                stylistId: true
            }
        });

        console.log(`📊 Found ${appointments.length} appointments without originalStylistId`);

        if (appointments.length === 0) {
            console.log('✅ All appointments already have originalStylistId set!');
            return;
        }

        // Update each appointment to set originalStylistId to current stylistId
        let updated = 0;
        for (const appointment of appointments) {
            await prisma.appointment.update({
                where: { id: appointment.id },
                data: { originalStylistId: appointment.stylistId }
            });
            updated++;
            console.log(`✓ Updated appointment ${appointment.id} (${updated}/${appointments.length})`);
        }

        console.log(`✅ Successfully populated originalStylistId for ${updated} appointments!`);
    } catch (error) {
        console.error('❌ Error populating originalStylistId:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

populateOriginalStylistId()
    .then(() => {
        console.log('🎉 Migration complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });
