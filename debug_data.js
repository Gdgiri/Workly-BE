const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const stylist = await prisma.stylist.findFirst({
        where: { name: { contains: 'sathishkumar' } }
    });
    console.log('Stylist:', JSON.stringify(stylist, null, 2));

    const service = await prisma.service.findFirst({
        where: { name: { contains: 'Eyebrow Double lines' } }
    });
    console.log('Service:', JSON.stringify(service, null, 2));

    const appointments = await prisma.appointment.findMany({
        where: {
            stylistId: stylist?.id,
            startTime: {
                gte: new Date('2026-02-28T00:00:00Z'),
                lte: new Date('2026-02-28T23:59:59Z')
            }
        }
    });
    console.log('Appointments for 2026-02-28:', JSON.stringify(appointments, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
