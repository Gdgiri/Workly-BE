
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTodayData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Range:', today.toISOString(), 'to', tomorrow.toISOString());

    const sales = await prisma.sale.findMany({
        where: {
            createdAt: { gte: today, lt: tomorrow }
        },
        include: { appointment: true }
    });

    const appointments = await prisma.appointment.findMany({
        where: {
            startTime: { gte: today, lt: tomorrow }
        }
    });

    console.log('Total Sales Today:', sales.length);
    console.log('Sales with Appointments:', sales.filter(s => !!s.appointment).length);
    console.log('Sales without Appointments (Walk-ins):', sales.filter(s => !s.appointment).length);
    console.log('Total Appointments Today (startTime):', appointments.length);

    await prisma.$disconnect();
}

checkTodayData().catch(err => {
    console.error(err);
    process.exit(1);
});
