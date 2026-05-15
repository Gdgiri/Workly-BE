const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const packages = await prisma.package.findMany({
        select: { id: true, name: true, adminId: true, authId: true, active: true }
    });
    console.log('--- PACKAGES ---');
    console.log(JSON.stringify(packages, null, 2));

    const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, businessEmail: true }
    });
    console.log('--- ADMINS ---');
    console.log(JSON.stringify(admins, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
