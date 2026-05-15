import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateExistingCustomers() {
    try {
        console.log('🔍 Finding customers without adminId...');

        // Find all customers without adminId
        const customersWithoutAdmin = await prisma.customer.findMany({
            where: {
                adminId: null
            }
        });

        console.log(`Found ${customersWithoutAdmin.length} customers without adminId`);

        if (customersWithoutAdmin.length === 0) {
            console.log('✅ All customers already have adminId set');
            return;
        }

        // For now, we'll need to manually assign them or use a default admin
        // Let's find the first admin user
        const firstAdmin = await prisma.user.findFirst({
            where: {
                role: 'ADMIN'
            }
        });

        if (!firstAdmin) {
            console.log('⚠️ No admin user found in database');
            console.log('Please create an admin user first or manually update customer adminId values');
            return;
        }

        console.log(`Using admin: ${firstAdmin.authId} as default for existing customers`);

        // Update all customers without adminId to use the first admin
        const result = await prisma.customer.updateMany({
            where: {
                adminId: null
            },
            data: {
                adminId: firstAdmin.authId
            }
        });

        console.log(`✅ Updated ${result.count} customers with adminId: ${firstAdmin.authId}`);

    } catch (error) {
        console.error('❌ Error updating customers:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateExistingCustomers();
