import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const appointments = await prisma.appointment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
            service: true,
            stylist: true,
            customer: true
        }
    });

    console.log("LAST 10 APPOINTMENTS:");
    for (const app of appointments) {
        console.log(`ID: ${app.id}, Customer: ${app.customer?.name}, Service: ${app.service?.name}, Stylist: ${app.stylist?.name || 'NULL'}, Date: ${app.startTime}, AdminId: ${app.adminId}`);
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
