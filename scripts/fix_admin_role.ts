
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_AUTH_ID = 'c3d14ddf-9da1-4464-b7ae-5a2f92f2d046';

async function main() {
    console.log(`🔍 Checking user with Auth ID: ${TARGET_AUTH_ID}...`);

    const user = await prisma.user.findUnique({
        where: { authId: TARGET_AUTH_ID },
    });

    if (!user) {
        console.error('❌ User not found!');
        return;
    }

    console.log('👤 Current User Status:', {
        id: user.id,
        role: user.role,
        isActive: user.isActive,
        approvalStatus: user.approvalStatus,
    });

    if (user.role === 'ADMIN') {
        console.log('✅ User is already an ADMIN. No changes needed.');
        return;
    }

    console.log('🔄 Updating user role to ADMIN...');

    const updatedUser = await prisma.user.update({
        where: { authId: TARGET_AUTH_ID },
        data: {
            role: 'ADMIN',
            isActive: true,
            approvalStatus: 'APPROVED', // Ensure they are approved if that was also an issue
        },
    });

    console.log('✅ User updated successfully:', {
        id: updatedUser.id,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        approvalStatus: updatedUser.approvalStatus,
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
