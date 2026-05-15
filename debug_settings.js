const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const settings = await prisma.settings.findMany();
        console.log('ALL SETTINGS:', JSON.stringify(settings, null, 2));

        const count = await prisma.settings.count();
        console.log('SETTINGS COUNT:', count);
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
