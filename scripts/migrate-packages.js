const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- MIGRATING PACKAGE ADMIN_IDS ---');

    // 1. Get all users mapping authId -> id
    const users = await prisma.user.findMany({ select: { id: true, authId: true } });
    const map = new Map();
    users.forEach(u => map.set(u.authId, u.id));

    // 2. Get all packages
    const packages = await prisma.package.findMany();

    let count = 0;
    for (const p of packages) {
        if (map.has(p.adminId)) {
            const newAdminId = map.get(p.adminId);
            await prisma.package.update({
                where: { id: p.id },
                data: { adminId: newAdminId }
            });
            console.log(`Updated package ${p.name} (ID: ${p.id}): ${p.adminId} -> ${newAdminId}`);
            count++;
        }
    }

    console.log(`--- MIGRATION COMPLETE: ${count} packages updated ---`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
