const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- FINAL VERIFICATION ---');

    // 1. Find Prabhu in User table
    const prabhuUser = await prisma.user.findFirst({
        where: { email: 'prabhu@gmail.com' }
    });
    console.log('User Record:', JSON.stringify(prabhuUser, null, 2));

    if (prabhuUser) {
        // 2. Find Stylist record for Prabhu
        const prabhuStylist = await prisma.stylist.findFirst({
            where: { authId: prabhuUser.authId }
        });
        console.log('Stylist Record:', JSON.stringify(prabhuStylist, null, 2));

        if (prabhuStylist) {
            // 3. Check Admin link
            const admin = await prisma.user.findUnique({
                where: { id: prabhuStylist.adminId }
            });
            console.log('Linked Admin:', JSON.stringify(admin ? { id: admin.id, email: admin.businessEmail, role: admin.role } : 'NOT FOUND', null, 2));

            if (admin && admin.role === 'ADMIN') {
                console.log('✅ PASS: Prabhu is linked to the internal ID of an ADMIN.');
            } else {
                console.log('❌ FAIL: Admin link is incorrect (or linked to an authId).');
            }
        } else {
            console.log('❌ FAIL: No Stylist record found for Prabhu.');
        }
    } else {
        console.log('❌ FAIL: No User record found for Prabhu.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
