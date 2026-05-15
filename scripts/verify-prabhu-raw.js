const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- RAW SQL VERIFICATION ---');

    // 1. Get Prabhu's User Record
    const users = await prisma.$queryRaw`SELECT id, authId, role FROM \`users\` WHERE \`email\` = 'prabhu@gmail.com' OR \`businessEmail\` = 'prabhu@gmail.com'`;
    console.log('User Record:', JSON.stringify(users, null, 2));

    if (users.length > 0) {
        const prabhuAuthId = users[0].authId;

        // 2. Get Prabhu's Stylist Record
        const stylists = await prisma.$queryRawUnsafe('SELECT * FROM `stylists` WHERE `authId` = ?', prabhuAuthId);
        console.log('Stylist Record:', JSON.stringify(stylists, null, 2));

        if (stylists.length > 0) {
            const adminId = stylists[0].adminId;

            // 3. Verify Admin is a real User with role ADMIN
            const admins = await prisma.$queryRawUnsafe('SELECT id, email, businessEmail, role FROM `users` WHERE `id` = ?', adminId);
            console.log('Linked Admin:', JSON.stringify(admins, null, 2));

            if (admins.length > 0 && admins[0].role === 'ADMIN') {
                console.log('✅ PASS: Business link is correct (points to internal User.id of an ADMIN)');
            } else {
                console.log('❌ FAIL: Linked record is not an ADMIN or points to an authId.');
            }
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
