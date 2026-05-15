import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const adminId = '6302dd5b-226a-47d5-95b3-d82d6bf02e62';
    const appointments = await prisma.appointment.findMany({
        where: {
            startTime: {
                gte: new Date('2026-03-01T00:00:00.000Z'),
                lte: new Date('2026-03-03T23:59:59.000Z')
            }
        },
        include: {
            service: true,
            stylist: true,
            customer: true
        }
    });

    console.log("MAR 2 APPOINTMENTS:");
    for (const app of appointments) {
        console.log(`ID: ${app.id}, Customer: ${app.customer?.name}, Service: ${app.service?.name}, Stylist: ${app.stylist?.name || 'NULL'}, Date: ${app.startTime}, Status: ${app.status}`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
