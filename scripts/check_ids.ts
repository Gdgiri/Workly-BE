
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_AUTH_ID = 'c3d14ddf-9da1-4464-b7ae-5a2f92f2d046';

async function main() {
    console.log(`🔍 Checking IDs for Auth ID: ${TARGET_AUTH_ID}...`);

    const user = await prisma.user.findUnique({
        where: { authId: TARGET_AUTH_ID },
    });

    if (!user) {
        console.error('❌ User not found!');
        return;
    }

    console.log('👤 User Details:', {
        id: user.id,          // The DB UUID
        authId: user.authId,  // The Auth ID
        role: user.role,
    });

    if (user.id !== user.authId) {
        console.log('⚠️ ID MISMATCH DETECTED (Expected if using UUIDs)');
        console.log(`- System might be querying by DB ID: ${user.id}`);
        console.log(`- Data might be stored with Auth ID: ${user.authId}`);
    } else {
        console.log('✅ IDs match (rare for UUID setup)');
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
