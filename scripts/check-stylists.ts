import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStylists() {
    try {
        console.log('🔍 Checking Stylist table for null values...');

        const allStylists = await prisma.stylist.findMany();
        console.log(`Total stylists found: ${allStylists.length}`);

        const invalidStylists = await prisma.stylist.findMany({
            where: {
                OR: [
                    { authId: null },
                    { adminId: null }
                ]
            }
        });

        console.log(`\n⚠️  Found ${invalidStylists.length} stylists with NULL authId or adminId:`);
        console.log('─'.repeat(80));

        for (const stylist of invalidStylists) {
            console.log(`   - Name: ${stylist.name}`);
            console.log(`     Email: ${stylist.email}`);
            console.log(`     ID: ${stylist.id}`);
            console.log(`     authId: ${stylist.authId}`);
            console.log(`     adminId: ${stylist.adminId}`);
            console.log('---');
        }

        if (invalidStylists.length > 0) {
            console.log('\n💡 These records match the criteria for "null value" and can be cleared.');
        } else {
            console.log('\n✅ No stylists found with null authId or adminId.');
        }

    } catch (error) {
        console.error('❌ Error checking stylists:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkStylists();
