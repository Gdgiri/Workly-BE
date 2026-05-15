import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('Starting migration...');
    try {
        const allSettings = await prisma.settings.findMany();
        console.log(`Found ${allSettings.length} settings records.`);

        for (const settings of allSettings) {
            // Use explicit casting to access columns even if TS definitions are old/new (runtime matters)
            const keyId = (settings as any).paymentRazorpayKeyId;
            const keySecret = (settings as any).paymentRazorpayKeySecret;

            console.log(`Processing admin ${settings.adminId}, Settings ID ${settings.id}`);

            if (keyId || keySecret) {
                console.log(`Found deprecated keys: KeyID=${keyId ? 'YES' : 'NO'}, Secret=${keySecret ? 'YES' : 'NO'}`);

                let activeMethods = (settings.activePaymentMethods as any) || [];

                // Handle potential string format (though Prisma usually parses Json)
                if (typeof activeMethods === 'string') {
                    try { activeMethods = JSON.parse(activeMethods); } catch (e) { activeMethods = []; }
                }

                if (!Array.isArray(activeMethods)) {
                    console.warn(`activePaymentMethods is not an array for ${settings.id}. Skipping.`);
                    continue;
                }

                // Find razorpay item
                let razorpay = activeMethods.find((m: any) => m.name === 'razorpay' || m.name === 'razor');

                if (razorpay) {
                    console.log(`Found razorpay method in JSON. Updating credentials.`);

                    // Only update if value exists in column (don't overwrite with null)
                    if (keyId) razorpay.url = keyId;
                    if (keySecret) razorpay.secretKey = keySecret;

                    // Update the record
                    await prisma.settings.update({
                        where: { id: settings.id },
                        data: { activePaymentMethods: activeMethods }
                    });
                    console.log(`Successfully updated activePaymentMethods for ${settings.id}`);
                } else {
                    console.log(`Razorpay entry not found in activePaymentMethods. Skipping injection.`);
                }
            } else {
                console.log(`No deprecated keys found for this record.`);
            }
        }
    } catch (error) {
        console.error('Migration failed:', error);
    }
    console.log('Migration complete.');
}

migrate()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
