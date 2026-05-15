import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_EMAIL = 'mohan@gmail.com';

async function checkCustomer() {
    try {
        console.log(`🔍 Checking Customer table for: ${TEST_EMAIL}`);

        const customer = await prisma.customer.findFirst({
            where: { email: TEST_EMAIL }
        });

        if (customer) {
            console.log('✅ Found Customer:');
            console.log(customer);
        } else {
            console.log('❌ Customer NOT found in local DB.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkCustomer();
