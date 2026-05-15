const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSettings() {
    const settings = await prisma.settings.findMany({
        select: { id: true, adminId: true, createdAt: true }
    });
    console.log('Settings entries:', JSON.stringify(settings, null, 2));
    await prisma.$disconnect();
}

checkSettings();
