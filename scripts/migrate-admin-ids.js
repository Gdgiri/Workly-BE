const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING ADMIN_ID MIGRATION ---');

    // 1. Get all users to create a map of authId -> internalId
    const users = await prisma.user.findMany({
        select: { id: true, authId: true, businessEmail: true, role: true }
    });

    const authToInternalMap = new Map();
    users.forEach(u => {
        authToInternalMap.set(u.authId, u.id);
    });

    console.log(`Found ${users.length} users. ${authToInternalMap.size} authId mappings created.`);

    // 2. Fix Stylists
    const stylists = await prisma.stylist.findMany();
    let stylistUpdates = 0;
    for (const s of stylists) {
        if (authToInternalMap.has(s.adminId)) {
            const newAdminId = authToInternalMap.get(s.adminId);
            console.log(`Updating Stylist ${s.name}: adminId ${s.adminId} -> ${newAdminId}`);
            await prisma.stylist.update({
                where: { id: s.id },
                data: { adminId: newAdminId }
            });
            stylistUpdates++;
        }
    }
    console.log(`Updated ${stylistUpdates} stylist records.`);

    // 3. Fix Customers
    const customers = await prisma.customer.findMany();
    let customerUpdates = 0;
    for (const c of customers) {
        if (authToInternalMap.has(c.adminId)) {
            const newAdminId = authToInternalMap.get(c.adminId);
            console.log(`Updating Customer ${c.name}: adminId ${c.adminId} -> ${newAdminId}`);
            await prisma.customer.update({
                where: { id: c.id },
                data: { adminId: newAdminId }
            });
            customerUpdates++;
        }
    }
    console.log(`Updated ${customerUpdates} customer records.`);

    // 4. Fix Services (Some might be linked to authId)
    const services = await prisma.service.findMany();
    let serviceUpdates = 0;
    for (const sv of services) {
        if (sv.adminId && authToInternalMap.has(sv.adminId)) {
            const newAdminId = authToInternalMap.get(sv.adminId);
            console.log(`Updating Service ${sv.name}: adminId ${sv.adminId} -> ${newAdminId}`);
            await prisma.service.update({
                where: { id: sv.id },
                data: { adminId: newAdminId }
            });
            serviceUpdates++;
        }
    }
    console.log(`Updated ${serviceUpdates} service records.`);

    console.log('--- MIGRATION COMPLETE ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
