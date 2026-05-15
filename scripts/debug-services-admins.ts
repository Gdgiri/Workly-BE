
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Debugging Service visibility...');

    // 1. Fetch all services
    const services = await prisma.service.findMany({
        select: {
            id: true,
            name: true,
            adminId: true,
            authId: true,
            isActive: true
        }
    });

    console.log(`\n📋 Found ${services.length} Services:`);
    services.forEach(s => {
        console.log(`   - [${s.name}] (ID: ${s.id}) -> AdminID: ${s.adminId} | Active: ${s.isActive}`);
    });

    // Test specific query for the user we saw in logs
    const targetAdminId = 'be9be1e7-f338-4c94-8887-4027928e1833';
    console.log(`\n🧪 Testing strict query for Admin: ${targetAdminId}`);

    const myServices = await prisma.service.findMany({
        where: {
            isActive: true,
            adminId: targetAdminId
        }
    });
    console.log(`   -> Query returned ${myServices.length} active services.`);

    if (myServices.length === 0) {
        console.log('   ⚠️  No active services found! Checking inactive ones...');
        const inactive = await prisma.service.findMany({ where: { adminId: targetAdminId, isActive: false } });
        console.log(`   -> Found ${inactive.length} INACTIVE services.`);
    }

    // 2. Fetch all users (to map IDs)
    // Note: 'User' table doesn't exist in this schema based on previous context, 
    // but we usually have 'Stylist', 'Customer', or maybe 'Admin' if it exists.
    // Checking schema... user mentioned 'register-admins.ts' so maybe there isn't a local Admin table?
    // Let's check 'Stylist' as they are staff.

    // Wait, the schema view previously showed 'User' routes but I might not have 'User' model visible in recent snippets.
    // Let's check for unique IDs in the services list to suggest valid Admin IDs.

    const uniqueAdminIds = [...new Set(services.map(s => s.adminId).filter(Boolean))];
    console.log(`\n🔑 Unique AdminIDs found in Services:`, uniqueAdminIds);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
