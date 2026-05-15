const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicateSettings() {
    try {
        console.log('🔍 Checking for duplicate settings entries...');

        // Get all settings
        const allSettings = await prisma.settings.findMany({
            select: {
                id: true,
                adminId: true,
                createdAt: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        console.log(`Found ${allSettings.length} settings entries:`);
        allSettings.forEach(s => {
            console.log(`  - adminId: ${s.adminId}, created: ${s.createdAt}`);
        });

        // Delete the 'admin-1' entry if it exists and there's another entry
        if (allSettings.length > 1) {
            const admin1Entry = allSettings.find(s => s.adminId === 'admin-1');

            if (admin1Entry) {
                console.log(`\n🗑️  Deleting duplicate 'admin-1' entry...`);
                await prisma.settings.delete({
                    where: { id: admin1Entry.id }
                });
                console.log('✅ Duplicate entry removed successfully!');
            } else {
                console.log('\n⚠️  No "admin-1" entry found to remove.');
            }
        } else {
            console.log('\n✅ No duplicate entries found.');
        }

        // Show remaining settings
        const remainingSettings = await prisma.settings.findMany({
            select: {
                id: true,
                adminId: true,
                createdAt: true
            }
        });

        console.log(`\n📊 Remaining settings entries: ${remainingSettings.length}`);
        remainingSettings.forEach(s => {
            console.log(`  - adminId: ${s.adminId}, created: ${s.createdAt}`);
        });

    } catch (error) {
        console.error('❌ Error cleaning up settings:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupDuplicateSettings();
