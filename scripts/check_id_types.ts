
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- CHECKING ID TYPES ---');

    // 1. Get the admin user we looked at before
    const adminAuthId = 'a1e235fc-d256-4223-971b-82b8e8589699'; // From previous log
    const adminDbId = '02d6ba2c-9089-4a71-bb89-3e8eb996f93c';   // From previous log

    const admin = await prisma.user.findFirst({
        where: { id: adminDbId }
    });
    console.log(`Admin DB ID: ${admin?.id}`);
    console.log(`Admin Auth ID: ${admin?.authId}`);

    // 2. Check a Stylist linked to this admin
    const stylist = await prisma.stylist.findFirst({
        where: { adminId: adminDbId } // Check if DB ID is used
    });

    if (stylist) {
        console.log(`✅ Found Stylist linked via DB ID: ${stylist.name}`);
        console.log(`Stylist.adminId: ${stylist.adminId}`);
    } else {
        console.log('❌ No Stylist found via DB ID. Checking Auth ID...');
        const stylistAuth = await prisma.stylist.findFirst({
            where: { adminId: adminAuthId }
        });
        if (stylistAuth) {
            console.log(`✅ Found Stylist linked via Auth ID: ${stylistAuth.name}`);
            console.log(`Stylist.adminId: ${stylistAuth.adminId}`);
        } else {
            console.log('❌ No Stylist found via Auth ID either.');
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
