import prisma from '../prisma';

async function main() {
    console.log('🔍 Starting comprehensive data diagnosis...');

    try {
        const appointments = await prisma.appointment.findMany();
        console.log(`📊 Total Appointments: ${appointments.length}`);

        // 1. Check Service Relations
        const services = await prisma.service.findMany({ select: { id: true } });
        const validServiceIds = new Set(services.map(s => s.id));
        const invalidService = appointments.filter(a => !validServiceIds.has(a.serviceId));
        console.log(`🛠️ Appointments with invalid Service: ${invalidService.length}`);
        if (invalidService.length > 0) console.log(invalidService.map(a => a.id));

        // 2. Check Stylist Relations
        const stylists = await prisma.stylist.findMany({ select: { id: true } });
        const validStylistIds = new Set(stylists.map(s => s.id));
        const invalidStylist = appointments.filter(a => !validStylistIds.has(a.stylistId));
        console.log(`💇 Appointments with invalid Stylist: ${invalidStylist.length}`);
        if (invalidStylist.length > 0) console.log(invalidStylist.map(a => a.id));

        // 3. Check Customer Relations
        const customers = await prisma.customer.findMany({ select: { id: true } });
        const validCustomerIds = new Set(customers.map(c => c.id));
        const invalidCustomer = appointments.filter(a => !validCustomerIds.has(a.userId));
        console.log(`👥 Appointments with invalid Customer: ${invalidCustomer.length}`);
        if (invalidCustomer.length > 0) {
            console.log(invalidCustomer.map(a => ({ id: a.id, createdAt: a.createdAt, userId: a.userId })));
        }

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
