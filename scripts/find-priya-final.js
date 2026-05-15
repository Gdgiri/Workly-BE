const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- USERS DUMP (keys only) ---');
    const users = await prisma.user.findMany({ take: 1 });
    if (users.length > 0) {
        console.log('User Keys:', Object.keys(users[0]));
        // Try to find by role and a known part of email if email exists
        const allUsers = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { id: true, authId: true, businessEmail: true }
        });
        console.log('Admins:', JSON.stringify(allUsers, null, 2));
    }

    console.log('--- STYLISTS DUMP ---');
    const stylists = await prisma.stylist.findMany({
        where: { name: 'prabhu' },
        select: { id: true, name: true, adminId: true, authId: true }
    });
    console.log('Prabhu Records:', JSON.stringify(stylists, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
