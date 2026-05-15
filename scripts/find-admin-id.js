const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const allUsers = await prisma.user.findMany({
        select: { id: true, authId: true, businessEmail: true, role: true }
    });

    const targetAuthId = 'be9be1e7-f338-4c94-8887-4027928e1833';
    const target = allUsers.find(u => u.authId === targetAuthId);

    if (target) {
        console.log('--- TARGET ADMIN FOUND ---');
        console.log(JSON.stringify(target, null, 2));
    } else {
        console.log('--- TARGET ADMIN NOT FOUND ---');
        console.log('Sample of users:', JSON.stringify(allUsers.slice(0, 5), null, 2));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
