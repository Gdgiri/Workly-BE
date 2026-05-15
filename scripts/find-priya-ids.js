const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        where: { email: { contains: 'priyamohan' } }
    });
    console.log('--- USER DATA ---');
    console.log(JSON.stringify(users, null, 2));

    const stylists = await prisma.stylist.findMany({
        where: { email: { contains: 'prabhu' } }
    });
    console.log('--- PRABHU STYLIST DATA ---');
    console.log(JSON.stringify(stylists, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
