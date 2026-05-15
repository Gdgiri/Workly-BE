const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const settings = await prisma.settings.findMany({
            select: {
                id: true,
                adminId: true,
                currency: true,
                salonName: true
            }
        });
        console.log('CURRENCY SETTINGS:', JSON.stringify(settings, null, 2));
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
