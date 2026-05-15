import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStylistAdminId() {
    console.log('🔧 Starting stylist adminId fix...\n');

    // Step 1: Check current state
    const stylistsWithoutBusiness = await prisma.stylist.findMany({
        where: { adminId: null },
        select: { id: true, name: true, email: true, adminId: true }
    });

    console.log(`Found ${stylistsWithoutBusiness.length} stylists without business link`);

    if (stylistsWithoutBusiness.length === 0) {
        console.log('✅ All stylists already have adminId set!');
        await prisma.$disconnect();
        return;
    }

    // Step 2: Get first admin user
    const firstAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true, email: true }
    });

    if (!firstAdmin) {
        console.error('❌ No ADMIN user found! Cannot link stylists.');
        await prisma.$disconnect();
        process.exit(1);
    }

    console.log(`\n✅ Found admin: ${firstAdmin.email} (${firstAdmin.id})`);
    console.log(`\n🔄 Linking ${stylistsWithoutBusiness.length} stylists to this admin...\n`);

    // Step 3: Update all stylists
    const result = await prisma.stylist.updateMany({
        where: { adminId: null },
        data: { adminId: firstAdmin.id }
    });

    console.log(`✅ Updated ${result.count} stylists\n`);

    // Step 4: Verify
    const stillMissing = await prisma.stylist.findMany({
        where: { adminId: null },
        select: { id: true, name: true, email: true }
    });

    if (stillMissing.length === 0) {
        console.log('✅ SUCCESS: All stylists now have adminId!\n');
    } else {
        console.error(`⚠️ WARNING: ${stillMissing.length} stylists still missing adminId`);
    }

    // Show final state
    const allStylists = await prisma.stylist.findMany({
        select: { id: true, name: true, email: true, adminId: true }
    });

    console.log('📊 Final stylist state:');
    allStylists.forEach(s => {
        const status = s.adminId ? '✅' : '❌';
        console.log(`  ${status} ${s.name} (${s.email}) - adminId: ${s.adminId || 'NULL'}`);
    });

    await prisma.$disconnect();
}

fixStylistAdminId()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .then(() => {
        console.log('\n✅ Migration complete!');
        process.exit(0);
    });
