import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const settings = await prisma.settings.findFirst();
    if (settings) {
        const fraud: boolean = settings.fraudProtection;
        console.log('fraudProtection is defined in type:', fraud);
    }
}
