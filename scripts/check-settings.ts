import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndInsertSettings() {
    try {
        console.log('🔍 Checking Settings table...');

        // Check if settings exist for admin-1
        const existing = await prisma.settings.findUnique({
            where: { adminId: 'admin-1' }
        });

        if (existing) {
            console.log('✅ Found existing settings:');
            console.log('  - Admin ID:', existing.adminId);
            console.log('  - Razorpay Key ID:', existing.razorpayKeyId);
            console.log('  - Has Key Secret:', !!existing.razorpayKeySecret);
            console.log('  - Key Secret length:', existing.razorpayKeySecret?.length || 0);
        } else {
            console.log('❌ No settings found for admin-1');
            console.log('📝 Creating settings with Razorpay credentials...');

            const newSettings = await prisma.settings.create({
                data: {
                    adminId: 'admin-1',
                    razorpayKeyId: 'rzp_test_Rn1nYClyGO1MU8',
                    razorpayKeySecret: '7SgfzRSL0biOc39A3yxoOwql',
                }
            });

            console.log('✅ Settings created successfully!');
            console.log('  - ID:', newSettings.id);
        }

        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

checkAndInsertSettings();
