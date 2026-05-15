const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`SHOW COLUMNS FROM payments LIKE 'paymentMethod'`;
        console.log('ENUM DETAILS:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
