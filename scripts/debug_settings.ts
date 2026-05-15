
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔍 Fetching all Settings...');
        const settings = await prisma.settings.findMany();

        console.log(`Found ${settings.length} settings records.`);

        for (const setting of settings) {
            console.log('------------------------------------------------');
            console.log(`🆔 Admin ID: "${setting.adminId}"`);
            console.log(`� Auth ID: "${setting.authId}"`);
            console.log(`🔑 Legacy Razorpay Key ID: ${setting.razorpayKeyId}`);

            if (setting.activePaymentMethods === null) {
                console.log('🔴 Active Payment Methods is NULL');
            } else {
                console.log(`� Active Payment Methods Value:`);
                console.log(JSON.stringify(setting.activePaymentMethods, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
