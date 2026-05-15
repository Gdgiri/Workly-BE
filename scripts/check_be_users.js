const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { authId: true, role: true, businessEmail: true }
    });
    console.log('Current users in salon_be1 db:', JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

main();
