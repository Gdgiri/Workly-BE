const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STYLIST COLUMNS (FULL) ---');
    const stylist = await prisma.$queryRaw`SELECT * FROM \`stylists\` LIMIT 1`;
    const keys = Object.keys(stylist[0] || {});
    keys.forEach(k => console.log(`COL: ${k}`));

    console.log('--- LOOKING FOR SPECIFIC KEYS ---');
    ['adminId', 'name', 'email', 'authId'].forEach(k => {
        console.log(`${k} exists: ${keys.includes(k)}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
