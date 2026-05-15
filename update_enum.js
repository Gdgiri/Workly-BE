const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Safe alteration of enum in MySQL
        const sql = `ALTER TABLE payments MODIFY COLUMN paymentMethod ENUM('CASH','CARD','UPI','WALLET','RAZORPAY','BANK_TRANSFER','PACKAGE','GPAY','PHONEPE','PAYTM','ONLINEPAY') NOT NULL`;
        await prisma.$executeRawUnsafe(sql);
        console.log('ENUM UPDATED SUCCESSFULLY');
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
