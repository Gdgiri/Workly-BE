const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- RESOLVING DUPLICATES AND MIGRATING ---');

    // 1. Get the mapping
    const users = await prisma.user.findMany({
        select: { id: true, authId: true }
    });
    const authToInternalMap = new Map();
    users.forEach(u => {
        authToInternalMap.set(u.authId, u.id);
    });

    // 2. Fix Customers - resolve conflicts
    const customers = await prisma.customer.findMany();
    for (const c of customers) {
        if (authToInternalMap.has(c.adminId)) {
            const internalId = authToInternalMap.get(c.adminId);

            // Check if a record with internalId ALREADY exists for this email
            const existing = await prisma.customer.findFirst({
                where: {
                    email: c.email,
                    adminId: internalId
                }
            });

            if (existing) {
                console.log(`Conflict! Customer ${c.email} exists with both authID and internalID. Deleting authID version ${c.id}`);
                await prisma.customer.delete({ where: { id: c.id } });
            } else {
                console.log(`Migrating Customer ${c.email} adminId: ${c.adminId} -> ${internalId}`);
                await prisma.customer.update({
                    where: { id: c.id },
                    data: { adminId: internalId }
                });
            }
        }
    }

    // 3. Fix Stylists - resolve conflicts
    const stylists = await prisma.stylist.findMany();
    for (const s of stylists) {
        if (authToInternalMap.has(s.adminId)) {
            const internalId = authToInternalMap.get(s.adminId);

            const existing = await prisma.stylist.findFirst({
                where: {
                    email: s.email,
                    adminId: internalId
                }
            });

            if (existing) {
                console.log(`Conflict! Stylist ${s.email} exists with both authID and internalID. Deleting authID version ${s.id}`);
                await prisma.stylist.delete({ where: { id: s.id } });
            } else {
                console.log(`Migrating Stylist ${s.email} adminId: ${s.adminId} -> ${internalId}`);
                await prisma.stylist.update({
                    where: { id: s.id },
                    data: { adminId: internalId }
                });
            }
        }
    }

    // 4. Fix Services
    const services = await prisma.service.findMany();
    for (const sv of services) {
        if (sv.adminId && authToInternalMap.has(sv.adminId)) {
            const internalId = authToInternalMap.get(sv.adminId);
            console.log(`Migrating Service ${sv.name} adminId: ${sv.adminId} -> ${internalId}`);
            await prisma.service.update({
                where: { id: sv.id },
                data: { adminId: internalId }
            });
        }
    }

    console.log('--- MIGRATION AND CONFLICT RESOLUTION COMPLETE ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
