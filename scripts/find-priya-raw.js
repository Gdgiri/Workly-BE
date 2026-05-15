const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- RAW USER DATA ---');
    const users = await prisma.$queryRaw`SELECT id, email, authId, role FROM users WHERE email LIKE '%priyamohan%'`;
    console.log(JSON.stringify(users, null, 2));

    console.log('--- RAW STYLIST DATA ---');
    const stylists = await prisma.$queryRaw`SELECT id, name, email, adminId, authId FROM stylists WHERE name LIKE '%prabhu%'`;
    console.log(JSON.stringify(stylists, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
