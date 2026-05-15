const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking all users in salon_be1...');

    const users = await prisma.user.findMany({
        select: {
            id: true,
            authId: true,
            role: true,
            businessEmail: true,
            businessName: true,
            subscriptionId: true
        }
    });

    console.log('Users found:', JSON.stringify(users, null, 2));

    await prisma.$disconnect();
}

main();
