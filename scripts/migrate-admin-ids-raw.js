const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- STARTING RAW SQL ADMIN_ID MIGRATION ---');

    // 1. Get the mapping
    const users = await prisma.$queryRaw`SELECT id, authId FROM \`users\``;
    const authToInternalMap = new Map();
    users.forEach(u => {
        authToInternalMap.set(u.authId, u.id);
    });
    console.log(`Mapping size: ${authToInternalMap.size}`);

    // 2. Migrate stylists
    for (const [authId, internalId] of authToInternalMap) {
        const result = await prisma.$executeRawUnsafe(
            'UPDATE `stylists` SET `adminId` = ? WHERE `adminId` = ?',
            internalId, authId
        );
        if (result > 0) console.log(`Updated ${result} stylists for admin ${authId} -> ${internalId}`);
    }

    // 3. Migrate customers
    for (const [authId, internalId] of authToInternalMap) {
        const result = await prisma.$executeRawUnsafe(
            'UPDATE `customers` SET `adminId` = ? WHERE `adminId` = ?',
            internalId, authId
        );
        if (result > 0) console.log(`Updated ${result} customers for admin ${authId} -> ${internalId}`);
    }

    // 4. Migrate services
    for (const [authId, internalId] of authToInternalMap) {
        const result = await prisma.$executeRawUnsafe(
            'UPDATE `services` SET `adminId` = ? WHERE `adminId` = ?',
            internalId, authId
        );
        if (result > 0) console.log(`Updated ${result} services for admin ${authId} -> ${internalId}`);
    }

    console.log('--- RAW SQL MIGRATION COMPLETE ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
