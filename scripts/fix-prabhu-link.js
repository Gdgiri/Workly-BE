const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const authId = '6e58109f-f64c-438e-8ff7-54e6dbb58788';
    const adminId = 'be9be1e7-f338-4c94-8887-4027928e1833';
    const id = require('crypto').randomUUID();

    console.log('Running Safe Minimal SQL Fix for Prabhu...');

    try {
        const result = await prisma.$executeRaw`
            INSERT INTO \`stylists\` 
            (id, authId, adminId, name, email, createdAt, updatedAt)
            VALUES 
            (${id}, ${authId}, ${adminId}, 'prabhu', 'prabhu@gmail.com', NOW(), NOW())
        `;
        console.log('✅ Success! Rows affected:', result);
    } catch (e) {
        console.error('❌ SQL Fix Failed:', e.message);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
